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
let tapHandlerReady = false;
let cachedToken = null;
// Thread id from a notification tap, awaiting in-app router navigation.
let pendingNav = null;

// Map a tapped notification's data payload to an in-app route.
function routeForNotification(data = {}) {
  if (data.threadId) return `/messages/${data.threadId}`;
  if (data.boardId) return `/boards/${data.boardId}`;
  if (data.outfitId) return `/o/${data.outfitId}`;
  if (data.type === 'follow' && data.handle) return `/u/${data.handle}`;
  if (data.type === 'reminder') return '/feed';
  return null;
}

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
  // Register the notification-tap handler as EARLY as possible (on app launch,
  // before auth) so a cold-start tap — which fires once, right after boot —
  // isn't missed because ensureRegistered hadn't run yet. Deep-links to the
  // thread. Idempotent.
  async initTapHandler() {
    if (!Capacitor.isNativePlatform() || tapHandlerReady) return;
    tapHandlerReady = true;
    try {
      const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
      FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
        const route = routeForNotification(event?.notification?.data || {});
        if (!route) return;
        // Hand off to the router (NOT window.location.assign — a hard reload
        // re-runs the whole splash/auth boot and strands the screen on a spinner).
        // App.jsx listens for this event (warm) and drains pendingNav once authed
        // (cold start). Covers DM, like, try-on, and reminder taps.
        pendingNav = route;
        try { window.dispatchEvent(new CustomEvent('drape:open-route', { detail: route })); } catch { /* ignore */ }
      });
    } catch (err) {
      tapHandlerReady = false;
      console.warn('initTapHandler failed:', err.message);
    }
  },

  // Drain a queued notification-tap target (cold start: the tap fired before
  // the router/auth was ready). Returns the threadId once, or null.
  consumePendingNav() {
    const t = pendingNav;
    pendingNav = null;
    return t;
  },

  // Remove any delivered notifications for a thread once the user opens it —
  // so the tray doesn't keep stale alerts for messages already read.
  async clearThreadNotifications(threadId) {
    if (!Capacitor.isNativePlatform() || !threadId) return;
    try {
      const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
      const { notifications } = await FirebaseMessaging.getDeliveredNotifications();
      const match = (notifications || []).filter(n => n?.data?.threadId === threadId);
      if (match.length) await FirebaseMessaging.removeDeliveredNotifications({ notifications: match });
    } catch (err) {
      console.warn('clearThreadNotifications failed:', err.message);
    }
  },

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
