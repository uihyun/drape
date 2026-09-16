// === StylistService ====================================================
// Client side of SPEC-1.6 §D. Recommendations come from the styleRecommend
// callable (free, server-capped daily); rating a rec writes the closed-enum
// feedback field the rules allow. Persona choice is a device preference —
// it's a lens, not data, so localStorage is enough.

import {
  doc, updateDoc, serverTimestamp, deleteField,
  collection, addDoc, deleteDoc, onSnapshot, orderBy, query, limit,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase.js';
import { currentLang } from '../hooks/useLocale.jsx';

const PERSONA_KEY = 'drape_stylist_persona';

// Kept in sync with functions/stylist.js PERSONAS. Illustrated initials on
// the client — explicitly AI characters, never photoreal faces (house rule).
export const STYLIST_PERSONAS = [
  { id: 'noa',  name: 'Noa',  tagKey: 'personaNoaTag', bioKey: 'personaNoaBio',  color: '#8a8577', img: '/stylists/noa.webp' },
  { id: 'remy', name: 'Remy', tagKey: 'personaRemyTag', bioKey: 'personaRemyBio', color: '#4a6fa5', img: '/stylists/remy.webp' },
  { id: 'sol',  name: 'Sol',  tagKey: 'personaSolTag', bioKey: 'personaSolBio',  color: '#c2716b', img: '/stylists/sol.webp' },
  { id: 'juno', name: 'Juno', tagKey: 'personaJunoTag', bioKey: 'personaJunoBio', color: '#7d5ba6', img: '/stylists/juno.webp' },
];

export function getChosenPersona() {
  try {
    const v = localStorage.getItem(PERSONA_KEY);
    return STYLIST_PERSONAS.some((p) => p.id === v) ? v : null;
  } catch { return null; }
}

export function setChosenPersona(id) {
  try { localStorage.setItem(PERSONA_KEY, id); } catch { /* private mode */ }
}

async function recommend({ persona, ask }) {
  const call = httpsCallable(functions, 'styleRecommend');
  const { data } = await call({ persona, ask: ask || '', lang: currentLang() });
  return data; // { recId, persona, outfits: [{title,itemIds,why,confidence}], remaining }
}

// Whole-batch rating ('up' | 'down' | null to clear) — per-outfit granularity
// is a later iteration; the strongest per-outfit signal is the try-on itself.
async function rateRec(recId, value) {
  await updateDoc(doc(db, 'stylistRecs', recId), {
    feedback: value === 'up' || value === 'down' ? value : deleteField(),
    feedbackAt: serverTimestamp(),
  });
}

// ── Saved looks ───────────────────────────────────────────────────────
// A recommendation is ephemeral (the next "Style me" replaces it), so a
// look the user liked has to be kept somewhere they can return to: the
// stylist's comment is half the value, and they may want to re-run the
// try-on later against a different reference photo or background.
function savedLooksRef(uid) {
  return collection(db, 'users', uid, 'savedLooks');
}

async function saveLook(uid, { persona, title, why, itemIds, ask = '' }) {
  const ref = await addDoc(savedLooksRef(uid), {
    persona, title, why, itemIds, ask,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

async function unsaveLook(uid, lookId) {
  await deleteDoc(doc(db, 'users', uid, 'savedLooks', lookId));
}

// `max` grows with the "show more" button so a user with 50 saved looks
// only ever reads the page they're actually looking at.
function subscribeSavedLooks(uid, cb, { max = 12 } = {}) {
  if (!uid) { cb([]); return () => {}; }
  return onSnapshot(
    query(savedLooksRef(uid), orderBy('createdAt', 'desc'), limit(max)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => cb([]),
  );
}

export const StylistService = { recommend, rateRec, saveLook, unsaveLook, subscribeSavedLooks };
export default StylistService;
