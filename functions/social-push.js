// Social push: someone liked your outfit, and someone tried on your look.
// Both are strong re-engagement / validation signals (and try-on is unique to
// drape). They reuse the shared sendToUser helper, carry a deep-link `data.type`
// + target, and coalesce per-target via collapseKey so a burst doesn't spam.

const admin = require('firebase-admin');
const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { sendToUser } = require('./push-send.js');
const { notify } = require('./notifications.js');

const db = admin.firestore();

// Display name for a uid, falling back gracefully so a missing profile never
// blocks delivery.
async function displayNameOf(uid) {
  try {
    const snap = await db.collection('profiles').doc(uid).get();
    const p = snap.exists ? snap.data() : null;
    if (p?.displayName) return p.displayName;
    if (p?.handle) return `@${p.handle}`;
  } catch { /* ignore */ }
  return 'Someone';
}

// ── Like push ──────────────────────────────────────────────────────────
// Fires when likedBy gains a new member. Notifies the outfit owner (never for
// self-likes). collapseKey per outfit so many likes show as one row.
exports.onOutfitLiked = onDocumentUpdated('outfits/{outfitId}', async (event) => {
  const before = event.data?.before?.data() || {};
  const after = event.data?.after?.data() || {};
  const beforeLiked = Array.isArray(before.likedBy) ? before.likedBy : [];
  const afterLiked = Array.isArray(after.likedBy) ? after.likedBy : [];
  const owner = after.userId;
  if (!owner) return;

  const newLikers = afterLiked.filter(u => !beforeLiked.includes(u) && u !== owner);
  if (!newLikers.length) return;

  const name = await displayNameOf(newLikers[newLikers.length - 1]);
  const extra = newLikers.length - 1;
  const title = extra > 0 ? `${name} +${extra}` : name;
  await sendToUser(owner, {
    title,
    body: 'liked your look',
    data: { type: 'like', outfitId: event.params.outfitId },
    collapseKey: `like_${event.params.outfitId}`,
  });
});

// ── Try-on push + count ────────────────────────────────────────────────
// Fires when a generation flips to 'ready'. For an outfit-ref try-on (recreating
// someone else's look), bump the source outfit's tryOnCount and notify its owner
// (never for trying on your own look). The pending→ready transition happens once,
// so it can't double-count (later analysis writes don't change status).
exports.onLookTriedOn = onDocumentUpdated('generations/{generationId}', async (event) => {
  const before = event.data?.before?.data() || {};
  const after = event.data?.after?.data() || {};
  if (before.status === 'ready' || after.status !== 'ready') return;
  const srcId = after.outfitRefId;
  if (!srcId) return; // only outfit-ref try-ons reference a source look

  // Count is always bumped; notification is owner-only and skips self-try-on.
  db.collection('outfits').doc(srcId).set(
    { tryOnCount: admin.firestore.FieldValue.increment(1) },
    { merge: true },
  ).catch(err => console.warn('tryOnCount bump failed:', srcId, err.message));

  let owner;
  try {
    const snap = await db.collection('outfits').doc(srcId).get();
    owner = snap.exists ? snap.data().userId : null;
  } catch { return; }
  if (!owner || owner === after.userId) return;

  const name = await displayNameOf(after.userId);
  await sendToUser(owner, {
    title: name,
    body: 'tried on your look',
    data: { type: 'tryon', outfitId: srcId },
    collapseKey: `tryon_${srcId}`,
  });
  await notify(owner, { type: 'tryon', actorUid: after.userId, targetType: 'outfit', targetId: srcId });
});
