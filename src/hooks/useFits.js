import { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase.js';
import { FitsService } from '../services/fits-service.js';

const DAILY_FITS = 5;

// Local-day key ("YYYY-MM-DD") in the user's own timezone — must match the
// server's dayKey() so the DISPLAYED remaining count matches what the server
// will actually enforce. (en-CA formats as ISO date.)
function todayKey() {
  try { return new Intl.DateTimeFormat('en-CA').format(new Date()); }
  catch { return new Date().toISOString().slice(0, 10); }
}

// Live "fits" balance for the signed-in user. Reads the (server-written)
// users/{uid} doc — display only; the server enforces the real gate. Returns
// daily-remaining (reset at local midnight), persistent bonus, their total,
// the user's own invite code, and whether they've already redeemed one.
export function useFits(user) {
  const [state, setState] = useState({
    dailyRemaining: DAILY_FITS, bonus: 0, total: DAILY_FITS,
    inviteCode: '', redeemed: false, loaded: false,
  });

  const mintedRef = useRef(false);
  useEffect(() => {
    mintedRef.current = false;
    const uid = user?.uid || auth.currentUser?.uid;
    if (!user || user.isAnonymous || !uid) {
      setState({ dailyRemaining: DAILY_FITS, bonus: 0, total: DAILY_FITS, inviteCode: '', redeemed: false, loaded: false });
      return;
    }
    return onSnapshot(doc(db, 'users', uid), (snap) => {
      const u = snap.exists() ? snap.data() : {};
      const usedToday = u.fitDayKey === todayKey() ? (u.fitDailyUsed || 0) : 0;
      const dailyRemaining = Math.max(0, DAILY_FITS - usedToday);
      const bonus = u.fitBonus || 0;
      setState({
        dailyRemaining, bonus, total: dailyRemaining + bonus,
        inviteCode: u.inviteCode || '', redeemed: !!u.invitedBy, loaded: true,
      });
      // Backfill the invite code for users who signed in before the fits
      // rollout (they never hit the initializeUser bootstrap). The mint writes
      // users.inviteCode → this snapshot fires again with it. Once per mount.
      if (!u.inviteCode && !mintedRef.current) {
        mintedRef.current = true;
        FitsService.getInviteCode().catch(() => { mintedRef.current = false; });
      }
    }, () => setState((s) => ({ ...s, loaded: true })));
  }, [user?.uid]);

  return state;
}

export const FITS_PER_DAY = DAILY_FITS;
