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

// Localized push copy per event. The recipient's language lives on
// profiles/{uid}.lang (same field the reminder push uses); we look it up and
// pick the matching line. Title is the actor name (server-side), so the body
// omits it — hence "내 룩을 좋아해요" not "…님이…". Target-aware so a board
// notice never says "look" and vice-versa.
// es / fr were missing until 2026-10-12 (they fell back to English).
const PUSH_COPY = {
  follow:         { en: 'started following you',   ko: '나를 팔로우했어요',       ja: 'あなたをフォローしました', es: 'empezó a seguirte', fr: 'a commencé à vous suivre' },
  tryon:          { en: 'tried on your look',      ko: '내 룩을 입어봤어요',       ja: 'あなたのルックを試着しました', es: 'se probó tu look', fr: 'a essayé votre tenue' },
  comment_outfit: { en: 'commented on your look',  ko: '내 룩에 댓글을 남겼어요',   ja: 'あなたのルックにコメントしました', es: 'comentó tu look', fr: 'a commenté votre tenue' },
  comment_board:  { en: 'commented on your board', ko: '내 보드에 댓글을 남겼어요', ja: 'あなたのボードにコメントしました', es: 'comentó tu tablero', fr: 'a commenté votre planche' },
  like_outfit:    { en: 'liked your look',         ko: '내 룩을 좋아해요',         ja: 'あなたのルックにいいねしました', es: 'le gustó tu look', fr: 'a aimé votre tenue' },
  like_board:     { en: 'liked your board',        ko: '내 보드를 좋아해요',       ja: 'あなたのボードにいいねしました', es: 'le gustó tu tablero', fr: 'a aimé votre planche' },
  stylist:        { en: 'replied to you',          ko: '답장을 보냈어요',          ja: '返信しました', es: 'te respondió', fr: 'vous a répondu' },
  moderation: {
    en: 'Your look was hidden — its image was flagged as inappropriate.',
    ko: '이미지가 부적합으로 판단되어 룩 공개가 해제됐어요.',
    ja: '画像が不適切と判断され、ルックの公開が取り消されました。',
    es: 'Ocultamos tu look: su imagen se marcó como inapropiada.',
    fr: 'Votre tenue a été masquée : son image a été signalée comme inappropriée.',
  },
};
const LANGS = new Set(['en', 'ko', 'ja', 'es', 'fr']);

async function recipientLang(uid) {
  try {
    const l = ((await db.collection('profiles').doc(uid).get()).data() || {}).lang;
    return LANGS.has(l) ? l : 'en';
  } catch { return 'en'; }
}

function pushBody(type, targetType, lang = 'en') {
  const key = (type === 'comment' || type === 'like')
    ? `${type}_${targetType === 'board' ? 'board' : 'outfit'}`
    : type;
  const row = PUSH_COPY[key];
  return row ? (row[lang] || row.en) : '';
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
    // Unified: anything in the bell also pushes (Instagram-style), localized.
    const lang = await recipientLang(recipientUid);
    await sendToUser(recipientUid, {
      title: actor.actorName,
      body: pushBody(type, targetType, lang),
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
    const lang = await recipientLang(recipientUid);
    await sendToUser(recipientUid, {
      title,
      body: pushBody('like', targetType, lang),
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
    const lang = await recipientLang(recipientUid);
    await sendToUser(recipientUid, {
      title: 'drape',
      body: pushBody(type, targetType, lang),
      data: deepLinkData(type, targetType, targetId),
      collapseKey: `${type}_${targetId || 'x'}`,
    });
  } catch (err) {
    console.warn('notifySystem write failed:', err.message);
  }
}

// A stylist's chat reply that landed while the user wasn't looking at the
// thread (owner, 2026-10-12: a reply takes seconds, people wander off). The
// chat screen keeps users/{uid}.stylistViewing = { thread, at } fresh while
// it's on screen; if that points at this thread and is recent, they saw the
// reply arrive and nothing is sent. Otherwise a bell row plus a native push
// whose title is the stylist and body is the start of the reply.
// The chat refreshes it every 30s; 45s of slack covers one missed beat. A
// kill or reload can't clear it, so this window is the most a missed push
// can be off by.
const VIEWING_FRESH_MS = 45 * 1000;
async function notifyStylistReply(uid, { persona, personaName, personaImg, thread, reply }) {
  try {
    const u = (await db.collection('users').doc(uid).get()).data() || {};
    const v = u.stylistViewing;
    const seen = v && v.thread === thread && v.at?.toMillis && Date.now() - v.at.toMillis() < VIEWING_FRESH_MS;
    if (seen) return;
    const preview = String(reply || '').replace(/\s+/g, ' ').trim();
    await db.collection('notifications').doc(uid).collection('items').add({
      type: 'stylist',
      actorUid: null, actorHandle: '', actorName: personaName, actorPhoto: personaImg || '',
      targetType: 'stylist',
      targetId: persona,
      preview: preview ? preview.slice(0, 120) : null,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const lang = await recipientLang(uid);
    await sendToUser(uid, {
      title: personaName,
      body: preview ? (preview.length > 110 ? `${preview.slice(0, 107)}…` : preview) : pushBody('stylist', null, lang),
      data: { type: 'stylist', persona },
      collapseKey: `stylist_${persona}`,
    });
  } catch (err) {
    console.warn('notifyStylistReply failed:', err.message);
  }
}

module.exports = { notify, notifyLike, notifySystem, notifyStylistReply, recipientLang };
