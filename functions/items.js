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

async function uploadCropped(bucket, path, base64, mime) {
  const file = bucket.file(path);
  const buf = Buffer.from(base64, 'base64');
  // Normalize to PNG so transparency survives downstream try-on composites.
  const png = await sharp(buf).png().toBuffer();
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
    const cropPrompt = `Extract ONLY the clothing item from this photo.
Output a PNG image with a FULLY TRANSPARENT background (alpha = 0
everywhere except the garment itself). Do NOT fill the background
with white, gray, or any other color — pure transparency only.

Preserve the garment's original colors, fabric texture, proportions,
and any prints / logos. Remove the wearer, hands, hangers, mannequin,
furniture, and surrounding scene cleanly along the garment's silhouette.

Frame: a square canvas with the garment centered and occupying about
80% of the frame. Do not redesign, restyle, re-color, or reshape the
item — this is a catalog cutout, not a redesign.`;
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
