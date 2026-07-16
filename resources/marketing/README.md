# drape marketing ops

Living doc for marketing asset production + the publishing pipeline. Keep this current
whenever kits are added or the pipeline changes (same spirit as CHANGELOG.md).

## Account strategy (decided 2026-07)

- **One Instagram account: @drape.nyc.** No per-language accounts — followers/engagement
  would fragment and every account would look dead to the algorithm.
- **Organic grid = English only.** NYC-brand reads as premium in KR/JP; photo-led cards
  (D/E/J) carry Explore reach regardless of language.
- **Captions = English** (hashtag pool may include KR/JP tags for search reach).
- **KO/JA creatives exist only as dark-post ads** — country-targeted in Meta Ads Manager,
  never on the grid. Ad copy in the local language (CTR reasons).
- Split a @drape.jp only if/when Japan shows real traction.

## Kits

| Kit | Contents |
|---|---|
| `2026-07/` | Launch kit. `en/` feed set A–J (1080×1350), `ads-ko/` + `ads-ja/` dark-post variants (D/E/G/I/J), `captions.md`, `src/` templates |

## Design tokens (ads must match the app brand)

- Ink `#141312`, paper `#f5f1ea`, text-ivory `#f2ede4`, muted `#8a857d`
- Headlines: Didot italic (EN). KO: Apple SD Gothic Neo bold. JA: Hiragino Sans.
- Eyebrow/labels: Helvetica Neue caps, 10px, letter-spacing 4px, muted
- Every card: wordmark `drape` (Didot italic) bottom-left + caps CTA bottom-right,
  radius 10–12px, padding 44/40/36
- User-facing term is **try-on / 트라이온 / AI試着** — "fit(s)" is internal-only vocab

## How images are made (repeatable)

1. Cards are plain HTML at 540×675 CSS px in `<kit>/src/card-*.html`.
2. Render at 2× via gstack browse: `viewport 540x675 --scale 2` → `goto file://…` →
   `screenshot --viewport` = 1080×1350 PNG. (Fonts are macOS system fonts — render on a Mac.)
3. Photo material:
   - Seed personas' outfit photos + amy's closet items / try-on results, pulled straight
     from Firestore/Storage: `src/fetch-seed.cjs` (schema dump), `src/dl-seed.cjs`
     (downloads; uses ADC against drape-9e532). Seed accounts are ours — free to use.
   - Item crops from `.crop-ab/out` (local only, gitignored).
   - Generated model shots via `src/gen-model.cjs` — same Gemini image model as the app
     (`gemini-3.1-flash-image`, key from `.env` `VITE_GEMINI_API_KEY_DEV`), garment-detail
     preservation prompt.
4. Sanity-check contact sheets before shipping; IG compression eats Didot hairlines below 2×.

## Publishing pipeline (Cloud Functions) — LIVE

**Fully live since 2026-07-16.** `/admin` → Marketing tab manages the queue
(create/edit/delete, creative picker, status filter). `functions/marketing.js`:
admin callables + `publishMarketingPosts` (onSchedule 15 min; queued docs whose
scheduledAt passed → IG Graph `me/media` → `me/media_publish`) +
`refreshMarketingTokens` (weekly; 60-day tokens never expire in practice).
Kit creatives are public Storage objects under `marketing/2026-07/`
(`scripts/upload-marketing-assets.cjs`) — same URLs feed the picker and the IG API.

Tokens live in the admin-only `marketingConfig/tokens` doc (NOT deploy-time
secrets — the weekly refresher rotates them in place). Seed/rotate with
`scripts/seed-marketing-tokens.cjs --from-file=<json>` (file outside the repo,
delete after). IG token from the Meta app "drape" (app id 963836626700601,
use case *Manage messaging & content on Instagram*, @drape.nyc added as
Instagram Tester; app stays in dev mode — no App Review needed for own-account
publishing). The publisher's queue query needs the `marketingPosts`
(status, scheduledAt) composite index — in firestore.indexes.json.

**Threads:** API use case exists on the app but token setup was abandoned for
now (organic Threads posting off). Threads *ads* don't need it — they're a
placement checkbox in Ads Manager.

Local machines can't stay on; the scheduler lives in Functions:

```
Firestore `marketingPosts` queue          functions/marketing.js
{ scheduledAt, imageUrl, caption,   →     onSchedule("every 15 minutes"):
  targets: [instagram|threads],            pick due+status=queued docs →
  status: queued|published|failed,         IG Graph API (create container → publish)
  results: {…} }                           + Threads API → mark status/results
```

- **Images** need public URLs → deploy kit PNGs under Firebase Hosting (`/marketing/…`)
  or a public Storage path.
- **Tokens** in Firebase Secrets: `META_IG_TOKEN`, `META_IG_USER_ID`, `THREADS_TOKEN`
  (long-lived; refresh flow TBD when built).
- Queue writes stay admin-only (rules deny client access, same pattern as `adminStats`).

### One-time setup (owner TODO — blocks the build)

1. [ ] @drape.nyc → Professional account (Settings → account type, free)
2. [ ] Create a Facebook Page and link it to the IG account
3. [ ] developers.facebook.com → create app → Instagram Graph API →
       long-lived token with `instagram_content_publish` (+ note the IG user id)
4. [ ] Same app → Threads use case → token with `threads_content_publish`
5. [ ] Hand tokens over → they go into Firebase Secrets, then the function gets built

## Posting cadence (decided 2026-07-16; owner is in New York — schedule in ET)

Mon/Wed/Fri, US-first timing, alternating two windows for 3 weeks then keep the
insights winner: **A** 12:00pm ET (US lunch peak) / **B** 7:30pm ET (US evening
prime; doubles as 8:30am KST/JST commute). Launch queue: 10 EN posts, first one
Thu 7/16 7:30pm ET, then Fri 7/17 noon → Mon/Wed/Fri through 8/5 (order
D F B E H A J G I C). Visible/editable in /admin → Marketing.

Paid ads are separate from this queue: boost published posts in-app, or run
country-targeted dark posts in Ads Manager (`ads-ko/`, `ads-ja/` creatives;
objective "App promotion"; Threads placement via checkbox).

## Reference genres (competitor ad patterns, analyzed 2026-07)

CozyLook / Array Closet / Verifyt / DressYou IG ads boil down to four genres we cover:
big-serif dark archive grid (A/G), item→worn try-on split (B), full-bleed UGC with app
chrome (D/J), bold-type + phone mockup (H/I). The OOTD-calendar card (F) is ours alone —
no competitor has the feature; lean on it.
