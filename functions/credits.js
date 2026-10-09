// Credits — the one currency in drape (owner, 2026-10-09).
//
// Everything that costs us a model call is priced in credits, out of one
// wallet with two buckets:
//
//   users/{uid}.creditDayKey     "YYYY-MM-DD" in profiles.timezone — which day
//                                the daily counter belongs to (lazy reset).
//   users/{uid}.creditDailyUsed  credits spent today, of DAILY_CREDITS free.
//   users/{uid}.creditBalance    carried-over credits (invites, admin grants,
//                                purchases later). Spent only AFTER the daily
//                                allowance, and never expires — a balance
//                                someone earned or paid for must not vanish.
//   users/{uid}.creditsV         1 once the doc is on this scheme.
//
// Prices are whole numbers on a 10x scale so a text call can cost less than
// an image without fractions: a try-on is an image generation (~$0.07), a
// chat turn or verdict is a Flash text call (~$0.005). Before this, a fit was
// one try-on and the stylist sold blocks of 3/10 uses for one fit, which no
// one could follow.
//
// Legacy (fits) docs are converted on first touch, value for value: a fit
// was one try-on, so fitBonus x10; unused stylist top-ups (style*Extra) were
// one use each, so +1 each. The fit* fields stay written as a mirror
// (try-ons affordable) because 2.2.1 apps compute their N/5 meter from them.
//
// All fields are server-only (firestore.rules deny list). The client reads
// them for display and can never write them.

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

const db = admin.firestore();

const DAILY_CREDITS = 50;
const PRICE = { tryon: 10, chat: 1, verdict: 1, rec: 1 };
const INVITE_REWARD = 100;
const INVITE_CAP = 100; // soft cap: max invites one account can be credited for
const LEGACY_SCALE = 10;

// "YYYY-MM-DD" in an IANA tz (en-CA formats as ISO date). The daily allowance
// resets at the user's local midnight. Falls back to New York (matches reminders).
function dayKey(tz) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'America/New_York' }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
  }
}

// The wallet as of `day`, converting a legacy doc on the fly. Pure, and
// mirrored by src/hooks/useCredits.js so the meter matches what's enforced.
function walletOf(u, day) {
  if (u.creditsV === 1) {
    return {
      dailyUsed: day && u.creditDayKey === day ? (u.creditDailyUsed || 0) : 0,
      balance: u.creditBalance || 0,
    };
  }
  const legacyUsed = day && u.fitDayKey === day ? (u.fitDailyUsed || 0) * LEGACY_SCALE : 0;
  return {
    dailyUsed: Math.min(DAILY_CREDITS, legacyUsed),
    balance: (u.fitBonus || 0) * LEGACY_SCALE
      + (u.styleRecExtra || 0) + (u.styleVerdictExtra || 0) + (u.styleChatExtra || 0),
  };
}

function walletFields(day, w) {
  return {
    creditsV: 1,
    creditDayKey: day || null,
    creditDailyUsed: w.dailyUsed,
    creditBalance: w.balance,
    // 2.2.1 mirror: try-ons left = 5 - fitDailyUsed (+ fitBonus).
    fitDayKey: day || null,
    fitDailyUsed: Math.ceil(w.dailyUsed / LEGACY_SCALE),
    fitBonus: Math.floor(w.balance / LEGACY_SCALE),
    // Folded into creditBalance on conversion.
    styleRecExtra: 0, styleVerdictExtra: 0, styleChatExtra: 0,
  };
}

// Spend `cost` credits INSIDE a transaction: today's free allowance first,
// then the balance, splitting across the two when needed. Throws
// `resource-exhausted 'out_of_fits'` (the token every app build already
// handles) when both together fall short. Returns the charge for refundCredits.
async function reserveCredits(txn, uid, cost) {
  const userRef = db.collection('users').doc(uid);
  const profRef = db.collection('profiles').doc(uid);
  const [userSnap, profSnap] = await Promise.all([txn.get(userRef), txn.get(profRef)]);
  const u = userSnap.exists ? userSnap.data() : {};
  const day = dayKey(profSnap.exists && profSnap.data().timezone);
  const w = walletOf(u, day);
  const dailyLeft = Math.max(0, DAILY_CREDITS - w.dailyUsed);
  if (dailyLeft + w.balance < cost) throw new HttpsError('resource-exhausted', 'out_of_fits');
  const fromDaily = Math.min(cost, dailyLeft);
  const fromBalance = cost - fromDaily;
  const next = { dailyUsed: w.dailyUsed + fromDaily, balance: w.balance - fromBalance };
  txn.set(userRef, walletFields(day, next), { merge: true });
  return {
    cost, day, daily: fromDaily, balance: fromBalance,
    left: DAILY_CREDITS - next.dailyUsed + next.balance,
  };
}

// Give a charge back — only when the call produced nothing. The daily part
// returns only if it's still the same day (after midnight the allowance is
// full again anyway); the balance part always returns. Best-effort: a refund
// failure never breaks the caller.
async function refundCredits(uid, charge) {
  if (!charge || !charge.cost) return;
  const userRef = db.collection('users').doc(uid);
  try {
    await db.runTransaction(async (txn) => {
      const snap = await txn.get(userRef);
      if (!snap.exists) return;
      const u = snap.data();
      const day = u.creditDayKey || null;
      const w = walletOf(u, day);
      const next = {
        dailyUsed: day === charge.day ? Math.max(0, w.dailyUsed - charge.daily) : w.dailyUsed,
        balance: w.balance + charge.balance,
      };
      txn.set(userRef, walletFields(day, next), { merge: true });
    });
  } catch (e) { console.warn('refundCredits failed:', uid, e.message); }
}

// Add to the carried-over balance inside a transaction, given the already-read
// users doc. Keeps whatever day the doc's counter belongs to.
function grantCredits(txn, ref, u, amount) {
  const day = u.creditsV === 1 ? (u.creditDayKey || null) : (u.fitDayKey || null);
  const w = walletOf(u, day);
  txn.set(ref, walletFields(day, { dailyUsed: w.dailyUsed, balance: w.balance + amount }), { merge: true });
}

// Ambiguity-free alphabet (no 0/O/1/I/L).
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function randomCode() {
  let s = '';
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return s;
}

// Mint (idempotent) a unique invite code for a user. Stored on users.inviteCode
// + reverse index inviteCodes/{code}. Called at signup + lazily for old users.
async function ensureInviteCode(uid) {
  const userRef = db.collection('users').doc(uid);
  const snap = await userRef.get();
  if (snap.exists && snap.data().inviteCode) return snap.data().inviteCode;
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = randomCode();
    const codeRef = db.collection('inviteCodes').doc(code);
    try {
      await db.runTransaction(async (txn) => {
        if ((await txn.get(codeRef)).exists) throw new Error('COLLISION');
        txn.set(codeRef, { uid, createdAt: admin.firestore.FieldValue.serverTimestamp() });
        txn.set(userRef, { inviteCode: code }, { merge: true });
      });
      return code;
    } catch (e) { if (e.message !== 'COLLISION') throw e; }
  }
  throw new Error('INVITE_CODE_ALLOCATION_FAILED');
}

// The invitee submits an inviter's code (once, ever). Both sides get
// INVITE_REWARD: the invitee once ever (gated by invitedBy), the inviter up to
// INVITE_CAP invites (abuse guard).
exports.redeemInvite = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'sign in required');
  const code = String(request.data?.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  if (!code) throw new HttpsError('invalid-argument', 'no_code');

  const userRef = db.collection('users').doc(uid);
  const codeRef = db.collection('inviteCodes').doc(code);
  return db.runTransaction(async (txn) => {
    const [userSnap, codeSnap] = await Promise.all([txn.get(userRef), txn.get(codeRef)]);
    const u = userSnap.exists ? userSnap.data() : {};
    if (u.invitedBy) throw new HttpsError('failed-precondition', 'already_redeemed');
    if (!codeSnap.exists) throw new HttpsError('not-found', 'invalid_code');
    const inviterUid = codeSnap.data().uid;
    if (inviterUid === uid) throw new HttpsError('failed-precondition', 'self_referral');

    const inviterRef = db.collection('users').doc(inviterUid);
    const invSnap = await txn.get(inviterRef);
    const inv = invSnap.exists ? invSnap.data() : {};
    const count = inv.inviteCount || 0;

    grantCredits(txn, userRef, u, INVITE_REWARD);
    txn.set(userRef, { invitedBy: inviterUid }, { merge: true });
    if (count < INVITE_CAP) {
      grantCredits(txn, inviterRef, inv, INVITE_REWARD);
      txn.set(inviterRef, { inviteCount: count + 1 }, { merge: true });
    }
    return { ok: true, reward: INVITE_REWARD };
  });
});

// Mint (if needed) + return the caller's invite code. Called by the client when
// it notices the code is missing (existing users who signed in before the
// invite rollout never hit the initializeUser bootstrap).
exports.getInviteCode = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'sign in required');
  return { code: await ensureInviteCode(uid) };
});

module.exports.reserveCredits = reserveCredits;
module.exports.refundCredits = refundCredits;
module.exports.grantCredits = grantCredits;
module.exports.walletOf = walletOf;
module.exports.dayKey = dayKey;
module.exports.ensureInviteCode = ensureInviteCode;
module.exports.DAILY_CREDITS = DAILY_CREDITS;
module.exports.PRICE = PRICE;
module.exports.INVITE_REWARD = INVITE_REWARD;
