// Maintain users.followerCount / followingCount via follow doc triggers.
// Doc ID convention: `${followerId}_${followingId}`.

const { onDocumentCreated, onDocumentDeleted } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

const db = admin.firestore();

exports.onFollowCreated = onDocumentCreated('follows/{followId}', async (event) => {
    const data = event.data?.data();
    if (!data) return;
    const { followerId, followingId } = data;
    if (!followerId || !followingId) return;
    try {
        await Promise.all([
            db.collection('users').doc(followingId).set(
                { followerCount: admin.firestore.FieldValue.increment(1) },
                { merge: true },
            ),
            db.collection('users').doc(followerId).set(
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
            db.collection('users').doc(followingId).set(
                { followerCount: admin.firestore.FieldValue.increment(-1) },
                { merge: true },
            ),
            db.collection('users').doc(followerId).set(
                { followingCount: admin.firestore.FieldValue.increment(-1) },
                { merge: true },
            ),
        ]);
    } catch (err) {
        console.warn('onFollowDeleted counter bump failed:', err.message);
    }
});
