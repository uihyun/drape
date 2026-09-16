# App Store poster decks

## What's here

- `captures/` — the raw phone screenshots the posters are built from. Source of
  truth, committed. Older ones are 1290×2796 (6.7"); the trends and stylist
  ones are 1170×2532 (iPhone 12 Pro). Both work: the renderer scales to the
  card width and the poster is always 1290×2796.
- `posters-shipped/1.5.0-en`, `posters-shipped/1.5.0-ja` — the decks actually
  on the stores. Committed because once 2.1.0 replaces them they are gone: they
  were never in this repo, and the only other copy was Apple's CDN.
- `posters-2.1.0-<locale>/` — rendered output. **Not committed** (gitignored):
  derived from `captures/` plus the script, and regenerating is one command.

Everything above used to live only in `~/Desktop/idea/drape/screenshots/`,
outside any repo, which is how it went missing.

## Rendering

    node scripts/build-store-posters.cjs en      # also ko · ja · es · fr

The treatment was measured off the shipped deck and is reproduced exactly: ink
`#141312` ground, one centred Didot-italic lowercase line with a baseline at
y=356, a 14px pine dot at y=430, and the capture as a white rounded card at
x=155, y=560, width 980, corner radius 40. No subhead — the single line carries
it. CJK has no italic, so those locales use a Mincho/Myeongjo face upright,
which is what the shipped Japanese deck does.

## The 2.1.0 deck

Six slides. The order is the shipped one with two substitutions and one drop:

| # | slide | vs shipped 1.5.0 |
|---|---|---|
| 1 | calendar | unchanged, same line |
| 2 | trends | replaces `02-feed` — the feed lost its tab |
| 3 | closet | unchanged, same line |
| 4 | analyze | unchanged, same line |
| 5 | tryon | unchanged, same line |
| 6 | stylist | replaces `06-market` — the marketplace has no entry point in the shipped UI |

`07-board` drops: least-used tab across 90 days of GA (4.4% of profile views,
8 s/user). The four unchanged slides keep their shipped headline word for word.

Korean, Spanish and French have no shipped deck — the Korean storefront runs
the English screenshots today — so those lines are new.
