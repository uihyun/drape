// === Drape Cloud Functions entrypoint ==================================
// Heavy lifting (processItem + virtualTryOn) lives in items.js and tryon.js.
// This file holds:
//   - shared helpers (auth verify, credits, rate limit)
//   - the per-user lifecycle endpoints (initializeUser, healthCheck)
//   - re-exports for trigger / webhook modules

const functions = require('firebase-functions');
const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const cors = require('cors');

admin.initializeApp();

const { assignReferralCode } = require('./referral.js');
const profileFns = require('./profile.js');

const corsHandler = cors({ origin: true });
const db = admin.firestore();

const SIGNUP_BONUS = 3;
const DAILY_BONUS = 1;
const DAILY_BONUS_CAP = 10;
const MAX_GUEST_TRANSFER = 2;

// Per-call credit costs. Try-on Pro is the headline expense; processItem is
// cheap (one Flash call + one Flash vision call) so we don't charge.
const COSTS = {
  tryOnPro:   1,
  tryOnFlash: 0, // cheap preview tier — free
  processItem: 0, // registration must feel free, no matter how often
};

async function verifyAuth(req) {
    const header = req.get('Authorization') || req.get('authorization') || '';
    const match = header.match(/^Bearer\s+(.+)$/);
    if (!match) return null;
    try {
        const decoded = await admin.auth().verifyIdToken(match[1]);
        return {
            uid: decoded.uid,
            isAnonymous: decoded.firebase?.sign_in_provider === 'anonymous',
        };
    } catch (err) {
        console.warn('ID token verification failed:', err.message);
        return null;
    }
}

function todayUtc() {
    return new Date().toISOString().slice(0, 10);
}

/**
 * Initialize credits for a user (idempotent) and apply the daily login bonus.
 * Optionally transfers leftover guest credits on first init (capped).
 */
async function initializeAndApplyDaily(uid, guestCreditsClaimed = 0) {
    const userRef = db.collection('users').doc(uid);
    const today = todayUtc();
    const transfer = Math.max(0, Math.min(MAX_GUEST_TRANSFER, Number(guestCreditsClaimed) || 0));

    return db.runTransaction(async (txn) => {
        const snap = await txn.get(userRef);
        const data = snap.data() || {};
        const isFirstInit = data.credits === undefined;

        let credits = isFirstInit ? (SIGNUP_BONUS + transfer) : (data.credits || 0);
        let lifetimeCredits = isFirstInit ? (SIGNUP_BONUS + transfer) : (data.lifetimeCredits || 0);
        let lastDailyBonusAt = data.lastDailyBonusAt || null;

        if (isFirstInit) {
            lastDailyBonusAt = today;
        } else if (lastDailyBonusAt !== today) {
            // Pro users are unlimited — skip credit bump but still mark today.
            if (data.plan !== 'pro' && credits < DAILY_BONUS_CAP) {
                credits += DAILY_BONUS;
                lifetimeCredits += DAILY_BONUS;
            }
            lastDailyBonusAt = today;
        }

        const update = { credits, lifetimeCredits, lastDailyBonusAt };

        if (!data.referralCode) {
            update.referralCode = await assignReferralCode(db, uid, txn);
        }

        if (isFirstInit) {
            txn.set(userRef, update, { merge: true });
        } else {
            txn.update(userRef, update);
        }
        return { ...update, isFirstInit };
    });
}

async function deductCredits(uid, amount) {
    if (!amount || amount <= 0) return null;
    const userRef = db.collection('users').doc(uid);
    return db.runTransaction(async (txn) => {
        const snap = await txn.get(userRef);
        if (!snap.exists) throw new Error('USER_NOT_INITIALIZED');
        const data = snap.data();
        if (data.plan === 'pro') return data.credits || 0;
        const current = data.credits || 0;
        if (current < amount) throw new Error('INSUFFICIENT_CREDITS');
        txn.update(userRef, { credits: current - amount });
        return current - amount;
    });
}

async function refundCredits(uid, amount) {
    if (!amount || amount <= 0) return;
    const userRef = db.collection('users').doc(uid);
    try {
        await db.runTransaction(async (txn) => {
            const snap = await txn.get(userRef);
            const data = snap.data();
            if (!data || data.plan === 'pro') return;
            const current = data.credits || 0;
            txn.update(userRef, { credits: current + amount });
        });
    } catch (err) {
        console.error('Credit refund failed:', err);
    }
}

// Rate limiter — per-user (or per-IP for anonymous). 30/min by default;
// processItem can spike higher when the user adds 10 things in a row.
async function checkRateLimit(identifier, { perMinute = 30 } = {}) {
    const rateLimitDoc = db.collection('rateLimits').doc(identifier);
    const now = Date.now();
    const windowStart = now - (60 * 1000);
    const doc = await rateLimitDoc.get();
    const data = doc.data();
    const requests = (data?.requests || []).filter(req => req > windowStart);
    if (requests.length >= perMinute) {
        throw new Error('RATE_LIMIT');
    }
    requests.push(now);
    await rateLimitDoc.set({ requests }, { merge: true });
}

module.exports.helpers = {
    verifyAuth, todayUtc,
    initializeAndApplyDaily, deductCredits, refundCredits,
    checkRateLimit, COSTS,
};

// ── initializeUser ─────────────────────────────────────────────────────
// Called by auth-service.js immediately after sign-in. Allocates credits,
// daily bonus, referral code, and ensures the profile doc exists.
exports.initializeUser = onRequest(async (req, res) => {
    corsHandler(req, res, async () => {
        try {
            if (req.method === 'OPTIONS') return res.status(204).end();
            if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

            const auth = await verifyAuth(req);
            if (!auth) return res.status(401).json({ error: 'auth_required' });

            const body = req.body || {};
            const guestCreditsClaimed = Number(body.guestCreditsClaimed || 0);
            const credits = await initializeAndApplyDaily(auth.uid, guestCreditsClaimed);

            // Best-effort profile bootstrap. The Firebase Auth token already
            // carries displayName + photoURL, so we don't need them in the
            // request body.
            try {
                const userRecord = await admin.auth().getUser(auth.uid);
                await profileFns.ensureProfile(auth.uid, {
                    displayName: userRecord.displayName || '',
                    photoURL: userRecord.photoURL || null,
                });
            } catch (e) {
                console.warn('ensureProfile failed (non-fatal):', e.message);
            }

            res.json({ ok: true, ...credits });
        } catch (err) {
            console.error('initializeUser failed:', err);
            res.status(500).json({ error: err.message || 'internal' });
        }
    });
});

exports.healthCheck = functions.https.onRequest((req, res) => {
    res.json({ ok: true, ts: Date.now() });
});

// ── Closet pipeline ────────────────────────────────────────────────────
const itemFns = require('./items.js');
exports.processItem = itemFns.processItem;
exports.detectItems = itemFns.detectItems;
exports.processIdentityRef = itemFns.processIdentityRef;
exports.analyzeOotd = itemFns.analyzeOotd;
exports.processOotdPhoto = itemFns.processOotdPhoto;

// ── Virtual try-on ─────────────────────────────────────────────────────
const tryonFns = require('./tryon.js');
exports.virtualTryOn = tryonFns.virtualTryOn;

// ── Billing — RevenueCat + Stripe deferred to a later phase. ───────────
// When ready, re-enable here:
//   const revenueCatFns = require('./revenuecat.js');
//   exports.revenueCatWebhook = revenueCatFns.revenueCatWebhook;
// and set the REVENUECAT_WEBHOOK_AUTH secret to a real value.

// ── Referrals + promo codes (growth, not billing) ──────────────────────
const referralFns = require('./referral.js');
const promoFns    = require('./promo.js');
exports.redeemReferral = referralFns.redeemReferral;
exports.redeemPromo    = promoFns.redeemPromo;

// ── Moderation triggers ────────────────────────────────────────────────
const moderationFns = require('./moderation.js');
exports.onOutfitListed   = moderationFns.onOutfitListed;
exports.onReportCreated  = moderationFns.onReportCreated;
exports.onCaptionChanged = moderationFns.onCaptionChanged;

// ── Comment + lookbook + follow counters ───────────────────────────────
const commentFns    = require('./comment-counter.js');
const followFns     = require('./follow-counters.js');
const collectionFns = require('./collection-counter.js');
exports.onCommentCreated         = commentFns.onCommentCreated;
exports.onCommentDeleted         = commentFns.onCommentDeleted;
exports.onFollowCreated          = followFns.onFollowCreated;
exports.onFollowDeleted          = followFns.onFollowDeleted;
exports.onCollectionItemCreated  = collectionFns.onCollectionItemCreated;
exports.onCollectionItemDeleted  = collectionFns.onCollectionItemDeleted;

// ── Profile + handle ───────────────────────────────────────────────────
exports.claimHandle              = profileFns.claimHandle;
exports.updateProfile            = profileFns.updateProfile;
exports.onOutfitListChange       = profileFns.onOutfitListChange;
exports.onOutfitDeletedDecrement = profileFns.onOutfitDeletedDecrement;
exports.onUserCountsChange       = profileFns.onUserCountsChange;

// ── Account deletion ───────────────────────────────────────────────────
const accountFns = require('./account.js');
exports.deleteAccount = accountFns.deleteAccount;
