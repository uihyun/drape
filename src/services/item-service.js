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
    ...(shopUrl ? { shopUrl } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const itemId = draft.id;

  // 2. Upload original.
  const originalRef = itemStorageRef(user.uid, itemId, `original.${mime === 'image/png' ? 'png' : 'jpg'}`);
  await uploadBytes(originalRef, blob, { contentType: mime });
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
    processItem({ itemId }).catch(err => console.warn('processItem dispatch:', err?.message));
  } catch (err) {
    // Non-fatal — the user sees a 'processing' card; admin can re-run.
    console.warn('processItem callable missing:', err?.message);
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
    'currency', 'listedAt',
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
  // Storage cleanup — best effort. Firestore doc removal is the source of
  // truth; orphan files are pruned by a scheduled function later.
  for (const path of [it.originalPath, it.croppedPath]) {
    if (!path) continue;
    try { await deleteObject(ref(storage, path)); } catch { /* ignore */ }
  }
  await deleteDoc(doc(db, ITEMS, itemId));
}

/**
 * Manually re-run the processing pipeline (e.g. user wasn't happy with the
 * auto-crop or tags). Resets status back to 'processing' so the listener
 * reverts to a skeleton card until the function writes results.
 */
async function reprocessItem(itemId) {
  await updateDoc(doc(db, ITEMS, itemId), {
    status: 'processing',
    updatedAt: serverTimestamp(),
  });
  const processItem = httpsCallable(functions, 'processItem');
  await processItem({ itemId });
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
async function createFromDetected({ blob, detected, sourceLabel = '', shopUrl = '' }) {
  const user = auth.currentUser;
  if (!user) throw new Error('AUTH_REQUIRED');
  const id = `dt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const path = `items/${user.uid}/${id}/original.jpg`;
  const ref_ = ref(storage, path);
  await uploadBytes(ref_, blob, { contentType: 'image/jpeg' });
  const url = await getDownloadURL(ref_);
  // Status starts as 'processing' so the card shows a skeleton until the
  // server isolates the specific piece. processItem (called below with a
  // focus hint) replaces croppedUrl with a clean cutout of just the
  // detected category — without focus it would crop whatever piece was
  // most prominent in the multi-item source photo.
  await setDoc(doc(db, ITEMS, id), {
    userId: user.uid,
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
  }).catch(err => console.warn('processItem (detected) failed:', err?.message));
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
};

export default ItemService;
