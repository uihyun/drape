// === StylistService ====================================================
// Client side of SPEC-1.6 §D. Recommendations come from the styleRecommend
// callable (free, server-capped daily); rating a rec writes the closed-enum
// feedback field the rules allow. Persona choice is a device preference —
// it's a lens, not data, so localStorage is enough.

import { doc, updateDoc, serverTimestamp, deleteField } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase.js';
import { currentLang } from '../hooks/useLocale.jsx';

const PERSONA_KEY = 'drape_stylist_persona';

// Kept in sync with functions/stylist.js PERSONAS. Illustrated initials on
// the client — explicitly AI characters, never photoreal faces (house rule).
export const STYLIST_PERSONAS = [
  { id: 'noa',  name: 'Noa',  tagKey: 'personaNoaTag',  color: '#8a8577' },
  { id: 'remy', name: 'Remy', tagKey: 'personaRemyTag', color: '#4a6fa5' },
  { id: 'sol',  name: 'Sol',  tagKey: 'personaSolTag',  color: '#c2716b' },
  { id: 'juno', name: 'Juno', tagKey: 'personaJunoTag', color: '#7d5ba6' },
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

export const StylistService = { recommend, rateRec };
export default StylistService;
