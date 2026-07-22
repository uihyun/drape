// === Drape Cloud Functions entrypoint ==================================
// Heavy lifting (processItem + virtualTryOn) lives in items.js and tryon.js.
// This file holds:
//   - shared helpers (auth verify, rate limit)
//   - the per-user lifecycle endpoint (initializeUser)
//   - re-exports for trigger modules

const functions = require('firebase-functions');
const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const cors = require('cors');

admin.initializeApp();

const profileFns = require('./profile.js');
const fitsFns = require('./fits.js');

const corsHandler = cors({ origin: true });
const db = admin.firestore();

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

// Rate limiter — per-user (or per-IP for anonymous). 30/min default;
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

module.exports.helpers = { verifyAuth, checkRateLimit };

// ── initializeUser ─────────────────────────────────────────────────────
// Called by auth-service.js immediately after sign-in. Just ensures the
// /profiles/{uid} doc + handle exist; everything else lives in its own
// service now (no credits, no daily bonus, no referral).
exports.initializeUser = onRequest(async (req, res) => {
    corsHandler(req, res, async () => {
        try {
            if (req.method === 'OPTIONS') return res.status(204).end();
            if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

            const auth = await verifyAuth(req);
            if (!auth) return res.status(401).json({ error: 'auth_required' });

            try {
                const userRecord = await admin.auth().getUser(auth.uid);
                await profileFns.ensureProfile(auth.uid, {
                    displayName: userRecord.displayName || '',
                });
            } catch (e) {
                console.warn('ensureProfile failed (non-fatal):', e.message);
            }
            // Mint the user's invite code (new users + lazily for existing ones).
            try { await fitsFns.ensureInviteCode(auth.uid); }
            catch (e) { console.warn('ensureInviteCode failed (non-fatal):', e.message); }

            res.json({ ok: true });
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
exports.analyzeGeneration = itemFns.analyzeGeneration;
exports.processOotdPhoto = itemFns.processOotdPhoto;
exports.cleanupStuckItems = itemFns.cleanupStuckItems;

// ── On-demand translation (Phase 2) ────────────────────────────────────
const translateFns = require('./translate.js');
exports.translateContent = translateFns.translateContent;

// ── Periodic reminder push ─────────────────────────────────────────────
const reminderFns = require('./reminders.js');
exports.sendReminders = reminderFns.sendReminders;

// ── Social push (like / try-on) + try-on count ─────────────────────────
const socialFns = require('./social-push.js');
exports.onOutfitLiked = socialFns.onOutfitLiked;
exports.onBoardLiked = socialFns.onBoardLiked;
exports.onLookTriedOn = socialFns.onLookTriedOn;

// ── Virtual try-on ─────────────────────────────────────────────────────
const tryonFns = require('./tryon.js');
exports.virtualTryOn = tryonFns.virtualTryOn;
exports.cleanupStuckTryons = tryonFns.cleanupStuckTryons;

// ── Try-on "fits" quota + invite rewards ───────────────────────────────
exports.redeemInvite = fitsFns.redeemInvite;
exports.getInviteCode = fitsFns.getInviteCode;

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
exports.onOotdCommentCreated     = commentFns.onOotdCommentCreated;
exports.onOotdCommentDeleted     = commentFns.onOotdCommentDeleted;
exports.onBoardCommentCreated    = commentFns.onBoardCommentCreated;
exports.onBoardCommentDeleted    = commentFns.onBoardCommentDeleted;
exports.onFollowCreated          = followFns.onFollowCreated;
exports.onFollowDeleted          = followFns.onFollowDeleted;
exports.recountMyFollows         = followFns.recountMyFollows;
exports.onCollectionItemCreated  = collectionFns.onCollectionItemCreated;
exports.onCollectionItemDeleted  = collectionFns.onCollectionItemDeleted;

// ── Profile + handle ───────────────────────────────────────────────────
exports.claimHandle              = profileFns.claimHandle;
exports.updateProfile            = profileFns.updateProfile;
exports.onOutfitListChange       = profileFns.onOutfitListChange;
exports.onOutfitDeletedDecrement = profileFns.onOutfitDeletedDecrement;

// ── Account deletion ───────────────────────────────────────────────────
const accountFns = require('./account.js');
exports.deleteAccount = accountFns.deleteAccount;

// ── Push notifications for marketplace DMs ─────────────────────────────
const messageFns = require('./messages.js');
exports.onMessageCreated = messageFns.onMessageCreated;
exports.cleanupOldThreads = messageFns.cleanupOldThreads;

// ── Admin analytics (email-gated; admin SDK reads across all accounts) ──
const adminFns = require('./admin.js');
exports.adminOverview      = adminFns.adminOverview;
exports.adminTopTryons     = adminFns.adminTopTryons;
exports.adminUsers         = adminFns.adminUsers;
exports.adminUserDetail    = adminFns.adminUserDetail;
exports.adminErrors        = adminFns.adminErrors;
exports.dailyAdminSnapshot = adminFns.dailyAdminSnapshot;

// ── Marketing post queue (admin-gated; publisher lands once Meta tokens exist) ──
const marketingFns = require('./marketing.js');
exports.adminMarketingList   = marketingFns.adminMarketingList;
exports.adminMarketingUpsert = marketingFns.adminMarketingUpsert;
exports.adminMarketingDelete = marketingFns.adminMarketingDelete;
exports.adminMarketingAssets = marketingFns.adminMarketingAssets;
exports.publishMarketingPosts   = marketingFns.publishMarketingPosts;
exports.refreshMarketingTokens  = marketingFns.refreshMarketingTokens;

// ── GA screen-engagement proxy for /admin ──
exports.adminScreenEngagement = require('./ga.js').adminScreenEngagement;
