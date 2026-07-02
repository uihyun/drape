// Lightweight content moderation for the public outfit feed.
//
// Three pieces:
//   1) `checkCustomCommand(text)` — cheap keyword blocklist applied before
//      a free-form text field (caption, custom try-on prompt) is accepted.
//   2) `onOutfitListed` — Firestore onUpdate trigger. When an outfit flips
//      to isListed=true, we run a Gemini SFW check against the cover image.
//      Unsafe outfits get flipped back to isListed=false with a flag.
//   3) `onReportCreated` — increments the outfit's reportCount; auto-unlist
//      at threshold.
//
// Not a substitute for human review — best-effort guard so obvious abuse
// doesn't sit on the feed unattended.

const { onDocumentUpdated, onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
// Image SFW moderation uses Cloud Vision SAFE_SEARCH_DETECTION (purpose-built
// NSFW scoring) instead of a Gemini yes/no — cheaper, more reliable, and
// service-account/ADC auth (no key, no GEMINI secret). See docs/COST.md.
const vision = require('@google-cloud/vision');

let _visionClient = null;
function visionClient() {
  if (!_visionClient) _visionClient = new vision.ImageAnnotatorClient();
  return _visionClient;
}

const AUTO_UNLIST_THRESHOLD = 3;

const BLOCKLIST = [
  // Explicit
  'porn', 'pornographic', 'nude', 'naked', 'nsfw', 'erotic', 'sex scene',
  'bestiality', 'incest', 'pedophil', 'csam', 'child porn',
  // Violence / hate
  'gore', 'beheading', 'kkk', 'nazi propaganda',
  // Korean
  '음란', '포르노', '성기', '자위',
];

function normalize(text) {
  return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function checkCustomCommand({ text } = {}) {
  const combined = normalize(text);
  if (!combined) return { ok: true };
  for (const word of BLOCKLIST) {
    if (combined.includes(word)) return { ok: false, matched: word };
  }
  return { ok: true };
}
exports.checkCustomCommand = checkCustomCommand;

async function fetchImageAsBase64(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const mimeType = res.headers.get('content-type') || 'image/jpeg';
    const buf = Buffer.from(await res.arrayBuffer());
    return { data: buf.toString('base64'), mimeType };
  } catch (err) {
    console.warn('moderation: image fetch failed:', err.message);
    return null;
  }
}

// Cloud Vision SafeSearch returns a likelihood per category (VERY_UNLIKELY …
// VERY_LIKELY). Flag clearly-inappropriate covers. Keep the `racy` bar high
// (VERY_LIKELY only) so ordinary fashion — swimwear, fitted looks, which score
// POSSIBLE/LIKELY racy — isn't false-flagged. (SafeSearch has no "hate" category;
// the text blocklist + reports cover that.) Returns null on infra error so we
// fail OPEN (don't auto-unlist legit content on a transient failure).
const HIGH = new Set(['LIKELY', 'VERY_LIKELY']);
async function runSfwCheck(img) {
  try {
    const [result] = await visionClient().safeSearchDetection({ image: { content: img.data } });
    const s = result.safeSearchAnnotation || {};
    const reasons = [];
    if (HIGH.has(s.adult)) reasons.push(`adult:${s.adult}`);
    if (HIGH.has(s.violence)) reasons.push(`violence:${s.violence}`);
    if (s.racy === 'VERY_LIKELY') reasons.push(`racy:${s.racy}`);
    if (reasons.length) return { safe: false, reason: reasons.join(',').slice(0, 200) };
    return { safe: true };
  } catch (err) {
    console.warn('moderation: SafeSearch failed:', err.message);
    return null;
  }
}

exports.onOutfitListed = onDocumentUpdated(
  {
    document: 'outfits/{outfitId}',
    timeoutSeconds: 60,
  },
  async (event) => {
    const before = event.data?.before?.data() || {};
    const after = event.data?.after?.data() || {};
    const wasListed = before.isListed === true;
    const isListed = after.isListed === true;
    if (wasListed || !isListed) return;

    const outfitId = event.params.outfitId;
    const coverUrl = after.coverUrl;
    if (!coverUrl) return;

    const img = await fetchImageAsBase64(coverUrl);
    if (!img) return;

    const verdict = await runSfwCheck(img);
    if (!verdict || verdict.safe) return;

    console.warn(`moderation: auto-unlisting outfit ${outfitId} (${verdict.reason})`);
    await admin.firestore().collection('outfits').doc(outfitId).update({
      isListed: false,
      moderationFlag: 'auto_sfw',
      moderationReason: verdict.reason,
      moderatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
);

exports.onCaptionChanged = onDocumentUpdated(
  { document: 'outfits/{outfitId}' },
  async (event) => {
    const before = event.data?.before?.data() || {};
    const after = event.data?.after?.data() || {};
    const beforeCap = before.notes || '';
    const afterCap = after.notes || '';
    if (beforeCap === afterCap) return;
    if (!afterCap) return;

    const verdict = checkCustomCommand({ text: afterCap });
    if (verdict.ok) return;

    const outfitId = event.params.outfitId;
    console.warn(`moderation: notes cleared for outfit ${outfitId} (${verdict.matched})`);
    await admin.firestore().collection('outfits').doc(outfitId).update({
      notes: '',
      moderationFlag: 'auto_caption',
      moderationReason: `notes_blocklist:${verdict.matched}`,
      moderatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
);

exports.onReportCreated = onDocumentCreated(
  { document: 'reports/{reportId}' },
  async (event) => {
    const report = event.data?.data();
    if (!report?.targetId) return;
    const targetType = report.targetType || 'outfit';
    const targetRef = admin.firestore().collection(targetType === 'item' ? 'items' : 'outfits').doc(report.targetId);

    await admin.firestore().runTransaction(async (txn) => {
      const snap = await txn.get(targetRef);
      if (!snap.exists) return;
      const data = snap.data();
      const nextCount = (data.reportCount || 0) + 1;
      const update = { reportCount: nextCount };
      if (nextCount >= AUTO_UNLIST_THRESHOLD && data.isListed === true) {
        update.isListed = false;
        update.moderationFlag = 'auto_reports';
        update.moderatedAt = admin.firestore.FieldValue.serverTimestamp();
      }
      txn.update(targetRef, update);
    });
  }
);
