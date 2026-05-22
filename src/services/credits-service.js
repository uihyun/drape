// Credits service — guest credits in localStorage, logged-in credits in Firestore.
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase.js';

const GUEST_CREDITS_KEY = 'drape_guest_credits';
export const GUEST_INITIAL_CREDITS = 2;
export const MAX_GUEST_TRANSFER = 2;

// Custom event so React hook re-renders when localStorage changes in the same tab.
const GUEST_CREDITS_CHANGED = 'drape:guestCreditsChanged';

function readGuestCredits() {
  try {
    const raw = localStorage.getItem(GUEST_CREDITS_KEY);
    if (raw === null) {
      // First visit — issue initial credits.
      localStorage.setItem(GUEST_CREDITS_KEY, String(GUEST_INITIAL_CREDITS));
      return GUEST_INITIAL_CREDITS;
    }
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return GUEST_INITIAL_CREDITS;
  }
}

function writeGuestCredits(n) {
  try {
    localStorage.setItem(GUEST_CREDITS_KEY, String(Math.max(0, n)));
    window.dispatchEvent(new CustomEvent(GUEST_CREDITS_CHANGED));
  } catch (e) {
    console.warn('Failed to write guest credits:', e);
  }
}

export const CreditsService = {
  getGuestCredits: readGuestCredits,

  decrementGuest() {
    const current = readGuestCredits();
    if (current <= 0) return 0;
    const next = current - 1;
    writeGuestCredits(next);
    return next;
  },

  // Peek the transferable guest credit count without clearing.
  // Caller must invoke clearGuestCredits() only after the server confirms
  // the signup transfer was applied.
  peekGuestForTransfer() {
    return Math.min(readGuestCredits(), MAX_GUEST_TRANSFER);
  },

  clearGuestCredits() {
    writeGuestCredits(0);
  },
};

/**
 * React hook — returns the user's current credit state.
 * Guest: localStorage; logged-in: Firestore onSnapshot.
 */
export function useCredits() {
  const [state, setState] = useState(() => {
    const user = auth.currentUser;
    const isGuest = !user || user.isAnonymous;
    return {
      credits: isGuest ? readGuestCredits() : null,
      plan: 'free',
      isGuest,
      loading: !isGuest, // logged-in users start loading until snapshot arrives
    };
  });

  useEffect(() => {
    let unsubDoc = null;

    const handleAuth = (user) => {
      const isGuest = !user || user.isAnonymous;
      if (unsubDoc) { unsubDoc(); unsubDoc = null; }

      if (isGuest) {
        setState({ credits: readGuestCredits(), plan: 'free', isGuest: true, loading: false });
      } else {
        setState(prev => ({ ...prev, isGuest: false, loading: true }));
        unsubDoc = onSnapshot(
          doc(db, 'users', user.uid),
          (snap) => {
            const data = snap.data();
            setState({
              credits: data?.credits ?? 0,
              plan: data?.plan || 'free',
              isGuest: false,
              loading: false,
            });
          },
          (err) => {
            console.warn('Credits subscription error:', err);
            setState({ credits: 0, plan: 'free', isGuest: false, loading: false });
          }
        );
      }
    };

    const unsubAuth = auth.onAuthStateChanged(handleAuth);

    const onGuestChange = () => {
      if (!auth.currentUser || auth.currentUser.isAnonymous) {
        setState({ credits: readGuestCredits(), plan: 'free', isGuest: true, loading: false });
      }
    };
    window.addEventListener(GUEST_CREDITS_CHANGED, onGuestChange);
    window.addEventListener('storage', onGuestChange); // other tabs

    return () => {
      unsubAuth();
      if (unsubDoc) unsubDoc();
      window.removeEventListener(GUEST_CREDITS_CHANGED, onGuestChange);
      window.removeEventListener('storage', onGuestChange);
    };
  }, []);

  return state;
}
