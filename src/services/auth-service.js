import { FUNCTIONS_BASE } from './api-base.js';
import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signInWithCredential,
  linkWithPopup,
  linkWithCredential,
  getRedirectResult,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase.js';
import { CreditsService } from './credits-service.js';
import { ReferralService } from './referral-service.js';
import { isNativeApp, isIOS as isIOSPlatform } from './platform-service.js';

// iOS Safari/WebKit blocks popups in PWAs — used to switch sign-in to redirect.
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

// Apple Sign-In native flow 는 @capacitor-firebase/authentication 플러그인이
// 처리 (capacitor.config.json 의 skipNativeAuth: true 와 결합). 플러그인이
// nonce 생성 + Apple authorize + 검증 가능한 형식의 rawNonce 반환까지 담당.

const googleProvider = new GoogleAuthProvider();
const appleProvider = new OAuthProvider('apple.com');
appleProvider.addScope('email');
appleProvider.addScope('name');

function providerKeyForUser(user) {
  const id = user?.providerData?.[0]?.providerId;
  if (id === 'apple.com') return 'apple';
  if (id === 'google.com') return 'google';
  return id || 'unknown';
}

export const AuthService = {
  // Subscribe to auth state changes
  onAuthChange(callback) {
    return onAuthStateChanged(auth, callback);
  },

  get currentUser() {
    return auth.currentUser;
  },

  get isLoggedIn() {
    return !!auth.currentUser && !auth.currentUser.isAnonymous;
  },

  // Sign in with Google. Web uses Firebase popup. Native (iOS / Android)
  // uses @capacitor-firebase/authentication so the OS-level Google account
  // sheet is shown — Capacitor webview blocks signInWithPopup.
  async signInWithGoogle(beforeSwitch) {
    if (isNativeApp()) {
      return this._signInWithGoogleNative(beforeSwitch);
    }
    const current = auth.currentUser;
    if (current?.isAnonymous) {
      try {
        const result = await linkWithPopup(current, googleProvider);
        await this._ensureUserDoc(result.user, 'google');
        await this.initializeCredits(result.user);
        return result.user;
      } catch (err) {
        if (err.code === 'auth/credential-already-in-use') {
          // Reuse the credential from the first popup so we don't trigger a
          // 2nd OAuth popup (almost always blocked by Safari/Chrome right
          // after the first one closes).
          const credential = GoogleAuthProvider.credentialFromError(err);
          if (!credential) throw err;
          await beforeSwitch?.();
          const result = await signInWithCredential(auth, credential);
          await this._ensureUserDoc(result.user, 'google');
          await this.initializeCredits(result.user);
          return result.user;
        }
        throw err;
      }
    } else {
      const result = await signInWithPopup(auth, googleProvider);
      await this._ensureUserDoc(result.user, 'google');
      await this.initializeCredits(result.user);
      return result.user;
    }
  },

  // Native (iOS / Android) Google sign-in via @capacitor-firebase/authentication.
  // We pass `skipNativeAuth: true` so the plugin only returns the OAuth credential
  // (idToken). We then run linkWithCredential / signInWithCredential ourselves
  // to keep the existing anonymous-link semantics consistent with the web path.
  async _signInWithGoogleNative(beforeSwitch) {
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
    // mode: 'select_account' — Credential Manager 가 자동으로 credential 찾지 않고
    // 명시적으로 계정 선택 chooser 띄움. emulator 에서 NoCredentialException 회피 +
    // 사용자가 여러 Google 계정 가진 경우 선택 가능 (둘 다 도움).
    const result = await FirebaseAuthentication.signInWithGoogle({
      skipNativeAuth: true,
      mode: 'select_account',
    });
    const idToken = result.credential?.idToken;
    if (!idToken) throw new Error('Google Sign-In returned no idToken');
    const credential = GoogleAuthProvider.credential(idToken);
    const current = auth.currentUser;

    if (current?.isAnonymous) {
      try {
        const linked = await linkWithCredential(current, credential);
        await this._ensureUserDoc(linked.user, 'google');
        await this.initializeCredits(linked.user);
        return linked.user;
      } catch (err) {
        if (err.code === 'auth/credential-already-in-use') {
          await beforeSwitch?.();
          const signed = await signInWithCredential(auth, credential);
          await this._ensureUserDoc(signed.user, 'google');
          await this.initializeCredits(signed.user);
          return signed.user;
        }
        throw err;
      }
    } else {
      const signed = await signInWithCredential(auth, credential);
      await this._ensureUserDoc(signed.user, 'google');
      await this.initializeCredits(signed.user);
      return signed.user;
    }
  },

  // Sign in with Apple. Web uses Firebase popup (Apple OAuth via Service ID
  // configured in Firebase Console). Native iOS uses the Capacitor plugin to
  // get an identityToken from the OS-level Apple Sign-In sheet, then signs
  // into Firebase with that credential.
  //
  // Apple-specific quirk: the user's displayName is returned ONLY on the very
  // first sign-in. We capture it from the auth result and stash it on the
  // Firebase user profile so later loads still have a name to show.
  async signInWithApple(beforeSwitch) {
    const current = auth.currentUser;

    if (isNativeApp() && isIOSPlatform()) {
      // @capacitor-firebase/authentication 의 공식 Apple Sign-In path 사용 —
      // 플러그인이 내부적으로 nonce 생성 + SHA256 + Apple ASAuthorizationAppleIDProvider
      // 호출 + raw nonce 까지 모두 정확한 형식으로 처리. capacitor.config.json 의
      // `skipNativeAuth: true` 와 결합해서 native 측은 OAuth flow 만 수행하고
      // identityToken + rawNonce 를 JS 로 반환 → JS SDK 의 signInWithCredential 로
      // Firebase 인증.
      //
      // 이전엔 @capacitor-community/apple-sign-in + manual nonce 만들기로 시도했으나
      // Apple SDK 의 nonce claim 형식이 우리 hex 와 안 맞아 Firebase 가 검증 실패.
      // 플러그인은 내부적으로 정확한 형식 (Firebase 검증 통과) 으로 처리.
      const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
      const result = await FirebaseAuthentication.signInWithApple({ scopes: ['email', 'name'] });
      const idToken = result?.credential?.idToken;
      const rawNonce = result?.credential?.nonce;
      if (!idToken) {
        throw new Error('Apple Sign-In returned no idToken');
      }
      const credential = appleProvider.credential({ idToken, rawNonce });
      const fullName = result?.user?.displayName || '';

      // Apple identity token 은 Firebase 에서 1회만 redeem 가능 (replay protection).
      // 이전엔 anonymous 사용자에 link 시도 후 실패 시 fallback 으로 signInWithCredential
      // 호출하던 흐름이었는데, link 가 내부적으로 token 을 server-side consume 시켜
      // 두 번째 호출이 "Duplicate credential received / auth/missing-or-invalid-nonce"
      // 로 reject. 따라서 anonymous 든 아니든 signInWithCredential 만 한 번 호출.
      // (anonymous 사용자가 만들었던 데이터는 anonymous UID 에 묶여 있음 — 출시 후
      // 본격적인 anonymous → 정식 계정 데이터 이전 정책 결정 필요. 지금은 단순 sign-in.)
      if (current?.isAnonymous) await beforeSwitch?.();
      const fb = await signInWithCredential(auth, credential);
      await this._applyAppleFirstLoginName(fb.user, fullName);
      await this._ensureUserDoc(fb.user, 'apple');
      await this.initializeCredits(fb.user);
      return fb.user;
    }

    // Web path
    if (current?.isAnonymous) {
      try {
        const result = await linkWithPopup(current, appleProvider);
        await this._applyAppleFirstLoginName(result.user, result.user.displayName || '');
        await this._ensureUserDoc(result.user, 'apple');
        await this.initializeCredits(result.user);
        return result.user;
      } catch (err) {
        if (err.code === 'auth/credential-already-in-use') {
          // Reuse the credential from the first popup so we don't have to
          // re-prompt the user — a 2nd popup right after a closed one
          // is almost always blocked by Safari/Chrome.
          const credential = OAuthProvider.credentialFromError(err);
          if (!credential) throw err;
          await beforeSwitch?.();
          const result = await signInWithCredential(auth, credential);
          await this._applyAppleFirstLoginName(result.user, result.user.displayName || '');
          await this._ensureUserDoc(result.user, 'apple');
          await this.initializeCredits(result.user);
          return result.user;
        }
        throw err;
      }
    } else {
      const result = await signInWithPopup(auth, appleProvider);
      await this._applyAppleFirstLoginName(result.user, result.user.displayName || '');
      await this._ensureUserDoc(result.user, 'apple');
      await this.initializeCredits(result.user);
      return result.user;
    }
  },

  // Apple only sends the user's name on the very first sign-in. If we got one
  // and the Firebase user doesn't already have a displayName, stash it.
  async _applyAppleFirstLoginName(user, fullName) {
    if (!fullName) return;
    if (user.displayName) return;
    try {
      await updateProfile(user, { displayName: fullName });
    } catch (e) {
      console.warn('Failed to apply Apple first-login displayName:', e);
    }
  },

  // Handle redirect result after iOS sign-in (call on app load)
  async handleRedirectResult() {
    try {
      const result = await getRedirectResult(auth);
      if (result?.user) {
        const provider = providerKeyForUser(result.user);
        await this._ensureUserDoc(result.user, provider);
        await this.initializeCredits(result.user);
      }
      return result;
    } catch (err) {
      if (err.code === 'auth/credential-already-in-use') {
        const credential = GoogleAuthProvider.credentialFromError(err);
        if (credential) {
          const result = await signInWithCredential(auth, credential);
          await this._ensureUserDoc(result.user, 'google');
          await this.initializeCredits(result.user);
          return result;
        }
      }
      console.warn('Redirect result error:', err);
      return null;
    }
  },

  async signOut() {
    await firebaseSignOut(auth);
    // Anonymous auth will auto-restart via firebase.js onAuthStateChanged
  },

  // Apple Guideline 5.1.1(v) — 계정 + 모든 사용자 데이터 영구 삭제.
  // 서버에서 Firestore/Storage/Auth 정리 후 클라이언트 signOut.
  async deleteAccount() {
    const user = auth.currentUser;
    if (!user || user.isAnonymous) {
      throw new Error('AUTH_REQUIRED');
    }
    const token = await user.getIdToken();
    const res = await fetch(
      `${FUNCTIONS_BASE}/deleteAccount`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `DELETE_FAILED_${res.status}`);
    }
    // 백엔드에서 Auth user 가 이미 삭제됨 — 클라이언트 토큰 무효. signOut 해서
    // anonymous 로 재시작.
    await firebaseSignOut(auth);
  },

  // Create or update user doc in Firestore
  async _ensureUserDoc(user, provider = 'google') {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      // merge:true so a server-initialized credit doc isn't clobbered
      await setDoc(userRef, {
        displayName: user.displayName || '',
        email: user.email || '',
        photoURL: user.photoURL || '',
        provider,
        createdAt: serverTimestamp(),
        savedCustomStyles: [],
      }, { merge: true });
    } else {
      // Update profile info in case it changed
      await updateDoc(userRef, {
        displayName: user.displayName || snap.data().displayName,
        email: user.email || snap.data().email,
        photoURL: user.photoURL || snap.data().photoURL,
      });
    }
  },

  // Grant signup bonus + daily login bonus (idempotent on server).
  // Only consumes guest credits if the server confirms this was the first init,
  // so a failed/unreached server doesn't destroy the guest's localStorage balance.
  async initializeCredits(user) {
    try {
      const guestCreditsClaimed = CreditsService.peekGuestForTransfer();
      const token = await user.getIdToken();
      const res = await fetch(
        `${FUNCTIONS_BASE}/initializeUser`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ guestCreditsClaimed }),
        }
      );
      if (!res.ok) {
        console.warn('initializeCredits failed:', res.status);
        return;
      }
      const state = await res.json().catch(() => null);
      if (state?.isFirstInit) {
        CreditsService.clearGuestCredits();
      }
      // Apply a pending ?ref= code if one is stashed. Must run AFTER
      // initializeUser so the invitee's user doc exists + has a referralCode.
      ReferralService.redeemPendingReferral().catch(() => { /* non-fatal */ });
    } catch (err) {
      console.warn('initializeCredits error:', err);
    }
  },

  // Save a named custom style to user's account (Firestore)
  async saveCustomStyleToAccount(userId, name, text) {
    const userRef = doc(db, 'users', userId);
    const entry = { id: Date.now().toString(), name, text, createdAt: Date.now() };
    await updateDoc(userRef, { savedCustomStyles: arrayUnion(entry) });
    return entry;
  },

  // Remove a saved custom style from user's account
  async removeCustomStyleFromAccount(userId, entry) {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { savedCustomStyles: arrayRemove(entry) });
  },

  // Get user's saved custom styles from Firestore
  async getSavedCustomStyles(userId) {
    const snap = await getDoc(doc(db, 'users', userId));
    return snap.exists() ? (snap.data().savedCustomStyles || []) : [];
  },
};
