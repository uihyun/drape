// Profile + handle management.
//
// `profiles/{uid}` is the public-readable subset (handle, displayName,
// photoURL, bio, follower/following/outfit counts). `handles/{handle}` is
// the reverse index that lets us look up a profile by handle.
//
// All writes are server-only (per firestore.rules).

const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated, onDocumentDeleted, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

const db = admin.firestore();

const HANDLE_RE = /^[a-z0-9_]{3,20}$/;
const BIO_MAX = 80;
const DISPLAY_NAME_MAX = 30;
const INSTAGRAM_MAX = 30;
const INSTAGRAM_RE = /^[a-zA-Z0-9._]{1,30}$/;
const LOCATION_MAX = 60;

function normalizeHandle(input) {
    return String(input || '').trim().toLowerCase();
}

function defaultHandleForUid(uid) {
    return `drape${uid.replace(/[^a-z0-9]/gi, '').slice(0, 8).toLowerCase()}`;
}

// Profile is created with photoURL: null intentionally — the user
// uploads their own from Settings. We don't pull from auth provider so
// the empty avatar prompts a real choice.
async function ensureProfile(uid, { displayName }) {
    const profileRef = db.collection('profiles').doc(uid);

    return db.runTransaction(async (txn) => {
        const profileSnap = await txn.get(profileRef);
        const existing = profileSnap.exists ? profileSnap.data() : null;

        if (existing && existing.handle) {
            const update = {};
            if (displayName && displayName !== existing.displayName) update.displayName = displayName;
            if (Object.keys(update).length) txn.update(profileRef, update);
            return existing.handle;
        }

        let handle = defaultHandleForUid(uid);
        for (let attempt = 0; attempt < 5; attempt++) {
            const handleRef = db.collection('handles').doc(handle);
            const handleSnap = await txn.get(handleRef);
            if (!handleSnap.exists) {
                txn.set(handleRef, {
                    uid,
                    claimedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                txn.set(profileRef, {
                    handle,
                    displayName: displayName || '',
                    photoURL: null,
                    bio: '',
                    location: '',
                    followerCount: 0,
                    followingCount: 0,
                    outfitCount: 0,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
                return handle;
            }
            handle = `${defaultHandleForUid(uid)}${attempt + 2}`;
        }
        throw new Error('HANDLE_ALLOCATION_FAILED');
    });
}

exports.claimHandle = onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Max-Age', '3600');

    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return; }

    try {
        const header = req.get('Authorization') || '';
        const m = header.match(/^Bearer\s+(.+)$/);
        if (!m) { res.status(401).json({ error: 'AUTH_REQUIRED' }); return; }
        const decoded = await admin.auth().verifyIdToken(m[1]);
        if (decoded.firebase?.sign_in_provider === 'anonymous') {
            res.status(401).json({ error: 'AUTH_REQUIRED' });
            return;
        }
        const uid = decoded.uid;

        const desired = normalizeHandle(req.body?.data?.handle);
        if (!HANDLE_RE.test(desired)) {
            res.status(400).json({ error: 'INVALID_HANDLE' });
            return;
        }

        await db.runTransaction(async (txn) => {
            const desiredRef = db.collection('handles').doc(desired);
            const desiredSnap = await txn.get(desiredRef);
            if (desiredSnap.exists && desiredSnap.data().uid !== uid) {
                throw new HttpsError('already-exists', 'HANDLE_TAKEN');
            }

            const profileRef = db.collection('profiles').doc(uid);
            const profileSnap = await txn.get(profileRef);
            const previousHandle = profileSnap.exists ? profileSnap.data().handle : null;

            if (previousHandle === desired) return;

            txn.set(desiredRef, {
                uid,
                claimedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            if (previousHandle && previousHandle !== desired) {
                txn.delete(db.collection('handles').doc(previousHandle));
            }

            if (profileSnap.exists) {
                txn.update(profileRef, { handle: desired });
            } else {
                txn.set(profileRef, {
                    handle: desired,
                    displayName: decoded.name || '',
                    photoURL: null,
                    bio: '',
                    location: '',
                    followerCount: 0,
                    followingCount: 0,
                    outfitCount: 0,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
        });

        res.json({ handle: desired });
    } catch (err) {
        if (err instanceof HttpsError) {
            const code = err.code === 'already-exists' ? 409 : 400;
            res.status(code).json({ error: err.message });
            return;
        }
        if (err.message === 'HANDLE_TAKEN') {
            res.status(409).json({ error: 'HANDLE_TAKEN' });
            return;
        }
        console.error('claimHandle failed:', err);
        res.status(500).json({ error: 'CLAIM_FAILED' });
    }
});

exports.updateProfile = onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Max-Age', '3600');

    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return; }

    try {
        const header = req.get('Authorization') || '';
        const m = header.match(/^Bearer\s+(.+)$/);
        if (!m) { res.status(401).json({ error: 'AUTH_REQUIRED' }); return; }
        const decoded = await admin.auth().verifyIdToken(m[1]);
        if (decoded.firebase?.sign_in_provider === 'anonymous') {
            res.status(401).json({ error: 'AUTH_REQUIRED' });
            return;
        }

        const data = req.body?.data || {};
        const update = {};
        const result = {};

        if (typeof data.bio === 'string') {
            const bio = data.bio.slice(0, BIO_MAX);
            update.bio = bio;
            result.bio = bio;
        }
        if (typeof data.displayName === 'string') {
            const displayName = data.displayName.trim().slice(0, DISPLAY_NAME_MAX);
            update.displayName = displayName;
            result.displayName = displayName;
            await admin.auth().updateUser(decoded.uid, { displayName: displayName || null });
        }
        if (typeof data.instagram === 'string') {
            const raw = data.instagram.trim()
                .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
                .replace(/^@/, '')
                .replace(/[\/?#].*$/, '')
                .slice(0, INSTAGRAM_MAX);
            if (raw && !INSTAGRAM_RE.test(raw)) {
                res.status(400).json({ error: 'INVALID_INSTAGRAM' });
                return;
            }
            update.instagram = raw;
            result.instagram = raw;
        }
        if (typeof data.location === 'string') {
            const location = data.location.trim().slice(0, LOCATION_MAX);
            update.location = location;
            result.location = location;
        }
        if (typeof data.photoURL === 'string') {
            // Empty string = explicit removal. Anything else: trust the
            // client URL since the only writable Storage path is
            // /users/{uid}/profile/{filename} (owner-only per rules).
            const photoURL = data.photoURL.trim();
            update.photoURL = photoURL || null;
            result.photoURL = update.photoURL;
        }
        // Calendar day-cell look (cutout vs full photo) — public-readable so a
        // visitor's PublicCalendar renders the owner's chosen style too.
        if (typeof data.calendarShowBackground === 'boolean') {
            update.calendarShowBackground = data.calendarShowBackground;
            result.calendarShowBackground = data.calendarShowBackground;
        }
        // Reminder targeting: the user's IANA timezone + language, captured on
        // login, so the scheduled reminder sends at their local evening in their
        // language. Plus an opt-out. (Stored server-side; admin set bypasses rules.)
        if (typeof data.timezone === 'string') {
            update.timezone = data.timezone.slice(0, 64);
            // The tz sync fires once per app session (login) — use it as a
            // last-active heartbeat so reminders skip currently-active users.
            update.lastActiveAt = admin.firestore.FieldValue.serverTimestamp();
        }
        if (data.lang === 'en' || data.lang === 'ko' || data.lang === 'ja') {
            update.lang = data.lang;
        }
        if (typeof data.remindersOptOut === 'boolean') {
            update.remindersOptOut = data.remindersOptOut;
            result.remindersOptOut = data.remindersOptOut;
        }

        if (Object.keys(update).length === 0) {
            res.status(400).json({ error: 'NO_FIELDS' });
            return;
        }

        await db.collection('profiles').doc(decoded.uid).set(update, { merge: true });
        res.json(result);
    } catch (err) {
        console.error('updateProfile failed:', err);
        res.status(500).json({ error: 'UPDATE_FAILED' });
    }
});

// Maintain profiles.outfitCount when an outfit becomes/leaves isListed=true.
exports.onOutfitListChange = onDocumentUpdated('outfits/{outfitId}', async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;
    const wasListed = before.isListed === true;
    const isListed = after.isListed === true;
    if (wasListed === isListed) return;
    if (!after.userId) return;
    try {
        await db.collection('profiles').doc(after.userId).set(
            { outfitCount: admin.firestore.FieldValue.increment(isListed ? 1 : -1) },
            { merge: true },
        );
    } catch (err) {
        console.warn('onOutfitListChange counter update failed:', err.message);
    }
});

exports.onOutfitDeletedDecrement = onDocumentDeleted('outfits/{outfitId}', async (event) => {
    const data = event.data?.data();
    if (!data || !data.userId) return;
    if (data.isListed !== true) return;
    try {
        await db.collection('profiles').doc(data.userId).set(
            { outfitCount: admin.firestore.FieldValue.increment(-1) },
            { merge: true },
        );
    } catch (err) {
        console.warn('onOutfitDeletedDecrement failed:', err.message);
    }
});

exports.ensureProfile = ensureProfile;
exports.HANDLE_RE = HANDLE_RE;
