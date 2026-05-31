// Cache-Control for user-uploaded images. Every upload path is content-
// addressed (unique id / timestamp in the path, or write-once per item), so
// a given URL never changes its bytes — safe to cache forever + immutable.
// Without this header the browser re-downloads the image every time an <img>
// re-mounts (e.g. returning from a detail page), which shows as the photo
// blanking then re-appearing. Mirrors what the server functions already set
// on the crops they write (functions/items.js, functions/tryon.js).
export const IMG_CACHE = 'public,max-age=31536000,immutable';
