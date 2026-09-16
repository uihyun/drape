// Bulk "these are my clothes" registration. Lives here rather than in a page
// because two surfaces start it: the Add-item sheet (the fast path) and the
// Analyze page (the full review flow).
//
// Deliberately fire-and-forget: the caller navigates to the closet immediately
// and items stream in as Processing cards via the live subscription, instead of
// holding the user behind a spinner for N detections.
import { ItemService } from './item-service.js';

// Every input is passed in — this keeps running after the caller unmounts, so
// it must not reach back into component state (a ReferenceError here is
// swallowed by the per-piece catch and the whole batch fails silently).
export async function bulkAddOwned(photos, { shopUrl = '' } = {}) {
  let added = 0;
  for (const blob of photos) {
    try {
      const data = await ItemService.analyzePhoto({ blob, mime: blob.type || 'image/jpeg' });
      for (const piece of (data.items || [])) {
        try {
          await ItemService.createFromDetected({
            blob,
            detected: piece,
            sourceLabel: data.style || '',
            shopUrl,
            owned: true,
          });
          added += 1;
        } catch { /* one failed create = one missing card; the rest still land */ }
      }
    } catch { /* detection failure on one photo shouldn't abort the others */ }
  }
  return added;
}

export default bulkAddOwned;
