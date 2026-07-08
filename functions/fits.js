// Try-on "fits" economy — server-authoritative daily quota + invite bonus.
//
//   users/{uid}.fitDayKey     "YYYY-MM-DD" in the user's tz — which day the
//                             daily counter belongs to (lazy reset).
//   users/{uid}.fitDailyUsed  fits spent today (of DAILY_FITS free).
//   users/{uid}.fitBonus      persistent bonus balance (invites now, IAP later),
//                             spent only AFTER the daily free allowance.
//   users/{uid}.invitedBy     uid of the inviter, set ONCE (dedupe guard).
//   users/{uid}.inviteCode    this user's own code to share.
//   inviteCodes/{code}        → { uid } reverse index (server-only).
//
// 1 fit = 1 try-on (virtualTryOn call). Reserved before generation, refunded if
// the whole generation fails. All fields are server-only (firestore.rules deny
// list) — the client reads them for display but can never write them.

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

const db = admin.firestore();

const DAILY_FITS = 5;
const INVITE_REWARD = 10;
const INVITE_CAP = 100; // soft cap: max invites one account can be credited for

// "YYYY-MM-DD" in an IANA tz (en-CA formats as ISO date). The daily allowance
// resets at the user's local midnight. Falls back to New York (matches reminders).
function dayKey(tz) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'America/New_York' }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
  }
}

// Reserve 1 fit INSIDE a transaction. Spends the daily free allowance first,
// then bonus. Throws `resource-exhausted 'out_of_fits'` when both are empty.
// Returns which bucket was charged ('daily' | 'bonus') so a failed generation
// can refund the right one. Reads profiles/{uid} for the user's timezone.
async function reserveFit(txn, uid) {
  const userRef = db.collection('users').doc(uid);
  const profRef = db.collection('profiles').doc(uid);
  const [userSnap, profSnap] = await Promise.all([txn.get(userRef), txn.get(profRef)]);
  const u = userSnap.exists ? userSnap.data() : {};
  const tz = (profSnap.exists && profSnap.data().timezone) || 'America/New_York';
  const today = dayKey(tz);
  const usedToday = u.fitDayKey === today ? (u.fitDailyUsed || 0) : 0;
  const bonus = u.fitBonus || 0;

  if (usedToday < DAILY_FITS) {
    txn.set(userRef, { fitDayKey: today, fitDailyUsed: usedToday + 1 }, { merge: true });
    return 'daily';
  }
  if (bonus > 0) {
    txn.set(userRef, { fitBonus: bonus - 1 }, { merge: true });
    return 'bonus';
  }
  throw new HttpsError('resource-exhausted', 'out_of_fits');
}

// Reverse a reserved fit — ONLY when the whole try-on failed. Best-effort; a
// refund failure never breaks the caller (the fit is a soft currency).
async function refundFit(uid, charged) {
  if (charged !== 'daily' && charged !== 'bonus') return;
  const userRef = db.collection('users').doc(uid);
  try {
    await db.runTransaction(async (txn) => {
      const snap = await txn.get(userRef);
      if (!snap.exists) return;
      const u = snap.data();
      if (charged === 'bonus') {
        txn.set(userRef, { fitBonus: (u.fitBonus || 0) + 1 }, { merge: true });
      } else if ((u.fitDailyUsed || 0) > 0) {
        txn.set(userRef, { fitDailyUsed: u.fitDailyUsed - 1 }, { merge: true });
      }
    });
  } catch (e) { console.warn('refundFit failed:', uid, e.message); }
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

// The invitee submits an inviter's code (once, ever). Credits the INVITER +10.
// Used by the manual-entry UI and (Phase 2) the deep-link / install-referrer
// paths. Idempotent per invitee via the invitedBy guard.
exports.redeemInvite = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'sign in required');
  const code = String(request.data?.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  if (!code) throw new HttpsError('invalid-argument', 'no_code');

  const userRef = db.collection('users').doc(uid);
  const codeRef = db.collection('inviteCodes').doc(code);
  return db.runTransaction(async (txn) => {
    const [userSnap, codeSnap] = await Promise.all([txn.get(userRef), txn.get(codeRef)]);
    if ((userSnap.exists ? userSnap.data() : {}).invitedBy) {
      throw new HttpsError('failed-precondition', 'already_redeemed');
    }
    if (!codeSnap.exists) throw new HttpsError('not-found', 'invalid_code');
    const inviterUid = codeSnap.data().uid;
    if (inviterUid === uid) throw new HttpsError('failed-precondition', 'self_referral');

    const inviterRef = db.collection('users').doc(inviterUid);
    const invSnap = await txn.get(inviterRef);
    const inv = invSnap.exists ? invSnap.data() : {};
    const count = inv.inviteCount || 0;

    txn.set(userRef, { invitedBy: inviterUid }, { merge: true });
    if (count < INVITE_CAP) {
      txn.set(inviterRef, { fitBonus: (inv.fitBonus || 0) + INVITE_REWARD, inviteCount: count + 1 }, { merge: true });
    }
    return { ok: true, reward: count < INVITE_CAP ? INVITE_REWARD : 0 };
  });
});

// Mint (if needed) + return the caller's invite code. Called by the client when
// it notices the code is missing (existing users who signed in before the fits
// rollout never hit the initializeUser bootstrap).
exports.getInviteCode = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'sign in required');
  return { code: await ensureInviteCode(uid) };
});

module.exports.reserveFit = reserveFit;
module.exports.refundFit = refundFit;
module.exports.ensureInviteCode = ensureInviteCode;
module.exports.DAILY_FITS = DAILY_FITS;
module.exports.INVITE_REWARD = INVITE_REWARD;
