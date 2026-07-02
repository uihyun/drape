// Maintain commentCount on every commentable parent (outfits, ootds,
// boards) via Firestore triggers. Clients can't be trusted to bump the
// counter, and we need it on the parent for feed-card display without
// a separate read.

const { onDocumentCreated, onDocumentDeleted } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const { notify } = require('./notifications.js');

const db = admin.firestore();

function bump(parentColl, parentId, delta) {
    return db.collection(parentColl).doc(parentId).update({
        commentCount: admin.firestore.FieldValue.increment(delta),
    });
}

// Bell notification to the parent's owner when someone comments (skips self).
async function notifyComment(parentColl, parentId, comment) {
    try {
        const snap = await db.collection(parentColl).doc(parentId).get();
        const ownerUid = snap.exists ? snap.data().userId : null;
        await notify(ownerUid, {
            type: 'comment',
            actorUid: comment?.userId,
            targetType: parentColl === 'boards' ? 'board' : 'outfit',
            targetId: parentId,
            preview: comment?.text,
        });
    } catch (err) { console.warn('notifyComment failed:', err.message); }
}

// Outfits
exports.onCommentCreated = onDocumentCreated('outfits/{outfitId}/comments/{commentId}', async (event) => {
    try { await bump('outfits', event.params.outfitId, 1); }
    catch (err) { console.warn('onCommentCreated outfits failed:', err.message); }
    await notifyComment('outfits', event.params.outfitId, event.data?.data());
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
    await notifyComment('boards', event.params.boardId, event.data?.data());
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
