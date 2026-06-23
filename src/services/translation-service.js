// === TranslationService ================================================
// Phase-2 on-demand translation of localized free-text (see
// functions/translate.js). Generated text is stored in the creator's language;
// a viewer in another language taps "translate" and gets it in theirs. The
// server caches the result on the doc; we also cache per session so a re-open
// (or toggling back and forth) never re-calls.

import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase.js';

const sessionCache = new Map(); // `${coll}|${id}|${target}` -> fields object

// Returns the translated free-text fields for a doc, shaped per collection
// (outfits: {name,notes,palette[],pieces[]}; generations: {notes,palette[]};
// items: {name}). Throws on failure so the caller can leave the original shown.
async function getOrTranslate(coll, id, target) {
  const key = `${coll}|${id}|${target}`;
  if (sessionCache.has(key)) return sessionCache.get(key);
  const fn = httpsCallable(functions, 'translateContent');
  const { data } = await fn({ coll, id, target });
  const fields = data?.fields || null;
  if (fields) sessionCache.set(key, fields);
  return fields;
}

export const TranslationService = { getOrTranslate };
