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
import { db, functions, auth } from '../firebase.js';

const GENERATIONS = 'generations';

/**
 * Kick off a virtual try-on. The Cloud Function does the heavy lifting +
 * writes the Generation doc; this returns the id so the UI can subscribe.
 */
async function startTryOn({ itemIds, modelTier = 'pro', prompt = '', regenerateOf = null }) {
  const user = auth.currentUser;
  if (!user) throw new Error('not_signed_in');
  if (!Array.isArray(itemIds) || itemIds.length === 0) throw new Error('no_items');

  const callable = httpsCallable(functions, 'virtualTryOn');
  const res = await callable({ itemIds, modelTier, prompt, regenerateOf });
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
  deleteGeneration,
};

export default GenerationService;
