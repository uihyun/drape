// === IdentityService ===================================================
// User's identity reference photos — 2~3 full-body shots used as the
// reference set passed into every virtual try-on call (Nano Banana Pro's
// multi-image identity preservation, brief §7).
//
// Stored as a small array on the user's /users/{uid} doc + the actual jpegs
// under identity/{uid}/{n}.jpg. The set is private; only the owner reads.

import { doc, getDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, storage, auth, functions } from '../firebase.js';
import { IMG_CACHE } from './storageCache.js';

const MAX_IDENTITY_REFS = 3;
const MIN_IDENTITY_REFS = 1;

/** Add one identity reference photo — fire-and-forget, like createItem.
 *  The slot is committed to Firestore with the RAW photo first, so the
 *  ref is saved the moment the upload finishes even if the user leaves the
 *  screen. Background-removal (slow Gemini call) is then dispatched WITHOUT
 *  awaiting; when it returns it patches just that slot. Settings observes
 *  the user doc via subscribeMyRefs, so the cutout swaps in live with no
 *  refresh. Resolves as soon as the raw ref is committed. */
async function addRef(blob) {
  const user = auth.currentUser;
  if (!user) throw new Error('not_signed_in');

  const userRef = doc(db, 'users', user.uid);
  const snap = await getDoc(userRef);
  const existing = (snap.exists() && snap.data().identityRefs) || [];
  if (existing.length >= MAX_IDENTITY_REFS) {
    throw new Error('max_identity_refs');
  }
  const idx = existing.length;
  // Unique path (timestamp) so a delete-then-re-add at the same index never
  // collides with the old object, and the slot's identity is stable for the
  // async patch below even if the array shifts.
  const refId = `${idx}_${Date.now()}`;
  const path = `identity/${user.uid}/${refId}.jpg`;
  const r = storageRef(storage, path);
  await uploadBytes(r, blob, { contentType: 'image/jpeg', cacheControl: IMG_CACHE });
  const url = await getDownloadURL(r);

  // Commit the ref with the raw photo NOW — leaving the screen is safe.
  // `processing: true` lets the UI show a "cleaning up" hint on this slot.
  const committed = { url, path, refId, addedAt: Date.now(), processing: true };
  await updateDoc(userRef, {
    identityRefs: [...existing, committed],
    identityRefUpdatedAt: serverTimestamp(),
  });

  // Background-remove the person, fire-and-forget. Re-reads the doc on
  // completion (the array may have changed) and patches this slot by refId.
  (async () => {
    try {
      const processFn = httpsCallable(functions, 'processIdentityRef');
      const { data } = await processFn({ storagePath: path });
      const fresh = await getDoc(userRef);
      const cur = (fresh.exists() && fresh.data().identityRefs) || [];
      const patched = cur.map(s => s.refId === refId
        ? { ...s, url: data?.ok && data?.url ? data.url : s.url, path: data?.path || s.path, processing: false }
        : s);
      await updateDoc(userRef, { identityRefs: patched, identityRefUpdatedAt: serverTimestamp() });
    } catch (err) {
      console.warn('identity ref bg-removal skipped:', err?.message);
      // Clear the processing flag so the slot doesn't spin forever.
      try {
        const fresh = await getDoc(userRef);
        const cur = (fresh.exists() && fresh.data().identityRefs) || [];
        await updateDoc(userRef, {
          identityRefs: cur.map(s => s.refId === refId ? { ...s, processing: false } : s),
        });
      } catch { /* ignore */ }
    }
  })();

  return [...existing, committed];
}

/** Re-run background removal on an existing ref. For users who added
 *  refs before this pipeline existed, or whose cutout came back wrong. */
async function reprocessRef(idx) {
  const user = auth.currentUser;
  if (!user) throw new Error('not_signed_in');
  const userRef = doc(db, 'users', user.uid);
  const snap = await getDoc(userRef);
  const existing = (snap.exists() && snap.data().identityRefs) || [];
  if (idx < 0 || idx >= existing.length) return existing;
  const slot = existing[idx];
  if (!slot?.path) return existing;
  const processFn = httpsCallable(functions, 'processIdentityRef');
  const { data } = await processFn({ storagePath: slot.path });
  if (!data?.ok || !data?.url) return existing;
  const next = existing.map((s, i) => i === idx
    ? { ...s, url: data.url, path: data.path || s.path }
    : s);
  await updateDoc(userRef, {
    identityRefs: next,
    identityRefUpdatedAt: serverTimestamp(),
  });
  return next;
}

/** Remove an identity ref by index (and the underlying storage file). */
async function removeRef(idx) {
  const user = auth.currentUser;
  if (!user) throw new Error('not_signed_in');

  const userRef = doc(db, 'users', user.uid);
  const snap = await getDoc(userRef);
  const existing = (snap.exists() && snap.data().identityRefs) || [];
  if (idx < 0 || idx >= existing.length) return existing;

  const removed = existing[idx];
  if (removed?.path) {
    try { await deleteObject(storageRef(storage, removed.path)); } catch { /* ignore */ }
  }
  const next = existing.filter((_, i) => i !== idx);
  await updateDoc(userRef, {
    identityRefs: next,
    identityRefUpdatedAt: serverTimestamp(),
  });
  return next;
}

/** Reorder identity refs by index permutation. The first item in the
 *  resulting array becomes the primary (used as the canvas in
 *  identity-refs try-on). Server doesn't care about the order — it
 *  just walks the array — so this is a client-only patch. */
async function reorderRefs(newOrderIndices) {
  const user = auth.currentUser;
  if (!user) throw new Error('not_signed_in');
  const userRef = doc(db, 'users', user.uid);
  const snap = await getDoc(userRef);
  const existing = (snap.exists() && snap.data().identityRefs) || [];
  if (!Array.isArray(newOrderIndices) || newOrderIndices.length !== existing.length) {
    return existing;
  }
  const seen = new Set();
  const next = [];
  for (const i of newOrderIndices) {
    if (typeof i !== 'number' || i < 0 || i >= existing.length || seen.has(i)) {
      return existing; // reject any malformed permutation
    }
    seen.add(i);
    next.push(existing[i]);
  }
  await updateDoc(userRef, {
    identityRefs: next,
    identityRefUpdatedAt: serverTimestamp(),
  });
  return next;
}

async function getMyRefs() {
  const user = auth.currentUser;
  if (!user) return [];
  const snap = await getDoc(doc(db, 'users', user.uid));
  return (snap.exists() && snap.data().identityRefs) || [];
}

/** Live subscription to the user's identity refs. Lets the Settings UI
 *  reflect background-removal completing (and any other device's edits)
 *  without a manual refetch — the fire-and-forget addRef relies on this. */
function subscribeMyRefs(cb) {
  const user = auth.currentUser;
  if (!user) { cb([]); return () => {}; }
  return onSnapshot(
    doc(db, 'users', user.uid),
    snap => cb((snap.exists() && snap.data().identityRefs) || []),
    err => { console.warn('subscribeMyRefs failed:', err?.message); cb([]); },
  );
}

export const IdentityService = {
  addRef,
  removeRef,
  subscribeMyRefs,
  reprocessRef,
  reorderRefs,
  getMyRefs,
  MIN_IDENTITY_REFS,
  MAX_IDENTITY_REFS,
};

export default IdentityService;
