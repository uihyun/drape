// In-app notification writes. The existing social triggers already send a push
// (social-push / comment-counter / follow-counters); here they ALSO drop a
// notification doc so the profile bell can show an activity list + unread dot.
//
//   notifications/{recipientUid}/items/{autoId}
//     { type: 'comment'|'follow'|'tryon', actorUid, actorHandle, actorName,
//       actorPhoto, targetType, targetId, preview, read, createdAt }
//
// Server-only (firestore.rules blocks client create; clients read + mark-read +
// delete their own). Likes are intentionally NOT written here — they'd be the
// noisiest source; batch them into the bell later. Self-events are skipped.

const admin = require('firebase-admin');

const db = admin.firestore();

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
  } catch (err) {
    console.warn('notify write failed:', err.message);
  }
}

module.exports = { notify };
