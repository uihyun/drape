// === Server-tunable AI model ids =======================================
// Every Gemini model id used in production lives here, overridable from
// Firestore `config/models` — so switching a model (or rolling one back
// after a bad release) is a console edit, never a code deploy.
//
// SAFETY (same contract as config/copy and config/app): a missing doc, a
// denied read, or a malformed value falls back to the baked-in default.
// Values are validated against a strict id pattern, and imageSize against
// the closed set the SDK accepts — a typo can only cost a fallback, never
// an unhandled crash mid-request.
//
// Cache: one read per function instance per TTL. A change reaches live
// traffic within ~5 minutes (sooner on cold instances) without redeploys.

const admin = require('firebase-admin');

const DEFAULTS = {
  vision: 'gemini-3.5-flash',                 // tagging / OOTD analysis / stylist / translate
  imageCrop: 'gemini-3.1-flash-lite-image',   // item cutout
  imageCropSize: '1K',
  imageTryon: 'gemini-3.1-flash-image',       // the try-on render
  imageTryonSize: '1K',
};

const MODEL_RE = /^[a-z0-9][a-z0-9.\-]{2,63}$/;   // gemini-3.1-flash-image, etc.
const SIZES = ['1K', '2K', '4K'];
const TTL_MS = 5 * 60 * 1000;

let cache = { at: 0, value: { ...DEFAULTS } };
let inflight = null;

function sane(raw) {
  const out = { ...DEFAULTS };
  if (!raw || typeof raw !== 'object') return out;
  for (const key of ['vision', 'imageCrop', 'imageTryon']) {
    const v = raw[key];
    if (typeof v === 'string' && MODEL_RE.test(v.trim())) out[key] = v.trim();
  }
  for (const key of ['imageCropSize', 'imageTryonSize']) {
    if (SIZES.includes(raw[key])) out[key] = raw[key];
  }
  return out;
}

/**
 * Current model ids. Never throws and never blocks on a cold read for long:
 * on the first call of an instance it awaits one Firestore get, afterwards
 * it serves cache and refreshes in the background past the TTL.
 */
async function getModels() {
  const fresh = Date.now() - cache.at < TTL_MS;
  if (fresh) return cache.value;
  if (!inflight) {
    inflight = admin.firestore().collection('config').doc('models').get()
      .then((snap) => {
        cache = { at: Date.now(), value: sane(snap.exists ? snap.data() : null) };
        return cache.value;
      })
      .catch((e) => {
        // Keep serving whatever we had (defaults on the very first failure)
        // and retry after the TTL rather than hammering Firestore.
        console.warn('model config read failed, using previous/defaults:', e?.message);
        cache = { at: Date.now(), value: cache.value };
        return cache.value;
      })
      .finally(() => { inflight = null; });
  }
  // First ever call must wait; later calls keep the old value while it refreshes.
  return cache.at === 0 ? inflight : cache.value;
}

module.exports = { getModels, MODEL_DEFAULTS: DEFAULTS, MODEL_RE, MODEL_SIZES: SIZES };
