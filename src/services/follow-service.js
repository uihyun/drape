// Follow / unfollow + following list (Phase 10-2).
//
// Doc ID convention: `${followerId}_${followingId}`. Counter fields on users
// docs are maintained server-side via Cloud Function triggers.

import {
  collection, doc, getDoc, getDocs, query, where, setDoc, deleteDoc,
  onSnapshot, serverTimestamp, limit, orderBy, startAfter,
} from 'firebase/firestore';
import { db, auth } from '../firebase.js';

// Firestore `in` operator caps at 30 — we use that as the "fits in one query"
// threshold for the Following feed. Above this we'd need a fan-out collection
// (deferred — see PRODUCT_PLAN §10-2 후속).
export const FOLLOWING_FEED_LIMIT = 30;

function followId(followerId, followingId) {
  return `${followerId}_${followingId}`;
}

export const FollowService = {
  async toggleFollow(targetUid, currentlyFollowing) {
    const user = auth.currentUser;
    if (!user || user.isAnonymous) throw new Error('AUTH_REQUIRED');
    if (user.uid === targetUid) throw new Error('CANNOT_FOLLOW_SELF');
    const ref = doc(db, 'follows', followId(user.uid, targetUid));
    if (currentlyFollowing) {
      await deleteDoc(ref);
    } else {
      await setDoc(ref, {
        followerId: user.uid,
        followingId: targetUid,
        createdAt: serverTimestamp(),
      });
    }
    return !currentlyFollowing;
  },

  async isFollowing(targetUid) {
    const user = auth.currentUser;
    if (!user || user.isAnonymous || !targetUid || targetUid === user.uid) return false;
    const snap = await getDoc(doc(db, 'follows', followId(user.uid, targetUid)));
    return snap.exists();
  },

  subscribeIsFollowing(targetUid, cb) {
    const user = auth.currentUser;
    if (!user || user.isAnonymous || !targetUid || targetUid === user.uid) {
      cb(false);
      return () => {};
    }
    return onSnapshot(
      doc(db, 'follows', followId(user.uid, targetUid)),
      (snap) => cb(snap.exists()),
      () => cb(false),
    );
  },

  // Up to FOLLOWING_FEED_LIMIT uids the given user is following. Used to
  // power the Following feed tab via `where('userId', 'in', ...)`.
  async getFollowingIds(uid, { max = FOLLOWING_FEED_LIMIT } = {}) {
    if (!uid) return [];
    const q = query(
      collection(db, 'follows'),
      where('followerId', '==', uid),
      limit(max),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data().followingId).filter(Boolean);
  },

  // Paginated list of users who follow `uid` (= "Followers"). 신규 순서.
  // Cursor-based pagination via lastDoc — caller passes the previous page's
  // lastVisible back in to fetch the next.
  async listFollowers(uid, { lastDoc = null, pageSize = 30 } = {}) {
    if (!uid) return { uids: [], lastVisible: null, hasMore: false };
    const constraints = [
      where('followingId', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(pageSize),
    ];
    let q = query(collection(db, 'follows'), ...constraints);
    if (lastDoc) q = query(q, startAfter(lastDoc));
    const snap = await getDocs(q);
    return {
      uids: snap.docs.map(d => d.data().followerId).filter(Boolean),
      lastVisible: snap.docs[snap.docs.length - 1] || null,
      hasMore: snap.docs.length === pageSize,
    };
  },

  // Paginated list of users `uid` follows (= "Following"). 신규 순서.
  async listFollowing(uid, { lastDoc = null, pageSize = 30 } = {}) {
    if (!uid) return { uids: [], lastVisible: null, hasMore: false };
    const constraints = [
      where('followerId', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(pageSize),
    ];
    let q = query(collection(db, 'follows'), ...constraints);
    if (lastDoc) q = query(q, startAfter(lastDoc));
    const snap = await getDocs(q);
    return {
      uids: snap.docs.map(d => d.data().followingId).filter(Boolean),
      lastVisible: snap.docs[snap.docs.length - 1] || null,
      hasMore: snap.docs.length === pageSize,
    };
  },
};
