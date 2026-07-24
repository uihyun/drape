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

## Launch plan & checkpoint (as of 2026-07-16)

**Live queue (rebalanced 2026-07-22, runs 7/16–8/12):** dense grid-filling week
first (daily through 7/25), then deliberately thinned to 3–4/week with rest
days: swap4 7/27 → A 7/29 → howto 7/31 → J 8/2 → swap8 8/4 → G 8/6 → inspo 8/8
→ I 8/10 → C 8/12. The earlier daily density was an accident of adding swap
reels, not design — daily-then-silent is the worst pattern, so the tail was
stretched (+1 week runway) instead. 12pm ⇄ 7:30pm ET alternation preserved for
the window A/B.

**No hashtags AND no captions** on organic posts (decided 2026-07-21 — captions
read as clutter; the creative carries everything). Queue docs get `caption: ''`
(written via admin SDK; the admin-UI upsert still requires text, so blank
captions are seeded by script for now).

**Checkpoint Mon Aug 3** (moved from 7/28 — by 8/2 there are 7 images + 6 reels
out, enough sample on all three axes). Review per-post insights: saves +
profile visits + follows (ignore likes); reels: 3-sec retention + non-follower
reach share; noon-vs-evening window winner (unify batch 2 timing); concept axis
(swap series vs feature demos vs type cards). Batch 2 = 60% variations of
winners + 40% new bets (marketplace/DM angles, fall closet, new persona mixes —
~40 unused seed photos + the crop pipeline make production ~free). Settle at
3/week from 8/13. Insights pull: screenshots, or IG media-insights API if the
token carries instagram_business_manage_insights.

**Reels library** (`2026-07/reels/`, all 1080×1920, music baked in — silent
masters in `reels/silent/`): ootd (montage), howto (snap→catalogued), week
(jisu weekly), features (3-feature demo), tryon (Veo backup, unpublished),
swap3/4/8 (closet-swap split-wipe series; swap5/6/7 retired/superseded),
inspo (SHIIR-style hard-cut editorial: "The inspiration" sources → "The result"
try-ons, 1.3s cuts — reference reel instagram.com/reels/DXrxPZCjpDv).

**Reel production lessons (2026-07-21):**
- Try-on composites: `src/gen-tryon.cjs`. Direct mode (identity + outfit photo)
  leaks the source scene/person ~40% of the time — the reliable path is
  two-step: crop items from the source (`gen-crop.cjs`, app's crop prompt) →
  dress the identity with the catalog crops.
- Pick source outfits VISUALLY DISTINCT from the wearer's own (pink dress →
  pink dress reads as "nothing changed").
- Square/portrait source for a full-bleed 9:16 slot → regenerate with
  `AR=9:16` env on gen-tryon (Gemini aspectRatio) for full-body framing;
  cover-crop makes faces huge.
- Organic reels can't carry a tappable link (IG policy) — outros bake the
  visible URL instead: pill text is DRAPE.NYC, not "get the app". Clickable
  paths are the bio link, story reshares with a link sticker, and boosted
  reels (real CTA button).
- Always cache-bust `<img>` srcs (?v=N) and restart the browse daemon before
  re-rendering an edited reel — stale image cache shipped a wrong cut once.
- Safety blocks on try-on prompts: reword to e-commerce framing and retry.

**Music:** Mixkit tracks (Mixkit License — commercial OK, NO attribution):
swap/inspo = Hazy After Hours / Cat Walk (house), features = Autofahren,
howto = Deep Urban, week = New York, ootd = Cat Walk. mp3s not in repo —
re-download from mixkit.co; bake with ffmpeg (afade + loudnorm, see git log).
Kevin MacLeod (CC BY) was tried first and rejected — attribution line in the
caption was the dealbreaker. IG trending audio remains app-upload-only.

## Analytics snapshot (2026-07-22 — GA property 538664894 + Firebase Auth)

**Access:** GA Data API via service account `ga-reader@drape-9e532.iam.gserviceaccount.com`
(Viewer on the property; token minted by impersonation — `scripts`-free, see
scratchpad ga-report pattern; gcloud needs `CLOUDSDK_PYTHON=python3.11`).

**Where users actually spend time (30d, engagement seconds):** profile_closet
58.5k · profile_tryon 12.4k · item 9.3k · tryon 4.5k · profile 2.3k — vs
**feed 1.7k**. The product IS the closet + try-on; the feed barely registers
(it only shows seed content today). → default home moved to profile.

**Funnel (30d):** ~850 landing visitors (IG campaign works as top-of-funnel)
→ 73 first_open in 90d (~8.5% visitor→install-open) → 29 real signups/30d
(20 Google / 9 Apple) → but only ~7 users ever added an item, ~9 ran a try-on.
**The leak is activation, not acquisition.** Post-signup first-run experience
is the highest-leverage fix (e.g. force the "snap your outfit → items appear"
moment in onboarding).

**Platform:** real usage is iOS (187k engagement-sec vs Android 2.7k, web 3.3k
— web is landing bounce). first_open spike 6/29–7/3 (launch), 1–3/day since.

**Admin additions:** Overview now has an **Activation funnel** row (real users:
signed up → added item → try-on → OOTD → outfit, with %) — the seed/dev split
GA can't do. Everything time-on-screen stays in GA (Reports → Engagement →
Pages and screens; screen names: feed, profile, profile_closet, …).

**Note:** `home_pref` user property is logged but NOT registered as a GA custom
dimension — register it in GA Admin → Custom definitions to query retention by
landing surface.

## Reference genres (competitor ad patterns, analyzed 2026-07)

CozyLook / Array Closet / Verifyt / DressYou IG ads boil down to four genres we cover:
big-serif dark archive grid (A/G), item→worn try-on split (B), full-bleed UGC with app
chrome (D/J), bold-type + phone mockup (H/I). The OOTD-calendar card (F) is ours alone —
no competitor has the feature; lean on it.
