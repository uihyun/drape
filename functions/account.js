// Account deletion — Apple Guideline 5.1.1(v) compliance.
//
// Nuclear delete: every user-owned doc + storage object. Webhook
// cancellation is RevenueCat-only here (drape doesn't ship a Stripe checkout
// in v0); when the web Pro tier lands, add cancelStripeSubscriptionIfAny.
//
// Order matters — Auth user last, so a mid-flight failure leaves the user
// signed-in and able to retry.

const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

const db = admin.firestore();

const BATCH_SIZE = 400;

function objectPathFromUrl(url) {
    if (typeof url !== 'string') return null;
    const m = url.match(/\/o\/([^?]+)/);
    if (!m) return null;
    try { return decodeURIComponent(m[1]); } catch { return null; }
}

async function deleteCollectionByQuery(query) {
    const snap = await query.get();
    if (snap.empty) return 0;
    let count = 0;
    let batch = db.batch();
    for (const doc of snap.docs) {
        batch.delete(doc.ref);
        count++;
        if (count % BATCH_SIZE === 0) {
            await batch.commit();
            batch = db.batch();
        }
    }
    await batch.commit();
    return count;
}

async function deleteItemAndStorage(itemDoc, bucket) {
    const data = itemDoc.data() || {};
    const paths = [data.originalPath, data.croppedPath].filter(Boolean);
    await Promise.allSettled(paths.map(p =>
        bucket.file(p).delete().catch(() => {})
    ));
    await itemDoc.ref.delete();
}

async function deleteOutfitAndChildren(outfitDoc, bucket) {
    const data = outfitDoc.data() || {};
    // comments subcollection (could include other users' comments — they go
    // with the outfit).
    await deleteCollectionByQuery(outfitDoc.ref.collection('comments'));
    if (data.coverPath) {
        await bucket.file(data.coverPath).delete().catch(() => {});
    }
    await outfitDoc.ref.delete();
}

async function deleteGenerationAndStorage(genDoc, bucket) {
    const data = genDoc.data() || {};
    const paths = data.variantPaths || [];
    await Promise.allSettled(paths.map(p =>
        bucket.file(p).delete().catch(() => {})
    ));
    await genDoc.ref.delete();
}

async function deleteOotdAndStorage(ootdDoc, bucket) {
    const data = ootdDoc.data() || {};
    if (data.photoPath) await bucket.file(data.photoPath).delete().catch(() => {});
    await ootdDoc.ref.delete();
}

exports.deleteAccount = onRequest({ timeoutSeconds: 540 }, async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Max-Age', '3600');

    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return; }

    let uid = null;
    try {
        const header = req.get('Authorization') || req.get('authorization') || '';
        const m = header.match(/^Bearer\s+(.+)$/);
        if (!m) { res.status(401).json({ error: 'AUTH_REQUIRED' }); return; }
        let decoded;
        try {
            decoded = await admin.auth().verifyIdToken(m[1]);
        } catch {
            res.status(401).json({ error: 'AUTH_REQUIRED' });
            return;
        }
        if (decoded.firebase?.sign_in_provider === 'anonymous') {
            res.status(400).json({ error: 'ANONYMOUS_NOT_DELETABLE' });
            return;
        }
        uid = decoded.uid;

        const bucket = admin.storage().bucket();
        const summary = {};

        const userDocBefore = await db.collection('users').doc(uid).get();
        const userDataBefore = userDocBefore.exists ? userDocBefore.data() : {};

        // 1) Items
        const itemsSnap = await db.collection('items').where('userId', '==', uid).get();
        for (const d of itemsSnap.docs) await deleteItemAndStorage(d, bucket);
        summary.items = itemsSnap.size;

        // 2) Outfits (+ comments subcollection)
        const outfitsSnap = await db.collection('outfits').where('userId', '==', uid).get();
        for (const d of outfitsSnap.docs) await deleteOutfitAndChildren(d, bucket);
        summary.outfits = outfitsSnap.size;

        // 3) OOTDs
        const ootdsSnap = await db.collection('ootds').where('userId', '==', uid).get();
        for (const d of ootdsSnap.docs) await deleteOotdAndStorage(d, bucket);
        summary.ootds = ootdsSnap.size;

        // 4) Generations (+ variants in storage)
        const gensSnap = await db.collection('generations').where('userId', '==', uid).get();
        for (const d of gensSnap.docs) await deleteGenerationAndStorage(d, bucket);
        summary.generations = gensSnap.size;

        // 5) Bookmarks subcollection
        summary.bookmarks = await deleteCollectionByQuery(
            db.collection('users').doc(uid).collection('bookmarks')
        );

        // 6) Lookbooks (collections)
        summary.lookbooks = await deleteCollectionByQuery(
            db.collection('collections').where('ownerId', '==', uid)
        );

        // 7) Follows (both directions)
        summary.followsOut = await deleteCollectionByQuery(
            db.collection('follows').where('followerId', '==', uid)
        );
        summary.followsIn = await deleteCollectionByQuery(
            db.collection('follows').where('followingId', '==', uid)
        );

        // 8) Blocks (both directions)
        summary.blocksOut = await deleteCollectionByQuery(
            db.collection('blocks').where('blockerId', '==', uid)
        );
        summary.blocksIn = await deleteCollectionByQuery(
            db.collection('blocks').where('blockedId', '==', uid)
        );

        // 9) Reports
        summary.reports = await deleteCollectionByQuery(
            db.collection('reports').where('reporterId', '==', uid)
        );

        // 10) Comments on others' outfits
        try {
            summary.otherComments = await deleteCollectionByQuery(
                db.collectionGroup('comments').where('userId', '==', uid)
            );
        } catch (e) {
            console.warn('otherComments cleanup skipped:', e.message);
            summary.otherComments = `skipped: ${e.code || e.message}`;
        }

        // 11) Profile + handle reverse index
        const profileRef = db.collection('profiles').doc(uid);
        const profileSnap = await profileRef.get();
        if (profileSnap.exists) {
            const handle = profileSnap.data()?.handle;
            if (handle) {
                await db.collection('handles').doc(handle).delete().catch(() => {});
                summary.handle = handle;
            }
            await profileRef.delete();
            summary.profile = 1;
        }

        // 12) Referral code reverse index
        const referralCode = userDataBefore?.referralCode;
        if (referralCode) {
            await db.collection('referralCodes').doc(referralCode).delete().catch(() => {});
            summary.referralCode = referralCode;
        }

        // 13) Storage: any leftover under identity/{uid}/, users/{uid}/, items/{uid}/, ootds/{uid}/, generations/{uid}/
        const prefixes = [
            `identity/${uid}/`,
            `users/${uid}/`,
            `items/${uid}/`,
            `ootds/${uid}/`,
            `generations/${uid}/`,
        ];
        for (const prefix of prefixes) {
            try { await bucket.deleteFiles({ prefix }); } catch (e) { console.warn(`storage cleanup ${prefix}:`, e.message); }
        }
        summary.storage = 'cleaned';

        // 14) users root doc
        await db.collection('users').doc(uid).delete();

        // 15) Firebase Auth user — last.
        await admin.auth().deleteUser(uid);

        console.info(`deleteAccount completed: uid=${uid}`, summary);
        res.json({ ok: true, summary });
    } catch (err) {
        console.error('deleteAccount failed:', { uid, err: err.message });
        res.status(500).json({ error: 'DELETE_FAILED', detail: err.message });
    }
});
