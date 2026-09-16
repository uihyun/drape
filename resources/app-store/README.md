# App Store screenshot assets

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
| 6 | `06-market.png` | Feed → Market | A populated grid of listings with prices |

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
