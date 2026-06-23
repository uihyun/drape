// === translateContent ==================================================
// On-demand translation for the Phase-1 localized free-text. Generated text
// (item names, OOTD analysis notes/palette names/piece names) is stored in the
// CREATOR's language. When a viewer in another language opens a public surface,
// the client offers a "translate" toggle that calls this once; the result is
// cached on the doc under `i18n.<target>` so every later viewer (and a re-open)
// is free. Most posts are viewed same-language, so this rarely runs.
//
// Enums and the search `description` are NOT translated — they stay English
// (the search/filter SSOT; see CLAUDE.md + functions/items.js).

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const geminiApiKey = defineSecret('GEMINI_API_KEY');
const VISION = 'gemini-3.5-flash';
const LANG_NAMES = { en: 'English', ko: 'Korean', ja: 'Japanese' };

// Which Firestore collection each surface translates, and the free-text shape
// pulled out of its doc. Arrays keep order so the client overlays by index.
const COLLS = new Set(['outfits', 'generations', 'items']);
function extractFreeText(coll, d) {
  if (coll === 'outfits') {
    return {
      name: typeof d.name === 'string' ? d.name : '',
      notes: typeof d.notes === 'string' ? d.notes : '',
      palette: Array.isArray(d.palette) ? d.palette.map(p => (p && p.name) || '') : [],
      pieces: Array.isArray(d.pieces) ? d.pieces.map(p => (p && p.name) || '') : [],
    };
  }
  if (coll === 'generations') {
    return {
      notes: typeof d.notes === 'string' ? d.notes : '',
      palette: Array.isArray(d.palette) ? d.palette.map(p => (p && p.name) || '') : [],
    };
  }
  // items — only the display name (description feeds the English shopping query)
  return { name: typeof d.name === 'string' ? d.name : '' };
}

function hasText(ft) {
  return Object.values(ft).some(v => (Array.isArray(v) ? v.some(Boolean) : Boolean(v)));
}

exports.translateContent = onCall(
  { secrets: [geminiApiKey], cors: true, timeoutSeconds: 30, memory: '256MiB' },
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'AUTH_REQUIRED');
    const { coll, id, target } = request.data || {};
    if (!COLLS.has(coll)) throw new HttpsError('invalid-argument', 'bad coll');
    if (!id || typeof id !== 'string') throw new HttpsError('invalid-argument', 'id required');
    if (!LANG_NAMES[target]) throw new HttpsError('invalid-argument', 'bad target');

    const ref = admin.firestore().collection(coll).doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', 'doc missing');
    const data = snap.data();

    // Already in the requested language → nothing to translate.
    if ((data.lang || 'en') === target) return { fields: extractFreeText(coll, data) };
    // Cache hit — a previous viewer already paid for this language.
    const cached = data.i18n && data.i18n[target];
    if (cached) return { fields: cached, cached: true };

    const fields = extractFreeText(coll, data);
    if (!hasText(fields)) return { fields };

    const genai = new GoogleGenerativeAI(geminiApiKey.value());
    const model = genai.getGenerativeModel({
      model: VISION,
      generationConfig: { responseMimeType: 'application/json' },
    });
    const prompt = `Translate the string VALUES in this JSON to ${LANG_NAMES[target]}.
Rules: keep the JSON structure, keys, and every array's length and order identical;
translate empty strings to empty strings; render names/notes naturally in a fashion
editorial tone; keep brand names and proper nouns as-is. Return ONLY the JSON.

${JSON.stringify(fields)}`;

    let translated;
    try {
      const res = await model.generateContent([{ text: prompt }]);
      translated = JSON.parse(res?.response?.text() || 'null');
    } catch (err) {
      console.warn('translateContent failed:', err?.message);
      throw new HttpsError('internal', 'translate_failed');
    }
    if (!translated || typeof translated !== 'object') {
      throw new HttpsError('internal', 'translate_parse_failed');
    }

    // Cache under i18n.<target> (merge so other languages survive). No
    // updatedAt bump — translation must not reorder feeds; and `notes` is
    // untouched so onCaptionChanged stays a no-op.
    await ref.set({ i18n: { [target]: translated } }, { merge: true });
    return { fields: translated };
  }
);
