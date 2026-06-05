// === PushService ========================================================
// Native push registration via Capacitor + Firebase Cloud Messaging.
//
// Web (PWA) doesn't register anything here — we lean on the Firestore
// realtime stream + the in-app unread badge while the tab is open. Push
// is iOS / Android only for v1, gated on Capacitor.isNativePlatform().
//
// Token storage shape:
//   /users/{uid}/fcmTokens/{token} = { platform, createdAt }
// Subcollection chosen over an array on the user doc so multiple devices
// can register independently and stale tokens drop without a read-modify-
// write race. The sendNewMessagePush Cloud Function lists this collection
// to fan-out push for new DMs.
//
// Required outside this file before pushes actually fly:
//  - Firebase Console: enable Cloud Messaging API (Project settings → Cloud Messaging)
//  - iOS: upload APNs auth key (.p8) to Firebase, enable Push capability in Xcode
//  - Android: google-services.json under android/app/, Firebase project linked
// See CAPACITOR_SETUP.md §6 for the manual checklist.

import { Capacitor } from '@capacitor/core';
import { collection, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase.js';

let registered = false;
let cachedToken = null;

async function persistToken(uid, token, platform) {
  if (!uid || !token) return;
  cachedToken = token;
  await setDoc(
    doc(collection(db, 'users', uid, 'fcmTokens'), token),
    { platform, createdAt: serverTimestamp() },
    { merge: true },
  );
}

async function removeToken(uid, token) {
  if (!uid || !token) return;
  try { await deleteDoc(doc(db, 'users', uid, 'fcmTokens', token)); }
  catch (err) { console.warn('removeToken failed:', err.message); }
}

export const PushService = {
  // Idempotent — safe to call on every auth state change. Registers
  // listeners once; on subsequent calls just refreshes the stored token
  // mapping for the current uid.
  async ensureRegistered() {
    if (!Capacitor.isNativePlatform()) return;
    const user = auth.currentUser;
    if (!user || user.isAnonymous) return;

    // Use @capacitor-firebase/messaging, NOT @capacitor/push-notifications:
    // on iOS the latter hands back the raw APNs device token, but our server
    // sends via FCM (admin.messaging) which needs the FCM registration token.
    // FirebaseMessaging.getToken() returns the FCM token (it owns the APNs↔FCM
    // exchange internally).
    let FirebaseMessaging;
    try {
      ({ FirebaseMessaging } = await import('@capacitor-firebase/messaging'));
    } catch (err) {
      console.warn('firebase-messaging import failed:', err.message);
      return;
    }

    if (!registered) {
      registered = true;
      const perm = await FirebaseMessaging.checkPermissions();
      if (perm.receive !== 'granted') {
        const req = await FirebaseMessaging.requestPermissions();
        if (req.receive !== 'granted') {
          console.info('push permission denied');
          registered = false; // let a later launch retry once enabled
          return;
        }
      }

      // Token refresh (reinstall / APNs re-issue) → re-persist.
      FirebaseMessaging.addListener('tokenReceived', async (event) => {
        const u = auth.currentUser;
        if (!u || u.isAnonymous || !event?.token) return;
        await persistToken(u.uid, event.token, Capacitor.getPlatform());
      });

      // Tapping a notification in the tray → deep-link straight to the chat.
      FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
        const threadId = event?.notification?.data?.threadId;
        if (threadId) window.location.assign(`/messages/${threadId}`);
      });

      // Fetch + persist the current FCM token now.
      try {
        const { token } = await FirebaseMessaging.getToken();
        if (token) await persistToken(user.uid, token, Capacitor.getPlatform());
      } catch (err) {
        console.warn('FCM getToken failed:', err.message);
      }
    } else if (cachedToken) {
      // Auth changed (user switched accounts) — re-bind cached token to the new uid.
      await persistToken(user.uid, cachedToken, Capacitor.getPlatform());
    }
  },

  // Best-effort cleanup on sign-out so the previous user doesn't keep
  // receiving pushes on this device.
  async unregister(uid) {
    if (uid && cachedToken) await removeToken(uid, cachedToken);
    cachedToken = null;
  },
};
