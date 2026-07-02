# Cost notes — Gemini image generation

Running record of what drives the Google Cloud / Gemini bill and the decisions we've made about it. The dominant variable cost is **Gemini image generation**; everything else (Firestore, Storage, Functions invocations, Flash text/vision) is small at our scale.

---

## The June 2026 spike — what happened

June GCP total ≈ **$244** (+790% vs May). Gemini API alone ≈ **$217**, and within that the single expensive SKU was **"Generate_content image output token count for Gemini 3 Pro Image" ≈ $180**.

Root-caused with data + code + pricing:

- Only **two** operations generate images, both on `gemini-3-pro-image` (Nano Banana Pro):
  1. **Item-registration crop** (`functions/items.js` `processItem`) — reshapes + crops each uploaded photo into a clean catalog cutout. **595 images in June.**
  2. **Try-on** (`functions/tryon.js` `virtualTryOn`) — the identity-preserving render. **107 images in June.**
- Everything else is cheap/free: tagging, OOTD/generation analysis, moderation, translation, outfit-ref face-blur all use **`gemini-3.5-flash`** (text/vision, not image output); background removal for identity refs + OOTD photos uses **`@imgly/background-removal-node`** (local, $0).
- **Root cause of the spike:** neither image call passed an output-resolution config, so the model defaulted to **4K** ($0.24/image). 702 images × $0.24 ≈ $168 ≈ the observed SKU. So we were paying the top resolution tier for phone-sized thumbnails.

### Item volume was REAL users, not seed/test
June items by bucket: **real 507 / dev 88 / seed 0**. The late-June spike (6/29 = 141, 6/30 = 259) was **real users**, not our test data. So image cost scales with real adoption — it's structural, not a one-off. (The dev 88 was early-June bulk testing.)

Per-op cost driver: item crop = 1 image each; try-on = 1 image per variant (default **1** variant, `n = variants ?? 1`). No hidden multipliers (regenerate = a fresh user-initiated call; no auto-retry loops).

---

## Gemini 3 Pro Image pricing (official, 2026)

| Mode | 1K / 2K | 4K |
|---|---|---|
| **Standard** | **$0.134** | $0.24 |
| Batch / Flex | $0.067 | $0.12 |

- **1K and 2K cost the same** ($0.134, ~1120 output tokens); 4K ≈ 2000 tokens = $0.24. So there's no point going below 2K.
- **Flex** = 50% off, synchronous, but latency **1–15 min (no guarantee)**. **Batch** = 50% off, async, up to 24h.
- **Gemini 2.5 Flash Image** (Nano Banana, non-Pro) = **$0.039/image** — 71% cheaper than Pro 2K, but a different (cheaper-quality) model.

---

## Decision & change — 4K → 2K (shipped 2026-07-01)

**Force 2K output on both image calls.** 4K→2K ≈ **44% off the image-output cost** (~$168→~$94 at June volume; scales with adoption), **zero quality loss** for the phone UI (closet thumbnails are small; try-on is displayed at 900×1200; item crop reshaping is identical — only pixel count drops).

Implementation:
- The old SDK `@google/generative-ai@0.21` **cannot** set output resolution. So the two image-gen calls now use **`@google/genai`** with `config: { imageConfig: { imageSize: '2K' } }`. Flash text/vision calls stay on the old SDK (two SDKs coexist).
- Files: `functions/items.js` (crop), `functions/tryon.js` (try-on), `functions/test-item-pipeline.js` (test rig, matched). Response parsing unchanged (`extractImage` reads `candidates[0].content.parts`).
- **Server-only** — reaches web + iOS + Android immediately on `firebase deploy --only functions`; no app build, no store review.
- Verified live: try-on logs show output tokens ~1270 (2K tier) vs ~2000 (4K). Token logging added: `crop image tokens:` / `tryon image tokens:` in the two functions.

### Options considered and rejected (for the crop)
- **Free @imgly instead of Pro crop** — rejected: the crop is one Pro call doing **reshape (lay-flat → front-on, one-shoe → a pair) + cutout**; @imgly only segments (pixel-preserving cutout), can't reshape.
- **Cheaper Gemini image model** — no cheaper Pro tier; Flash image mangled silhouettes previously (pants→shorts, per `items.js` comment).
- **Flex/Batch (another 50%)** — 1–15 min (Flex) / up to 24h (Batch) latency; too slow for the register-and-see-the-crop UX and for interactive try-on.

---

## Adopted / done

- **Item crop → `gemini-3.1-flash-lite-image` @1K (2026-07-02).** Was Pro 3 @2K
  ($0.134/img). A/B on 7 real photos (bunched khaki pants, single-shoe pair, long
  sleeves, white-on-white tee, washed cap) across Pro / Flash-3.1 / Flash-Lite ×
  1K/2K × prod/boosted prompts. Findings: **Lite @1K matches or beats Pro** for our
  needs — no pants→shorts, no sleeve crop, shoes render as a pair; Pro even lost on
  a couple (shifted black→olive, left garment on a sheet, rendered items small).
  Pro's extra wrinkle detail is more than a phone thumbnail needs. Measured
  **~$0.041/img (−72%)** and **~3x faster** (3–8s vs 21–27s → shorter "processing"
  state). 1K is invisible vs 2K on-device and halves stored size. Prompt gained
  explicit hard constraints (hem/sleeve length, piece count, shoe pair, fill frame).
  Try-on stays Pro (identity preservation). Test rig: scratchpad `flash-test/compare.js`.

- **Try-on → `gemini-3.1-flash-image` @1K (2026-07-02).** Was Pro 3 @2K
  ($0.150/img measured). A/B on 4 real men's outfit-ref looks (identity photo +
  public OOTD) across Pro / Flash-3.1 / Flash-Lite: **Flash-3.1 matched Pro** on
  identity (face/body) + outfit fidelity; Lite showed occasional face artifacts
  (dropped). Output is **1K** (not 2K) because the result is normalized to 900×1200
  downstream — 2K is just downscaled away; same model, only the canvas differs.
  Measured **~$0.08/img (−~47%)** and **~2-3x faster (25s→8s)** — win is mostly
  speed/UX (try-on volume ~107/Jun). Extra-limb artifacts (a draped jacket merging
  into the legs) appear on BOTH Pro and Flash (outfit-dependent); fixed with an
  `ANATOMY_GUARD` appended to every try-on prompt. Also fixed headwear transfer:
  the source-face blur now uses the tight `fdBoundingPoly` with minimal, no-upward
  padding so caps/hats stay visible (the old loose box erased them). Single fixed
  model, no user selector. Rig: `test-tryon-ab.js`.

## Deferred levers (revisit as adoption / cost grows)

- **Try-on daily quota + credits + invite rewards.** Cap free try-ons (~5/day), sell/earn credits (e.g. +20 per invite). NOTE: credits/IAP were deliberately **removed** (commit `7f91e98`); reintroduction is greenfield — server-only `credits` field + per-day quota (current `checkRateLimit` is per-minute only) + invite attribution + IAP (RevenueCat/StoreKit/Play Billing + store re-review; app currently declares "no IAP"). **User deferred this ("나중").**
- **Batch tier for the item crop.** Crop is already background — Flash-Lite batch (−50% again, ~$0.017/img) would halve item cost once more if a 1–15 min "pretty crop appears late" processing window is acceptable.
- **Skip Pro when the source is already clean.** Retailer/wishlist photos are often already front-on catalog shots; a cheap Flash classify → @imgly cutout for those, Pro reshape only for worn/messy photos.

## Purpose-built APIs vs Gemini (cheaper + often more reliable)

Where a task is a narrow, well-defined vision problem, a purpose-built Google API
beats asking a Gemini LLM — cheaper, more reliable, and it reuses the same GCP
project (service-account/ADC auth, no key). Rule of thumb: **LLM only when the
task needs the fashion taxonomy / free-text reasoning; otherwise a dedicated API.**

- **DONE — outfit-ref face detection → Cloud Vision `FACE_DETECTION`** (2026-07-01).
  Flash returned unreliable bounding boxes (silent `{x:null}` on clear faces → face
  leak). Cloud Vision is a real detector. ~free (1000/mo), only on outfit-ref.
- **CANDIDATE — image moderation → Cloud Vision `SAFE_SEARCH_DETECTION`.**
  `functions/moderation.js` `runSfwCheck` currently asks `gemini-3.5-flash`
  SAFE/UNSAFE on a listing's cover image. SafeSearch is purpose-built NSFW scoring
  (adult/violence/racy/…), cheaper + more reliable, same free tier, runs only on
  listing. Map LIKELY/VERY_LIKELY → unsafe. (Text moderation — captions/prompts —
  stays: `checkCustomCommand` keyword list + LLM if needed.)
- **KEEP on Gemini (needs the LLM):** item **tagging** (closed fashion taxonomy:
  category/subcategory/colors/seasons/styles/fit/brand/description — Vision only
  gives generic labels) and OOTD/generation **analysis** (style/notes/pieces).
  Already the cheap Flash tier. Dominant colors *could* come from Vision
  `IMAGE_PROPERTIES` but not worth splitting.
- **MARGINAL — translation → Cloud Translation API** (cheaper per char) but it's
  on-demand + cached, so it rarely runs; low priority.
- **Image generation** (item crop, try-on) has no cheaper same-quality option; the
  only lever is the Flash-image-model quality test (see Deferred levers).

## Monitoring

After a change, watch the GCP billing report → Gemini API → SKU "Generate_content image output token count for Gemini 3 Pro Image" for 2–3 days; per-image output cost should drop to the 2K tier. Function logs (`crop image tokens` / `tryon image tokens`) show per-call output tokens (~1120 = 2K, ~2000 = 4K).
