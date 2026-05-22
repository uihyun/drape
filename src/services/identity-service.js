// === IdentityService ===================================================
// User's identity reference photos — 2~3 full-body shots used as the
// reference set passed into every virtual try-on call (Nano Banana Pro's
// multi-image identity preservation, brief §7).
//
// Stored as a small array on the user's /users/{uid} doc + the actual jpegs
// under identity/{uid}/{n}.jpg. The set is private; only the owner reads.

import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, auth } from '../firebase.js';

const MAX_IDENTITY_REFS = 3;
const MIN_IDENTITY_REFS = 1;

/** Add one identity reference photo. Returns the updated refs array. */
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
  const path = `identity/${user.uid}/${idx}.jpg`;
  const r = storageRef(storage, path);
  await uploadBytes(r, blob, { contentType: 'image/jpeg' });
  const url = await getDownloadURL(r);

  const next = [...existing, { url, path, addedAt: Date.now() }];
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

async function getMyRefs() {
  const user = auth.currentUser;
  if (!user) return [];
  const snap = await getDoc(doc(db, 'users', user.uid));
  return (snap.exists() && snap.data().identityRefs) || [];
}

export const IdentityService = {
  addRef,
  removeRef,
  getMyRefs,
  MIN_IDENTITY_REFS,
  MAX_IDENTITY_REFS,
};

export default IdentityService;
