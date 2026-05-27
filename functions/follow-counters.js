// Maintain profiles.followerCount / followingCount via follow doc triggers.
// Doc ID convention: `${followerId}_${followingId}`.
//
// Writes go straight to /profiles/{uid} — the same collection the UI reads
// from. An earlier version wrote to /users/{uid} and relied on a mirror
// trigger to copy values into /profiles/. The mirror was onDocumentUpdated,
// so the FIRST follow for a user with no pre-existing /users/{uid} doc
// silently CREATED the doc instead of updating it, and the mirror never
// fired. Direct writes here eliminate that hidden failure mode.

const { onDocumentCreated, onDocumentDeleted } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

const db = admin.firestore();

async function decrementClamped(ref, field) {
    // FieldValue.increment(-1) would let counts go negative if the doc
    // somehow drifted out of sync (replayed delete, missed create, etc.).
    // A transaction reads + clamps so we never display a negative count.
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const cur = (snap.exists && Number(snap.data()?.[field])) || 0;
        tx.set(ref, { [field]: Math.max(0, cur - 1) }, { merge: true });
    });
}

exports.onFollowCreated = onDocumentCreated('follows/{followId}', async (event) => {
    const data = event.data?.data();
    if (!data) return;
    const { followerId, followingId } = data;
    if (!followerId || !followingId) return;
    try {
        await Promise.all([
            db.collection('profiles').doc(followingId).set(
                { followerCount: admin.firestore.FieldValue.increment(1) },
                { merge: true },
            ),
            db.collection('profiles').doc(followerId).set(
                { followingCount: admin.firestore.FieldValue.increment(1) },
                { merge: true },
            ),
        ]);
    } catch (err) {
        console.warn('onFollowCreated counter bump failed:', err.message);
    }
});

exports.onFollowDeleted = onDocumentDeleted('follows/{followId}', async (event) => {
    const data = event.data?.data();
    if (!data) return;
    const { followerId, followingId } = data;
    if (!followerId || !followingId) return;
    try {
        await Promise.all([
            decrementClamped(db.collection('profiles').doc(followingId), 'followerCount'),
            decrementClamped(db.collection('profiles').doc(followerId), 'followingCount'),
        ]);
    } catch (err) {
        console.warn('onFollowDeleted counter bump failed:', err.message);
    }
});
