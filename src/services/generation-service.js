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
import { ref as storageRef, uploadBytes } from 'firebase/storage';
import { db, functions, auth, storage } from '../firebase.js';

const GENERATIONS = 'generations';

/**
 * Kick off a virtual try-on. The Cloud Function does the heavy lifting +
 * writes the Generation doc; this returns the id so the UI can subscribe.
 */
async function startTryOn({
  itemIds,
  modelTier = 'pro',
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
    await uploadBytes(r, customPhotoBlob, { contentType: 'image/jpeg' });
  }

  const callable = httpsCallable(functions, 'virtualTryOn');
  const res = await callable({
    itemIds,
    modelTier,
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

/** Rate a generation: -1 (👎), +1 (👍), 0 (clear). */
async function rateGeneration(generationId, rating) {
  if (![-1, 0, 1].includes(rating)) throw new Error('bad_rating');
  await updateDoc(doc(db, GENERATIONS, generationId), {
    rating,
    ratedAt: serverTimestamp(),
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
  await deleteDoc(doc(db, GENERATIONS, generationId));
}

export const GenerationService = {
  startTryOn,
  getGeneration,
  rateGeneration,
  listMyGenerations,
  subscribeMyGenerations,
  deleteGeneration,
};

export default GenerationService;
