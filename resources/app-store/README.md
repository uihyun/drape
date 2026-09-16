# App Store poster decks

## What's here

- `captures/` — the raw phone screenshots the posters are built from. Source of
  truth, committed. Older ones are 1290×2796 (6.7"); the trends and stylist
  ones are 1170×2532 (iPhone 12 Pro). Both work: the renderer scales to the
  card width and the poster is always 1290×2796.
- `posters-shipped/1.5.0-en`, `posters-shipped/1.5.0-ja` — the decks actually
  on the stores. Committed because once 2.1.0 replaces them they are gone: they
  were never in this repo, and the only other copy was Apple's CDN.
- `posters-2.1.0-<locale>/` — the decks to upload for 2.1.0. Committed too,
  even though they are derived: the headline face is a macOS system font, so a
  different machine does not reproduce them, and the upload artifact is worth
  more than the bytes it costs.

All of this used to live only in `~/Desktop/idea/drape/screenshots/`, outside
any repo, which is how it went missing. That path still holds a copy, but the
repo is the original now — the renderer reads and writes here.

## Rendering

    node scripts/build-store-posters.cjs en      # also ja · es · fr

Reads `captures/`, writes `posters-2.1.0-<locale>/`. Both inside the repo — no
argument needed, and it refuses to write anywhere near `posters-shipped/`.

The treatment was measured off the shipped deck and is reproduced exactly: ink
`#141312` ground, one centred Didot-italic lowercase line with a baseline at
y=356, a 14px pine dot at y=430, and the capture as a white rounded card at
x=155, y=560, width 980, corner radius 40. No subhead — the single line carries
it. Japanese has no italic, so it uses a Mincho upright, which is what the
shipped Japanese deck does.

## The 2.1.0 deck

Six slides, four locales.

| # | slide | line (en) |
|---|---|---|
| 1 | trends | what everyone's wearing |
| 2 | analyze | shop any photo |
| 3 | tryon | see it on you, first |
| 4 | closet | your closet, digitized |
| 5 | stylist | a stylist in your closet |
| 6 | calendar | log every outfit |

Two substitutions against shipped 1.5.0: trends replaces `02-feed` (the feed
lost its tab) and stylist replaces `06-market` (the marketplace has no entry
point in the shipped UI). `07-board` drops — least-used tab across 90 days of
GA (4.4% of profile views, 8 s/user). The four surviving slides keep their
shipped headline word for word.

The order changed, though. 1.5.0 opened calendar / feed / closet, and those are
exactly the three portrait shots search results show before anyone taps — a
trio that describes Lekondo as well as it describes drape. The first three now
run the one story no competitor can tell: see someone's look, drape reads the
outfit, it lands on your body. Closet is the foundation but not the pitch, so
it follows; calendar closes, because a habit feature is for people already sold.

**No Korean deck.** The treatment is a Bodoni italic and the Hangul counterpart
to that is a Myeongjo, but Myeongjo at display size reads literary and dated in
Korean, where fashion display type is overwhelmingly a modern sans. Three
passes at the font could not make the Korean sit beside the English deck, so
the KR storefront keeps inheriting the English set — which is what it already
runs today. Reviving it means a different treatment for Korean, not another
serif. Spanish and French have no shipped deck either, so those lines are new.
