// Referral system — Phase 8-3.
//
// Flow:
//   1. Every user gets a `referralCode` (e.g. "DRAPE-XJ92") on first init
//      (see `initializeAndApplyDaily` in index.js).
//   2. A visitor lands on https://drape.app/?ref=DRAPE-XJ92.
//      The client stashes that code in localStorage and passes it to
//      `initializeUser` on the very first sign-in (first-init only).
//   3. The server looks up the inviter by referralCode, credits inviter +5
//      and invitee +3 atomically, and writes `referredBy` on the invitee.
//   4. `referredBy` is write-once — clients can't overwrite it. Self-referral
//      and double-redeem (invitee already has referredBy) are rejected.
//
// Abuse notes:
//   - A single Google account can only ever be credited once (referredBy is
//     set on first-init). Burner gmail accounts are still possible; stronger
//     fraud controls (phone/reCAPTCHA) are called out as Phase 8-4 risk work.

const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

const INVITER_BONUS = 5;
const INVITEE_BONUS = 3;

// Unambiguous alphabet — no 0/O/1/I.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LEN = 4;

function makeReferralSuffix() {
  let out = '';
  for (let i = 0; i < CODE_LEN; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

// Shared with initializeAndApplyDaily — generates a unique-enough code.
// With 32^4 = ~1M codes the probability of collision at ~10k users is low,
// but we still retry on collision by checking the reverse index.
async function assignReferralCode(db, uid, txn) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = `DRAPE-${makeReferralSuffix()}`;
    const indexRef = db.collection('referralCodes').doc(code);
    const indexSnap = await txn.get(indexRef);
    if (!indexSnap.exists) {
      txn.set(indexRef, { uid, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      return code;
    }
  }
  throw new Error('REFERRAL_CODE_ALLOCATION_FAILED');
}

exports.assignReferralCode = assignReferralCode;

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
    console.warn('Referral verifyAuth failed:', err.message);
    return null;
  }
}

function setCors(res) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Max-Age', '3600');
}

function normalizeCode(raw) {
  return String(raw || '').trim().toUpperCase();
}

// ──────────────────────────────────────────────────────────────────────────
// redeemReferral — POST { code }
// Called automatically by the client immediately after a new user signs in
// if a ?ref= code was stashed in localStorage. Safe to call multiple times;
// once `referredBy` is set on the invitee, subsequent calls return ALREADY.
// ──────────────────────────────────────────────────────────────────────────
exports.redeemReferral = onRequest(async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return; }

  try {
    const authInfo = await verifyAuth(req);
    if (!authInfo || authInfo.isAnonymous) {
      res.status(401).json({ error: 'AUTH_REQUIRED' });
      return;
    }

    const code = normalizeCode(req.body?.code);
    if (!code || !code.startsWith('DRAPE-')) {
      res.status(400).json({ error: 'INVALID_CODE' });
      return;
    }

    const db = admin.firestore();
    const indexSnap = await db.collection('referralCodes').doc(code).get();
    if (!indexSnap.exists) {
      res.status(404).json({ error: 'CODE_NOT_FOUND' });
      return;
    }
    const inviterUid = indexSnap.data().uid;
    if (inviterUid === authInfo.uid) {
      res.status(400).json({ error: 'SELF_REFERRAL' });
      return;
    }

    const inviteeRef = db.collection('users').doc(authInfo.uid);
    const inviterRef = db.collection('users').doc(inviterUid);

    const result = await db.runTransaction(async (txn) => {
      const inviteeSnap = await txn.get(inviteeRef);
      const inviterSnap = await txn.get(inviterRef);
      if (!inviteeSnap.exists) throw new Error('INVITEE_NOT_INITIALIZED');
      if (!inviterSnap.exists) throw new Error('INVITER_NOT_FOUND');

      const invitee = inviteeSnap.data();
      if (invitee.referredBy) {
        return { status: 'ALREADY' };
      }

      const inviter = inviterSnap.data();
      // Pro 사용자는 credits 동결 — 보너스 건너뜀. referredBy 관계만 기록.
      const inviteeUpdate = { referredBy: inviterUid };
      let inviteeBonus = 0;
      if (invitee.plan !== 'pro') {
        inviteeUpdate.credits = (invitee.credits || 0) + INVITEE_BONUS;
        inviteeUpdate.lifetimeCredits = (invitee.lifetimeCredits || 0) + INVITEE_BONUS;
        inviteeBonus = INVITEE_BONUS;
      }
      txn.update(inviteeRef, inviteeUpdate);
      let inviterBonus = 0;
      if (inviter.plan !== 'pro') {
        txn.update(inviterRef, {
          credits: (inviter.credits || 0) + INVITER_BONUS,
          lifetimeCredits: (inviter.lifetimeCredits || 0) + INVITER_BONUS,
        });
        inviterBonus = INVITER_BONUS;
      }
      return { status: 'OK', inviteeBonus, inviterBonus };
    });

    res.json(result);
  } catch (err) {
    console.error('redeemReferral failed:', err);
    const msg = err.message || '';
    if (msg === 'INVITEE_NOT_INITIALIZED' || msg === 'INVITER_NOT_FOUND') {
      res.status(409).json({ error: msg });
      return;
    }
    res.status(500).json({ error: 'REDEEM_FAILED' });
  }
});
