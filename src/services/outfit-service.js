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
  onSnapshot,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, auth, storage, functions } from '../firebase.js';
import { IMG_CACHE } from './storageCache.js';

const OUTFITS = 'outfits';

function isValidDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
// kind: 'mine' = user composed from their closet items,
//       'analyzed' = AnalyzePhoto save (source photo + detected pieces, may
//                    not all be in the user's closet),
//       'saved' = bookmark of someone else's listed outfit (future).

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
    kind: 'mine',
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

/**
 * Save the result of an AnalyzePhoto session as a reviewable outfit
 * snapshot — uploads the source photo + stores the detected style/items
 * inline so the user can revisit even when none of the detected pieces
 * are in their own closet. Lives in the same `outfits` collection under
 * kind='analyzed'; surfaced in the "Saved" sub-tab.
 */
async function createAnalyzedOutfit({
  photoBlob,
  name = '',
  mood = '',
  notes = '',
  stylingTips = [],
  palette = [],
  style = [],
  detectedItems = [],
  itemIds = [],
}) {
  const user = auth.currentUser;
  if (!user) throw new Error('not_signed_in');
  let photoUrl = null;
  let photoPath = null;
  if (photoBlob) {
    const id = `an_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const path = `analyzed/${user.uid}/${id}.jpg`;
    const r = storageRef(storage, path);
    await uploadBytes(r, photoBlob, { contentType: 'image/jpeg', cacheControl: IMG_CACHE });
    photoUrl = await getDownloadURL(r);
    photoPath = path;
  }
  const ref = await addDoc(collection(db, OUTFITS), {
    userId: user.uid,
    kind: 'analyzed',
    itemIds, // any pieces user already pulled into their closet
    detectedItems, // raw detect output for the rest
    name: name || '',
    mood,
    notes,
    stylingTips,
    palette,
    style, // [{label, level}] style breakdown
    sourcePhotoUrl: photoUrl,
    sourcePhotoPath: photoPath,
    coverUrl: photoUrl, // the source photo doubles as the card cover
    tags: [],
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
  const allowed = ['name', 'notes', 'note', 'tags', 'itemIds', 'pieceLinks', 'coverUrl', 'isPublic', 'isListed', 'heroVariant'];
  const safe = Object.fromEntries(
    Object.entries(patch).filter(([k]) => allowed.includes(k))
  );
  safe.updatedAt = serverTimestamp();
  if ('isListed' in safe && safe.isListed) safe.listedAt = serverTimestamp();
  await updateDoc(doc(db, OUTFITS, outfitId), safe);
}

async function deleteOutfit(outfitId) {
  // Storage cleanup — best effort. An outfit may own an uploaded worn-look
  // photo (photoPath), its segmented cutout, an analyzed source photo, or a
  // cover. Item images are NOT touched (they belong to the closet).
  try {
    const snap = await getDoc(doc(db, OUTFITS, outfitId));
    const d = snap.exists() ? snap.data() : null;
    const paths = [d?.photoPath, d?.photoCutPath, d?.sourcePhotoPath, d?.coverPath].filter(Boolean);
    await Promise.all(paths.map(p =>
      deleteObject(storageRef(storage, p)).catch(() => {})));
  } catch { /* ignore */ }
  await deleteDoc(doc(db, OUTFITS, outfitId));
}

async function listMyOutfits({ uid, pageSize = 30, cursor = null, kind = null } = {}) {
  const constraints = [
    where('userId', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(pageSize),
  ];
  if (cursor) constraints.push(startAfter(cursor));
  const snap = await getDocs(query(collection(db, OUTFITS), ...constraints));
  let outfits = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  // Client-side kind filter so adding the field doesn't require a new
  // composite index. Legacy outfits without a kind field default to 'mine'.
  if (kind) {
    outfits = outfits.filter(o => (o.kind || 'mine') === kind);
  }
  return {
    outfits,
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

/** Personal ❤️ self-favorite on the owner's own analyzed outfit. */
async function toggleSelfLike(outfitId, selfLiked) {
  await updateDoc(doc(db, OUTFITS, outfitId), {
    selfLiked: !!selfLiked,
    selfLikedAt: serverTimestamp(),
  });
}

// ── OOTD / calendar / feed ─────────────────────────────────────────────
// A dated outfit (date set) is an "OOTD": it appears on the calendar and,
// when public, in the discovery feed. These methods were formerly a
// separate OotdService; merged here since an OOTD is just an outfit.

/** Create/update a dated (OOTD) outfit. Pass an id to update a specific one,
 *  omit to create a new entry for the date (multiple OOTDs per day OK). */
async function upsertOotd({
  id = null, date, outfitId = null, linkedType = null,
  photoBlob = null, note = '', isPublic = undefined,
}) {
  const user = auth.currentUser;
  if (!user) throw new Error('not_signed_in');
  if (!isValidDate(date)) throw new Error('bad_date');

  let photoUrl = null;
  let photoPath = null;
  if (photoBlob) {
    const path = `ootds/${user.uid}/${date}-${Date.now()}.jpg`;
    const r = storageRef(storage, path);
    await uploadBytes(r, photoBlob, { contentType: 'image/jpeg', cacheControl: IMG_CACHE });
    photoUrl = await getDownloadURL(r);
    photoPath = path;
  }

  const payload = {
    userId: user.uid,
    date,
    source: 'photo',
    outfitId,
    linkedType: outfitId ? (linkedType || 'outfit') : null,
    // photoCutStatus drives the calendar cell: 'processing' shows a spinner
    // (not the with-background photo) until processOotdPhoto finishes, then it
    // flips to 'ready' (cutout) or 'none' (keep original) — so the cell lands
    // on its final look in one step instead of swapping bg→cutout on refresh.
    ...(photoUrl ? { photoUrl, photoPath, photoCutUrl: null, photoCutStatus: 'processing' } : {}),
    note,
    ...(isPublic !== undefined ? { isPublic } : {}),
    updatedAt: serverTimestamp(),
  };

  let savedId;
  if (id) {
    await setDoc(doc(db, OUTFITS, id), payload, { merge: true });
    savedId = id;
  } else {
    const ref = await addDoc(collection(db, OUTFITS), {
      ...payload,
      itemIds: [],
      likedBy: [], likeCount: 0, commentCount: 0,
      createdAt: serverTimestamp(),
    });
    savedId = ref.id;
  }

  if (photoBlob) {
    httpsCallable(functions, 'analyzeOotd')({ ootdId: savedId })
      .catch(e => console.warn('analyzeOotd skipped:', e?.message));
    httpsCallable(functions, 'processOotdPhoto')({ ootdId: savedId })
      .catch(e => console.warn('processOotdPhoto skipped:', e?.message));
  }

  // Wear history: stamp linked outfit's items with this date.
  if (outfitId) {
    try {
      const effectiveType = linkedType || 'outfit';
      let itemIds = [];
      if (effectiveType === 'outfit') {
        const o = await getOutfit(outfitId);
        itemIds = o?.itemIds || [];
      }
      if (itemIds.length) {
        const { ItemService } = await import('./item-service.js');
        await ItemService.recordWear({ itemIds, date, ootdId: savedId, outfitId });
      }
    } catch (e) {
      console.warn('wear log recording failed:', e?.message);
    }
  }
  return { id: savedId };
}

async function listForDate({ uid, date }) {
  const snap = await getDocs(query(
    collection(db, OUTFITS),
    where('userId', '==', uid),
    where('date', '==', date),
  ));
  const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  rows.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
  return rows;
}

async function deleteOotd({ id }) {
  if (!id) throw new Error('id required');
  // deleteOutfit already cleans the doc's storage (photoPath/photoCutPath/etc).
  await deleteOutfit(id);
}

/** Public OOTD feed — dated public outfits. orderBy date excludes undated
 *  (built/analyzed) outfits, so only "today's look" posts surface. */
async function listPublicFeed({ pageSize = 24, cursor = null, sortBy = 'latest' } = {}) {
  // Popular = likeCount desc, but ties (e.g. everything at 0) fall back to
  // date desc so the order is stable, not arbitrary.
  const constraints = [
    where('isPublic', '==', true),
    ...(sortBy === 'popular'
      ? [orderBy('likeCount', 'desc'), orderBy('date', 'desc')]
      : [orderBy('date', 'desc')]),
    limit(pageSize),
  ];
  let q = query(collection(db, OUTFITS), ...constraints);
  if (cursor) q = query(q, startAfter(cursor));
  const snap = await getDocs(q);
  return {
    ootds: snap.docs.map(d => ({ id: d.id, ...d.data() })),
    lastVisible: snap.docs[snap.docs.length - 1] || null,
    hasMore: snap.docs.length === pageSize,
  };
}

async function listFollowingFeed({ followingIds, pageSize = 24 } = {}) {
  if (!Array.isArray(followingIds) || followingIds.length === 0) return [];
  const ids = followingIds.slice(0, 30);
  const snap = await getDocs(query(
    collection(db, OUTFITS),
    where('isPublic', '==', true),
    where('userId', 'in', ids),
    orderBy('date', 'desc'),
    limit(pageSize),
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Bookmark / unbookmark — stored under /users/{uid}/bookmarks/{outfitId}. */
async function toggleBookmark(outfitId, currentlyBookmarked) {
  const user = auth.currentUser;
  if (!user) throw new Error('not_signed_in');
  const ref = doc(db, 'users', user.uid, 'bookmarks', outfitId);
  if (currentlyBookmarked) {
    await deleteDoc(ref);
  } else {
    await setDoc(ref, { type: 'ootd', ootdId: outfitId, createdAt: serverTimestamp() });
  }
}

async function listBookmarkedOotds({ uid, pageSize = 60 } = {}) {
  const snap = await getDocs(collection(db, 'users', uid, 'bookmarks'));
  const rows = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(r => (r.type || 'ootd') === 'ootd');
  rows.sort((a, b) =>
    (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
  const ids = rows.slice(0, pageSize).map(r => r.ootdId || r.id).filter(Boolean);
  if (!ids.length) return { ootds: [] };
  const hydrated = await Promise.all(
    ids.map(id => getDoc(doc(db, OUTFITS, id))
      .then(s => s.exists() ? { id: s.id, ...s.data() } : null)
      .catch(() => null)));
  return { ootds: hydrated.filter(Boolean) };
}

/** All the user's dated outfits (OOTDs), newest date first. */
async function listMyOotds({ uid, pageSize = 60 } = {}) {
  // Order by createdAt desc (index: userId ASC, createdAt DESC) so the
  // newest outfits are in the fetched window — a just-made OOTD must be
  // here. Without an order the limit returned an arbitrary doc-ID slice,
  // so a new OOTD could fall outside it (showed in Calendar's range query
  // but not here). Fetch a bit wide, then keep the dated ones (= OOTDs).
  const snap = await getDocs(query(
    collection(db, OUTFITS),
    where('userId', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(pageSize * 3),
  ));
  const ootds = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(o => !!o.date);
  ootds.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return { ootds: ootds.slice(0, pageSize) };
}

/** Public dated outfits by a user (PublicProfile). */
async function listPublicByUser({ uid, pageSize = 200 } = {}) {
  const snap = await getDocs(query(
    collection(db, OUTFITS),
    where('userId', '==', uid),
    where('isPublic', '==', true),
    orderBy('date', 'desc'),
    limit(pageSize),
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Month of dated outfits, bucketed by date with the calendar rep first. */
function groupOotdsByDate(docs) {
  const byDate = {};
  for (const d of docs) {
    const data = { id: d.id, ...d.data() };
    if (!byDate[data.date]) byDate[data.date] = [];
    byDate[data.date].push(data);
  }
  for (const k of Object.keys(byDate)) {
    byDate[k].sort((a, b) => {
      if (!!a.isCalendarRep !== !!b.isCalendarRep) return a.isCalendarRep ? -1 : 1;
      return (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0);
    });
  }
  return byDate;
}

function monthQuery(uid, monthStart, monthEnd) {
  return query(
    collection(db, OUTFITS),
    where('userId', '==', uid),
    where('date', '>=', monthStart),
    where('date', '<=', monthEnd),
    orderBy('date', 'asc'),
  );
}

async function listMonth({ uid, monthStart, monthEnd }) {
  const snap = await getDocs(monthQuery(uid, monthStart, monthEnd));
  return groupOotdsByDate(snap.docs);
}

/** Live month subscription — the calendar uses this so a cutout finishing
 *  server-side (processOotdPhoto) swaps in automatically, with no manual
 *  refresh. cb receives the same { [date]: ootd[] } shape as listMonth. */
function subscribeMonth({ uid, monthStart, monthEnd }, cb) {
  return onSnapshot(
    monthQuery(uid, monthStart, monthEnd),
    snap => cb(groupOotdsByDate(snap.docs)),
    err => { console.warn('subscribeMonth failed:', err?.message); cb({}); },
  );
}

/** Mark one dated outfit as the calendar cover for its date. */
async function setCalendarRepresentative({ uid, date, id }) {
  const user = auth.currentUser;
  if (!user || user.uid !== uid) throw new Error('not_authorized');
  if (!id || !isValidDate(date)) throw new Error('bad_args');
  const peers = await listForDate({ uid, date });
  await Promise.all(peers.map(p => {
    const shouldBe = p.id === id;
    if (!!p.isCalendarRep === shouldBe) return null;
    return setDoc(doc(db, OUTFITS, p.id), {
      isCalendarRep: shouldBe,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }).filter(Boolean));
}

export const OutfitService = {
  createAnalyzedOutfit,
  createOutfit,
  getOutfit,
  updateOutfit,
  deleteOutfit,
  listMyOutfits,
  getFeedOutfits,
  toggleLike,
  toggleSelfLike,
  // OOTD / calendar / feed (merged from OotdService):
  upsertOotd,
  deleteOotd,
  listForDate,
  listMonth,
  subscribeMonth,
  listMyOotds,
  listPublicByUser,
  listPublicFeed,
  listFollowingFeed,
  toggleBookmark,
  listBookmarkedOotds,
  setCalendarRepresentative,
};

export default OutfitService;
