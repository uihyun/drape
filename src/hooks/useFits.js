import { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase.js';
import { FitsService } from '../services/fits-service.js';

const DAILY_FITS = 5;

// "Today" for a quota counter, computed the way the server computes it:
// in profiles/{uid}.timezone, New York when unset (fits.js / stylist.js
// dayKey). The device's own zone drifts from that — the profile syncs once
// per session — so a traveller saw a reset the server hadn't made.
function dayKeyIn(tz) {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'America/New_York' }).format(new Date()); }
  catch { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date()); }
}

// The server's timezone for this user, live.
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

// The raw (server-written) users/{uid} doc. Counters are derived at render
// time, not in the snapshot callback, so the day key is current whenever the
// screen redraws rather than frozen at the last write.
function useUserCounters(user) {
  const uid = user && !user.isAnonymous ? (user.uid || auth.currentUser?.uid) : null;
  const [u, setU] = useState({ data: {}, loaded: false });
  useEffect(() => {
    if (!uid) { setU({ data: {}, loaded: false }); return undefined; }
    return onSnapshot(doc(db, 'users', uid), (snap) => {
      setU({ data: snap.exists() ? snap.data() : {}, loaded: true });
    }, () => setU((s) => ({ ...s, loaded: true })));
  }, [uid]);
  const tz = useQuotaTz(uid);
  return { ...u, uid, today: dayKeyIn(tz) };
}

// Live "fits" balance for the signed-in user. Display only; the server
// enforces the real gate. Returns daily-remaining (reset at local midnight),
// persistent bonus, their total, the user's own invite code, and whether
// they've already redeemed one.
export function useFits(user) {
  const { data: u, loaded, uid, today } = useUserCounters(user);
  const mintedRef = useRef(false);
  useEffect(() => { mintedRef.current = false; }, [uid]);
  // Backfill the invite code for users who signed in before the fits rollout
  // (they never hit the initializeUser bootstrap). The mint writes
  // users.inviteCode, so the snapshot fires again with it. Once per mount.
  useEffect(() => {
    if (!loaded || !uid || u.inviteCode || mintedRef.current) return;
    mintedRef.current = true;
    FitsService.getInviteCode().catch(() => { mintedRef.current = false; });
  }, [loaded, uid, u.inviteCode]);

  if (!uid) return { dailyRemaining: DAILY_FITS, bonus: 0, total: DAILY_FITS, inviteCode: '', redeemed: false, loaded: false };
  const usedToday = u.fitDayKey === today ? (u.fitDailyUsed || 0) : 0;
  const dailyRemaining = Math.max(0, DAILY_FITS - usedToday);
  const bonus = u.fitBonus || 0;
  return {
    dailyRemaining, bonus, total: dailyRemaining + bonus,
    inviteCode: u.inviteCode || '', redeemed: !!u.invitedBy, loaded,
  };
}

export const FITS_PER_DAY = DAILY_FITS;

const DAILY_RECS = 3; // mirrors REC_DAILY in functions/stylist.js; past this a rec charges one fit

// Live free-recommendation balance (stylist). Same contract as useFits.
export function useStyleRecs(user) {
  const { data: u, loaded, uid, today } = useUserCounters(user);
  if (!uid) return { remaining: DAILY_RECS, loaded: false };
  const usedToday = u.styleRecDayKey === today ? (u.styleRecUsed || 0) : 0;
  return { remaining: Math.max(0, DAILY_RECS - usedToday), loaded };
}

export const RECS_PER_DAY = DAILY_RECS;

const DAILY_CHAT = 10; // mirrors CHAT_DAILY in functions/stylist.js

// Live stylist-chat balance: free messages left today plus any topped-up
// block. Display only; stylistChat enforces it.
export function useStyleChatQuota(user) {
  const { data: u, loaded, uid, today } = useUserCounters(user);
  if (!uid) return { remaining: DAILY_CHAT, extra: 0, loaded: false };
  const usedToday = u.styleChatDayKey === today ? (u.styleChatUsed || 0) : 0;
  return { remaining: Math.max(0, DAILY_CHAT - usedToday), extra: u.styleChatExtra || 0, loaded };
}

export const CHAT_PER_DAY = DAILY_CHAT;
