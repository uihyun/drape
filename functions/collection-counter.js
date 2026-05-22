// Maintain lookbooks.itemCount + auto-set coverOutfitId on first add.
// "Lookbooks" are drape's equivalent of voda's "collections" — a curated
// group of outfits ("Summer 2026", "Office Looks", etc.).
//
// The on-disk collection name stays `collections` (compatibility with the
// generic plumbing in collection-service.js); the items subcollection is
// keyed by outfitId.

const { onDocumentCreated, onDocumentDeleted } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

const db = admin.firestore();

exports.onCollectionItemCreated = onDocumentCreated('collections/{collectionId}/items/{outfitId}', async (event) => {
    const { collectionId, outfitId } = event.params;
    try {
        const colRef = db.collection('collections').doc(collectionId);
        const colSnap = await colRef.get();
        if (!colSnap.exists) return;
        const update = {
            itemCount: admin.firestore.FieldValue.increment(1),
        };
        if (!colSnap.data().coverOutfitId) {
            update.coverOutfitId = outfitId;
        }
        await colRef.update(update);
    } catch (err) {
        console.warn('onCollectionItemCreated failed:', err.message);
    }
});

exports.onCollectionItemDeleted = onDocumentDeleted('collections/{collectionId}/items/{outfitId}', async (event) => {
    const { collectionId, outfitId } = event.params;
    try {
        const colRef = db.collection('collections').doc(collectionId);
        const colSnap = await colRef.get();
        if (!colSnap.exists) return;
        const update = {
            itemCount: admin.firestore.FieldValue.increment(-1),
        };
        if (colSnap.data().coverOutfitId === outfitId) {
            update.coverOutfitId = admin.firestore.FieldValue.delete();
        }
        await colRef.update(update);
    } catch (err) {
        console.warn('onCollectionItemDeleted failed:', err.message);
    }
});
