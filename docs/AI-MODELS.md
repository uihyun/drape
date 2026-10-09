# AI models — what drape uses, what it costs, what to move to

Checked **2026-10-09**: live `config/models` (no overrides, so the baked
defaults in `functions/model-config.js` are what runs), every call site, the
Gemini API model list (`v1beta/models`), and the official pricing page
(ai.google.dev/gemini-api/docs/pricing). Re-check both lists whenever this is
revisited; Google ships Flash versions every few months.

## Rules (owner, 2026-10-09)

1. **Best value for the job.** The cheapest model that holds quality on that
   task, not the biggest one.
2. **Prefer the newest generation.** Don't sit on an older model when a newer
   one is as good or cheaper.
3. **Never a `-preview` / `-exp` model, and never a `-latest` alias.**
   Previews can change or vanish without notice. `-latest` aliases move under
   you, so a model swap would arrive without a test.
4. **Switching is a config edit, not a deploy.** `vision`, `imageCrop` and
   `imageTryon` are read from Firestore `config/models` (/admin → Config). A
   rollback is the same edit. The constants in `items.js` / `tryon.js` /
   `stylist.js` only document the defaults.
5. **A/B before switching.** The try-on and crop rigs are
   `functions/test-tryon-ab.js` and `functions/test-item-crop-ab.js`. A
   stylist change also needs the four-persona check (CLAUDE.md).

## What runs today

**2026-10-09: `vision` switched 3.5-flash → 3.8-flash** (config/models + code
default), after the A/B below. Image models unchanged. Same day, the crop
prompt gained watch / small-item / text-and-logo rules (see CHANGELOG).


| Job | Where | Model (config key) | Size | Price (standard) | Per call (approx.) |
|---|---|---|---|---|---|
| Item tagging (closed taxonomy) | `items.js` `processItem` | `gemini-3.8-flash` (`vision`) | — | $0.75 in / $3.75 out per 1M (2026) | < $0.001 |
| Item cutout (crop + reshape) | `items.js` `processItem` | `gemini-3.1-flash-lite-image` (`imageCrop`) | 1K | $0.0336 / image | ~$0.034 |
| OOTD / outfit analysis | `items.js` `analyzeOotd` | `gemini-3.8-flash` (`vision`) | — | as above | < $0.003 |
| Try-on render | `tryon.js` `virtualTryOn` | `gemini-3.1-flash-image` (`imageTryon`) | 1K | $0.067 / image | ~$0.07 |
| Stylist chat, recs, verdicts, style profile, "lately" | `stylist.js` | `gemini-3.8-flash` (`vision`) | — | as above | < $0.005 |
| Translate-this-post | `translate.js` | `gemini-3.8-flash` (`vision`) | — | as above | < $0.001 |
| Image moderation (SafeSearch) | `moderation.js` | Cloud Vision `SAFE_SEARCH_DETECTION` | — | 1,000/mo free | ~free |
| Face blur on outfit refs | `tryon.js` | Cloud Vision `FACE_DETECTION` | — | 1,000/mo free | ~free |
| Background removal (identity refs, OOTD cutouts, alpha) | `items.js`, `tryon.js` | `@imgly/background-removal-node` (local) | — | $0 | $0 |
| Marketing reel test (not the app) | `resources/marketing/2026-07/src/veo-test.cjs` | `veo-3.1-fast-generate-preview` | — | — | **breaks rule 3** |

**Image output dominates the bill** (see `docs/COST.md`). Try-on is the
single most expensive call; crops come next because every item gets one.

## What's available now (GA only, 2026-10-09)

Text / vision (per 1M tokens, standard tier):

| Model | Input | Output | Note |
|---|---|---|---|
| `gemini-3.8-flash` | **$0.75** → $1.50 from 2027-01-01 | **$3.75** → $7.50 from 2027-01-01 | Newest, "most intelligent Flash" |
| `gemini-3.7-flash` / `gemini-3.6-flash` | same as 3.8 | same as 3.8 | Older than 3.8 at the same price, so no reason to pick them |
| `gemini-3.5-flash` (ours until 2026-10-09) | $1.50 | $9.00 | "Earlier Flash"; now the *expensive* one |
| `gemini-3.5-flash-lite` | $0.30 | $2.50 | Newest Lite; translation / simple data |
| `gemini-3.1-flash-lite` | $0.25 | $1.50 | Older Lite |

Image generation (per output image, standard tier):

| Model | 1K | 2K | Note |
|---|---|---|---|
| `gemini-nano-banana-2.1` | **$0.0336** | $0.0504 | Update to Nano Banana 2: better quality, multi-turn character consistency |
| `gemini-3.1-flash-image` (Nano Banana 2, **our try-on**) | $0.067 | $0.101 | |
| `gemini-3.1-flash-lite-image` (Nano Banana 2 Lite, **our crop**) | $0.0336 | — | Ultra-low latency |
| `gemini-3-pro-image` (Nano Banana Pro) | $0.134 | $0.134 | Dropped in July 2026; Flash matched it |

Video: `veo-3.1*` is **preview only**. The GA option is
`gemini-omni-1.1-flash`, about $0.10/s at 720p.

Avoid: the whole 2.5 family (old; `gemini-2.5-flash-image` shuts down
2026-10-02), anything `-preview`, and `gemini-*-latest`.

## Recommendations (A/B first, then a config edit)

1. **`vision`: `gemini-3.5-flash` → `gemini-3.8-flash`.** It's newer *and*
   cheaper: −50% input / −58% output through 2026, and still cheaper on
   output after the 2027 price change ($7.50 vs $9.00). It covers tagging,
   OOTD analysis, the stylist and translate. Check before switching:
   - tagging JSON still passes `sanitizeTags` on ~20 real items;
   - OOTD analysis pieces/style on ~10 real looks;
   - the four-persona stylist check on one closet.
2. **`imageTryon`: `gemini-3.1-flash-image` → `gemini-nano-banana-2.1`
   @1K.** Half the price ($0.067 → $0.0336) on a newer model whose stated gain
   is character consistency. That is exactly try-on's job, but identity
   preservation is the product, so run `test-tryon-ab.js` on real identity
   photos (face, body, headwear, limbs) before switching.
3. **`imageCrop`: keep `gemini-3.1-flash-lite-image`.** Nano Banana 2.1 costs
   the same @1K, so switch only if an A/B shows better fidelity (e.g. shoe
   type and construction, layered garments) without slower crops.
4. **Translate stays on `vision`.** It's on-demand and cached, so a separate
   Lite key isn't worth it.
5. **Marketing video: replace the Veo preview with `gemini-omni-1.1-flash`**
   (GA) before the next reel, after a quality check against the Veo reel
   rules (4K 9:16, no uncanny synthetic faces).

Estimated effect at today's volume: text is already small, so (1) is mostly
"newer at half price"; (2) halves the largest per-call cost.

## A/B results — 2026-10-09

Run with `functions/test-model-ab.js`, which drives the real production
functions with writes blocked. Data: 10 items (with production focus), 5
OOTDs, 4 stylist personas on one closet, and 3 try-ons on one identity photo.
The report is at `.crop-ab/model-ab/2026-10-09-merged/report.html`
(gitignored, holds personal photos).

| Job | A (current) | B (candidate) | Avg time A → B | Verdict |
|---|---|---|---|---|
| vision (tagging, OOTD analysis, stylist) | `gemini-3.5-flash` | `gemini-3.8-flash` | OOTD 7.2 → 12.5s · chat 22.8 → 32.2s* | **Switch.** Same or better quality (OOTD pieces slightly more complete; four personas stay distinct), −50% / −58% price. Cost: 30–80% slower replies |
| imageCrop | `gemini-3.1-flash-lite-image` | `gemini-nano-banana-2.1` | 4.5 → 12.5s | **Keep A.** Similar quality at the same price, B is 2.7× slower and dropped the loafers' penny strap |
| imageTryon | `gemini-3.1-flash-image` | `gemini-nano-banana-2.1` | 9.8 → 18.8s | **Hold.** B's face is slightly closer, but in 1/3 it kept the identity photo's background (café table) and seated pose. 2× slower. Re-test with a background-normalising prompt before switching |

\* Chat times are inflated on both sides: with writes blocked, the style
profile was rebuilt on every call.

## How to switch / roll back

/admin → Config → models. Set `vision`, `imageCrop` or `imageTryon` (and
`imageCropSize` / `imageTryonSize`, 1K/2K/4K). The id is validated against
`MODEL_RE`, so a typo falls back to the default. It takes effect within about
5 minutes, with no deploy. Rolling back is the same edit with the old id.
