// Comments live in a `comments` subcollection on any parent doc:
//   {parentColl}/{parentId}/comments/{commentId}
// Supports outfits / ootds / boards uniformly — the only varying piece
// is the parent collection name. commentCount on the parent doc is
// maintained by a Cloud Function trigger (functions/comment-counter.js).

import {
  collection, addDoc, deleteDoc, doc, query, orderBy, onSnapshot,
  serverTimestamp, getDoc,
} from 'firebase/firestore';
import { db, auth } from '../firebase.js';

export const COMMENT_MAX_LEN = 500;
const ALLOWED_PARENTS = new Set(['outfits', 'boards', 'generations']);

function checkParent(parentColl) {
  if (!ALLOWED_PARENTS.has(parentColl)) {
    throw new Error(`unsupported_parent: ${parentColl}`);
  }
}

export const CommentService = {
  subscribe(parentColl, parentId, cb) {
    if (!parentId) return () => {};
    checkParent(parentColl);
    const q = query(
      collection(db, parentColl, parentId, 'comments'),
      orderBy('createdAt', 'asc'),
    );
    return onSnapshot(q, (snap) => {
      cb(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.warn('comments subscribe error:', err);
      cb([]);
    });
  },

  async addComment(parentColl, parentId, text) {
    checkParent(parentColl);
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
    return addDoc(collection(db, parentColl, parentId, 'comments'), {
      userId: user.uid,
      displayName: profileDisplayName || user.displayName || '',
      handle: handle || null,
      photoURL: user.photoURL || null,
      text: trimmed,
      createdAt: serverTimestamp(),
    });
  },

  async deleteComment(parentColl, parentId, commentId) {
    checkParent(parentColl);
    return deleteDoc(doc(db, parentColl, parentId, 'comments', commentId));
  },
};
