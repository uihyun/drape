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

/** Create or update today's (or any date's) OOTD entry.
 *  `linkedType` disambiguates what `outfitId` points at — 'outfit' (legacy
 *  outfits collection), 'board', or 'tryon' (generations). Older docs have
 *  no linkedType; treat as 'outfit'. */
async function upsertOotd({
  date,
  outfitId = null,
  linkedType = null,
  photoBlob = null,
  // Reuse an existing public Storage URL (typically a try-on variant)
  // as the OOTD photo without re-uploading. Skipped when photoBlob is
  // also set — the user-uploaded blob takes precedence.
  photoUrlFromTryon = null,
  note = '',
  isPublic = undefined,
}) {
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
  } else if (photoUrlFromTryon) {
    photoUrl = photoUrlFromTryon;
    photoPath = null; // not owned by this OOTD; deleting the OOTD doesn't touch the variant
  }

  // setDoc(..., { merge: true }) is intentional — an OOTD often grows over
  // the day: morning logs the outfit, evening adds a selfie + note.
  await setDoc(doc(db, OOTDS, id), {
    userId: user.uid,
    date,
    outfitId,
    linkedType: outfitId ? (linkedType || 'outfit') : null,
    ...(photoUrl ? { photoUrl, photoPath } : {}),
    note,
    ...(isPublic !== undefined ? { isPublic } : {}),
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  }, { merge: true });

  // Trigger AI analysis + background-removal whenever the OOTD got a
  // new photo source — direct upload OR reused try-on variant URL.
  // Both run fire-and-forget so upsertOotd returns fast.
  // processOotdPhoto produces photoCutUrl which the Calendar prefers
  // over the raw photoUrl, so the cell always shows a clean cutout.
  if (photoBlob || photoUrlFromTryon) {
    httpsCallable(functions, 'analyzeOotd')({ ootdId: id })
      .catch(e => console.warn('analyzeOotd skipped:', e?.message));
    httpsCallable(functions, 'processOotdPhoto')({ ootdId: id })
      .catch(e => console.warn('processOotdPhoto skipped:', e?.message));
  }

  // Wear history: stamp each item in the linked outfit/tryon with this
  // date. Boards aren't wear-stamped yet — stickers store itemIds inline
  // and we'll add that path when board linking sees real use.
  if (outfitId) {
    try {
      const effectiveType = linkedType || 'outfit';
      let itemIds = [];
      if (effectiveType === 'tryon') {
        const genSnap = await getDoc(doc(db, 'generations', outfitId));
        itemIds = genSnap.exists() ? (genSnap.data().itemIds || []) : [];
      } else if (effectiveType === 'outfit') {
        const { OutfitService } = await import('./outfit-service.js');
        const outfit = await OutfitService.getOutfit(outfitId);
        itemIds = outfit?.itemIds || [];
      }
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

/** Bookmark / unbookmark a feed OOTD. Stored under the viewer's own
 *  /users/{uid}/bookmarks/{ootdId} so we can list them without
 *  scanning every OOTD. type='ootd' tagged so the same collection
 *  can hold outfit bookmarks later without a schema migration. */
async function toggleBookmark(ootdId, currentlyBookmarked) {
  const user = auth.currentUser;
  if (!user) throw new Error('not_signed_in');
  const ref_ = doc(db, 'users', user.uid, 'bookmarks', ootdId);
  if (currentlyBookmarked) {
    await deleteDoc(ref_);
  } else {
    await setDoc(ref_, {
      type: 'ootd',
      ootdId,
      createdAt: serverTimestamp(),
    });
  }
}

/** All OOTDs the user has bookmarked, newest-bookmark first. Returns
 *  hydrated OOTD docs (skips ones that have been deleted / unpublished
 *  since the bookmark).
 *
 *  Client-side filter + sort so we don't need a (type, createdAt)
 *  composite index on the per-user subcollection. Bookmark counts are
 *  small per user (tens, not thousands), so this is fine. */
async function listBookmarkedOotds({ uid, pageSize = 60 } = {}) {
  const snap = await getDocs(collection(db, 'users', uid, 'bookmarks'));
  const rows = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(r => (r.type || 'ootd') === 'ootd');
  rows.sort((a, b) => {
    const at = a.createdAt?.toMillis?.() ?? 0;
    const bt = b.createdAt?.toMillis?.() ?? 0;
    return bt - at;
  });
  const ids = rows.slice(0, pageSize).map(r => r.ootdId || r.id).filter(Boolean);
  if (!ids.length) return { ootds: [] };
  const hydrated = await Promise.all(
    ids.map(id => getDoc(doc(db, OOTDS, id))
      .then(s => s.exists() ? { id: s.id, ...s.data() } : null)
      .catch(() => null))
  );
  return { ootds: hydrated.filter(Boolean) };
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
/**
 * All OOTDs the signed-in user has logged, newest first. Used by the
 * Outfits → Mine tab. Client-side sort so we don't need a new composite
 * index (userId ASC, date DESC) — typical user has < 1k OOTDs which is
 * trivial to sort in memory.
 */
async function listMyOotds({ uid, pageSize = 60 } = {}) {
  const snap = await getDocs(query(
    collection(db, OOTDS),
    where('userId', '==', uid),
    limit(pageSize),
  ));
  const ootds = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  ootds.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return { ootds };
}

/** Public OOTDs by user — used by PublicProfile (calendar + outfits tab).
 *  Filtered server-side to isPublic=true so non-owners' queries don't trip
 *  the security rules. */
async function listPublicByUser({ uid, pageSize = 200 } = {}) {
  const snap = await getDocs(query(
    collection(db, OOTDS),
    where('userId', '==', uid),
    where('isPublic', '==', true),
    orderBy('date', 'desc'),
    limit(pageSize),
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

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
  listMyOotds,
  listPublicByUser,
  listPublicFeed,
  toggleLike,
  toggleBookmark,
  listBookmarkedOotds,
};

export default OotdService;
