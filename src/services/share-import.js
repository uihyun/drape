// === Share-import client (SPEC-1.6 §A) =================================
// /import receives a share (web share_target GET today; native intents in
// the 2.0 builds), turns it into an image Blob, parks the blob here, and
// jumps into the normal analyze flow. Module memory is the right stash:
// blobs don't survive sessionStorage, and the handoff is same-session by
// construction (share → /import → /analyze in one navigation chain).

import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase.js';

let pending = null; // { blob, sourceUrl, title } | null

export function setPendingImport(entry) { pending = entry; }
export function takePendingImport() {
  const p = pending;
  pending = null;
  return p;
}

// Pull the first http(s) URL out of a share payload — many apps put the
// link in `text` rather than `url`.
export function extractSharedUrl({ url, text, title }) {
  for (const s of [url, text, title]) {
    const m = String(s || '').match(/https?:\/\/[^\s"'<>]+/);
    if (m) return m[0];
  }
  return null;
}

// Server fetches the page, finds og:image, shrinks it, returns JPEG base64.
export async function fetchImportImage(url) {
  const call = httpsCallable(functions, 'importFromUrl');
  const { data } = await call({ url });
  const bin = atob(data.imageBase64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return {
    blob: new Blob([bytes], { type: data.contentType || 'image/jpeg' }),
    sourceUrl: data.sourceUrl,
    title: data.title || '',
  };
}
