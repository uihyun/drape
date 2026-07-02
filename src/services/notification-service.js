// In-app notifications for the profile bell. Docs are written server-side by
// the social triggers (functions/notifications.js) at
// notifications/{uid}/items/{id}; the client reads them, marks them read, and
// can dismiss. Mirrors the MessageService subscribe pattern.

import {
  collection, query, orderBy, limit, where, onSnapshot,
  doc, deleteDoc, getDocs, writeBatch,
} from 'firebase/firestore';
import { db, auth } from '../firebase.js';

const COLL = 'notifications';

function itemsCol(uid) {
  return collection(db, COLL, uid, 'items');
}

export const NotificationService = {
  // Live subscription to the current user's notifications (newest first).
  subscribe(cb, { pageSize = 50 } = {}) {
    const user = auth.currentUser;
    if (!user || user.isAnonymous) { cb([]); return () => {}; }
    const q = query(itemsCol(user.uid), orderBy('createdAt', 'desc'), limit(pageSize));
    return onSnapshot(
      q,
      snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => { console.warn('notifications subscribe failed:', err.message); cb([]); },
    );
  },

  // Flip every unread notification to read (single-field query → no composite
  // index needed). Called when the bell view opens.
  async markAllRead() {
    const user = auth.currentUser;
    if (!user || user.isAnonymous) return;
    try {
      const snap = await getDocs(query(itemsCol(user.uid), where('read', '==', false), limit(300)));
      if (snap.empty) return;
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.update(d.ref, { read: true }));
      await batch.commit();
    } catch (err) { console.warn('markAllRead failed:', err.message); }
  },

  async remove(id) {
    const user = auth.currentUser;
    if (!user || user.isAnonymous || !id) return;
    try { await deleteDoc(doc(db, COLL, user.uid, 'items', id)); }
    catch (err) { console.warn('notification delete failed:', err.message); }
  },
};
