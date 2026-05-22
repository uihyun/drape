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
  serverTimestamp,
  deleteDoc,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '../firebase.js';

const OOTDS = 'ootds';

function ootdDocId(uid, dateStr) {
  return `${uid}_${dateStr}`;
}

function isValidDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** Create or update today's (or any date's) OOTD entry. */
async function upsertOotd({ date, outfitId = null, photoBlob = null, note = '' }) {
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
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  }, { merge: true });

  return { id };
}

async function getOotd({ uid, date }) {
  const snap = await getDoc(doc(db, OOTDS, ootdDocId(uid, date)));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

async function deleteOotd({ uid, date }) {
  await deleteDoc(doc(db, OOTDS, ootdDocId(uid, date)));
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
  deleteOotd,
  listMonth,
};

export default OotdService;
