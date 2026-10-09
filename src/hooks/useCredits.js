import { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase.js';
import { CreditService } from '../services/credit-service.js';

// Mirrors functions/credits.js — the server enforces, this only displays.
export const DAILY_CREDITS = 50;
export const PRICE = { tryon: 10, chat: 1, verdict: 1 };
const LEGACY_SCALE = 10;

// "Today" for the wallet, computed the way the server computes it: in
// profiles/{uid}.timezone, New York when unset. The device's own zone drifts
// from that — the profile only syncs when the app comes forward — so a
// traveller saw a reset the server hadn't made.
function dayKeyIn(tz) {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'America/New_York' }).format(new Date()); }
  catch { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date()); }
}

// Same conversion as credits.js walletOf: a doc not yet touched since the
// switch from fits still shows its value (fitBonus x10, stylist top-ups +1).
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

function useQuotaTz(uid) {
  const [tz, setTz] = useState(null);
  useEffect(() => {
    if (!uid) { setTz(null); return undefined; }
    return onSnapshot(doc(db, 'profiles', uid), (snap) => {
      setTz((snap.exists() && snap.data().timezone) || null);
    }, () => setTz(null));
  }, [uid]);
  return tz;
}

const SIGNED_OUT = {
  dailyRemaining: DAILY_CREDITS, balance: 0, total: DAILY_CREDITS,
  inviteCode: '', redeemed: false, loaded: false,
};

// Live credit wallet for the signed-in user: free credits left today (reset
// at local midnight), the carried-over balance, their total, the user's own
// invite code, and whether they've already redeemed one. Derived at render
// time, not in the snapshot callback, so the day key is current whenever the
// screen redraws.
export function useCredits(user) {
  const uid = user && !user.isAnonymous ? (user.uid || auth.currentUser?.uid) : null;
  const [snap, setSnap] = useState({ data: {}, loaded: false });
  useEffect(() => {
    if (!uid) { setSnap({ data: {}, loaded: false }); return undefined; }
    return onSnapshot(doc(db, 'users', uid), (s) => {
      setSnap({ data: s.exists() ? s.data() : {}, loaded: true });
    }, () => setSnap((p) => ({ ...p, loaded: true })));
  }, [uid]);
  const tz = useQuotaTz(uid);
  const u = snap.data;

  // Backfill the invite code for users who signed in before invites existed
  // (they never hit the initializeUser bootstrap). The mint writes
  // users.inviteCode, so the snapshot fires again with it. Once per mount.
  const mintedRef = useRef(false);
  useEffect(() => { mintedRef.current = false; }, [uid]);
  useEffect(() => {
    if (!snap.loaded || !uid || u.inviteCode || mintedRef.current) return;
    mintedRef.current = true;
    CreditService.getInviteCode().catch(() => { mintedRef.current = false; });
  }, [snap.loaded, uid, u.inviteCode]);

  if (!uid) return SIGNED_OUT;
  const { dailyUsed, balance } = walletOf(u, dayKeyIn(tz));
  const dailyRemaining = Math.max(0, DAILY_CREDITS - dailyUsed);
  return {
    dailyRemaining, balance, total: dailyRemaining + balance,
    inviteCode: u.inviteCode || '', redeemed: !!u.invitedBy, loaded: snap.loaded,
  };
}
