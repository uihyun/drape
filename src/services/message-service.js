// === MessageService =====================================================
// Lightweight DM layer for marketplace conversations. No escrow, no offers
// — just direct messaging between buyer and seller about a listed item.
//
// Thread id is `${minUid}_${maxUid}_${itemId}` so the same pair opening
// the same listing always lands in one canonical thread (idempotent).

import {
  collection, doc, getDoc, setDoc, addDoc,
  query, where, orderBy, limit, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from '../firebase.js';
import { IMG_CACHE } from './storageCache.js';
import { CameraService } from './camera.js';

const THREADS = 'threads';

export function threadIdFor(uidA, uidB, itemId) {
  const [lo, hi] = uidA < uidB ? [uidA, uidB] : [uidB, uidA];
  return `${lo}_${hi}_${itemId}`;
}

// Read a blob's pixel dimensions (so an image bubble can reserve the
// right aspect ratio before the download resolves — no layout jump).
function blobDimensions(blob) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { resolve({ width: 0, height: 0 }); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

// Bump unread for participants who *aren't currently in the room* and
// refresh the thread preview. Shared by sendMessage / sendImage.
// activeIn[uid] (set by Thread.jsx) suppresses the badge while the other
// side is watching; the sender's own count always resets.
async function bumpThread(threadId, uid, lastMessage) {
  try {
    const snap = await getDoc(doc(db, THREADS, threadId));
    const data = snap.data() || {};
    const others = (data.participants || []).filter(u => u !== uid);
    const prev = (data.unreadFor && typeof data.unreadFor === 'object') ? data.unreadFor : {};
    const active = (data.activeIn && typeof data.activeIn === 'object') ? data.activeIn : {};
    const next = { ...prev, [uid]: 0 };
    for (const o of others) next[o] = active[o] ? 0 : (prev[o] || 0) + 1;
    await setDoc(
      doc(db, THREADS, threadId),
      { updatedAt: serverTimestamp(), lastMessage, unreadFor: next },
      { merge: true },
    );
  } catch (err) {
    console.warn('thread bump failed:', err.message);
  }
}

export const MessageService = {
  // Prepare a thread WITHOUT writing anything. Returns the deterministic
  // threadId + a `draft` of the thread doc the UI can render from. The thread
  // is only persisted on the FIRST message (ensureThread, below) — so a buyer
  // who taps "Contact seller" and leaves without typing never creates an empty
  // room that clutters both inboxes.
  prepareThread({ sellerUid, item }) {
    const user = auth.currentUser;
    if (!user || user.isAnonymous) throw new Error('AUTH_REQUIRED');
    if (user.uid === sellerUid) throw new Error('CANNOT_DM_SELF');
    const id = threadIdFor(user.uid, sellerUid, item.id);
    const draft = {
      participants: [user.uid, sellerUid].sort(),
      itemId: item.id,
      itemName: item.name || '',
      itemCover: item.croppedUrl || item.originalUrl || '',
      priceAsking: item.priceAsking || 0,
      currency: item.currency || 'KRW',
      sellerUid,
      buyerUid: user.uid,
    };
    return { id, draft };
  },

  // Create the thread doc from a draft if it isn't there yet. Idempotent
  // (setDoc merge); called once, right before the first message is sent.
  async ensureThread(threadId, draft) {
    if (!draft) throw new Error('NO_DRAFT');
    await setDoc(
      doc(db, THREADS, threadId),
      { ...draft, updatedAt: serverTimestamp() },
      { merge: true },
    );
  },

  // Live list of the current user's threads, newest activity first.
  subscribeMyThreads(cb) {
    const user = auth.currentUser;
    if (!user || user.isAnonymous) { cb([]); return () => {}; }
    const q = query(
      collection(db, THREADS),
      where('participants', 'array-contains', user.uid),
      orderBy('updatedAt', 'desc'),
      limit(50),
    );
    return onSnapshot(
      q,
      snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => { console.warn('threads subscribe failed:', err.message); cb([]); },
    );
  },

  // Single thread metadata.
  async getThread(threadId) {
    const snap = await getDoc(doc(db, THREADS, threadId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  },

  // Live message stream for a thread (oldest → newest).
  subscribeMessages(threadId, cb) {
    const q = query(
      collection(db, THREADS, threadId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(200),
    );
    return onSnapshot(
      q,
      snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => { console.warn('messages subscribe failed:', err.message); cb([]); },
    );
  },

  async sendMessage(threadId, text) {
    const user = auth.currentUser;
    if (!user || user.isAnonymous) throw new Error('AUTH_REQUIRED');
    const trimmed = (text || '').trim().slice(0, 1000);
    if (!trimmed) return;
    await addDoc(collection(db, THREADS, threadId, 'messages'), {
      fromUid: user.uid,
      text: trimmed,
      createdAt: serverTimestamp(),
    });
    await bumpThread(threadId, user.uid, { text: trimmed, fromUid: user.uid, createdAt: serverTimestamp() });
  },

  // Photo message. The blob is recompressed client-side before upload so
  // we never push a multi-MB camera original over the wire — capped at
  // 1280px / ~0.7 quality (a few hundred KB). Stored under the sender's
  // own Storage prefix; the message doc just holds the download URL +
  // pixel dimensions for jump-free rendering.
  async sendImage(threadId, blob) {
    const user = auth.currentUser;
    if (!user || user.isAnonymous) throw new Error('AUTH_REQUIRED');
    if (!blob) return;
    const compressed = await CameraService.compressBlob(blob, {
      maxWidth: 1280, maxHeight: 1280, quality: 0.7, format: 'image/jpeg',
    });
    const { width, height } = await blobDimensions(compressed);
    const imgId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const path = `dm/${user.uid}/${threadId}/${imgId}.jpg`;
    const r = storageRef(storage, path);
    await uploadBytes(r, compressed, { contentType: 'image/jpeg', cacheControl: IMG_CACHE });
    const imageUrl = await getDownloadURL(r);
    await addDoc(collection(db, THREADS, threadId, 'messages'), {
      fromUid: user.uid,
      type: 'image',
      imageUrl,
      imagePath: path,
      width,
      height,
      createdAt: serverTimestamp(),
    });
    // Emoji preview keeps the thread-list snippet language-neutral.
    await bumpThread(threadId, user.uid, { text: '📷', type: 'image', fromUid: user.uid, createdAt: serverTimestamp() });
  },

  // Presence flag — Thread.jsx flips this on mount / off on unmount.
  // sendMessage reads it to decide whether to bump unread on the
  // recipient. Best-effort: if the tab closes abruptly the stale 'true'
  // means the other party briefly doesn't get a badge until they
  // re-enter — acceptable trade-off vs. server-side presence.
  async setActive(threadId, isActive) {
    const user = auth.currentUser;
    if (!user || user.isAnonymous) return;
    try {
      await setDoc(
        doc(db, THREADS, threadId),
        { activeIn: { [user.uid]: !!isActive } },
        { merge: true },
      );
    } catch (err) {
      console.warn('setActive failed:', err.message);
    }
  },

  // Reset the current user's unread count for this thread. Called when
  // the Thread page mounts so opening a chat clears its badge.
  async markThreadRead(threadId) {
    const user = auth.currentUser;
    if (!user || user.isAnonymous) return;
    try {
      await setDoc(
        doc(db, THREADS, threadId),
        { unreadFor: { [user.uid]: 0 } },
        { merge: true },
      );
    } catch (err) {
      console.warn('markThreadRead failed:', err.message);
    }
  },
};
