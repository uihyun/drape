// Single source of truth for which photo an outfit/OOTD shows OUTSIDE the
// calendar (profile grid, discovery feed, detail hero). Respects the
// per-post `heroVariant`: 'cut' → background-removed cutout, otherwise the
// full photo with its background. The calendar deliberately uses
// photoCutUrl directly and does NOT go through this.
export function outfitCardPhoto(o) {
  if (!o) return null;
  const full = o.photoUrl || o.coverUrl || o.sourcePhotoUrl || null;
  if (o.heroVariant === 'cut' && o.photoCutUrl) return o.photoCutUrl;
  return full || o.photoCutUrl || null;
}
