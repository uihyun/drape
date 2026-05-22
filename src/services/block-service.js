// User blocking (Apple App Review Guideline 1.2 UGC compliance).
//
// Doc ID convention: `${blockerId}_${blockedId}` in top-level `blocks`. Same
// pattern as follows — pair uniqueness in the ID, no composite index needed.
// Read is restricted to the blocker (no notification surface for being blocked).
//
// Effects of blocking (target audience = me, the blocker):
//   - Designs by blocked user are hidden from my feed / profile views.
//   - Mutual unfollow on block (best practice, prevents stale follow rows).
// The blocked user is *not* notified. They can still see their own content
// and the rest of the app — only my surfaces hide them.

import {
  collection, doc, getDoc, getDocs, query, where, setDoc, deleteDoc,
  onSnapshot, serverTimestamp, orderBy, limit, startAfter,
} from 'firebase/firestore';
import { db, auth } from '../firebase.js';
import { FollowService } from './follow-service.js';

function blockId(blockerId, blockedId) {
  return `${blockerId}_${blockedId}`;
}

export const BlockService = {
  async toggleBlock(targetUid, currentlyBlocked) {
    const user = auth.currentUser;
    if (!user || user.isAnonymous) throw new Error('AUTH_REQUIRED');
    if (user.uid === targetUid) throw new Error('CANNOT_BLOCK_SELF');
    const ref = doc(db, 'blocks', blockId(user.uid, targetUid));
    if (currentlyBlocked) {
      await deleteDoc(ref);
    } else {
      await setDoc(ref, {
        blockerId: user.uid,
        blockedId: targetUid,
        createdAt: serverTimestamp(),
      });
      // 차단 시 양방향 unfollow — Apple 의 "no interaction" 요구사항 충족.
      // 실패해도 block 자체는 유효하므로 swallow.
      try {
        const iFollow = await FollowService.isFollowing(targetUid);
        if (iFollow) await FollowService.toggleFollow(targetUid, true);
      } catch { /* ignore */ }
    }
    return !currentlyBlocked;
  },

  async isBlocked(targetUid) {
    const user = auth.currentUser;
    if (!user || user.isAnonymous || !targetUid || targetUid === user.uid) return false;
    const snap = await getDoc(doc(db, 'blocks', blockId(user.uid, targetUid)));
    return snap.exists();
  },

  subscribeIsBlocked(targetUid, cb) {
    const user = auth.currentUser;
    if (!user || user.isAnonymous || !targetUid || targetUid === user.uid) {
      cb(false);
      return () => {};
    }
    return onSnapshot(
      doc(db, 'blocks', blockId(user.uid, targetUid)),
      (snap) => cb(snap.exists()),
      () => cb(false),
    );
  },

  // Realtime Set<uid> of users I've blocked. Used by feed surfaces to filter
  // out content from blocked authors client-side. Anonymous/signed-out users
  // get an immediate empty set.
  subscribeMyBlockedUids(cb) {
    const user = auth.currentUser;
    if (!user || user.isAnonymous) {
      cb(new Set());
      return () => {};
    }
    const q = query(collection(db, 'blocks'), where('blockerId', '==', user.uid));
    return onSnapshot(
      q,
      (snap) => {
        const set = new Set();
        snap.forEach(d => {
          const v = d.data()?.blockedId;
          if (v) set.add(v);
        });
        cb(set);
      },
      () => cb(new Set()),
    );
  },

  // Paginated list for the "Blocked users" management page. Returns uids;
  // caller resolves profiles via ProfileService.getProfilesByUids.
  async listMyBlocked({ lastDoc = null, pageSize = 30 } = {}) {
    const user = auth.currentUser;
    if (!user || user.isAnonymous) return { uids: [], lastVisible: null, hasMore: false };
    const constraints = [
      where('blockerId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(pageSize),
    ];
    let q = query(collection(db, 'blocks'), ...constraints);
    if (lastDoc) q = query(q, startAfter(lastDoc));
    const snap = await getDocs(q);
    return {
      uids: snap.docs.map(d => d.data().blockedId).filter(Boolean),
      lastVisible: snap.docs[snap.docs.length - 1] || null,
      hasMore: snap.docs.length === pageSize,
    };
  },
};
