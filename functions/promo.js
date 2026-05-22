// Promo codes — Phase 8-3.
//
// Admin creates documents at promoCodes/{code} manually in the Firebase Console:
//   {
//     credits: 10,                       // credits to grant on redemption
//     maxUses: 1000,                     // total across all users (null = unlimited)
//     usedCount: 0,                      // server-maintained
//     expiresAt: Timestamp | null,       // optional
//     perUserLimit: 1,                   // usually 1
//     note: "Launch giveaway"            // free-form admin memo
//   }
//
// Clients call POST /redeemPromo { code } — the server validates, transacts,
// and writes promoCodeUses/{uid_code} for idempotency. Clients have read
// access to promoCodes so they can preview a code before submitting.

const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

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
    console.warn('Promo verifyAuth failed:', err.message);
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

exports.redeemPromo = onRequest(async (req, res) => {
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
    if (!code) {
      res.status(400).json({ error: 'INVALID_CODE' });
      return;
    }

    const db = admin.firestore();
    const promoRef = db.collection('promoCodes').doc(code);
    const userRef = db.collection('users').doc(authInfo.uid);
    const useRef = db.collection('promoCodeUses').doc(`${authInfo.uid}_${code}`);

    const result = await db.runTransaction(async (txn) => {
      const promoSnap = await txn.get(promoRef);
      if (!promoSnap.exists) return { error: 'CODE_NOT_FOUND' };
      const promo = promoSnap.data();

      if (promo.expiresAt && promo.expiresAt.toMillis && promo.expiresAt.toMillis() < Date.now()) {
        return { error: 'EXPIRED' };
      }
      if (typeof promo.maxUses === 'number' && promo.maxUses > 0 &&
          (promo.usedCount || 0) >= promo.maxUses) {
        return { error: 'MAX_USES_REACHED' };
      }

      const useSnap = await txn.get(useRef);
      const perUserLimit = Number(promo.perUserLimit || 1);
      const existingUses = Number(useSnap.data()?.count || 0);
      if (useSnap.exists && existingUses >= perUserLimit) {
        return { error: 'ALREADY_REDEEMED' };
      }

      const userSnap = await txn.get(userRef);
      if (!userSnap.exists) return { error: 'USER_NOT_INITIALIZED' };
      const user = userSnap.data();

      const credits = Number(promo.credits || 0);
      if (credits <= 0) return { error: 'CODE_HAS_NO_CREDITS' };

      // Pro 사용자는 credits 동결 — 코드 redeemed 로 기록만 하고 credits 부여 안 함.
      if (user.plan !== 'pro') {
        txn.update(userRef, {
          credits: (user.credits || 0) + credits,
          lifetimeCredits: (user.lifetimeCredits || 0) + credits,
        });
      }
      txn.update(promoRef, {
        usedCount: (promo.usedCount || 0) + 1,
      });
      txn.set(useRef, {
        uid: authInfo.uid,
        code,
        count: existingUses + 1,
        lastRedeemedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      return { status: 'OK', creditsGranted: credits };
    });

    if (result.error) {
      const status = result.error === 'CODE_NOT_FOUND' ? 404
        : result.error === 'USER_NOT_INITIALIZED' ? 409
        : 400;
      res.status(status).json({ error: result.error });
      return;
    }
    res.json(result);
  } catch (err) {
    console.error('redeemPromo failed:', err);
    res.status(500).json({ error: 'REDEEM_FAILED' });
  }
});
