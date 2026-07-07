// Try-on "fits" — client calls. Balance is read live via useFits() straight
// from users/{uid}; this service holds the write actions (invite redemption).
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase.js';

export const FitsService = {
  // Redeem an inviter's code (once ever). Credits the INVITER +10 fits.
  // Resolves { ok, reward }; rejects with a Firebase callable error whose
  // `message` is a stable token ('already_redeemed' | 'invalid_code' |
  // 'self_referral' | 'no_code') the caller maps to a localized string.
  async redeemInvite(code) {
    const clean = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
    if (!clean) { const e = new Error('no_code'); e.reason = 'no_code'; throw e; }
    try {
      const { data } = await httpsCallable(functions, 'redeemInvite')({ code: clean });
      return data;
    } catch (err) {
      // Callable errors surface the server message in err.message.
      err.reason = err?.message || 'error';
      throw err;
    }
  },
};
