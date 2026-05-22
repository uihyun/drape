// === OutfitService =====================================================
// An "outfit" is a named composition of 1..N items. Optionally has a
// rendered cover image (a try-on result, or a flat collage of the cropped
// item PNGs). Outfits are the unit of:
//   - the OOTD calendar (each day points to 0..1 outfit OR a free-form photo)
//   - the public feed (a posted outfit, with author + likes + comments)
//   - virtual try-on (you try on an outfit as a set, not just one piece)

import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  deleteDoc,
  updateDoc,
} from 'firebase/firestore';
import { db, auth } from '../firebase.js';

const OUTFITS = 'outfits';

/**
 * Create a new outfit. itemIds is required (must reference items owned by
 * the caller). Optional fields: name, notes, coverUrl, tags.
 */
async function createOutfit({ itemIds, name = '', notes = '', coverUrl = null, tags = [] }) {
  const user = auth.currentUser;
  if (!user) throw new Error('not_signed_in');
  if (!Array.isArray(itemIds) || itemIds.length === 0) throw new Error('no_items');

  const ref = await addDoc(collection(db, OUTFITS), {
    userId: user.uid,
    itemIds,
    name,
    notes,
    coverUrl,
    tags,
    isPublic: false,
    isListed: false,
    likeCount: 0,
    likedBy: [],
    commentCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id };
}

async function getOutfit(outfitId) {
  const snap = await getDoc(doc(db, OUTFITS, outfitId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

async function updateOutfit(outfitId, patch) {
  // Keep aligned with firestore.rules' allowed keys on /outfits/{id}.
  const allowed = ['name', 'notes', 'tags', 'itemIds', 'coverUrl', 'isPublic', 'isListed'];
  const safe = Object.fromEntries(
    Object.entries(patch).filter(([k]) => allowed.includes(k))
  );
  safe.updatedAt = serverTimestamp();
  if ('isListed' in safe && safe.isListed) safe.listedAt = serverTimestamp();
  await updateDoc(doc(db, OUTFITS, outfitId), safe);
}

async function deleteOutfit(outfitId) {
  await deleteDoc(doc(db, OUTFITS, outfitId));
}

async function listMyOutfits({ uid, pageSize = 30, cursor = null } = {}) {
  const constraints = [
    where('userId', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(pageSize),
  ];
  if (cursor) constraints.push(startAfter(cursor));
  const snap = await getDocs(query(collection(db, OUTFITS), ...constraints));
  return {
    outfits: snap.docs.map(d => ({ id: d.id, ...d.data() })),
    lastVisible: snap.docs[snap.docs.length - 1] || null,
    hasMore: snap.docs.length === pageSize,
  };
}

/**
 * Public feed of listed outfits — paginated. styleFilter / userIds for the
 * "following" tab — same shape as voda's old DesignService.getFeedDesigns
 * so feed components carry over with light renames.
 */
async function getFeedOutfits({ pageSize = 24, cursor = null, sortBy = 'latest', styleFilter = null, userIds = null } = {}) {
  const constraints = [
    where('isListed', '==', true),
  ];
  if (Array.isArray(userIds)) {
    if (userIds.length === 0) return { outfits: [], lastVisible: null, hasMore: false };
    // Firestore `in` clause caps at 30 — for now slice and merge.
    constraints.push(where('userId', 'in', userIds.slice(0, 30)));
  }
  if (styleFilter) constraints.push(where('tags', 'array-contains', styleFilter));
  constraints.push(orderBy(sortBy === 'popular' ? 'likeCount' : 'listedAt', 'desc'));
  constraints.push(limit(pageSize));
  if (cursor) constraints.push(startAfter(cursor));

  const snap = await getDocs(query(collection(db, OUTFITS), ...constraints));
  return {
    outfits: snap.docs.map(d => ({ id: d.id, ...d.data() })),
    lastVisible: snap.docs[snap.docs.length - 1] || null,
    hasMore: snap.docs.length === pageSize,
  };
}

async function toggleLike(outfitId, uid, currentlyLiked) {
  const ref = doc(db, OUTFITS, outfitId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const liked = Array.isArray(data.likedBy) ? data.likedBy : [];
  const nextLiked = currentlyLiked
    ? liked.filter(u => u !== uid)
    : Array.from(new Set([...liked, uid]));
  await updateDoc(ref, {
    likedBy: nextLiked,
    likeCount: Math.max(0, (data.likeCount || 0) + (currentlyLiked ? -1 : 1)),
  });
}

export const OutfitService = {
  createOutfit,
  getOutfit,
  updateOutfit,
  deleteOutfit,
  listMyOutfits,
  getFeedOutfits,
  toggleLike,
};

export default OutfitService;
