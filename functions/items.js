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
  "name":        short 2-4 word display title (e.g. "Cream linen trousers", "Black wool cardigan", "Navy bomber jacket"). Color + material/garment, no brand. Title case,
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
    // Display title — surfaced on the item card and detail page. Auto-set
    // only when the user hasn't typed their own; see processItem patch.
    name:        typeof raw.name === 'string' ? raw.name.slice(0, 60) : null,
  };
}

// Take the LAST inline image returned, not the first — Gemini Image
// echoes the input photos back in the response parts and the actual
// generated output is appended at the end. See identical fix in
// functions/tryon.js for the full backstory.
function extractImage(response) {
  const parts = response?.candidates?.[0]?.content?.parts || [];
  let last = null;
  for (const p of parts) {
    if (p.inlineData?.data) {
      last = { data: p.inlineData.data, mimeType: p.inlineData.mimeType || 'image/png' };
    }
  }
  return last;
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
  const keyed = await chromaKeyToTransparent(await sharp(raw).png().toBuffer());
  // Trim transparent (and uniform-color) edges so the stored PNG is a
  // tight bbox of the actual subject. This makes thumbnails render at
  // a consistent size regardless of how much whitespace the source
  // photo had around the person / garment, and shrinks the file too.
  let png;
  try {
    png = await sharp(keyed).trim({ threshold: 10 }).png().toBuffer();
  } catch (e) {
    console.warn('trim failed, using untrimmed:', e?.message);
    png = keyed;
  }
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
    const { itemId, focus = null } = request.data || {};
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
    // Pro model preserves the silhouette far better than Flash for this
    // task. Flash kept reinterpreting long pants as shorts, cropping
    // sleeves, etc. The cost trade-off is worth it for first-impression
    // catalog quality.
    const cropModel = genai.getGenerativeModel({ model: IMAGE_PRO });
    // IMPORTANT: do NOT ask the image model for a transparent background
    // directly — Nano Banana families re-generate the subject when given
    // "transparent PNG" instructions and sometimes change the garment's
    // shape (e.g. long pants → shorts). The original-quality crop works
    // best on a flat white background; the alpha channel is added in
    // post by chromaKeyToTransparent() below before the file is saved.
    // When the caller knows specifically which piece to crop (e.g. detect-
    // flow add: source photo has a top + bottom + shoes and the user picked
    // the top), pass focus so the prompt can disambiguate. Otherwise the
    // model picks the most prominent garment.
    const focusClause = focus?.category || focus?.description
      ? `\n\nIMPORTANT — this photo contains MULTIPLE clothing items. Extract \
ONLY the ${focus.category || 'item'}${focus.description ? ` ("${focus.description}")` : ''}. \
Ignore all other clothing the person is wearing.\n`
      : '';
    const cropPrompt = `Extract ONLY the item from this photo and present it
in the standard catalog product view for its category:
- Clothing (tops, bottoms, dresses, outerwear): axis-vertical, front-on,
  as if photographed from directly above on a flat surface or worn on
  an invisible body. Top of the garment at the top of the frame, hem
  at the bottom. Symmetric and centered.
- Shoes: clean side profile (right shoe facing right). If a pair, show
  the pair from the same angle.
- Bags: upright, frontal, handles up.
- Accessories (hats, jewelry, belts, glasses): centered, in the angle
  that shows the design most clearly.

You MAY rotate, flatten, and re-orient the item to achieve this view.
You may NOT change length, silhouette, proportions, color, fabric
texture, prints, or design — preserve all of those EXACTLY as in the
input. Do not turn pants into shorts, do not crop sleeves, do not
re-fit the garment.

Place the item centered on a fully white background, occupying ~80%
of a square frame. Remove the wearer, hangers, mannequin, bed sheets,
floor, and surrounding scene. This is a faithful catalog cutout, not
a redesign.`;
    const cropPromise = cropModel.generateContent([
      { inlineData: { data: originalB64, mimeType: mime } },
      { text: cropPrompt + focusClause },
    ]).catch(err => ({ __error: err }));

    // ── Auto-tag (parallel) ────────────────────────────────────────────
    // CRITICAL: when this call came from the detect-add path (i.e. focus
    // is set), the user already picked a specific item from a MULTI-item
    // photo and the detect step gave us correct tags for that item. The
    // source `originalPath` here is the WHOLE photo (sneakers + shorts +
    // top etc.) — re-running tagPrompt on that returns whichever piece
    // dominates the frame and OVERWRITES the user's intended tags. We
    // skip the tag step entirely in that case and trust detect's tags.
    let tagPromise = Promise.resolve(null);
    if (!focus) {
      const visionModel = genai.getGenerativeModel({
        model: VISION,
        generationConfig: { responseMimeType: 'application/json' },
      });
      tagPromise = visionModel.generateContent([
        { inlineData: { data: originalB64, mimeType: mime } },
        { text: tagPrompt() },
      ]).catch(err => ({ __error: err }));
    }

    const [cropRes, tagRes] = await Promise.all([cropPromise, tagPromise]);

    // ── Crop result ────────────────────────────────────────────────────
    let croppedUrl = null;
    let croppedPath = null;
    if (cropRes?.response) {
      const img = extractImage(cropRes.response);
      if (img) {
        // Versioned path: each reprocess writes a fresh file so the
        // immutable cache header doesn't make browsers/CDN keep
        // serving the old crop. Old versions stay in storage as
        // orphans (cleaned up by a scheduled job later).
        croppedPath = `items/${uid}/${itemId}/cropped-${Date.now()}.png`;
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
      // Detect-add path (focus) already has authoritative tags + name +
      // a usable original photo, so the item is 'ready' even if our
      // best-effort crop fails. Single-item add still needs at least
      // one of crop or tag to succeed.
      status: (croppedUrl || tags || focus) ? 'ready' : 'failed',
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (croppedUrl)  { patch.croppedUrl = croppedUrl; patch.croppedPath = croppedPath; }
    if (tags)        { patch.tags = tags; }
    // Auto-populate the display name from Gemini only if the user
    // hasn't already typed one — never clobber a manual edit.
    if (tags?.name && !item.name) { patch.name = tags.name; }
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
  return `You are a fashion editor reading one photograph that may contain
one or more clothing pieces (on a person, hanger, or laid out). Return
ONLY valid JSON with this exact schema:

{
  "style":  "short 5-8 word style label (e.g. 'amekaji streetwear', 'minimal monochrome', 'y2k retro')",
  "mood":   "1-3 word vibe descriptor (e.g. 'relaxed weekend', 'sharp & polished', 'experimental layering')",
  "notes":  "2-4 sentence editorial reading of the look — what anchors it, how the pieces interact, the silhouette and proportions, what makes it feel cohesive (or deliberately not). Specific and observational, not generic.",
  "stylingTips": [
    "3 short actionable tips a viewer could use to recreate or reinterpret this look — e.g. 'swap the loafers for runner sneakers to soften the formality', 'try a longer overshirt to extend the line'. One tip per array entry, each 6-14 words"
  ],
  "palette": [
    { "hex": "#RRGGBB", "name": "lowercase color name", "percent": integer 0-100 },
    ... up to 3 entries, sorted by dominance, percents sum to ~100
  ],
  "composition": [
    { "label": one of [${TAXONOMY.STYLES.join(', ')}], "level": integer 0-5 },
    ... exactly 4 entries, the 4 most relevant style axes from the enum,
    level reflects how strongly the look reads as that style
  ],
  "items": [
    {
      "name":        short 2-4 word title (e.g. "Cream linen trousers", "Black wool cardigan", "Navy bomber jacket"). Color + material/garment, title case, no brand,
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
Skip skin, body parts, and identifying features of the wearer. Max 8
items. Palette percents should sum close to 100. Composition must use
exactly 4 entries from the enum. Use null/[] for any field you can't
determine. Avoid generic phrasing like 'effortlessly cool' or 'timeless
classic'.`;
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
    name: typeof raw.name === 'string' ? raw.name.slice(0, 60) : null,
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
    const cropPrompt = `Extract the ENTIRE person from this photo and place
them centered on a fully white background. The output is an identity
reference — a clean canvas of the person, NOT a snapshot of them with
their props.

CRITICAL FRAMING RULES:
- Include EVERYTHING from the TOP OF THE HEAD to the SOLES OF THE FEET.
- Do NOT crop the head, face, hair, hands, or feet under any circumstance.
- If the input photo is full-body, the output must remain full-body.
- If the input is a half-body shot, keep the same crop level — do NOT
  zoom in further on the torso.
- The person's silhouette must occupy the same vertical extent as in
  the input; just remove the surrounding room/wall/floor/furniture.

PRESERVE EXACTLY (do not retouch, restyle, reshape, re-fit, or modify):
- Face (every feature, identical).
- Hair (color, length, texture).
- Skin tone.
- Pose, height, body proportions.
- Clothing they are currently wearing.
- Worn accessories that sit ON the body: hats, glasses, earrings,
  necklaces, watches, rings, belts.

REMOVE (do NOT include in the output):
- Anything the person is HOLDING or CARRYING — bags, totes, backpacks,
  phones, bottles, umbrellas, drinks, cameras, shopping bags, leashes,
  etc. If a hand is holding an object, render an empty hand naturally
  in the same position. Do NOT invent a held object.
- Other people, pets, vehicles, furniture, or background props.

This is a faithful person-only cutout for identity reference, not a
lifestyle photo.`;

    let croppedUrl = null;
    let croppedPath = null;
    try {
      const res = await cropModel.generateContent([
        { inlineData: { data: base64, mimeType: mime } },
        { text: cropPrompt },
      ]);
      const img = extractImage(res?.response);
      if (img) {
        // Versioned suffix so reprocessing doesn't get blocked by the
        // immutable cache header on the storage URL.
        croppedPath = storagePath.replace(/\.(jpg|png)$/i, `-${Date.now()}.png`);
        croppedUrl = await uploadCropped(bucket, croppedPath, img.data, img.mimeType);
      }
    } catch (err) {
      console.warn('processIdentityRef crop failed:', err?.message);
      // Caller falls back to original on null URL.
    }

    return { ok: !!croppedUrl, url: croppedUrl, path: croppedPath };
  }
);

// Same person-cutout pipeline as processIdentityRef, but for OOTD
// photos. Output stored alongside the original at ootds/<uid>/<date>-
// cut-<timestamp>.png and the URL written back to the ootd doc as
// photoCutUrl / photoCutPath. The Calendar grid uses photoCutUrl when
// available so the figure stands out clean on the day cell instead of
// dragging the room/wall into the calendar.
exports.processOotdPhoto = onCall(
  { secrets: [geminiApiKey], cors: true, timeoutSeconds: 90, memory: '1GiB' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'AUTH_REQUIRED');
    const { ootdId } = request.data || {};
    if (!ootdId || typeof ootdId !== 'string') {
      throw new HttpsError('invalid-argument', 'ootdId required');
    }

    const db = admin.firestore();
    const ootdRef = db.collection('ootds').doc(ootdId);
    const snap = await ootdRef.get();
    if (!snap.exists) throw new HttpsError('not-found', 'ootd missing');
    const ootd = snap.data();
    if (ootd.userId !== uid) throw new HttpsError('permission-denied', 'not yours');
    if (!ootd.photoPath) throw new HttpsError('failed-precondition', 'no photo');

    const bucket = admin.storage().bucket();
    const buf = await downloadStorageObject(bucket, ootd.photoPath);
    const base64 = buf.toString('base64');
    const mime = ootd.photoPath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

    const genai = new GoogleGenerativeAI(geminiApiKey.value());
    const cropModel = genai.getGenerativeModel({ model: IMAGE_FLASH });
    // Identical prompt shape to processIdentityRef — same tradeoff
    // (Gemini Image re-draws pixels but tries hard to preserve every
    // listed attribute). Worn accessories AND the OUTFIT itself stay
    // since the photo IS the OOTD; held props go.
    const cropPrompt = `Extract the ENTIRE person from this photo and place
them centered on a fully white background. The output is a calendar
thumbnail of what they wore today — a clean canvas of the person,
NOT a snapshot of them in their environment.

CRITICAL FRAMING RULES:
- Include EVERYTHING from the TOP OF THE HEAD to the SOLES OF THE FEET.
- Do NOT crop the head, face, hair, hands, or feet under any circumstance.
- If the input photo is full-body, the output must remain full-body.
- If the input is a half-body shot, keep the same crop level — do NOT
  zoom in further on the torso.
- The person's silhouette must occupy the same vertical extent as in
  the input; just remove the surrounding room/wall/floor/furniture.

PRESERVE EXACTLY (do not retouch, restyle, reshape, re-fit, or modify):
- Face (every feature, identical).
- Hair (color, length, texture).
- Skin tone.
- Pose, height, body proportions.
- Clothing they are currently wearing (this IS the OOTD).
- Worn accessories that sit ON the body: hats, glasses, earrings,
  necklaces, watches, rings, belts, scarves, bags strapped over the
  shoulder.

REMOVE (do NOT include in the output):
- Anything the person is HOLDING or CARRYING in their hand — phones,
  bottles, drinks, umbrellas, shopping bags, cameras, leashes, etc.
  Render an empty hand naturally in the same position.
- Other people, pets, vehicles, furniture, or background props.

This is a faithful person-only cutout, not a redesign.`;

    let croppedUrl = null;
    let croppedPath = null;
    try {
      const res = await cropModel.generateContent([
        { inlineData: { data: base64, mimeType: mime } },
        { text: cropPrompt },
      ]);
      const img = extractImage(res?.response);
      if (img) {
        croppedPath = ootd.photoPath.replace(/\.(jpg|png)$/i, `-cut-${Date.now()}.png`);
        croppedUrl = await uploadCropped(bucket, croppedPath, img.data, img.mimeType);
        await ootdRef.update({
          photoCutUrl: croppedUrl,
          photoCutPath: croppedPath,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch (err) {
      console.warn('processOotdPhoto failed:', err?.message);
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
      const stylingTips = Array.isArray(parsed.stylingTips)
        ? parsed.stylingTips
            .filter(s => typeof s === 'string' && s.trim())
            .slice(0, 3)
            .map(s => s.slice(0, 160))
        : [];

      return {
        style: typeof parsed.style === 'string' ? parsed.style.slice(0, 120) : '',
        mood:  typeof parsed.mood  === 'string' ? parsed.mood.slice(0, 80)   : '',
        notes: typeof parsed.notes === 'string' ? parsed.notes.slice(0, 800) : '',
        stylingTips,
        palette: sanitizePalette(parsed.palette),
        composition: sanitizeComposition(parsed.composition),
        items,
      };
    } catch (err) {
      console.warn('detectItems failed:', err?.message);
      throw new HttpsError('internal', err?.message || 'detect_failed');
    }
  }
);
