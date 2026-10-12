// Grid thumbnails for closet items (2026-10-12).
//
// Every grid used to draw the full cutout: a trimmed PNG of up to 900×1200,
// 340–650 KB, about 4 MB once decoded. Scrolling the largest real closet
// (1,462 pieces) would pull ~700 MB, and WKWebView gives up long before that.
// A 480px-wide WebP with alpha is ~10× smaller and still sharp at the
// closet's largest pinch size on a 3× screen.
//
// One trigger owns it: whenever an item's croppedPath is new or changed,
// (re)build the thumb. That covers processItem, a borrowed piece pointing at
// someone else's cutout, and the one-off backfill (scripts/backfill-thumbs.cjs
// calls makeItemThumb directly). `thumbFor` records which cutout the thumb
// was made from, so the trigger's own write doesn't re-fire it.
//
// The thumb always lives in the ITEM's own folder (items/{uid}/{itemId}/),
// even when croppedPath points into another user's folder, so deleting the
// item deletes its thumb and never the owner's files.

const admin = require('firebase-admin');
const sharp = require('sharp');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');

const THUMB_W = 480;

async function makeItemThumb(bucket, itemId, item) {
  const [buf] = await bucket.file(item.croppedPath).download();
  const webp = await sharp(buf)
    .resize({ width: THUMB_W, withoutEnlargement: true })
    .webp({ quality: 80, alphaQuality: 90 })
    .toBuffer();
  const thumbPath = `items/${item.userId}/${itemId}/thumb-${Date.now()}.webp`;
  await bucket.file(thumbPath).save(webp, {
    metadata: { contentType: 'image/webp', cacheControl: 'public,max-age=31536000,immutable' },
  });
  await bucket.file(thumbPath).makePublic().catch(() => {});
  return {
    thumbUrl: `https://storage.googleapis.com/${bucket.name}/${thumbPath}`,
    thumbPath,
    thumbFor: item.croppedPath,
    bytes: webp.length,
  };
}

exports.onItemThumb = onDocumentWritten(
  { document: 'items/{itemId}', memory: '512MiB', timeoutSeconds: 60 },
  async (event) => {
    const after = event.data?.after?.exists ? event.data.after.data() : null;
    if (!after || !after.croppedPath || !after.userId) return;
    if (after.thumbFor === after.croppedPath) return;
    const bucket = admin.storage().bucket();
    try {
      const { bytes, ...fields } = await makeItemThumb(bucket, event.params.itemId, after);
      await event.data.after.ref.update(fields);
      // The thumb this one replaces (re-crop), if it was ours.
      const old = after.thumbPath;
      if (old && old !== fields.thumbPath && old.startsWith(`items/${after.userId}/${event.params.itemId}/`)) {
        await bucket.file(old).delete().catch(() => {});
      }
    } catch (e) {
      // Grids fall back to croppedUrl, so a missing thumb is only slower.
      console.warn('onItemThumb failed', event.params.itemId, e?.message);
    }
  },
);

module.exports.makeItemThumb = makeItemThumb;
