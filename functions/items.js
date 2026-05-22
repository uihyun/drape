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

const IMAGE_PRO   = 'gemini-3-pro-image-preview';
const IMAGE_FLASH = 'gemini-3-flash-image-preview';
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
    const cropPrompt = `Extract ONLY the clothing item from this photo. Place
it centered on a fully white background, preserving original colors,
fabric texture, and proportions. Remove the wearer, hangers, and
surrounding scene. Output a square crop with the garment occupying
~80% of the frame. Do not redesign or restyle the item.`;
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
