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
import { db, auth } from '../firebase.js';

const THREADS = 'threads';

export function threadIdFor(uidA, uidB, itemId) {
  const [lo, hi] = uidA < uidB ? [uidA, uidB] : [uidB, uidA];
  return `${lo}_${hi}_${itemId}`;
}

export const MessageService = {
  // Open (or create) a thread between the current user and a seller for
  // a specific item. Returns the threadId. Idempotent via deterministic id.
  //
  // We deliberately skip the existence check here — getDoc on a missing
  // thread denies under the participants-only read rule (rule evaluates
  // resource.data on null). setDoc with merge:true handles both cases:
  // first call hits the CREATE rule, repeat calls hit UPDATE (which only
  // requires participants + itemId to stay the same — they always do
  // because the threadId encodes both). lastMessage is omitted so the
  // preview from sendMessage isn't clobbered on reopen.
  async openThread({ sellerUid, item }) {
    const user = auth.currentUser;
    if (!user || user.isAnonymous) throw new Error('AUTH_REQUIRED');
    if (user.uid === sellerUid) throw new Error('CANNOT_DM_SELF');
    const id = threadIdFor(user.uid, sellerUid, item.id);
    const ref = doc(db, THREADS, id);
    await setDoc(ref, {
      participants: [user.uid, sellerUid].sort(),
      itemId: item.id,
      itemName: item.name || '',
      itemCover: item.croppedUrl || item.originalUrl || '',
      priceAsking: item.priceAsking || 0,
      currency: item.currency || 'KRW',
      sellerUid,
      buyerUid: user.uid,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return id;
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
    // Bump unread for the *other* participant + reset mine. Stored as a
    // map { [uid]: count } so the inbox can render a badge per row and
    // a hook can sum across threads for a global icon badge.
    // Done client-side for v1; move to a Cloud Function if abuse pops up.
    try {
      const snap = await getDoc(doc(db, THREADS, threadId));
      const data = snap.data() || {};
      const others = (data.participants || []).filter(u => u !== user.uid);
      const prev = (data.unreadFor && typeof data.unreadFor === 'object') ? data.unreadFor : {};
      const next = { ...prev, [user.uid]: 0 };
      for (const o of others) next[o] = (prev[o] || 0) + 1;
      await setDoc(
        doc(db, THREADS, threadId),
        {
          updatedAt: serverTimestamp(),
          lastMessage: { text: trimmed, fromUid: user.uid, createdAt: serverTimestamp() },
          unreadFor: next,
        },
        { merge: true },
      );
    } catch (err) {
      console.warn('thread updatedAt patch failed:', err.message);
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
