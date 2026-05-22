// Client referral/promo helpers.
//
// - On app load call `capturePendingReferral()` to pull `?ref=DRAPE-XXXX` out
//   of the URL and stash it in localStorage.
// - After sign-in AuthService calls `redeemPendingReferral(user)` which
//   posts to `redeemReferral` and clears the stash on success (or on a
//   terminal error like SELF_REFERRAL / CODE_NOT_FOUND — otherwise we keep
//   the code around so a temporary failure doesn't destroy it).
// - `redeemPromo(code)` is used by the Invite page's promo form.

import { auth } from '../firebase.js';

import { FUNCTIONS_BASE } from './api-base.js';
const PENDING_KEY = 'drape_pending_ref';

async function authedFetch(path, body) {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) {
    throw new Error('SIGN_IN_REQUIRED');
  }
  const token = await user.getIdToken();
  const res = await fetch(`${FUNCTIONS_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body || {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.error || 'REQUEST_FAILED');
    err.code = json.error;
    err.status = res.status;
    throw err;
  }
  return json;
}

function normalize(code) {
  return String(code || '').trim().toUpperCase();
}

export const ReferralService = {
  /**
   * Read ?ref= from the current URL and stash it in localStorage so we can
   * redeem after the next Google sign-in. Call this at app boot. Noop if
   * the URL has no ref param.
   *
   * Cleans the query string so the code doesn't stick around in the address
   * bar or leak into analytics referrer fields.
   */
  capturePendingReferral() {
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get('ref');
      if (!raw) return;
      const code = normalize(raw);
      if (!code.startsWith('DRAPE-')) return;
      localStorage.setItem(PENDING_KEY, code);

      params.delete('ref');
      const next = params.toString();
      const url = window.location.pathname + (next ? `?${next}` : '') + window.location.hash;
      window.history.replaceState({}, '', url);
    } catch (e) {
      console.warn('capturePendingReferral failed:', e);
    }
  },

  getPendingReferral() {
    try { return localStorage.getItem(PENDING_KEY) || null; } catch { return null; }
  },

  clearPendingReferral() {
    try { localStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
  },

  /**
   * Called right after sign-in. If a pending referral code is stashed, try
   * to redeem it. Returns the server response on success, or null if
   * nothing to do / non-terminal failure.
   */
  async redeemPendingReferral() {
    const code = this.getPendingReferral();
    if (!code) return null;
    try {
      const result = await authedFetch('/redeemReferral', { code });
      this.clearPendingReferral();
      return result;
    } catch (err) {
      // Terminal errors — the code will never work for this user, so drop it.
      if (['SELF_REFERRAL', 'CODE_NOT_FOUND', 'INVALID_CODE'].includes(err.code)) {
        this.clearPendingReferral();
      }
      console.warn('redeemPendingReferral failed:', err.code || err.message);
      return null;
    }
  },

  /**
   * Manual promo code redemption (Invite page).
   * Throws with err.code = server error string on failure.
   */
  async redeemPromo(code) {
    const normalized = normalize(code);
    if (!normalized) {
      const e = new Error('INVALID_CODE'); e.code = 'INVALID_CODE'; throw e;
    }
    return authedFetch('/redeemPromo', { code: normalized });
  },
};
