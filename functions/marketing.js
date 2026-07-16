// === Marketing post queue ==============================================
// Admin-gated CRUD over the `marketingPosts` collection — the scheduling
// queue behind the /admin Marketing tab. Firestore rules never open this
// collection to clients; everything goes through these callables.
//
// Doc shape:
//   { imageUrl, caption, targets: ['instagram'|'threads'],
//     scheduledAt: Timestamp, status: 'queued'|'published'|'failed'|'canceled',
//     results: { instagram?, threads? }, createdAt, updatedAt }
//
// The publisher (onSchedule every 15 min → IG Graph API container/publish +
// Threads API) lands in this file once the Meta tokens exist as secrets
// (META_IG_TOKEN / META_IG_USER_ID / THREADS_TOKEN) — setup checklist in
// resources/marketing/README.md. Until then the queue is fully manageable;
// nothing goes out.

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { assertAdmin } = require('./admin.js');

const opts = { cors: true, timeoutSeconds: 60, memory: '256MiB' };
const COLL = 'marketingPosts';
const TARGETS = ['instagram', 'threads'];
// IG caption hard limit; Threads is 500 but long queue captions get trimmed
// at publish time for that target rather than rejected here.
const CAPTION_MAX = 2200;

const toMillis = (t) => (t?.toMillis ? t.toMillis() : null);
const serialize = (doc) => {
  const x = doc.data();
  return {
    id: doc.id,
    imageUrl: x.imageUrl,
    caption: x.caption,
    targets: x.targets,
    status: x.status,
    results: x.results || null,
    scheduledAt: toMillis(x.scheduledAt),
    createdAt: toMillis(x.createdAt),
    updatedAt: toMillis(x.updatedAt),
  };
};

exports.adminMarketingList = onCall(opts, async (request) => {
  assertAdmin(request);
  const snap = await admin.firestore().collection(COLL)
    .orderBy('scheduledAt', 'desc').limit(200).get();
  return { posts: snap.docs.map(serialize) };
});

exports.adminMarketingUpsert = onCall(opts, async (request) => {
  assertAdmin(request);
  const { id, imageUrl, caption, targets, scheduledAt } = request.data || {};

  if (typeof imageUrl !== 'string' || !/^https:\/\//.test(imageUrl)) {
    throw new HttpsError('invalid-argument', 'IMAGE_URL_HTTPS_REQUIRED');
  }
  if (typeof caption !== 'string' || !caption.trim() || caption.length > CAPTION_MAX) {
    throw new HttpsError('invalid-argument', 'CAPTION_INVALID');
  }
  if (!Array.isArray(targets) || !targets.length || targets.some((t) => !TARGETS.includes(t))) {
    throw new HttpsError('invalid-argument', 'TARGETS_INVALID');
  }
  const when = new Date(scheduledAt);
  if (Number.isNaN(when.getTime())) throw new HttpsError('invalid-argument', 'SCHEDULED_AT_INVALID');

  const db = admin.firestore();
  const now = admin.firestore.FieldValue.serverTimestamp();
  const patch = {
    imageUrl,
    caption: caption.trim(),
    targets,
    scheduledAt: admin.firestore.Timestamp.fromDate(when),
    updatedAt: now,
  };

  if (id) {
    const ref = db.collection(COLL).doc(id);
    const cur = await ref.get();
    if (!cur.exists) throw new HttpsError('not-found', 'POST_NOT_FOUND');
    // Published posts are history, not drafts — edits would silently lie
    // about what actually went out.
    if (cur.data().status === 'published') throw new HttpsError('failed-precondition', 'ALREADY_PUBLISHED');
    await ref.update({ ...patch, status: 'queued', results: null });
    return { id };
  }
  const ref = await db.collection(COLL).add({ ...patch, status: 'queued', results: null, createdAt: now });
  return { id: ref.id };
});

exports.adminMarketingDelete = onCall(opts, async (request) => {
  assertAdmin(request);
  const { id } = request.data || {};
  if (!id) throw new HttpsError('invalid-argument', 'ID_REQUIRED');
  const ref = admin.firestore().collection(COLL).doc(id);
  const cur = await ref.get();
  if (!cur.exists) throw new HttpsError('not-found', 'POST_NOT_FOUND');
  if (cur.data().status === 'published') {
    // Keep the audit trail; flip to canceled instead of erasing history.
    throw new HttpsError('failed-precondition', 'ALREADY_PUBLISHED');
  }
  await ref.delete();
  return { ok: true };
});

// Storage-hosted ad creatives (uploaded public by scripts/upload-marketing-assets.cjs)
// so the admin picker can offer them without hand-pasting URLs.
exports.adminMarketingAssets = onCall(opts, async (request) => {
  assertAdmin(request);
  const bucket = admin.storage().bucket();
  const [files] = await bucket.getFiles({ prefix: 'marketing/' });
  const assets = files
    .filter((f) => /\.(png|jpe?g|webp)$/i.test(f.name))
    .map((f) => ({
      path: f.name,
      url: `https://storage.googleapis.com/${bucket.name}/${encodeURI(f.name)}`,
    }));
  return { assets };
});
