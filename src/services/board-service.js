// Sticker board: clothing items placed on a free canvas, diary-style.
// Each sticker = { itemId, x, y, scale, rotation, z } in board-local
// coordinates (0..1 on each axis, so the canvas can be sized however
// the renderer likes). Board doc shape:
//   { id, userId, name, stickers[], coverUrl, createdAt, updatedAt }

import {
  collection, doc, addDoc, getDoc, getDocs, deleteDoc,
  query, where, orderBy, limit, onSnapshot, setDoc, serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../firebase.js';

const BOARDS = 'boards';

async function createBoard({ name = '', stickers = [], coverUrl = null, isPublic = false } = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('AUTH_REQUIRED');
  const ref = await addDoc(collection(db, BOARDS), {
    userId: user.uid,
    name: String(name).slice(0, 80),
    stickers: Array.isArray(stickers) ? stickers : [],
    coverUrl,
    isPublic: !!isPublic,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id };
}

async function getBoard(boardId) {
  const snap = await getDoc(doc(db, BOARDS, boardId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

async function updateBoard(boardId, patch) {
  const allowed = ['name', 'stickers', 'coverUrl', 'isPublic'];
  const safe = Object.fromEntries(
    Object.entries(patch).filter(([k]) => allowed.includes(k))
  );
  safe.updatedAt = serverTimestamp();
  await setDoc(doc(db, BOARDS, boardId), safe, { merge: true });
}

async function deleteBoard(boardId) {
  await deleteDoc(doc(db, BOARDS, boardId));
}

async function listMyBoards({ pageSize = 30 } = {}) {
  const user = auth.currentUser;
  if (!user) return [];
  const snap = await getDocs(query(
    collection(db, BOARDS),
    where('userId', '==', user.uid),
    orderBy('updatedAt', 'desc'),
    limit(pageSize),
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Bookmark / unbookmark a board. Same subcollection as OOTDs at
 *  /users/{uid}/bookmarks/{boardId}, with type='board' so listing can
 *  filter the two kinds without a per-type collection. */
async function toggleBookmark(boardId, currentlyBookmarked) {
  const user = auth.currentUser;
  if (!user) throw new Error('not_signed_in');
  const ref = doc(db, 'users', user.uid, 'bookmarks', boardId);
  if (currentlyBookmarked) {
    await deleteDoc(ref);
  } else {
    await setDoc(ref, {
      type: 'board',
      boardId,
      createdAt: serverTimestamp(),
    });
  }
}

/** All boards the user has bookmarked, newest-bookmark first. Same
 *  client-side filter+sort as listBookmarkedOotds — avoids needing a
 *  per-user subcollection composite index. */
async function listBookmarkedBoards({ uid, pageSize = 30 } = {}) {
  const snap = await getDocs(collection(db, 'users', uid, 'bookmarks'));
  const rows = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(r => r.type === 'board');
  rows.sort((a, b) => {
    const at = a.createdAt?.toMillis?.() ?? 0;
    const bt = b.createdAt?.toMillis?.() ?? 0;
    return bt - at;
  });
  const ids = rows.slice(0, pageSize).map(r => r.boardId || r.id).filter(Boolean);
  if (!ids.length) return [];
  const hydrated = await Promise.all(
    ids.map(id => getDoc(doc(db, BOARDS, id))
      .then(s => s.exists() ? { id: s.id, ...s.data() } : null)
      .catch(() => null))
  );
  return hydrated.filter(Boolean);
}

/** This user's public boards — used by PublicProfile's Boards tab.
 *  Same shape as listPublicBoards but scoped to a single userId. */
async function listPublicBoardsByUser({ uid, pageSize = 30 } = {}) {
  const snap = await getDocs(query(
    collection(db, BOARDS),
    where('userId', '==', uid),
    where('isPublic', '==', true),
    orderBy('updatedAt', 'desc'),
    limit(pageSize),
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Public board feed — every board with isPublic=true, newest first.
 *  Owner-agnostic, so the caller hydrates author profiles separately
 *  (same pattern as listPublicFeed for OOTDs). */
async function listPublicBoards({ pageSize = 24, sortBy = 'latest' } = {}) {
  const orderField = sortBy === 'popular' ? 'likeCount' : 'updatedAt';
  const snap = await getDocs(query(
    collection(db, BOARDS),
    where('isPublic', '==', true),
    orderBy(orderField, 'desc'),
    limit(pageSize),
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Following feed — public boards from the given set of authors,
 *  newest first. Mirrors OotdService.listFollowingFeed. Firestore `in`
 *  caps at 30. */
async function listFollowingBoards({ followingIds, pageSize = 24 } = {}) {
  if (!Array.isArray(followingIds) || followingIds.length === 0) return [];
  const ids = followingIds.slice(0, 30);
  const snap = await getDocs(query(
    collection(db, BOARDS),
    where('isPublic', '==', true),
    where('userId', 'in', ids),
    orderBy('updatedAt', 'desc'),
    limit(pageSize),
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Like / unlike a public board. Mirrors OotdService.toggleLike. */
async function toggleLike(boardId, uid, currentlyLiked) {
  const ref_ = doc(db, BOARDS, boardId);
  const snap = await getDoc(ref_);
  if (!snap.exists()) throw new Error('not_found');
  const data = snap.data();
  const liked = Array.isArray(data.likedBy) ? data.likedBy : [];
  const nextLiked = currentlyLiked
    ? liked.filter(u => u !== uid)
    : [...liked, uid];
  await setDoc(ref_, {
    likedBy: nextLiked,
    likeCount: Math.max(0, (data.likeCount || 0) + (currentlyLiked ? -1 : 1)),
  }, { merge: true });
}

function subscribeMyBoards(cb) {
  const user = auth.currentUser;
  if (!user) { cb([]); return () => {}; }
  return onSnapshot(
    query(
      collection(db, BOARDS),
      where('userId', '==', user.uid),
      orderBy('updatedAt', 'desc'),
      limit(30),
    ),
    (snap) => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    (err) => {
      // Surface index-missing / permission errors instead of pretending
      // the user has zero boards — that's what hid the empty-list bug.
      console.warn('subscribeMyBoards failed:', err?.code, err?.message);
      cb([]);
    },
  );
}

export const BoardService = {
  createBoard,
  getBoard,
  updateBoard,
  deleteBoard,
  listMyBoards,
  listPublicBoards,
  listFollowingBoards,
  listPublicBoardsByUser,
  listBookmarkedBoards,
  subscribeMyBoards,
  toggleBookmark,
  toggleLike,
};

export default BoardService;
