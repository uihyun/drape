// Comments on an outfit. Per-outfit subcollection:
//   outfits/{outfitId}/comments/{commentId}
// commentCount on the parent outfit is maintained by a Cloud Function
// trigger (functions/comment-counter.js), not from the client.

import {
  collection, addDoc, deleteDoc, doc, query, orderBy, onSnapshot,
  serverTimestamp, getDoc,
} from 'firebase/firestore';
import { db, auth } from '../firebase.js';

export const COMMENT_MAX_LEN = 500;

export const CommentService = {
  subscribe(outfitId, cb) {
    if (!outfitId) return () => {};
    const q = query(
      collection(db, 'outfits', outfitId, 'comments'),
      orderBy('createdAt', 'asc'),
    );
    return onSnapshot(q, (snap) => {
      cb(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.warn('comments subscribe error:', err);
      cb([]);
    });
  },

  async addComment(outfitId, text) {
    const user = auth.currentUser;
    if (!user || user.isAnonymous) throw new Error('AUTH_REQUIRED');
    const trimmed = (text || '').trim().slice(0, COMMENT_MAX_LEN);
    if (!trimmed) throw new Error('TEXT_REQUIRED');
    // Denormalize handle + displayName onto the comment doc so the UI can
    // render the author chip without an extra profile read per comment.
    let handle = null;
    let profileDisplayName = null;
    try {
      const profSnap = await getDoc(doc(db, 'profiles', user.uid));
      if (profSnap.exists()) {
        const p = profSnap.data();
        handle = p.handle || null;
        profileDisplayName = p.displayName || null;
      }
    } catch (e) {
      console.warn('comment addComment: profile read failed', e?.message);
    }
    return addDoc(collection(db, 'outfits', outfitId, 'comments'), {
      userId: user.uid,
      displayName: profileDisplayName || user.displayName || '',
      handle: handle || null,
      photoURL: user.photoURL || null,
      text: trimmed,
      createdAt: serverTimestamp(),
    });
  },

  async deleteComment(outfitId, commentId) {
    return deleteDoc(doc(db, 'outfits', outfitId, 'comments', commentId));
  },
};
