// === OotdService =======================================================
// Daily lookbook calendar entry. One doc per (uid, YYYY-MM-DD) — the doc id
// IS the date string, which makes month queries trivial (`where date >=`)
// and prevents accidental duplicates per day.
//
// Each entry references either:
//   - outfitId (the outfit worn that day), and/or
//   - photoUrl (a free-form selfie of the day)
//   - note (text)
//
// Calendar UI loads a month at a time via listMonth().

import {
  collection,
  doc,
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
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, storage, auth, functions } from '../firebase.js';

const OOTDS = 'ootds';

function ootdDocId(uid, dateStr) {
  return `${uid}_${dateStr}`;
}

function isValidDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** Create or update today's (or any date's) OOTD entry. */
async function upsertOotd({ date, outfitId = null, photoBlob = null, note = '', isPublic = undefined }) {
  const user = auth.currentUser;
  if (!user) throw new Error('not_signed_in');
  if (!isValidDate(date)) throw new Error('bad_date');

  const id = ootdDocId(user.uid, date);
  let photoUrl = null;
  let photoPath = null;
  if (photoBlob) {
    const path = `ootds/${user.uid}/${date}.jpg`;
    const r = ref(storage, path);
    await uploadBytes(r, photoBlob, { contentType: 'image/jpeg' });
    photoUrl = await getDownloadURL(r);
    photoPath = path;
  }

  // setDoc(..., { merge: true }) is intentional — an OOTD often grows over
  // the day: morning logs the outfit, evening adds a selfie + note.
  await setDoc(doc(db, OOTDS, id), {
    userId: user.uid,
    date,
    outfitId,
    ...(photoUrl ? { photoUrl, photoPath } : {}),
    note,
    ...(isPublic !== undefined ? { isPublic } : {}),
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  }, { merge: true });

  // Trigger AI analysis when a new photo was uploaded — gives the
  // OotdDetail page palette/composition/notes/title without a second
  // user step. Best-effort; OOTD doc is source of truth either way.
  if (photoBlob) {
    try {
      const fn = httpsCallable(functions, 'analyzeOotd');
      await fn({ ootdId: id });
    } catch (e) {
      console.warn('analyzeOotd skipped:', e?.message);
    }
  }

  // Wear history: stamp each item in the linked outfit with this date.
  // Lazy-import to avoid circular dep (item-service → ootd-service path
  // isn't currently in use but this keeps things safe).
  if (outfitId) {
    try {
      const { OutfitService } = await import('./outfit-service.js');
      const outfit = await OutfitService.getOutfit(outfitId);
      const itemIds = outfit?.itemIds || [];
      if (itemIds.length) {
        const { ItemService } = await import('./item-service.js');
        await ItemService.recordWear({ itemIds, date, ootdId: id, outfitId });
      }
    } catch (e) {
      console.warn('wear log recording failed:', e?.message);
    }
  }

  return { id };
}

async function getOotd({ uid, date }) {
  const snap = await getDoc(doc(db, OOTDS, ootdDocId(uid, date)));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Fetch one OOTD by doc id ({uid}_{YYYY-MM-DD}). Used by /ootd/:id. */
async function getOotdById(ootdId) {
  const snap = await getDoc(doc(db, OOTDS, ootdId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Discovery feed — every OOTD with isPublic=true. sortBy = 'latest'
 *  (newest published first via updatedAt) or 'popular' (by likeCount).
 *  Like infra for OOTDs lands in a follow-up commit; until then 'popular'
 *  silently sorts by a non-existent field and matches latest as fallback. */
async function listPublicFeed({ pageSize = 24, cursor = null, sortBy = 'latest' } = {}) {
  const orderField = sortBy === 'popular' ? 'likeCount' : 'updatedAt';
  const constraints = [
    where('isPublic', '==', true),
    orderBy(orderField, 'desc'),
    limit(pageSize),
  ];
  let q = query(collection(db, OOTDS), ...constraints);
  if (cursor) q = query(q, startAfter(cursor));
  const snap = await getDocs(q);
  return {
    ootds: snap.docs.map(d => ({ id: d.id, ...d.data() })),
    lastVisible: snap.docs[snap.docs.length - 1] || null,
    hasMore: snap.docs.length === pageSize,
  };
}

async function deleteOotd({ uid, date }) {
  await deleteDoc(doc(db, OOTDS, ootdDocId(uid, date)));
}

/** Like / unlike a published OOTD. Mirrors OutfitService.toggleLike. */
async function toggleLike(ootdId, uid, currentlyLiked) {
  const ref_ = doc(db, OOTDS, ootdId);
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

/**
 * Load all OOTDs for a given month. Returns map keyed by 'YYYY-MM-DD' for
 * O(1) lookup from the calendar cell renderer.
 *
 * @param {string} monthStart 'YYYY-MM-01'
 * @param {string} monthEnd   'YYYY-MM-31' (or last day)
 */
async function listMonth({ uid, monthStart, monthEnd }) {
  const snap = await getDocs(query(
    collection(db, OOTDS),
    where('userId', '==', uid),
    where('date', '>=', monthStart),
    where('date', '<=', monthEnd),
    orderBy('date', 'asc'),
  ));
  const byDate = {};
  for (const d of snap.docs) {
    const data = { id: d.id, ...d.data() };
    byDate[data.date] = data;
  }
  return byDate;
}

export const OotdService = {
  upsertOotd,
  getOotd,
  getOotdById,
  deleteOotd,
  listMonth,
  listPublicFeed,
  toggleLike,
};

export default OotdService;
