// Maintain commentCount on every commentable parent (outfits, ootds,
// boards) via Firestore triggers. Clients can't be trusted to bump the
// counter, and we need it on the parent for feed-card display without
// a separate read.

const { onDocumentCreated, onDocumentDeleted } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

const db = admin.firestore();

function bump(parentColl, parentId, delta) {
    return db.collection(parentColl).doc(parentId).update({
        commentCount: admin.firestore.FieldValue.increment(delta),
    });
}

// Outfits
exports.onCommentCreated = onDocumentCreated('outfits/{outfitId}/comments/{commentId}', async (event) => {
    try { await bump('outfits', event.params.outfitId, 1); }
    catch (err) { console.warn('onCommentCreated outfits failed:', err.message); }
});
exports.onCommentDeleted = onDocumentDeleted('outfits/{outfitId}/comments/{commentId}', async (event) => {
    try { await bump('outfits', event.params.outfitId, -1); }
    catch (err) { console.warn('onCommentDeleted outfits failed:', err.message); }
});

// (OOTD comment triggers removed — OOTDs are now `outfits` docs, covered by
//  the onComment* outfit triggers above.)

// Boards
exports.onBoardCommentCreated = onDocumentCreated('boards/{boardId}/comments/{commentId}', async (event) => {
    try { await bump('boards', event.params.boardId, 1); }
    catch (err) { console.warn('onBoardCommentCreated failed:', err.message); }
});
exports.onBoardCommentDeleted = onDocumentDeleted('boards/{boardId}/comments/{commentId}', async (event) => {
    try { await bump('boards', event.params.boardId, -1); }
    catch (err) { console.warn('onBoardCommentDeleted failed:', err.message); }
});

// Generations (try-on results)
exports.onGenerationCommentCreated = onDocumentCreated('generations/{generationId}/comments/{commentId}', async (event) => {
    try { await bump('generations', event.params.generationId, 1); }
    catch (err) { console.warn('onGenerationCommentCreated failed:', err.message); }
});
exports.onGenerationCommentDeleted = onDocumentDeleted('generations/{generationId}/comments/{commentId}', async (event) => {
    try { await bump('generations', event.params.generationId, -1); }
    catch (err) { console.warn('onGenerationCommentDeleted failed:', err.message); }
});
