// === GenerationService =================================================
// Virtual try-on results + the feedback loop (brief §8 — "닫힌 API라
// 파인튜닝 못해도, 데이터는 1일차부터 모은다").
//
// Each call to `virtualTryOn` (functions/tryon.js) writes a Generation doc:
//   - inputs: identityRefIndices, itemIds, prompt, model tier
//   - output: resultUrl(s), N variants
//   - feedback: rating (👍/-1/0/+1), regeneratedFromId
//
// Rating + regeneration counts feed prompt tuning today, and become the
// training signal for self-hosted try-on models (IDM-VTON / CatVTON / Leffa)
// later.

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { ref as storageRef, uploadBytes, deleteObject } from 'firebase/storage';
import { db, functions, auth, storage } from '../firebase.js';
import { IMG_CACHE } from './storageCache.js';

const GENERATIONS = 'generations';

/**
 * Kick off a virtual try-on. The Cloud Function does the heavy lifting +
 * writes the Generation doc; this returns the id so the UI can subscribe.
 */
async function startTryOn({
  itemIds,
  modelTier = 'pro',
  title = '',
  prompt = '',
  backgroundDesc = '',
  regenerateOf = null,
  // Optional one-shot custom photo (Blob) — uploaded to
  // tryon-input/<uid>/<id>.jpg and passed to the function. When set, the
  // user's saved identityRefs are bypassed for this single call.
  customPhotoBlob = null,
  // When customPhotoBlob is set, default behavior preserves the source
  // photo's background. Pass true to run segmentation on the result so
  // the figure ends up on a clean white card (identity-refs style).
  removeCustomBg = false,
}) {
  const user = auth.currentUser;
  if (!user) throw new Error('not_signed_in');
  if (!Array.isArray(itemIds) || itemIds.length === 0) throw new Error('no_items');

  let customPhotoPath = null;
  if (customPhotoBlob) {
    const id = `ci_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    customPhotoPath = `tryon-input/${user.uid}/${id}.jpg`;
    const r = storageRef(storage, customPhotoPath);
    await uploadBytes(r, customPhotoBlob, { contentType: 'image/jpeg', cacheControl: IMG_CACHE });
  }

  const callable = httpsCallable(functions, 'virtualTryOn');
  const res = await callable({
    itemIds,
    modelTier,
    title,
    prompt,
    backgroundDesc,
    regenerateOf,
    customPhotoPath,
    removeCustomBg,
  });
  return res.data; // { generationId }
}

async function getGeneration(generationId) {
  const snap = await getDoc(doc(db, GENERATIONS, generationId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Personal ❤️ bookmark on a try-on. Replaces the old 👍/👎 rating. */
async function toggleLike(generationId, liked) {
  await updateDoc(doc(db, GENERATIONS, generationId), {
    liked: !!liked,
    likedAt: serverTimestamp(),
  });
}

/**
 * Live subscription to the user's generations. Used by TryOnHistory so a
 * just-kicked-off run pops in as a 'pending' card without a page refresh
 * and flips to 'ready' / 'failed' when the Cloud Function updates it.
 */
function subscribeMyGenerations(uid, cb, { pageSize = 60 } = {}) {
  if (!uid) { cb([]); return () => {}; }
  return onSnapshot(
    query(
      collection(db, GENERATIONS),
      where('userId', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(pageSize),
    ),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => {
      console.warn('subscribeMyGenerations failed:', err?.code, err?.message);
      cb([]);
    },
  );
}

async function listMyGenerations({ uid, pageSize = 30, cursor = null } = {}) {
  const constraints = [
    where('userId', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(pageSize),
  ];
  if (cursor) constraints.push(startAfter(cursor));
  const snap = await getDocs(query(collection(db, GENERATIONS), ...constraints));
  return {
    generations: snap.docs.map(d => ({ id: d.id, ...d.data() })),
    lastVisible: snap.docs[snap.docs.length - 1] || null,
    hasMore: snap.docs.length === pageSize,
  };
}

async function deleteGeneration(generationId) {
  // Storage cleanup — best effort. Remove the generated variant images +
  // any one-shot custom input photo so they don't orphan in the bucket.
  try {
    const snap = await getDoc(doc(db, GENERATIONS, generationId));
    const data = snap.exists() ? snap.data() : null;
    const paths = [
      ...(Array.isArray(data?.variantPaths) ? data.variantPaths : []),
      data?.customPhotoPath || null,
    ].filter(Boolean);
    await Promise.all(paths.map(p =>
      deleteObject(storageRef(storage, p)).catch(() => {})));
  } catch { /* ignore — doc removal below is the source of truth */ }
  await deleteDoc(doc(db, GENERATIONS, generationId));
}

/** Fire-and-forget palette/style analysis for a ready try-on.
 *  Mirrors how dated outfits are analyzed; safe to call repeatedly (the
 *  caller guards on !palette). */
async function analyzeGeneration(generationId) {
  return httpsCallable(functions, 'analyzeGeneration')({ generationId });
}

export const GenerationService = {
  startTryOn,
  analyzeGeneration,
  getGeneration,
  toggleLike,
  listMyGenerations,
  subscribeMyGenerations,
  deleteGeneration,
};

export default GenerationService;
