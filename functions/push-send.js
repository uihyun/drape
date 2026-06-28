// Shared FCM send helper — used by the marketplace DM push (messages.js) and the
// periodic reminder push (reminders.js). Reads a user's fcmTokens
// (users/{uid}/fcmTokens/{token}), sends a notification to all of them, and
// prunes tokens FCM reports as dead.

const admin = require('firebase-admin');

async function pruneInvalidTokens(uid, tokens, responses) {
  const dead = [];
  responses.forEach((res, i) => {
    if (res.success) return;
    const code = res.error?.code;
    if (code === 'messaging/registration-token-not-registered'
     || code === 'messaging/invalid-registration-token') {
      dead.push(tokens[i]);
    }
  });
  if (!dead.length) return;
  const db = admin.firestore();
  const batch = db.batch();
  dead.forEach(t => batch.delete(db.collection('users').doc(uid).collection('fcmTokens').doc(t)));
  try { await batch.commit(); }
  catch (err) { console.warn('prune dead tokens failed:', err.message); }
}

// Send one notification to every device a user has registered.
//   data       — string map sent alongside (values coerced to strings)
//   collapseKey— iOS thread-id + Android collapse/tag, so repeats coalesce
// Returns { ok, sent, total, reason? }.
async function sendToUser(uid, { title, body, data = {}, collapseKey } = {}) {
  let tokens;
  try {
    const snap = await admin.firestore().collection('users').doc(uid).collection('fcmTokens').get();
    tokens = snap.docs.map(d => d.id).filter(Boolean);
  } catch (err) {
    console.warn('fcmTokens read failed for', uid, err.message);
    return { ok: false, sent: 0, reason: 'read_failed' };
  }
  if (!tokens.length) return { ok: false, sent: 0, reason: 'no_tokens' };

  const key = collapseKey || data.type || 'drape';
  const strData = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]));
  try {
    const res = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: strData,
      apns: { payload: { aps: { 'thread-id': key, sound: 'default' } } },
      android: { collapseKey: key, notification: { tag: key } },
    });
    await pruneInvalidTokens(uid, tokens, res.responses);
    return { ok: true, sent: res.successCount, total: tokens.length };
  } catch (err) {
    console.warn('sendToUser failed for', uid, err.message);
    return { ok: false, sent: 0, reason: 'send_failed' };
  }
}

module.exports = { sendToUser, pruneInvalidTokens };
