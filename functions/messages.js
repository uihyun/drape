// Push notifications for new marketplace DMs.
//
// Trigger: every doc created under threads/{threadId}/messages/{messageId}.
//   1. Read the parent thread for participants + activeIn presence map.
//   2. Skip if the recipient currently has the thread open (activeIn[uid]
//      === true) — the in-app realtime stream already showed it; a push
//      would just buzz them while they're typing back.
//   3. Read sender's profile for the notification title (display name /
//      handle / avatar).
//   4. Fan out via admin.messaging().sendEachForMulticast to every fcm
//      token registered under /users/{recipientUid}/fcmTokens/{token}.
//   5. Prune invalid tokens returned by FCM so they don't keep failing.
//
// Requires (set up outside this file):
//   - Firebase project has Cloud Messaging API enabled
//   - iOS: APNs auth key (.p8) uploaded in Firebase console
//   - Android: google-services.json under android/app/ at build time
// See CAPACITOR_SETUP.md §6 for the full checklist.

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

const db = admin.firestore();

// Auto-cleanup: drop marketplace threads (their messages + DM images) that
// have been inactive for 30+ days. Runs daily so the inbox stays tidy and
// stale conversations don't accumulate forever. updatedAt is bumped on every
// message, so "inactive" = no message in 30 days.
const THREAD_TTL_MS = 30 * 24 * 60 * 60 * 1000;
exports.cleanupOldThreads = onSchedule('every 24 hours', async () => {
    const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - THREAD_TTL_MS);
    let deleted = 0;
    try {
        const snap = await db.collection('threads')
            .where('updatedAt', '<', cutoff)
            .limit(400)
            .get();
        for (const docSnap of snap.docs) {
            const threadId = docSnap.id;
            const participants = Array.isArray(docSnap.data().participants) ? docSnap.data().participants : [];
            // Thread doc + its messages subcollection.
            await db.recursiveDelete(docSnap.ref);
            // DM images either participant uploaded for this thread.
            await Promise.all(participants.map(uid =>
                admin.storage().bucket().deleteFiles({ prefix: `dm/${uid}/${threadId}/` })
                    .catch(err => console.warn('dm image cleanup failed', threadId, err.message)),
            ));
            deleted += 1;
        }
    } catch (err) {
        console.warn('cleanupOldThreads failed:', err.message);
    }
    console.log(`cleanupOldThreads: removed ${deleted} stale threads`);
});

async function pruneInvalidTokens(uid, tokens, responses) {
    const dead = [];
    responses.forEach((res, i) => {
        if (res.success) return;
        const code = res.error?.code;
        if (code === 'messaging/registration-token-not-registered'
         || code === 'messaging/invalid-registration-token') {
            dead.push(tokens[i]);
        }
    });
    if (!dead.length) return;
    const batch = db.batch();
    dead.forEach(t => batch.delete(db.collection('users').doc(uid).collection('fcmTokens').doc(t)));
    try { await batch.commit(); }
    catch (err) { console.warn('prune dead tokens failed:', err.message); }
}

exports.onMessageCreated = onDocumentCreated(
    'threads/{threadId}/messages/{messageId}',
    async (event) => {
        const message = event.data?.data();
        // Text OR image messages notify; only truly empty docs are skipped.
        if (!message || !message.fromUid) return;
        const isImage = message.type === 'image';
        if (!isImage && !message.text) return;
        const { threadId } = event.params;

        let thread;
        try {
            const snap = await db.collection('threads').doc(threadId).get();
            if (!snap.exists) return;
            thread = snap.data();
        } catch (err) {
            console.warn('onMessageCreated thread read failed:', err.message);
            return;
        }

        const participants = Array.isArray(thread.participants) ? thread.participants : [];
        const recipients = participants.filter(u => u !== message.fromUid);
        if (!recipients.length) return;

        // Sender profile for the notification title — fall back to a
        // generic label so a missing profile doc never blocks delivery.
        let title = 'New message';
        try {
            const prof = await db.collection('profiles').doc(message.fromUid).get();
            const p = prof.exists ? prof.data() : null;
            if (p?.displayName) title = p.displayName;
            else if (p?.handle) title = `@${p.handle}`;
        } catch (_) { /* ignore */ }

        const body = isImage
            ? 'Photo'
            : (message.text.length > 140 ? `${message.text.slice(0, 137)}...` : message.text);

        // activeIn[uid] is a presence TIMESTAMP refreshed while the recipient
        // has the room open+foreground. Only a RECENT one suppresses the push —
        // a stale value (force-quit / old build / missed background event) or a
        // legacy boolean must never perma-suppress.
        const ACTIVE_TTL_MS = 45 * 1000;
        const now = Date.now();
        for (const uid of recipients) {
            const activeAt = thread.activeIn && thread.activeIn[uid];
            const activeMs = activeAt && typeof activeAt.toMillis === 'function' ? activeAt.toMillis() : 0;
            if (activeMs && (now - activeMs) < ACTIVE_TTL_MS) {
                console.log(`onMessageCreated: ${uid} recently active in ${threadId}, skipping push`);
                continue;
            }

            let tokens;
            try {
                const snap = await db.collection('users').doc(uid)
                    .collection('fcmTokens').get();
                tokens = snap.docs.map(d => d.id).filter(Boolean);
            } catch (err) {
                console.warn('fcmTokens read failed for', uid, err.message);
                continue;
            }
            if (!tokens.length) {
                console.log(`onMessageCreated: no fcmTokens for ${uid} — device hasn't registered for push`);
                continue;
            }
            console.log(`onMessageCreated: sending to ${uid} (${tokens.length} token(s))`);

            try {
                const res = await admin.messaging().sendEachForMulticast({
                    tokens,
                    notification: { title, body },
                    data: {
                        threadId,
                        itemId: thread.itemId || '',
                        type: 'dm',
                    },
                    // iOS-specific: badge + collapse so a chatty thread
                    // doesn't spam the lock screen with N rows.
                    apns: {
                        payload: {
                            aps: {
                                'thread-id': threadId,
                                sound: 'default',
                            },
                        },
                    },
                    android: {
                        collapseKey: threadId,
                        notification: { tag: threadId },
                    },
                });
                console.log(`onMessageCreated: ${uid} delivered ${res.successCount}/${tokens.length}`);
                await pruneInvalidTokens(uid, tokens, res.responses);
            } catch (err) {
                console.warn('sendEachForMulticast failed for', uid, err.message);
            }
        }
    },
);
