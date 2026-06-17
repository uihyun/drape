// === ItemService =======================================================
// CRUD + async processing pipeline for a single clothing item.
//
// Flow (see brief §6 — "등록 = 비동기 파이프라인"):
//   1. createItem(blob)
//        → uploads original image to Storage
//        → writes Firestore doc with status='processing' (skeleton card)
//        → invokes `processItem` Cloud Function (fire-and-forget)
//   2. The Closet grid subscribes via onSnapshot — placeholder cards swap to
//      `status='ready'` the moment the function writes the cropped image +
//      tags back. User never waits on a single registration.

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
  onSnapshot,
  serverTimestamp,
  deleteDoc,
  updateDoc,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, storage, functions, auth } from '../firebase.js';
import { IMG_CACHE } from './storageCache.js';

const ITEMS = 'items';

// === Storage paths =====================================================
// items/{uid}/{itemId}/original.jpg  — raw upload (kept for re-processing)
// items/{uid}/{itemId}/cropped.png   — background-removed crop (the "hero")
// Identity refs live under identity/{uid}/{n}.jpg — see identity-service.js.

function itemStorageRef(uid, itemId, filename) {
  return ref(storage, `items/${uid}/${itemId}/${filename}`);
}

/**
 * Create a new closet item. Returns { id } immediately — caller can render a
 * skeleton card while `status='processing'`. The cropped image + tags are
 * written by the `processItem` Cloud Function when it finishes.
 */
async function createItem({ blob, mime = 'image/jpeg', shopUrl = '' }) {
  const user = auth.currentUser;
  if (!user) throw new Error('not_signed_in');

  // 1. Reserve an id by creating the doc with status=uploading first. Lets us
  //    upload to a path keyed on that id (instead of guessing client-side).
  //    A user-supplied shopUrl is stored TOP-LEVEL (not under tags) at create
  //    time — the processItem function later overwrites `tags`, which would
  //    wipe it, but it never touches top-level fields.
  const itemsCol = collection(db, ITEMS);
  const draft = await addDoc(itemsCol, {
    userId: user.uid,
    status: 'uploading',
    kind: 'owned', // a piece the user actually owns (vs analyze-saved refs)
    ...(shopUrl ? { shopUrl } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const itemId = draft.id;

  // 2. Upload original.
  const originalRef = itemStorageRef(user.uid, itemId, `original.${mime === 'image/png' ? 'png' : 'jpg'}`);
  await uploadBytes(originalRef, blob, { contentType: mime, cacheControl: IMG_CACHE });
  const originalUrl = await getDownloadURL(originalRef);

  // 3. Flip to processing + record the path. Listener UI shows skeleton.
  await updateDoc(doc(db, ITEMS, itemId), {
    status: 'processing',
    originalUrl,
    originalPath: originalRef.fullPath,
    updatedAt: serverTimestamp(),
  });

  // 4. Fire-and-forget the worker. The function reads the doc by id, does
  //    background-remove + auto-tag, and writes croppedUrl + tags back.
  //    We don't await — registration UX is "drop it and keep shooting".
  try {
    const processItem = httpsCallable(functions, 'processItem');
    processItem({ itemId }).catch((err) => {
      console.warn('processItem dispatch:', err?.message);
      markFailedIfStuck(itemId);
    });
  } catch (err) {
    console.warn('processItem callable missing:', err?.message);
    markFailedIfStuck(itemId);
  }

  return { id: itemId };
}

/** Subscribe to the current user's closet in modified-time DESC. */
function subscribeMyCloset(uid, onChange, { pageSize = 60 } = {}) {
  const q = query(
    collection(db, ITEMS),
    where('userId', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(pageSize),
  );
  return onSnapshot(q, snap => {
    onChange(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

/** One-shot paginated read for archives / older items. */
async function loadMyCloset({ uid, pageSize = 60, cursor = null } = {}) {
  const constraints = [
    where('userId', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(pageSize),
  ];
  if (cursor) constraints.push(startAfter(cursor));
  const snap = await getDocs(query(collection(db, ITEMS), ...constraints));
  return {
    items: snap.docs.map(d => ({ id: d.id, ...d.data() })),
    lastVisible: snap.docs[snap.docs.length - 1] || null,
    hasMore: snap.docs.length === pageSize,
  };
}

async function getItem(itemId) {
  const snap = await getDoc(doc(db, ITEMS, itemId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Owner-only edits — tag corrections, rename, archive toggle, listing flags. */
async function updateItem(itemId, patch) {
  // The Firestore rule limits which keys may change; keep this list aligned.
  const allowed = [
    'name', 'notes', 'tags', 'isArchived', 'isFavorite',
    'forSale', 'priceOriginal', 'priceAsking', 'conditionGrade',
    'currency', 'listedAt', 'kind',
  ];
  const safe = Object.fromEntries(
    Object.entries(patch).filter(([k]) => allowed.includes(k))
  );
  // Stamp listedAt the first time forSale flips on; preserves original list time.
  if (safe.forSale === true && patch.listedAt === undefined) {
    safe.listedAt = serverTimestamp();
  }
  safe.updatedAt = serverTimestamp();
  await updateDoc(doc(db, ITEMS, itemId), safe);
}

/**
 * Push a wear entry onto each item's wearLog. Called by OutfitService after
 * a dated outfit is upserted with linked items. Idempotent: if the same date
 * already exists in the log, we replace it instead of duplicating. Cap
 * the log at 60 entries (most recent kept) so old items don't bloat
 * forever — full history still derivable from the outfits collection.
 */
const WEAR_LOG_CAP = 60;
async function recordWear({ itemIds, date, ootdId, outfitId }) {
  if (!Array.isArray(itemIds) || itemIds.length === 0) return;
  if (!date) return;
  const updates = await Promise.allSettled(itemIds.map(async (itemId) => {
    const ref_ = doc(db, ITEMS, itemId);
    const snap = await getDoc(ref_);
    if (!snap.exists()) return;
    const prev = Array.isArray(snap.data().wearLog) ? snap.data().wearLog : [];
    const filtered = prev.filter(e => e?.date !== date);
    const nextLog = [{ date, ootdId, outfitId }, ...filtered].slice(0, WEAR_LOG_CAP);
    const lastWornAt = nextLog[0]?.date || null;
    const wornCount = nextLog.length;
    await updateDoc(ref_, {
      wearLog: nextLog,
      lastWornAt,
      wornCount,
      updatedAt: serverTimestamp(),
    });
  }));
  // Surface any failures in console but don't propagate — recording wear
  // is best-effort; the OOTD itself is the source of truth.
  for (const r of updates) {
    if (r.status === 'rejected') console.warn('recordWear: item update failed', r.reason?.message);
  }
}

async function deleteItem(itemId) {
  const it = await getItem(itemId);
  if (!it) return;
  // Firestore doc removal is the source of truth — do it FIRST and await
  // only this. The UI can navigate away immediately afterward.
  await deleteDoc(doc(db, ITEMS, itemId));
  // Storage cleanup is best-effort and NOT awaited: deleteObject on an
  // already-missing file 404s and Firebase retries it with backoff
  // (~1s of dead time that would otherwise stall the delete). Fire it off
  // and swallow errors; orphans are pruned by a scheduled function later.
  for (const path of [it.originalPath, it.croppedPath]) {
    if (!path) continue;
    deleteObject(ref(storage, path)).catch(() => { /* already gone / ignore */ });
  }
}

/**
 * Manually re-run the processing pipeline (e.g. user wasn't happy with the
 * auto-crop or tags). Resets status back to 'processing' so the listener
 * reverts to a skeleton card until the function writes results.
 */
// If a processItem dispatch rejects (function error, 120s timeout, network
// drop), the item would sit at 'processing' forever. Flip it to 'failed' so
// the closet card surfaces a Retry button — but only if it's STILL processing,
// so we never clobber a 'ready' the function actually wrote (a slow success's
// response can be lost even though the server finished). Handles every case
// except the app being killed mid-call; a lightweight server backstop
// (cleanupStuckItems) covers that.
async function markFailedIfStuck(itemId) {
  try {
    const s = await getDoc(doc(db, ITEMS, itemId));
    const st = s.exists() && s.data().status;
    if (st === 'processing' || st === 'uploading') {
      await updateDoc(doc(db, ITEMS, itemId), { status: 'failed', updatedAt: serverTimestamp() });
    }
  } catch { /* best-effort */ }
}

async function reprocessItem(itemId) {
  // For items from the multi-item detect-add flow, the original photo holds
  // several garments. Pass the stored category/description as `focus` so
  // processItem re-extracts THAT piece (and keeps its tags) instead of
  // re-cropping whichever garment dominates the frame. Single-item adds have
  // no detected tags yet → no focus → a full crop+tag pass.
  const snap = await getDoc(doc(db, ITEMS, itemId));
  const tags = (snap.exists() && snap.data().tags) || {};
  await updateDoc(doc(db, ITEMS, itemId), {
    status: 'processing',
    updatedAt: serverTimestamp(),
  });
  const processItem = httpsCallable(functions, 'processItem');
  const focus = tags.category
    ? { category: tags.category, description: tags.description || '' }
    : null;
  await processItem(focus ? { itemId, focus } : { itemId });
}

/**
 * Run Gemini vision on an arbitrary photo (OOTD selfie, magazine shot,
 * stranger on the street) and return a list of detected clothing items
 * plus a style label. Drives the /analyze page (✦ from the create
 * sheet); each detected item can then be saved into the closet with
 * the source photo as its hero (no per-piece crop yet — see
 * functions/items.js detectItems for why).
 */
async function analyzePhoto({ blob, mime = 'image/jpeg' }) {
  const compressed = await import('./camera.js').then(m => m.CameraService.compressImage(blob));
  const base64 = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const s = String(fr.result || '');
      const comma = s.indexOf(',');
      resolve(comma >= 0 ? s.slice(comma + 1) : s);
    };
    fr.onerror = reject;
    fr.readAsDataURL(compressed);
  });
  const detectItemsFn = httpsCallable(functions, 'detectItems');
  const { data } = await detectItemsFn({ photoBase64: base64, mime });
  return data; // { style, notes, items: [...] }
}

/**
 * Save a detected item into the closet directly from a source photo +
 * the tags Gemini guessed. The photo isn't cropped per-piece — we use
 * it as both originalUrl and croppedUrl placeholder so the closet card
 * still has something to show. Future: a follow-up processItem pass
 * could refine.
 */
async function createFromDetected({ blob, detected, sourceLabel = '', shopUrl = '', owned = false }) {
  const user = auth.currentUser;
  if (!user) throw new Error('AUTH_REQUIRED');
  const id = `dt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const path = `items/${user.uid}/${id}/original.jpg`;
  const ref_ = ref(storage, path);
  await uploadBytes(ref_, blob, { contentType: 'image/jpeg', cacheControl: IMG_CACHE });
  const url = await getDownloadURL(ref_);
  // Status starts as 'processing' so the card shows a skeleton until the
  // server isolates the specific piece. processItem (called below with a
  // focus hint) replaces croppedUrl with a clean cutout of just the
  // detected category — without focus it would crop whatever piece was
  // most prominent in the multi-item source photo.
  await setDoc(doc(db, ITEMS, id), {
    userId: user.uid,
    // `owned`: bulk-adding pieces the user actually owns (multi-item flat-lay
    // or burst capture of their own closet) → kind 'owned', counts toward
    // stats and is sale-eligible. Default false = detected-from-someone-
    // else's-photo, a wishlist reference until they mark "I own this".
    kind: owned ? 'owned' : 'wishlist',
    name: detected.name || detected.description || sourceLabel || 'detected',
    notes: sourceLabel ? `detected from: ${sourceLabel}` : '',
    originalUrl: url,
    originalPath: path,
    // No croppedUrl yet — the card falls back to originalUrl meanwhile.
    status: 'processing',
    tags: {
      category: detected.category || null,
      subcategory: detected.subcategory || null,
      colors: detected.colors || [],
      seasons: [],
      styles: [],
      fit: null,
      description: detected.description || '',
      brand: detected.brand || null,
    },
    detectedSearchQuery: detected.searchQuery || '',
    ...(shopUrl ? { shopUrl } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  // Fire-and-forget so the UI doesn't block; the live closet subscription
  // flips the card from processing → cropped when this returns.
  const processFn = httpsCallable(functions, 'processItem');
  processFn({
    itemId: id,
    focus: {
      category: detected.category || null,
      description: detected.description || '',
    },
  }).catch((err) => {
    console.warn('processItem (detected) failed:', err?.message);
    markFailedIfStuck(id);
  });
  return { id };
}

/** Like createFromDetected, but the photo is ALREADY in Storage (e.g. an
 *  OOTD's worn-look photo). We point the new item's originalPath at that
 *  existing object and let processItem (admin SDK) read + crop it server-
 *  side — so the client never has to fetch the photo cross-origin (the
 *  firebasestorage download endpoint doesn't return CORS headers, which was
 *  breaking the blob-fetch path). */
async function createFromExistingPhoto({ photoUrl, photoPath, detected, owned = false }) {
  const user = auth.currentUser;
  if (!user) throw new Error('AUTH_REQUIRED');
  if (!photoPath || !photoUrl) throw new Error('NO_SOURCE_PHOTO');
  const id = `dt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await setDoc(doc(db, ITEMS, id), {
    userId: user.uid,
    kind: owned ? 'owned' : 'wishlist',
    name: detected.name || detected.description || 'detected',
    notes: '',
    // Reuse the existing photo as the original — processItem crops a clean
    // cutout into a NEW items/ path, so the displayed image is independent
    // even if the source OOTD is later deleted.
    originalUrl: photoUrl,
    originalPath: photoPath,
    status: 'processing',
    tags: {
      category: detected.category || null,
      subcategory: detected.subcategory || null,
      colors: detected.colors || [],
      seasons: [],
      styles: [],
      fit: null,
      description: detected.description || '',
      brand: detected.brand || null,
    },
    detectedSearchQuery: detected.searchQuery || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const processFn = httpsCallable(functions, 'processItem');
  processFn({
    itemId: id,
    focus: { category: detected.category || null, description: detected.description || '' },
  }).catch((err) => {
    console.warn('processItem (existing photo) failed:', err?.message);
    markFailedIfStuck(id);
  });
  return { id };
}

export const ItemService = {
  createItem,
  subscribeMyCloset,
  loadMyCloset,
  getItem,
  updateItem,
  deleteItem,
  reprocessItem,
  recordWear,
  analyzePhoto,
  createFromDetected,
  createFromExistingPhoto,
};

export default ItemService;
