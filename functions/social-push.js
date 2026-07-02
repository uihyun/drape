// Social triggers: someone liked your outfit/board, and someone tried on your
// look. Both are strong re-engagement / validation signals (and try-on is
// unique to drape). Push + in-app bell are unified in notifications.js — these
// triggers just detect the event and hand off to notify*/notifyLike, which
// write the bell row AND send the push (coalesced per-target).

const admin = require('firebase-admin');
const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { notify, notifyLike } = require('./notifications.js');

const db = admin.firestore();

// Shared like handler for outfits + boards (both carry the same likedBy array).
async function handleLike(before, after, targetType, targetId) {
  const beforeLiked = Array.isArray(before.likedBy) ? before.likedBy : [];
  const afterLiked = Array.isArray(after.likedBy) ? after.likedBy : [];
  const owner = after.userId;
  if (!owner) return;

  const newLikers = afterLiked.filter(u => !beforeLiked.includes(u) && u !== owner);
  if (!newLikers.length) return;

  // One collapsed row/push per post — latest liker + how many others.
  const totalOthers = afterLiked.filter(u => u !== owner).length;
  await notifyLike(owner, {
    actorUid: newLikers[newLikers.length - 1],
    targetType,
    targetId,
    others: Math.max(0, totalOthers - 1),
  });
}

exports.onOutfitLiked = onDocumentUpdated('outfits/{outfitId}', (event) =>
  handleLike(event.data?.before?.data() || {}, event.data?.after?.data() || {}, 'outfit', event.params.outfitId));

exports.onBoardLiked = onDocumentUpdated('boards/{boardId}', (event) =>
  handleLike(event.data?.before?.data() || {}, event.data?.after?.data() || {}, 'board', event.params.boardId));

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

  await notify(owner, { type: 'tryon', actorUid: after.userId, targetType: 'outfit', targetId: srcId });
});
