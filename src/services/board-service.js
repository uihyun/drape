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

async function createBoard({ name = '', stickers = [], coverUrl = null } = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('AUTH_REQUIRED');
  const ref = await addDoc(collection(db, BOARDS), {
    userId: user.uid,
    name: String(name).slice(0, 80),
    stickers: Array.isArray(stickers) ? stickers : [],
    coverUrl,
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
  subscribeMyBoards,
};

export default BoardService;
