// Public profile + handle (Phase 10-3).
import { FUNCTIONS_BASE } from './api-base.js';
//
// `profiles/{uid}` is publicly readable; writes go through Cloud Functions
// (`claimHandle`, `updateProfile`).

import { collection, doc, getDoc, getDocs, query, where, limit, onSnapshot } from 'firebase/firestore';
import { updateProfile as authUpdateProfile } from 'firebase/auth';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from '../firebase.js';
import { IMG_CACHE } from './storageCache.js';

const CLAIM_FN_URL = `${FUNCTIONS_BASE}/claimHandle`;
const UPDATE_FN_URL = `${FUNCTIONS_BASE}/updateProfile`;

export const HANDLE_RE = /^[a-z0-9_]{3,20}$/;
export const BIO_MAX = 80;
export const DISPLAY_NAME_MAX = 30;
export const INSTAGRAM_MAX = 30;
export const LOCATION_MAX = 60;

// Generic default name created server-side on profile creation. We treat
// it as "user hasn't picked a name" and fall back to @handle for display.
export const DEFAULT_DISPLAY_NAME = 'drape user';

// Primary identifier shown across the app — *always* `@handle` (Instagram
// 식). displayName 은 부가 정보로 두 슬롯 있는 페이지 (Profile 헤더, follow
// list 행, Account summary) 에서만 부제목으로 노출. handle 은 unique +
// 클릭/공유 가능한 URL 단위라 가장 안정적인 ID.
export function profileLabel(profile) {
  if (!profile || !profile.handle) return '';
  return `@${profile.handle}`;
}
// Same allowed chars as Instagram itself. Used for client-side hint;
// canonical normalization (strip @, https://instagram.com/, etc.) happens
// server-side.
export const INSTAGRAM_RE = /^[a-zA-Z0-9._]{1,30}$/;

async function authedFetch(url, body) {
  const headers = { 'Content-Type': 'application/json' };
  const user = auth.currentUser;
  if (!user) throw new Error('AUTH_REQUIRED');
  try {
    const token = await user.getIdToken();
    headers.Authorization = `Bearer ${token}`;
  } catch (e) {
    console.warn('profile auth token attach failed:', e);
  }
  const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ data: body }) });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const err = new Error(errorData.error || 'Request failed');
    err.code = errorData.error;
    err.status = response.status;
    throw err;
  }
  return response.json();
}

export const ProfileService = {
  async getByUid(uid) {
    if (!uid) return null;
    const snap = await getDoc(doc(db, 'profiles', uid));
    return snap.exists() ? { uid: snap.id, ...snap.data() } : null;
  },

  // Resolve a handle (case-insensitive) to a profile. Two reads — handle
  // reverse-index then the profile itself.
  async getByHandle(handle) {
    const normalized = String(handle || '').trim().toLowerCase();
    if (!normalized) return null;
    const handleSnap = await getDoc(doc(db, 'handles', normalized));
    if (!handleSnap.exists()) return null;
    const uid = handleSnap.data().uid;
    return this.getByUid(uid);
  },

  // Batch fetch profiles for a list of uids — used by feed/listing pages
  // that need (handle / displayName / photoURL) for many designs at once.
  // Firestore `in` is capped at 30, so we chunk. Returns a Map(uid → profile).
  async getProfilesByUids(uids) {
    const unique = Array.from(new Set((uids || []).filter(Boolean)));
    if (unique.length === 0) return new Map();
    const result = new Map();
    for (let i = 0; i < unique.length; i += 30) {
      const chunk = unique.slice(i, i + 30);
      const snaps = await Promise.all(chunk.map(uid => getDoc(doc(db, 'profiles', uid))));
      snaps.forEach((s, j) => {
        if (s.exists()) result.set(chunk[j], { uid: chunk[j], ...s.data() });
      });
    }
    return result;
  },

  // Subscribe to a profile by uid (live counts + bio updates).
  subscribeByUid(uid, cb) {
    if (!uid) { cb(null); return () => {}; }
    return onSnapshot(
      doc(db, 'profiles', uid),
      (snap) => cb(snap.exists() ? { uid: snap.id, ...snap.data() } : null),
      () => cb(null),
    );
  },

  // Public listed designs by uid for the profile grid.
  async getListedDesignsByUid(uid, { max = 24 } = {}) {
    if (!uid) return [];
    const q = query(
      collection(db, 'designs'),
      where('userId', '==', uid),
      where('isListed', '==', true),
      where('status', '==', 'success'),
      limit(max),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async claimHandle(handle) {
    return authedFetch(CLAIM_FN_URL, { handle });
  },

  async updateBio(bio) {
    return authedFetch(UPDATE_FN_URL, { bio });
  },

  async updateInstagram(instagram) {
    return authedFetch(UPDATE_FN_URL, { instagram });
  },

  async updateLocation(location) {
    return authedFetch(UPDATE_FN_URL, { location });
  },

  // Upload a profile photo. Stored under /users/{uid}/profile/avatar.jpg
  // (public read, owner write via storage.rules), then the URL is pushed
  // to profiles/{uid}.photoURL through the updateProfile cloud function.
  // A query-string cache buster suffixes the URL on subsequent uploads
  // so the browser doesn't keep serving the old image after a swap.
  async updateProfilePhoto(blob) {
    const user = auth.currentUser;
    if (!user) throw new Error('not_signed_in');
    const path = `users/${user.uid}/profile/avatar.jpg`;
    const r = storageRef(storage, path);
    await uploadBytes(r, blob, { contentType: blob.type || 'image/jpeg', cacheControl: IMG_CACHE });
    const url = await getDownloadURL(r);
    const bustered = `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`;
    await authedFetch(UPDATE_FN_URL, { photoURL: bustered });
    return bustered;
  },

  async removeProfilePhoto() {
    await authedFetch(UPDATE_FN_URL, { photoURL: '' });
  },

  // Persist displayName to profiles/{uid} (server) and mirror to the
  // current Firebase Auth user so future actions (comments, etc.) pick up
  // the new name without a page reload.
  async updateDisplayName(displayName) {
    const trimmed = String(displayName || '').trim().slice(0, DISPLAY_NAME_MAX);
    const result = await authedFetch(UPDATE_FN_URL, { displayName: trimmed });
    if (auth.currentUser) {
      try { await authUpdateProfile(auth.currentUser, { displayName: trimmed || null }); } catch {}
    }
    return result;
  },
};
