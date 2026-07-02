// Maintain profiles.followerCount / followingCount via follow doc triggers.
// Doc ID convention: `${followerId}_${followingId}`.
//
// We RECOUNT both sides from /follows on every trigger instead of using
// FieldValue.increment, so counters always reflect the actual collection
// state. Drift from missed events, replays, or rule failures self-heals
// on the next follow/unfollow either side participates in. The extra
// count() reads (≤ 1KB billed per 1000 docs) are negligible at our
// scale and worth the correctness guarantee.

const { onDocumentCreated, onDocumentDeleted } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { notify } = require('./notifications.js');

const db = admin.firestore();

async function recountFor(uid) {
    if (!uid) return;
    const [followersSnap, followingSnap] = await Promise.all([
        db.collection('follows').where('followingId', '==', uid).count().get(),
        db.collection('follows').where('followerId', '==', uid).count().get(),
    ]);
    await db.collection('profiles').doc(uid).set({
        followerCount: followersSnap.data().count,
        followingCount: followingSnap.data().count,
    }, { merge: true });
}

async function recountBothSides(data) {
    const { followerId, followingId } = data || {};
    await Promise.all([recountFor(followerId), recountFor(followingId)]);
}

exports.onFollowCreated = onDocumentCreated('follows/{followId}', async (event) => {
    const data = event.data?.data() || {};
    try { await recountBothSides(data); }
    catch (err) { console.warn('onFollowCreated recount failed:', err.message); }
    // In-app bell notification to the followed user.
    await notify(data.followingId, { type: 'follow', actorUid: data.followerId });
});

exports.onFollowDeleted = onDocumentDeleted('follows/{followId}', async (event) => {
    try { await recountBothSides(event.data?.data()); }
    catch (err) { console.warn('onFollowDeleted recount failed:', err.message); }
});

// One-shot self-heal. The caller can only recount themselves (no admin
// surface to recount arbitrary users). The client invokes this once per
// session on profile mount to fix any pre-existing drift from when the
// trigger wrote to /users/ and the mirror sometimes missed.
exports.recountMyFollows = onCall(async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'AUTH_REQUIRED');
    await recountFor(uid);
    return { ok: true };
});
