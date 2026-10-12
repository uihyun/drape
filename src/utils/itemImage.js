// The small image for a closet item: the 480px WebP thumb when the server
// has made one (functions/thumbs.js), else the full cutout, else the raw
// photo. Use it for grids, pickers and strips. Detail views, outfit heroes
// and the board canvas keep the full cutout, because they show it large.
export function itemThumb(it) {
  return it?.thumbUrl || it?.croppedUrl || it?.originalUrl || null;
}
