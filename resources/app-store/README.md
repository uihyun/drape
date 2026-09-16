# App Store screenshot assets

> **Stale:** every folder below (`screenshots-6.7-en*`) is a **voda** asset —
> interior-design captures (playrooms, floor plans, furniture) that arrived with
> the migration baseline and were never replaced. They are NOT drape and must
> not be uploaded. The drape screenshots currently live on the App Store were
> uploaded directly to App Store Connect and were never committed here.

## Making a localized deck

1. Drop raw 1290×2796 captures into `captures-<locale>/` named
   `01-tryon.png`, `02-closet.png`, `03-stylist.png`, `04-calendar.png`,
   `05-trends.png`, `06-market.png`. A `captures-en/` set is the fallback for
   every locale, so a Spanish deck can reuse the English phone UI — the
   marketing caption is translated either way.
2. `node scripts/build-app-store-screenshots-b.cjs es`
3. Output lands in `screenshots-6.7-es-marketing-b/`.

Captions live in the `CAPTIONS` table in that script, keyed by locale — adding a
language is one entry, no new script. A headline that would overflow the canvas
throws before anything renders, because on a store screenshot overflow means
text sliced off at the right edge.

## Historical variants (voda)

`scripts/build-app-store-screenshots*.cjs` — variant A (quiet atelier), B (loud
dark, selected), C (hybrid). Only B has been carried forward to drape + locales.

## Upload

English-only screenshots are reused by both stores for any locale with none of
its own, so a localized deck is optional — it only matters where the caption
text is burned into the image, which it is in variant B.
