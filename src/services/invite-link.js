// Invite links — `https://drape.nyc/?invite=CODE`.
//
// The code used to travel only as text in the share message, so the recipient
// had to read it off a chat bubble and retype it into Settings. Now the link
// carries it and the app fills the field.
//
// Two capture points, because one is never enough:
//   • boot (main.jsx) — a cold start, whether from a browser or a deep link
//     that launched the app.
//   • `appUrlOpen` (App.jsx) — the app was ALREADY running. Boot capture has
//     long since finished, so without this nobody would ever read the code.
//
// The code is stashed rather than redeemed on sight: redemption is a one-shot,
// once-ever server call, and the person may not be signed in yet. It survives
// in localStorage until the Settings field actually applies it.

import { analytics, logEvent } from '../firebase.js';

const PENDING_KEY = 'drape:pendingInvite';
// Server codes are 6 chars; accept 4-8 so a format change doesn't silently
// start dropping links. Settings validates again before it calls the server.
const CODE_RE = /^[A-Z0-9]{4,8}$/;

function normalize(raw) {
  return String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

function stash(code) {
  try { localStorage.setItem(PENDING_KEY, code); } catch { /* private mode */ }
  // The URL gets scrubbed below, so `?invite=` never reaches GA's
  // page_location. Without this event there is no way to tell "nobody opened
  // the link" from "they opened it and bailed before applying".
  try { logEvent(analytics, 'invite_link_opened', { code }); } catch { /* ignore */ }
}

function fromParams(params) {
  const raw = params.get('invite');
  if (!raw) return null;
  const code = normalize(raw);
  if (!CODE_RE.test(code)) return null;
  stash(code);
  return code;
}

export const InviteLink = {
  /** `/join/CODE` — the shared form, and what the OS deep-links on. */
  captureCode(raw) {
    const code = normalize(raw);
    if (!CODE_RE.test(code)) return null;
    stash(code);
    return code;
  },

  /** Boot-time capture of the `?invite=CODE` query form (web / older links). */
  capture() {
    try {
      const params = new URLSearchParams(window.location.search);
      const code = fromParams(params);
      if (!code) return null;
      params.delete('invite');
      const qs = params.toString();
      const next = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;
      window.history.replaceState({}, '', next);
      return code;
    } catch {
      return null;
    }
  },

  /** Native deep link that arrived while the app was already running. */
  captureFromUrl(urlString) {
    try {
      return fromParams(new URL(urlString).searchParams);
    } catch {
      return null;
    }
  },

  getPending() {
    try { return localStorage.getItem(PENDING_KEY) || null; } catch { return null; }
  },

  clearPending() {
    try { localStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
  },
};

export default InviteLink;
