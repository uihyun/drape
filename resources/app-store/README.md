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
  views, 8 s/user).
- New since the deck was built: **stylist**, **trends**.

Proposed 2.1.0 deck, keeping the live order and only substituting what changed:

| # | slide | vs live |
|---|---|---|
| 1 | calendar | unchanged |
| 2 | trends | replaces `02-feed` |
| 3 | closet | unchanged |
| 4 | analyze | unchanged |
| 5 | tryon | unchanged |
| 6 | stylist | replaces `06-market` |

`07-board` drops. For the Trends capture, scroll so the bottom of the cover and
the first rows of "Styles on the rise" are both in frame — the frame crops the
bottom of whatever you shoot, and the cover alone doesn't say what Trends is.

## Making the 2.1.0 deck

There is no generator. The live posters were composed by hand in the design
above, and the previous renderer in this repo was voda's — different ground,
different type, a subhead drape's deck doesn't use — so it was deleted rather
than kept as a misleading starting point.

Five languages × six slides is thirty posters, so a renderer matching the
design above is worth building before the next deck. Until then, the live
posters under `~/Desktop/idea/drape/screenshots/poster/` are the reference for
ground colour, type treatment, dot placement and card geometry.
