# App Store screenshot assets

## The live deck — baseline, read before changing anything

Seven slides, built 2026-06-04, order: **calendar → feed → closet → analyze →
tryon → market → board**. Sources live OUTSIDE this repo:

- `~/Desktop/idea/drape/screenshots/` — raw 1290×2796 captures
  (`calendar.png`, `closet-1/2`, `analyzed-photo`, `analyzed-tryon`,
  `tryon-1..4`, `market1/2`, `market-thread`, `board`, `home-1..3`)
- `~/Desktop/idea/drape/screenshots/poster/` — the finished EN deck
  (`01-calendar` … `07-board`)
- `~/Desktop/idea/drape/screenshots/poster-ja/` — the Japanese deck

**The design** (this is drape's, and any new deck must match it):
- Ink `#141312` ground, full bleed.
- One headline, centred, **Didot/Bodoni italic, lowercase**, no subhead — the
  same voice as the wordmark. Live copy: *"log every outfit"*, *"a feed of real
  looks"*, *"see it on you, first"*.
- A single pine dot under the headline.
- The app screen sits as a **white rounded card**, bleeding off the bottom edge
  — not a phone mockup with a drop shadow.

No generator for this deck is in either repo; the posters appear to have been
composed by hand. `scripts/build-app-store-screenshots-b.cjs` is **voda's**
loud charcoal/terracotta treatment (all-caps Archivo + subhead + terracotta
bar) and does NOT match the above. It was carried forward by mistake; treat its
output as a draft layout only until it is rebuilt to the design above.

## What 2.1.0 changes about the deck

- `02-feed` — the feed lost its tab; **Trends** is the surface that replaced it.
- `06-market` — the marketplace has no entry point in the shipped UI, and the
  claim was cut from every description. It cannot be a slide.
- `07-board` — boards is the least used tab in 90 days of GA (4.4% of profile
  views, 8 s/user). The weakest candidate for a slot.
- New since the deck was built: **stylist**, **trends**.

## The shot list

Six screens. Shoot on an iPhone 14/15/16 **Pro Max** (6.7") so the capture is
1290×2796 with no resizing. Switch the app's language first (Settings →
Language), then take all six before moving to the next language.

| # | File | Where | What should be on screen |
|---|---|---|---|
| 1 | `01-tryon.png` | a finished try-on result | The generated image large and centred — this is the one shot that has to sell the product |
| 2 | `02-closet.png` | Closet tab | A full grid, ideally 9+ cut-out items, mixed categories and colours |
| 3 | `03-stylist.png` | Stylist, after "Style me" | A recommendation showing, with its item thumbnails — not the persona chooser |
| 4 | `04-calendar.png` | Calendar tab | A month with several days filled; photo backgrounds off reads cleaner |
| 5 | `05-trends.png` | Trends | Scrolled to the top so the cover photo and the headline are both visible |
| 6 | `06-discover.png` | Trends → a look → its author's profile | Someone else's public closet, a full grid of their pieces |

Shoot with **no notification banners**, battery not red, and the same account
across all six so the profile chrome stays consistent.

## Rendering a deck

1. Put the six files in `captures-<locale>/` using exactly the names above.
   `captures-en/` is the fallback for any locale with no set of its own, so a
   Spanish deck can reuse the English phone UI if you'd rather not reshoot —
   the marketing caption is translated either way.
2. `node scripts/build-app-store-screenshots-b.cjs es`  (`en`, `ko`, `ja` too)
3. Output lands in `screenshots-6.7-<locale>-marketing-b/`.

Captions live in the `CAPTIONS` table in that script, keyed by locale — adding a
language is one entry, no new script. All four locales are written already.

A headline that would overflow the canvas throws before anything renders, since
on a store screenshot overflow means text sliced off at the right edge. The fit
check measures ems rather than counting characters: a Korean or Japanese glyph
is ~1.7x the width of a Latin capital, so a character count would wave through
a line that runs half the canvas past the edge.

## History

Variants A (quiet atelier) and C (hybrid) were voda decks and were deleted with
the rest of that material on 2026-09-16; B is the one carried forward, and it
is now the locale-aware drape renderer. Git history has the originals.

## Upload

English-only screenshots are reused by both stores for any locale with none of
its own, so a localized deck is optional — it only matters where the caption
text is burned into the image, which it is in variant B.
