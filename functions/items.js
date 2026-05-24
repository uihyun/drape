// === processItem =======================================================
// Background-remove an uploaded clothing photo and auto-tag it.
//
// Called by item-service.js right after a user snaps a new item. The user
// already sees a 'processing' skeleton card in their closet; this function
// flips it to 'ready' with the cropped image + tag set.
//
// Two Gemini calls in parallel:
//   1. Nano Banana Pro (gemini-3-pro-image-preview) — "crop the garment,
//      transparent background" (or fall back to plain white if alpha lost)
//   2. Gemini vision (Flash by default — tagging is cheap & uniform) —
//      structured JSON output filling the taxonomy fields.

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const sharp = require('sharp');
const TAXONOMY = require('./taxonomy.js');

const geminiApiKey = defineSecret('GEMINI_API_KEY');

// Gemini model IDs as exposed by v1beta listModels (verified via curl).
// The earlier `gemini-3-flash-image-preview` was renamed to `3.1` — the
// old id 404s. Pro and the text-vision flash kept their names.
const IMAGE_PRO   = 'gemini-3-pro-image-preview';
const IMAGE_FLASH = 'gemini-3.1-flash-image-preview';
const VISION      = 'gemini-3-flash-preview';

// Reusable schema prompt for the auto-tag call. The model is told to pick
// from the closed vocab — anything off-list gets dropped at parse time.
function tagPrompt() {
  return `You are a fashion stylist tagging a single clothing item photo.
Return ONLY valid JSON matching this exact schema. Pick values strictly from
the provided enums; if uncertain, use null (not a guess).

{
  "category":    one of [${TAXONOMY.CATEGORIES.join(', ')}],
  "subcategory": one of the subcategories valid for the chosen category,
  "colors":      array of 1-3 from [${TAXONOMY.COLORS.join(', ')}],
  "seasons":     array of 1-4 from [${TAXONOMY.SEASONS.join(', ')}],
  "styles":      array of 1-2 from [${TAXONOMY.STYLES.join(', ')}],
  "fit":         one of [${TAXONOMY.FITS.join(', ')}, null],
  "description": short 1-sentence English description for search,
  "brand":       a brand name if clearly visible on the garment, else null
}`;
}

function safeParseJson(text) {
  try {
    const fenced = text.match(/```json\n([\s\S]*?)\n```/);
    return JSON.parse(fenced ? fenced[1] : text);
  } catch {
    return null;
  }
}

// Restrict the parsed object to the closed vocabulary so a hallucinated tag
// never lands in Firestore. Anything off-list → null / [].
function sanitizeTags(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const inEnum = (val, enums) => enums.includes(val) ? val : null;
  const inEnumArr = (arr, enums) => Array.isArray(arr)
    ? Array.from(new Set(arr.filter(x => enums.includes(x))))
    : [];
  const category = inEnum(raw.category, TAXONOMY.CATEGORIES);
  const subEnum = (category && TAXONOMY.SUBCATEGORIES[category]) || [];
  return {
    category,
    subcategory: inEnum(raw.subcategory, subEnum),
    colors:      inEnumArr(raw.colors,  TAXONOMY.COLORS).slice(0, 3),
    seasons:     inEnumArr(raw.seasons, TAXONOMY.SEASONS).slice(0, 4),
    styles:      inEnumArr(raw.styles,  TAXONOMY.STYLES).slice(0, 2),
    fit:         inEnum(raw.fit,        TAXONOMY.FITS),
    description: typeof raw.description === 'string' ? raw.description.slice(0, 240) : '',
    brand:       typeof raw.brand === 'string' ? raw.brand.slice(0, 60) : null,
  };
}

function extractImage(response) {
  const parts = response?.candidates?.[0]?.content?.parts || [];
  for (const p of parts) {
    if (p.inlineData?.data) {
      return { data: p.inlineData.data, mimeType: p.inlineData.mimeType || 'image/png' };
    }
  }
  return null;
}

async function downloadStorageObject(bucket, path) {
  const file = bucket.file(path);
  const [buf] = await file.download();
  return buf;
}

/**
 * If Gemini handed back an image with a uniform near-white background,
 * key it out so the saved PNG has true transparency. The model usually
 * complies with our "transparent PNG" prompt for new requests, but the
 * fallback path catches cases where it returns a flat-bg JPEG/PNG.
 *
 * Approach: sample edge pixels to learn the bg color; if the center
 * differs enough (i.e. the garment isn't itself near-white-on-white),
 * walk the raster and convert pixels close to that bg color to alpha=0
 * with a feathered band on the edge to avoid hard halos.
 *
 * Skipped when the whole frame is roughly one color — that's the
 * white-shirt-on-white case where keying would punch a hole in the
 * garment.
 */
async function chromaKeyToTransparent(buf) {
  try {
    const img = sharp(buf).ensureAlpha();
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;
    if (channels !== 4) return buf;

    // Sample 12 edge points for bg color.
    const ePts = [
      [0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1],
      [Math.floor(width / 2), 0], [Math.floor(width / 2), height - 1],
      [0, Math.floor(height / 2)], [width - 1, Math.floor(height / 2)],
      [Math.floor(width / 4), 0], [Math.floor((3 * width) / 4), 0],
      [Math.floor(width / 4), height - 1], [Math.floor((3 * width) / 4), height - 1],
    ];
    const avg = (pts) => {
      let r = 0, g = 0, b = 0;
      for (const [x, y] of pts) {
        const i = (y * width + x) * 4;
        r += data[i]; g += data[i + 1]; b += data[i + 2];
      }
      return [r / pts.length, g / pts.length, b / pts.length];
    };
    const [bgR, bgG, bgB] = avg(ePts);

    // If bg isn't bright, the catalog crop didn't give us a clean
    // backdrop — bail and keep the original.
    if ((bgR + bgG + bgB) / 3 < 200) return buf;

    // Sanity: if the center is also near the bg color, the garment is
    // probably similar (white-on-white) — keying would damage it.
    const cPts = [
      [Math.floor(width / 2), Math.floor(height / 2)],
      [Math.floor(width / 3), Math.floor(height / 2)],
      [Math.floor((2 * width) / 3), Math.floor(height / 2)],
      [Math.floor(width / 2), Math.floor(height / 3)],
      [Math.floor(width / 2), Math.floor((2 * height) / 3)],
    ];
    const [cR, cG, cB] = avg(cPts);
    const centerDist = Math.sqrt((cR - bgR) ** 2 + (cG - bgG) ** 2 + (cB - bgB) ** 2);
    if (centerDist < 25) return buf;

    const THRESH = 38; // hard transparent boundary
    const FEATHER = 18; // soft fade band beyond the boundary

    const out = Buffer.from(data);
    for (let i = 0; i < out.length; i += 4) {
      // Skip pixels Gemini already marked transparent.
      if (out[i + 3] === 0) continue;
      const dr = out[i] - bgR;
      const dg = out[i + 1] - bgG;
      const db = out[i + 2] - bgB;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      if (dist < THRESH) {
        out[i + 3] = 0;
      } else if (dist < THRESH + FEATHER) {
        out[i + 3] = Math.round(((dist - THRESH) / FEATHER) * 255);
      }
    }
    return await sharp(out, { raw: { width, height, channels } }).png().toBuffer();
  } catch (e) {
    console.warn('chromaKey failed, returning original:', e?.message);
    return buf;
  }
}

async function uploadCropped(bucket, path, base64, mime) {
  const file = bucket.file(path);
  const raw = Buffer.from(base64, 'base64');
  // Belt-and-suspenders: model is asked for transparent PNG, but if it
  // returns flat-bg we chroma-key the bg color out ourselves.
  const png = await chromaKeyToTransparent(await sharp(raw).png().toBuffer());
  await file.save(png, {
    metadata: {
      contentType: 'image/png',
      cacheControl: 'public,max-age=31536000,immutable',
    },
  });
  await file.makePublic().catch(() => { /* ignore — signed URL fallback below */ });
  return `https://storage.googleapis.com/${bucket.name}/${path}`;
}

/**
 * processItem callable — called from item-service.createItem after upload.
 *   request.data: { itemId }
 *   response:     { ok: true, tags, croppedUrl }
 */
exports.processItem = onCall(
  { secrets: [geminiApiKey], cors: true, timeoutSeconds: 120, memory: '1GiB' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'sign in required');
    const { itemId } = request.data || {};
    if (!itemId) throw new HttpsError('invalid-argument', 'itemId required');

    const db = admin.firestore();
    const docRef = db.collection('items').doc(itemId);
    const snap = await docRef.get();
    if (!snap.exists) throw new HttpsError('not-found', 'item missing');
    const item = snap.data();
    if (item.userId !== uid) throw new HttpsError('permission-denied', 'not owner');
    if (!item.originalPath) throw new HttpsError('failed-precondition', 'no original');

    const bucket = admin.storage().bucket();
    const original = await downloadStorageObject(bucket, item.originalPath);
    const originalB64 = original.toString('base64');
    const mime = 'image/jpeg';

    const genai = new GoogleGenerativeAI(geminiApiKey.value());

    // ── Crop ───────────────────────────────────────────────────────────
    // Nano Banana Pro is overkill for a clean catalog crop most of the
    // time; start with Flash and let admins re-run with Pro if needed.
    const cropModel = genai.getGenerativeModel({ model: IMAGE_FLASH });
    // IMPORTANT: do NOT ask the image model for a transparent background
    // directly — Nano Banana families re-generate the subject when given
    // "transparent PNG" instructions and sometimes change the garment's
    // shape (e.g. long pants → shorts). The original-quality crop works
    // best on a flat white background; the alpha channel is added in
    // post by chromaKeyToTransparent() below before the file is saved.
    const cropPrompt = `Extract ONLY the clothing item from this photo. Place
it centered on a fully white background, preserving original colors,
fabric texture, proportions, prints, and length EXACTLY as in the
input. Remove the wearer, hangers, mannequin, and surrounding scene.
Output a square crop with the garment occupying ~80% of the frame.
Do not redesign, restyle, re-color, re-fit, or reshape the item — do
not turn pants into shorts, do not crop sleeves, do not change the
silhouette. This is a faithful catalog cutout, not a redesign.`;
    const cropPromise = cropModel.generateContent([
      { inlineData: { data: originalB64, mimeType: mime } },
      { text: cropPrompt },
    ]).catch(err => ({ __error: err }));

    // ── Auto-tag (parallel) ────────────────────────────────────────────
    const visionModel = genai.getGenerativeModel({
      model: VISION,
      generationConfig: { responseMimeType: 'application/json' },
    });
    const tagPromise = visionModel.generateContent([
      { inlineData: { data: originalB64, mimeType: mime } },
      { text: tagPrompt() },
    ]).catch(err => ({ __error: err }));

    const [cropRes, tagRes] = await Promise.all([cropPromise, tagPromise]);

    // ── Crop result ────────────────────────────────────────────────────
    let croppedUrl = null;
    let croppedPath = null;
    if (cropRes?.response) {
      const img = extractImage(cropRes.response);
      if (img) {
        croppedPath = `items/${uid}/${itemId}/cropped.png`;
        croppedUrl = await uploadCropped(bucket, croppedPath, img.data, img.mimeType);
      }
    } else if (cropRes?.__error) {
      console.warn('crop failed', cropRes.__error.message);
    }

    // ── Tag result ─────────────────────────────────────────────────────
    let tags = null;
    if (tagRes?.response) {
      const text = tagRes.response.text();
      tags = sanitizeTags(safeParseJson(text));
    } else if (tagRes?.__error) {
      console.warn('tag failed', tagRes.__error.message);
    }

    const patch = {
      status: croppedUrl || tags ? 'ready' : 'failed',
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (croppedUrl)  { patch.croppedUrl = croppedUrl; patch.croppedPath = croppedPath; }
    if (tags)        { patch.tags = tags; }
    await docRef.update(patch);

    return { ok: true, tags, croppedUrl };
  }
);

// detectItems: vision-only analysis of an arbitrary photo (OOTD selfie,
// stranger's photo, magazine shot). Returns a short style label plus a
// list of clothing pieces visible in the image, each with category/
// colors/description/brand-guess from the closed taxonomy. The client
// builds "Add to closet" / "Find similar" affordances on top.
//
// No cropping per detected piece here — Gemini's bbox accuracy isn't
// good enough for clean cutouts yet, and we don't want to ship visibly
// bad crops. The source photo is reused as a thumbnail when a detected
// piece is added to the closet.
function detectPrompt() {
  return `You are a fashion analyst looking at one photograph that may contain
one or more clothing pieces (on a person, hanger, or laid out). Return
ONLY valid JSON with this exact schema:

{
  "style": "short 5-8 word style label (e.g. 'amekaji streetwear', 'minimal monochrome', 'y2k retro')",
  "notes": "one sentence describing the overall look",
  "items": [
    {
      "category":    one of [${TAXONOMY.CATEGORIES.join(', ')}],
      "subcategory": one of the subcategories valid for that category,
      "colors":      array of 1-3 from [${TAXONOMY.COLORS.join(', ')}],
      "description": 4-12 word english description of this specific piece,
      "brand":       brand name if clearly visible (logo / hangtag), else null,
      "searchQuery": 3-8 word search query that would find this piece online
    }
  ]
}

Rules: only describe garments and accessories that are clearly visible.
Skip skin, body parts, and background. Max 8 items. Use null for any
field you can't determine.`;
}

function sanitizeDetectItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const cat = TAXONOMY.CATEGORIES.includes(raw.category) ? raw.category : null;
  const sub = (cat && TAXONOMY.SUBCATEGORIES[cat] || []).includes(raw.subcategory)
    ? raw.subcategory
    : null;
  const colors = Array.isArray(raw.colors)
    ? Array.from(new Set(raw.colors.filter(c => TAXONOMY.COLORS.includes(c)))).slice(0, 3)
    : [];
  return {
    category: cat,
    subcategory: sub,
    colors,
    description: typeof raw.description === 'string' ? raw.description.slice(0, 240) : '',
    brand: typeof raw.brand === 'string' ? raw.brand.slice(0, 60) : null,
    searchQuery: typeof raw.searchQuery === 'string' ? raw.searchQuery.slice(0, 160) : '',
  };
}

// analyzeOotd: read a daily-outfit photo and return an editorial
// breakdown — dominant color palette, "aesthetic composition" levels
// across our STYLES taxonomy, a short notes-on-composition string,
// and a poetic 3-7 word title. Called from OotdService.upsertOotd
// right after the photo is saved so the OotdDetail page has rich
// content to render without a second user step.
function ootdAnalysisPrompt() {
  return `You are a fashion editor reading one full-body outfit photo
("OOTD" — what someone wore today). Return ONLY valid JSON with this
exact schema:

{
  "title": "3-7 word poetic title for this look (English)",
  "palette": [
    { "hex": "#RRGGBB", "name": "lowercase color name", "percent": integer 0-100 },
    ... up to 3 entries, sorted by dominance, percents sum to ~100
  ],
  "composition": [
    { "label": one of [${TAXONOMY.STYLES.join(', ')}], "level": integer 0-5 },
    ... 4 entries, pick the 4 most relevant style axes from the list,
    levels reflect how strongly this look reads as that style
  ],
  "notes": "1-3 sentence English reading of the look — what anchors it,
  how the pieces interact, the overall mood. Editorial tone, not
  generic. Avoid clichés."
}

Rules: only describe what's visible. Skip the wearer's identity / face.
Percentages of palette entries should sum close to 100. Composition
must use exactly 4 entries from the enum.`;
}

function sanitizePalette(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const c of raw.slice(0, 3)) {
    if (!c || typeof c !== 'object') continue;
    const hex = typeof c.hex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(c.hex.trim())
      ? c.hex.trim().toUpperCase() : null;
    if (!hex) continue;
    out.push({
      hex,
      name: typeof c.name === 'string' ? c.name.toLowerCase().slice(0, 32) : '',
      percent: Math.max(0, Math.min(100, Math.round(Number(c.percent) || 0))),
    });
  }
  return out;
}

function sanitizeComposition(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const c of raw.slice(0, 6)) {
    if (!c || typeof c !== 'object') continue;
    if (!TAXONOMY.STYLES.includes(c.label)) continue;
    out.push({
      label: c.label,
      level: Math.max(0, Math.min(5, Math.round(Number(c.level) || 0))),
    });
  }
  return out;
}

exports.analyzeOotd = onCall(
  { secrets: [geminiApiKey], cors: true, timeoutSeconds: 60, memory: '512MiB' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'AUTH_REQUIRED');
    const { ootdId } = request.data || {};
    if (!ootdId || typeof ootdId !== 'string') {
      throw new HttpsError('invalid-argument', 'ootdId required');
    }

    const ootdRef = admin.firestore().collection('ootds').doc(ootdId);
    const snap = await ootdRef.get();
    if (!snap.exists) throw new HttpsError('not-found', 'ootd missing');
    const ootd = snap.data();
    if (ootd.userId !== uid) throw new HttpsError('permission-denied', 'not yours');
    if (!ootd.photoPath) throw new HttpsError('failed-precondition', 'no photo');

    const bucket = admin.storage().bucket();
    const buf = await downloadStorageObject(bucket, ootd.photoPath);
    const base64 = buf.toString('base64');

    const genAI = new GoogleGenerativeAI(geminiApiKey.value());
    const model = genAI.getGenerativeModel({
      model: VISION,
      generationConfig: { responseMimeType: 'application/json' },
    });

    try {
      const res = await model.generateContent([
        { inlineData: { data: base64, mimeType: 'image/jpeg' } },
        { text: ootdAnalysisPrompt() },
      ]);
      const parsed = safeParseJson(res?.response?.text() || '');
      if (!parsed) throw new HttpsError('internal', 'parse_failed');

      const patch = {
        title: typeof parsed.title === 'string' ? parsed.title.slice(0, 120) : '',
        palette: sanitizePalette(parsed.palette),
        composition: sanitizeComposition(parsed.composition),
        notes: typeof parsed.notes === 'string' ? parsed.notes.slice(0, 600) : '',
        analyzedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      await ootdRef.update(patch);
      return { ok: true, ...patch, analyzedAt: undefined, updatedAt: undefined };
    } catch (err) {
      console.warn('analyzeOotd failed:', err?.message);
      throw new HttpsError('internal', err?.message || 'analyze_failed');
    }
  }
);

// Identity reference background removal. Same crop pipeline pattern
// as processItem but tuned for a person: isolate the human silhouette
// (face, hair, body, hands), output transparent PNG. Try-on then
// composites garments on a clean cutout without dragging the original
// room/wall/floor along.
exports.processIdentityRef = onCall(
  { secrets: [geminiApiKey], cors: true, timeoutSeconds: 90, memory: '1GiB' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'AUTH_REQUIRED');
    const { storagePath } = request.data || {};
    if (!storagePath || typeof storagePath !== 'string') {
      throw new HttpsError('invalid-argument', 'storagePath required');
    }
    if (!storagePath.startsWith(`identity/${uid}/`)) {
      throw new HttpsError('permission-denied', 'not your ref');
    }

    const bucket = admin.storage().bucket();
    const buf = await downloadStorageObject(bucket, storagePath);
    const mime = storagePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
    const base64 = buf.toString('base64');

    const genai = new GoogleGenerativeAI(geminiApiKey.value());
    const cropModel = genai.getGenerativeModel({ model: IMAGE_FLASH });
    // Same trick as processItem — model crops on white bg, chroma-key
    // does the alpha. Asking for "transparent PNG" directly causes the
    // model to redraw the person and lose detail.
    const cropPrompt = `Extract ONLY the person from this photo — full body,
including face, hair, clothing they're wearing, hands, and any small
items they're holding. Place the person centered on a fully white
background. Remove the wall, floor, furniture, and surrounding scene.

Preserve the person's appearance, pose, clothing, height, and body
proportions EXACTLY as in the input. Do not retouch, restyle, reshape,
re-fit, change clothing, or modify the body. This is a faithful
photo cutout, not a redesign.`;

    let croppedUrl = null;
    let croppedPath = null;
    try {
      const res = await cropModel.generateContent([
        { inlineData: { data: base64, mimeType: mime } },
        { text: cropPrompt },
      ]);
      const img = extractImage(res?.response);
      if (img) {
        // Overwrite the same path with the cutout PNG so existing refs
        // in identityRefs[] still point at the right blob.
        croppedPath = storagePath.replace(/\.jpg$/i, '.png');
        croppedUrl = await uploadCropped(bucket, croppedPath, img.data, img.mimeType);
      }
    } catch (err) {
      console.warn('processIdentityRef crop failed:', err?.message);
      // Caller falls back to original on null URL.
    }

    return { ok: !!croppedUrl, url: croppedUrl, path: croppedPath };
  }
);

exports.detectItems = onCall(
  { secrets: [geminiApiKey], cors: true, timeoutSeconds: 60, memory: '512MiB' },
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'AUTH_REQUIRED');
    const { photoBase64, mime = 'image/jpeg' } = request.data || {};
    if (!photoBase64 || typeof photoBase64 !== 'string') {
      throw new HttpsError('invalid-argument', 'photoBase64 required');
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey.value());
    const model = genAI.getGenerativeModel({ model: VISION });

    try {
      const res = await model.generateContent([
        { inlineData: { data: photoBase64, mimeType: mime } },
        { text: detectPrompt() },
      ]);
      const text = res?.response?.text() || '';
      const parsed = safeParseJson(text);
      if (!parsed) throw new HttpsError('internal', 'parse_failed');

      const items = Array.isArray(parsed.items)
        ? parsed.items.map(sanitizeDetectItem).filter(Boolean).slice(0, 8)
        : [];

      return {
        style: typeof parsed.style === 'string' ? parsed.style.slice(0, 120) : '',
        notes: typeof parsed.notes === 'string' ? parsed.notes.slice(0, 400) : '',
        items,
      };
    } catch (err) {
      console.warn('detectItems failed:', err?.message);
      throw new HttpsError('internal', err?.message || 'detect_failed');
    }
  }
);
