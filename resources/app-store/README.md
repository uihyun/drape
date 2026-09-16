# App Store poster decks

## What's here

Every slide uses its capture whole. Trimming one to hide something near the
bottom does not work here and fails loudly: the card is 980×2124, nearly the
captures' own aspect ratio, so cutting height leaves a relatively wider image
and `fit: cover` scales it up to reach the card's height — blowing the content
up and cropping both sides away. Reframe in the app and re-capture instead.

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

Ten slides, four locales. Three are full-bleed look photos, seven are app
captures in the ink-ground card treatment.

| # | file | line (en) |
|---|---|---|
| 1 | `01-hero-closet.jpg` | your closet, in your pocket |
| 2 | `02-hero-own.jpg` | wear what you already own |
| 3 | `03-trends.png` | what everyone's wearing |
| 4 | `04-calendar.png` | log every outfit |
| 5 | `05-analyze.png` | shop any photo |
| 6 | `06-hero-tryon-ios-only.jpg` | try it on before it's yours |
| 7 | `07-tryon.png` | see it on you, first |
| 8 | `08-closet.png` | your closet, digitized |
| 9 | `09-stylist.png` | a stylist in your closet |
| 10 | `10-board-ios-only.png` | moodboard your style |

`-ios-only` is in the filename rather than in a note here, because a note is not
in the folder at upload time. The two stores take different counts — Play caps
phone screenshots at 8, the App Store at 10 — so those two slides go up on the
App Store only. Names still sort into the right sequence with them absent, so
there is nothing to renumber for Play.

Two acts after the heroes. **Looking at looks:** trends and calendar are a pair —
other people's outfits, then your own, the same thing from outside and inside.
**Wearing them:** analyze → try-on is the deck's one literal chain (the same
varsity jacket, read off a photo and then put on a body), so nothing goes
between them except the title card. An earlier order put analyze straight after
trends to keep those adjacent, which was a misread — the trends masthead is a
different look by a different person, so trends only sets the world; it isn't
the photo analyze is reading.

Order is the argument, not the feature list. Search results show the first three
portrait shots before anyone taps, and the shipped 1.5.0 order spent all three
on calendar + feed + closet — a trio that describes Lekondo as well as it
describes drape. Two heroes open and the third is a title card for the try-on
payoff, so the preview reads look · look · trends and the product still appears
before the tap. Putting all three heroes up front was considered and rejected:
our heroes carry no app UI (Lekondo's hold phone mockups; ours don't), so three
in a row would show a searcher nothing of the product.

Closet is the foundation but not the pitch, so it follows the payoff.

`07-board` survives at the back rather than being cut: boards is the least-used
profile tab — 198 views / 39 users across 90 days of GA, against closet's
1,887 / 71 — which earns it the last slot, not deletion.

## Hero slides

Sources are in `looks/`, pulled from real OOTDs in `outfits`. Three things to
know before touching them.

**`cx` is measured, not guessed.** It's the figure's centre as a fraction of
source width, read off a tenths grid laid over the original. Centring on the
photo puts the person off-axis; centring on the outermost limb (an extended leg,
a bag) is worse — it shoves the body to one edge.

**The photos are 1200px tall and that's the ceiling.** The app resizes on
upload, so there is no larger original; filling 2796 means a 2.33x upscale. The
alternative — fitting by width so nothing is cropped — leaves a third of the
poster empty, which is worse.

**They ship as JPEG.** Lossless PNG costs ~6 MB a slide for no visible gain on a
photograph, and both stores accept JPEG screenshots. The card slides stay PNG
and are palette-quantised; never palette a hero, it bands the sky.

No wordmark slide. The store already prints the icon and the app name directly
above the screenshots, so spending the most-seen slot restating them is waste —
and opening on the bare brand name is the one move that would read as copying
Lekondo rather than following the category.

**No Korean deck.** The treatment is a Bodoni italic and the Hangul counterpart
to that is a Myeongjo, but Myeongjo at display size reads literary and dated in
Korean, where fashion display type is overwhelmingly a modern sans. Three passes
at the font could not make the Korean sit beside the English deck, so the KR
storefront keeps inheriting the English set — which is what it already runs
today. Reviving it means a different treatment for Korean, not another serif.

## Uploading

App Store: all ten, in filename order, into the **6.9" (1290×2796)** slot —
Apple derives the smaller sizes.

Play: the eight without `-ios-only` in the name, same order.

Those two are the cheapest to lose. The try-on title card is followed
immediately by the slide that makes the same point, and boards is the least-used
tab. Calendar is not a candidate: it looks minor on views (263 across 90 days)
but has the second-widest *reach* of any tab — 68 users against closet's 71,
more than try-on's 53. Few views per user is what a daily logging feature looks
like when it is working, not a sign nobody goes there.
