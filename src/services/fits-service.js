// Try-on "fits" — client calls. Balance is read live via useFits() straight
// from users/{uid}; this service holds the write actions (invite redemption).
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase.js';
import { brandOrigin } from './platform-service.js';

export const FitsService = {
  // The invite message, built in ONE place. Settings and the out-of-fits nudge
  // both send it, and the two copies had already drifted apart by the time the
  // link gained a code — the same per-call-site duplication that welded a
  // category label onto every shared item link for four months.
  //
  // It is a MESSAGE share (see shareLink): the code must survive, so it goes in
  // the text, and the link carries it as well. `/join/CODE` deep-links into the
  // app onto the field that applies it; the typed code is the fallback for
  // anyone who does not have the app yet.
  inviteMessage(code, t) {
    const codeLine = code ? `\n${t('inviteShareCode', { code })}` : '';
    const link = code ? `${brandOrigin()}/join/${code}` : brandOrigin();
    return `${t('inviteShareText')}${codeLine}\n${link}`;
  },

  // Mint (if missing) + fetch the caller's own invite code.
  async getInviteCode() {
    const { data } = await httpsCallable(functions, 'getInviteCode')({});
    return data?.code || '';
  },

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
