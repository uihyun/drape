// Maintain outfits.commentCount via Firestore triggers. Clients can't be
// trusted to bump the counter, and we need it on the outfit doc for
// feed-card display without a separate read.

const { onDocumentCreated, onDocumentDeleted } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

const db = admin.firestore();

exports.onCommentCreated = onDocumentCreated('outfits/{outfitId}/comments/{commentId}', async (event) => {
    try {
        await db.collection('outfits').doc(event.params.outfitId).update({
            commentCount: admin.firestore.FieldValue.increment(1),
        });
    } catch (err) {
        console.warn('onCommentCreated counter bump failed:', err.message);
    }
});

exports.onCommentDeleted = onDocumentDeleted('outfits/{outfitId}/comments/{commentId}', async (event) => {
    try {
        await db.collection('outfits').doc(event.params.outfitId).update({
            commentCount: admin.firestore.FieldValue.increment(-1),
        });
    } catch (err) {
        console.warn('onCommentDeleted counter bump failed:', err.message);
    }
});
