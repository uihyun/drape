// Sticker board: clothing items placed on a free canvas, diary-style.
// Each sticker = { itemId, x, y, scale, rotation, z } in board-local
// coordinates (0..1 on each axis, so the canvas can be sized however
// the renderer likes). Board doc shape:
//   { id, userId, name, stickers[], coverUrl, createdAt, updatedAt }

import {
  collection, doc, addDoc, getDoc, getDocs, deleteDoc,
  query, where, orderBy, limit, startAfter, onSnapshot, setDoc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../firebase.js';

const BOARDS = 'boards';

async function createBoard({ name = '', stickers = [], coverUrl = null, isPublic = false, background = 'paper', ratio = 'portrait', sourceOutfitId = null, rangeKey = null } = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('AUTH_REQUIRED');
  const ref = await addDoc(collection(db, BOARDS), {
    userId: user.uid,
    name: String(name).slice(0, 80),
    stickers: Array.isArray(stickers) ? stickers : [],
    coverUrl,
    isPublic: !!isPublic,
    background: String(background).slice(0, 24),
    ratio: String(ratio).slice(0, 12),
    // Where an auto-built board came from: an outfit ("Make a board"), or a
    // week/month of worn outfits ('week:2026-10-05' / 'month:2026-10'). Set
    // once at creation; a range board is refreshed in place, never duplicated.
    ...(sourceOutfitId ? { sourceOutfitId: String(sourceOutfitId) } : {}),
    ...(rangeKey ? { rangeKey: String(rangeKey).slice(0, 24) } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id };
}

// ── Auto-built boards (2026-10-08) ──────────────────────────────────
// "Make a board" from an outfit's pieces, and "everything I wore this week /
// this month". Items are laid out on a clean grid sized so every piece is
// visible; the user can still drag them around afterwards in the editor.
//
// A sticker is 60% of the canvas wide at scale 1 (.board-sticker), on a
// portrait 3:4 canvas, and cutouts run roughly 4:5 tall — so a scale that fits
// a cell is the smaller of its width- and height-limited values.
const STICKER_W = 0.6;
const CUTOUT_ASPECT = 1.25;   // h / w of a typical cutout
const CANVAS_ASPECT = 4 / 3;  // portrait board: h / w
function gridCells(n) {
  const cols = n <= 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4;
  const rows = Math.max(1, Math.ceil(n / cols));
  const cw = 0.9 / cols;
  const ch = 0.9 / rows;
  const scale = Math.max(0.15, Math.min(1.4,
    (cw * 0.86) / STICKER_W,
    (ch * 0.86) / (STICKER_W * CUTOUT_ASPECT / CANVAS_ASPECT),
  ));
  const cells = [];
  for (let i = 0; i < n; i += 1) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    // Centre a short last row instead of leaving it flush-left.
    const inRow = r === rows - 1 ? n - r * cols : cols;
    const offset = ((cols - inRow) * cw) / 2;
    cells.push({ x: 0.05 + offset + cw * (c + 0.5), y: 0.05 + ch * (r + 0.5), scale });
  }
  return cells;
}

export function gridStickers(itemIds) {
  return gridCells(itemIds.length).map((cell, i) => ({
    itemId: itemIds[i], x: cell.x, y: cell.y, scale: Number(cell.scale.toFixed(3)), rotation: 0, z: i + 1,
  }));
}

// Add pieces to an existing board without moving what the user already
// arranged: re-grid for the new total and give the newcomers the cells
// nobody is sitting on.
export function addToGrid(stickers, newIds) {
  const total = stickers.length + newIds.length;
  const cells = gridCells(total);
  const free = cells.filter((c) => !stickers.some((s) => Math.abs(s.x - c.x) < 0.08 && Math.abs(s.y - c.y) < 0.08));
  let z = Math.max(0, ...stickers.map((s) => s.z || 0));
  const added = newIds.map((id, i) => {
    const cell = free[i] || cells[(stickers.length + i) % cells.length];
    z += 1;
    return { itemId: id, x: cell.x, y: cell.y, scale: Number(cell.scale.toFixed(3)), rotation: 0, z };
  });
  return [...stickers, ...added];
}

async function findRangeBoard(rangeKey) {
  const user = auth.currentUser;
  if (!user) return null;
  const snap = await getDocs(query(
    collection(db, BOARDS),
    where('userId', '==', user.uid),
    where('rangeKey', '==', rangeKey),
    limit(1),
  ));
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

async function getBoard(boardId) {
  const snap = await getDoc(doc(db, BOARDS, boardId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

async function updateBoard(boardId, patch) {
  const allowed = ['name', 'stickers', 'coverUrl', 'isPublic', 'background', 'ratio'];
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
async function listBookmarkedBoards({ uid, pageSize = 30, cursor = null } = {}) {
  // Paginate bookmarks by createdAt (cursor = last bookmark doc), hydrate the
  // board docs for this page. hasMore = raw page full (keep loading even if a
  // page is mostly OOTD bookmarks).
  let q = query(collection(db, 'users', uid, 'bookmarks'), orderBy('createdAt', 'desc'), limit(pageSize));
  if (cursor) q = query(q, startAfter(cursor));
  const snap = await getDocs(q);
  const ids = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(r => r.type === 'board')
    .map(r => r.boardId || r.id).filter(Boolean);
  const hydrated = await Promise.all(
    ids.map(id => getDoc(doc(db, BOARDS, id))
      .then(s => s.exists() ? { id: s.id, ...s.data() } : null)
      .catch(() => null))
  );
  return {
    boards: hydrated.filter(Boolean),
    lastVisible: snap.docs[snap.docs.length - 1] || null,
    hasMore: snap.docs.length === pageSize,
  };
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
async function listPublicBoards({ pageSize = 24, sortBy = 'latest', cursor = null } = {}) {
  const orderField = sortBy === 'popular' ? 'likeCount' : 'updatedAt';
  let q = query(
    collection(db, BOARDS),
    where('isPublic', '==', true),
    orderBy(orderField, 'desc'),
    limit(pageSize),
  );
  if (cursor) q = query(q, startAfter(cursor));
  const snap = await getDocs(q);
  return {
    boards: snap.docs.map(d => ({ id: d.id, ...d.data() })),
    lastVisible: snap.docs[snap.docs.length - 1] || null,
    hasMore: snap.docs.length === pageSize,
  };
}

/** Following feed — public boards from the given set of authors,
 *  newest first. Mirrors OutfitService.listFollowingFeed. Firestore `in`
 *  caps at 30. */
async function listFollowingBoards({ followingIds, pageSize = 24, cursor = null } = {}) {
  if (!Array.isArray(followingIds) || followingIds.length === 0) return { boards: [], lastVisible: null, hasMore: false };
  const ids = followingIds.slice(0, 30);
  let q = query(
    collection(db, BOARDS),
    where('isPublic', '==', true),
    where('userId', 'in', ids),
    orderBy('updatedAt', 'desc'),
    limit(pageSize),
  );
  if (cursor) q = query(q, startAfter(cursor));
  const snap = await getDocs(q);
  return {
    boards: snap.docs.map(d => ({ id: d.id, ...d.data() })),
    lastVisible: snap.docs[snap.docs.length - 1] || null,
    hasMore: snap.docs.length === pageSize,
  };
}

/** Like / unlike a public board. Mirrors OutfitService.toggleLike. */
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

function subscribeMyBoards(cb, { pageSize = 150 } = {}) {
  const user = auth.currentUser;
  if (!user) { cb([]); return () => {}; }
  return onSnapshot(
    query(
      collection(db, BOARDS),
      where('userId', '==', user.uid),
      orderBy('updatedAt', 'desc'),
      limit(pageSize),
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

/** Personal ❤️ self-favorite on the owner's own board. */
async function toggleSelfLike(boardId, selfLiked) {
  await updateDoc(doc(db, BOARDS, boardId), {
    selfLiked: !!selfLiked,
    selfLikedAt: serverTimestamp(),
  });
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
  toggleSelfLike,
  findRangeBoard,
  gridStickers,
  addToGrid,
};

export default BoardService;
