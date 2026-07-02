// In-app notification writes. The existing social triggers already send a push
// (social-push / comment-counter / follow-counters); here they ALSO drop a
// notification doc so the profile bell can show an activity list + unread dot.
//
//   notifications/{recipientUid}/items/{autoId}
//     { type: 'comment'|'follow'|'tryon'|'like'|'moderation', actorUid,
//       actorHandle, actorName, actorPhoto, targetType, targetId, preview,
//       read, createdAt }
//
// Server-only (firestore.rules blocks client create; clients read + mark-read +
// delete their own). Likes are collapsed to one row per post (notifyLike);
// moderation notices have no actor (notifySystem). Self-events are skipped.

const admin = require('firebase-admin');
const { sendToUser } = require('./push-send.js');

const db = admin.firestore();

// English push copy per event — push isn't localized (no recipient locale
// server-side), while the in-app bell IS. Keep the wording target-aware so a
// board notice never says "look" and vice-versa.
function pushBody(type, targetType) {
  const board = targetType === 'board';
  if (type === 'follow') return 'started following you';
  if (type === 'tryon') return 'tried on your look';
  if (type === 'comment') return board ? 'commented on your board' : 'commented on your look';
  if (type === 'like') return board ? 'liked your board' : 'liked your look';
  if (type === 'moderation') return 'Your look was hidden — its image was flagged as inappropriate.';
  return '';
}

// Deep-link payload the client's routeForNotification() understands.
function deepLinkData(type, targetType, targetId, actorHandle) {
  const d = { type };
  if (type === 'follow') { if (actorHandle) d.handle = actorHandle; return d; }
  if (targetType === 'board') d.boardId = targetId;
  else if (targetId) d.outfitId = targetId;
  return d;
}

async function actorInfo(uid) {
  try {
    const p = (await db.collection('profiles').doc(uid).get()).data() || {};
    return {
      actorUid: uid,
      actorHandle: p.handle || '',
      actorName: p.displayName || (p.handle ? `@${p.handle}` : 'Someone'),
      actorPhoto: p.photoURL || '',
    };
  } catch {
    return { actorUid: uid, actorHandle: '', actorName: 'Someone', actorPhoto: '' };
  }
}

// Fire-and-forget: internal try/catch so a notification failure never breaks the
// trigger's primary work (counter bumps, push).
async function notify(recipientUid, { type, actorUid, targetType = null, targetId = null, preview = null } = {}) {
  if (!recipientUid || !actorUid || recipientUid === actorUid) return;
  try {
    const actor = await actorInfo(actorUid);
    await db.collection('notifications').doc(recipientUid).collection('items').add({
      type,
      ...actor,
      targetType,
      targetId,
      preview: preview ? String(preview).slice(0, 120) : null,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    // Unified: anything in the bell also pushes (Instagram-style).
    await sendToUser(recipientUid, {
      title: actor.actorName,
      body: pushBody(type, targetType),
      data: deepLinkData(type, targetType, targetId, actor.actorHandle),
      collapseKey: `${type}_${targetType || 'x'}_${targetId || actorUid}`,
    });
  } catch (err) {
    console.warn('notify write failed:', err.message);
  }
}

// Likes are collapsed to ONE row per post (deterministic doc id per
// target) so a burst doesn't flood the bell. Each new like overwrites: latest
// liker + "and N others", re-marked unread and bumped to the top. Works for
// both outfits and boards. `others` = number of OTHER likers besides the named.
async function notifyLike(recipientUid, { actorUid, targetType, targetId, others = 0 } = {}) {
  if (!recipientUid || !actorUid || !targetType || !targetId || recipientUid === actorUid) return;
  try {
    const actor = await actorInfo(actorUid);
    await db.collection('notifications').doc(recipientUid).collection('items').doc(`like_${targetType}_${targetId}`).set({
      type: 'like',
      ...actor,
      othersCount: Math.max(0, others),
      targetType,
      targetId,
      preview: null,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    const title = others > 0 ? `${actor.actorName} +${others}` : actor.actorName;
    await sendToUser(recipientUid, {
      title,
      body: pushBody('like', targetType),
      data: deepLinkData('like', targetType, targetId),
      collapseKey: `like_${targetType}_${targetId}`,
    });
  } catch (err) {
    console.warn('notifyLike write failed:', err.message);
  }
}

// System notification (no actor) — e.g. "your post was hidden by moderation".
// The client renders it with a system icon + localized copy (no name/avatar).
async function notifySystem(recipientUid, { type, targetType = null, targetId = null, preview = null } = {}) {
  if (!recipientUid) return;
  try {
    await db.collection('notifications').doc(recipientUid).collection('items').add({
      type,
      actorUid: null, actorHandle: '', actorName: '', actorPhoto: '',
      targetType,
      targetId,
      preview: preview ? String(preview).slice(0, 120) : null,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await sendToUser(recipientUid, {
      title: 'drape',
      body: pushBody(type, targetType),
      data: deepLinkData(type, targetType, targetId),
      collapseKey: `${type}_${targetId || 'x'}`,
    });
  } catch (err) {
    console.warn('notifySystem write failed:', err.message);
  }
}

module.exports = { notify, notifyLike, notifySystem };
