# Changelog

Internal release notes for drape — the detailed record (store-facing copy is
shorter; this is the full picture). Newest first.

Conventions:
- **Web** ships continuously to drape-9e532.web.app / drape.nyc on every change.
- **Native** (iOS/Android) ships per version below. A web-only fix lands in the
  next native build, so a change can be live on web before it reaches the apps.
- Versions track `versionName` (display) + `versionCode`/iOS build number.

---

## Unreleased (web live)

### Admin: Marketing tab — IG/Threads post queue

- New `/admin` **Marketing** tab: schedule Instagram/Threads posts into the
  `marketingPosts` Firestore queue — creative picker (Storage-hosted kit
  thumbnails or any https URL), caption editor (2200 cap), per-target chips,
  local-time scheduling, edit/delete for anything not yet published.
- `functions/marketing.js`: admin-gated callables `adminMarketingList` /
  `adminMarketingUpsert` / `adminMarketingDelete` / `adminMarketingAssets`
  (reuses `assertAdmin` from admin.js — roster stays single-source).
  Published posts are immutable (audit trail); clients never touch the
  collection (default-deny rules).
- `scripts/upload-marketing-assets.cjs`: uploads `resources/marketing/<kit>`
  creatives to Storage as public objects — needed by both the picker and the
  IG Graph API (which ingests by public URL). 2026-07 kit (20 PNGs) uploaded.
- **Publisher live (2026-07-16)**: `publishMarketingPosts` (every 15 min)
  publishes due queued posts via IG Graph (`me/media` → `me/media_publish`);
  `refreshMarketingTokens` (weekly) keeps the 60-day tokens fresh. Tokens in
  admin-only `marketingConfig/tokens` (seeded by
  `scripts/seed-marketing-tokens.cjs --from-file`); required composite index
  (marketingPosts: status + scheduledAt) added to firestore.indexes.json —
  without it every publisher run failed FAILED_PRECONDITION. Threads target
  parked (no token yet); Threads ads are an Ads Manager placement, not API.
- Marketing tab: status filter (all/queued/published/failed), reel/post kind
  chips, video thumbnails. Launch queue: 10 EN image posts Mon/Wed/Fri + 8
  Reels (feature demos + closet-swap try-on series + SHIIR-style inspo edit),
  7/16–8/5. Reels support in the publisher: REELS container + status polling.
  Org decisions: no hashtags, then no captions at all; Mixkit music baked into
  reels (IG trending audio is app-only, CC-BY tracks rejected over credit line).
- Marketing asset kit + ops doc live under `resources/marketing/` (2026-07
  launch kit: EN feed set A–J, KO/JA dark-post variants, captions, HTML
  templates + rebuild scripts).

## 1.4.0 — native build (versionCode 16 / iOS build 13)

Minor bump (not 1.3.1) — the try-on quota + invite rewards are a feature
addition, not a fix. (User-facing name is **try-on**; the `fit*` code
identifiers below are internal field/module names only.) Web/functions live now;
the client-side items reach iOS/Android with this build.

- **2026-07-07 · Fix: try-on returned a contact-sheet of several people instead of
  one.** The image model intermittently rendered a horizontal strip of ~4–6 tiny
  figures in a single frame (seen on a 3-item multi-select try-on). Reproduced it and
  confirmed the failure is **stochastic** — it fires regardless of output resolution
  (1K/2K) or prompt wording (the `ANATOMY_GUARD` didn't prevent it), so no prompt/size
  tweak fixes it reliably. Real fix in `functions/tryon.js`: **detect + regenerate.**
  A single full-body figure segments to a tall, narrow mask (aspect w/h ~0.3–0.7); a
  contact-sheet spans wide (~2.7). The no-scene normalize path already segments the
  output, so we reuse that mask's bounding box — if `w/h > 0.9` it's a grid, and the
  variant is regenerated (up to 3 tries). Clean single-figure results break out on the
  first pass, so normal runs pay no extra latency. Detection is **free** — it reuses the
  segmentation the no-scene path already runs (local onnx model, not a paid API) plus
  pixel math; only the regenerate call costs anything. Verified: A/B/C singles pass
  (0.33/0.72/0.31), the grid case is caught (2.74). Refactored the alpha-bbox scan out
  of `figureOnWhiteCard` into a shared `alphaBBox` helper. Also strengthened
  `ANATOMY_GUARD` with a blunt "ONE frame, ONE person — never a grid/collage/repeated
  poses; if about to add a second figure, STOP" clause to lower the grid rate at the
  source (fewer regenerates).
- **2026-07-07 · Try-on meter: daily-only ring + bonus pill.** The original ring showed
  the daily bucket only, so `0/5 +10` looked empty. A total-fill version (capacity =
  dailyMax + bonus) fixed the empty look but drained unevenly — spending bonus shrinks
  the denominator, so each try-on removed a different slice (a gauge on a moving scale
  is wrong). Final model splits the two by their nature: the **ring is the daily
  allowance on a fixed 5-slot scale** (each try-on = 1/5, resets at midnight — a real
  gauge), and the **bonus is a persistent balance shown as a soft-green `+M` pill**
  (`--accent-soft`/`--accent`), not gauged (it can reach the hundreds). Spend order is
  daily→bonus, so the ring fully drains 5→0 before the pill counts down — they never
  move at once. Empty ring + a prominent `+M` pill reads honestly as "daily done, N in
  reserve". Removed the unused `--fits-bonus` gold token.
- **2026-07-07 · Invite reward is now two-sided (+10 each).** Phase 1 credited only
  the inviter, which made the share copy read as a bare favor ("enter my code so I get
  10"). Changed `redeemInvite` to also credit the **invitee** +10 (once ever, gated by
  the existing `invitedBy` guard; the per-inviter `INVITE_CAP` still bounds the inviter
  side against abuse). Copy across en/ko/ja now states both sides get 10 ("we both get
  10 bonus try-ons", `inviteShareCode`/`inviteRedeemed`/`inviteEarnFits`/`fitsOutBody`).
- **2026-07-07 · Fix: invite share text was missing the code.** Users who signed in
  before the try-on quota rollout never hit the `initializeUser` bootstrap, so their
  `inviteCode` was never minted and the share sheet dropped it. Added a `getInviteCode`
  onCall (mints on demand, idempotent) + `useFits` lazily backfills it when the user
  doc lacks one. `FitsService.getInviteCode`.
- **2026-07-07 · Try-on quota — daily allowance + invite rewards (Phase 1).** Try-on
  was unlimited; introduced a soft economy. **5 free try-ons/day**, reset at the user's
  local midnight (non-accumulating), plus **+10 bonus try-ons to the INVITER** when
  someone redeems their invite code. Bonus try-ons persist, spent only after the daily 5. Server-authoritative: new `functions/fits.js`
  (`reserveFit` in a txn before generation, `refundFit` if every variant fails so a
  failed try-on costs nothing, `ensureInviteCode`, `redeemInvite` onCall with self/
  dupe/cap guards). Fields (`fitDayKey/fitDailyUsed/fitBonus/invitedBy/inviteCode/
  inviteCount`) live on `users/{uid}` and are added to the firestore.rules deny lists
  (client reads for display, can never write); `inviteCodes/{code}` reverse index is
  server-only. Client: `useFits` hook, TryOn gate + out-of-try-ons modal ("invite
  friends → +10"), Settings invite code share + "enter invite code". User-facing name is
  **try-on** ("N/5" ring + bonus pill); an earlier "fit" name was dropped. en/ko/ja.
  Server + web live; the UI reaches
  native in 1.4.0. (Phase 2 = free auto-attribution: deep-link/install-referrer/
  clipboard. IAP purchase deferred.)
- **2026-07-07 · Fix: focus crop pulled the wrong garment on multi-item photos.**
  Detect-adding a specific piece from a worn look (e.g. a "Cream scoop tank" under
  an open cardigan) sometimes cropped the wrong, more-visible layer (the cardigan).
  Root cause: the item NAME held the descriptor but `tags.description` was empty,
  and `focus` passed only the empty description — so the crop prompt saw just
  "Extract ONLY the top." with no color/neckline to separate a tank from a
  cardigan, and the model grabbed the dominant layer ~half the time. Fix (NO model
  change — stays on Flash-Lite): `focusDescriptor(name, description)` in
  `item-service.js` combines both (deduped) into `focus.description` across
  `createFromDetected` / `createFromDetectedExistingPhoto` / `reprocessItem`; and
  `items.js`'s focus clause was strengthened (lead with the description, warn the
  target may be hidden under other layers, forbid returning a more-visible layer,
  require sleeveless→sleeveless). Verified on the real failing photo: the shipped
  Lite config now returns the tank 4/4 (was 1/2 cardigan). This case was the gap
  the original Flash-Lite crop A/B missed (it only tested single clean garments).
  Server + web live; client bits reach native on the next build.
- **2026-07-06 · Fix: other people's profiles now match your own — auto-hiding
  tabs + clean notch.** On a public profile (`/u/:handle`, `.profile--sub`) the
  section tabs (Outfits / Calendar / Boards) sat fixed and content peeked through
  the notch, unlike your own profile. Two causes: the `useHideOnScroll` hook was
  never wired on PublicProfile's tab row, and the `::before` notch filler was
  excluded from `.profile--sub` on the wrong assumption that the (transparent)
  `.page-back-bar` covered the notch. Fixes: added `useHideOnScroll({upThreshold:
  130})` to PublicProfile (same params as Profile), and applied the notch filler
  to all `.profile` (it's `position:fixed`, so no doubled top gap; sits at z-7,
  below the back button at z-50). Behavior is now shared via one hook + one CSS
  rule; covers Outfits, Boards, and Calendar identically. Client-only.
- **2026-07-06 · Admin: boards column in the per-user table.** `counts.board` was
  already computed server-side but never rendered; added the header + cell (between
  OOTD and try-ons). Admin is web-only.

## 1.3.0 (Android versionCode 15 · iOS build 12) — RELEASED 2026-07-05

Headline: the **in-app notification center on the profile bell** + unified,
localized push (details below). This build also carries the 1.2.2 native-only
fixes that never shipped natively on their own — **native analytics actually
recording** (the `FirebaseAnalytics.then` no-op fix) and the **stuck-try-on
retry UI** — folded in here.

- **2026-07-02 · In-app notification center on the profile bell + unified push.**
  The 🔔 bell was a dead placeholder; it now opens `/notifications` — an activity
  list (comments, follows, try-ons, likes, and moderation notices) with an unread
  dot on the bell (`useUnreadNotifications`). Notifications live at
  `notifications/{uid}/items/{id}` (server-write only; owner read / mark-read /
  delete via firestore.rules). Server writes work for all users immediately; the
  bell UI + deep-link routing reach native on the next app build.
  - **Push + bell are unified** (Instagram-style): every event that drops a bell
    row also sends a push, centralized in `functions/notifications.js`
    (`notify`/`notifyLike`/`notifySystem` each write the doc AND call
    `sendToUser`). The separate like/try-on push code was removed from
    `social-push.js` to avoid double-firing. Comments and follows — previously
    bell-only — now push too.
  - **Likes collapse to one row/push per post** (`notifyLike`, deterministic doc
    id `like_${targetType}_${targetId}`): latest liker + "and N others", re-marked
    unread and bumped on each new like, so a burst doesn't flood. Works for both
    **outfits and boards** (`onOutfitLiked` + new `onBoardLiked`).
  - **Moderation notice** (`notifySystem`): when `onOutfitListed` auto-unlists a
    cover flagged by SafeSearch, the owner gets a no-actor system notification
    ("Your look was hidden…") + push explaining why.
  - **Copy is target-aware**: notifications distinguish look/outfit vs board
    ("liked your look" vs "liked your board") rather than a generic "post". New
    locale keys in en/ko/ja. **Push is localized too** — the recipient's
    `profiles/{uid}.lang` (same field the reminder push reads) picks the copy
    from a server-side table in `notifications.js`; the title is the actor name,
    so the body omits it. Deep-link routing generalized (`routeForNotification`
    now handles board/comment/follow targets).
  - **DM push localized** too: the image-only placeholder ("Photo") now renders
    per recipient (en/ko/ja) via the same `recipientLang`; text DMs already
    carried the sender's own words.
## 1.2.2 (Android versionCode 14 · iOS build 11) — superseded, folded into 1.3.0 (build 12); web parts live, never released natively on its own

Native-only fixes (native analytics recording via the `FirebaseAnalytics.then`
fix, stuck-try-on retry UI) plus the web changes below. The native build was cut
(versionCode 14 / build 11) but superseded by 1.3.0 before store release, so its
native fixes ride the 1.3.0 build. The web changes are already live.

- **2026-06-30 · Fix: board grid packed differently on iPhone vs desktop → JS masonry.**
  The board grid used CSS `columns` (multi-column) masonry. Multicol's default
  `column-fill: balance` distributes cards to equalize column heights, and that
  balancing is engine-dependent (WebKit ≠ Blink) — so the same boards packed
  differently on iPhone (Safari) than in the Chrome preview, leaving a floating
  gap on device. Replaced CSS `columns` with deterministic JS masonry: BoardList
  now assigns each board to the currently-shortest column (weight = ratio h/w),
  rendering explicit column divs (`.board-masonry` grid). Identical on every
  engine; keeps masonry look, per-board ratios, and the pinch column count.
  (Earlier same-day attempt swapped `aspect-ratio`→padding-top box on the cards —
  that was a misdiagnosis of the cause but is harmless and kept for card sizing.)
- **2026-06-30 · Swipe navigation on the try-on detail.** GenerationDetail now
  wires `useSwipeNavigate` + `SwipeHint` like OutfitDetail/ItemDetail/BoardDetail
  did — swipe the result hero left/right to move to the prev/next try-on in the
  list you came from. TryOnHistory cards pass the sibling ids via
  `buildSwipeState(..., 'tryon')` (the `tryon` route was already in SWIPE_ROUTES).
- **2026-06-30 · errorLogs now record the app version.** `logError` (ai-service)
  attaches `appVersion` — the native binary's `App.getInfo()` version+build (e.g.
  "1.2.2(11)") or "web". Surfaced in the admin Errors tab (`v… ·` prefix). Lets us
  tell which build an error came from — needed to confirm the native analytics fix
  actually landed (a 1.2.1 binary keeps erroring; a 1.2.2 binary shouldn't).

## Server / web — continuous (live for everyone; NO app version / build needed)

- **2026-07-02 · Fix: outfit-ref try-on now transfers headwear (caps/hats).** The
  source-face blur (Cloud Vision) used the loose `boundingPoly` + 18% padding in
  every direction, which for a hatted source **covered the whole hat** — so the
  model never saw it and dropped it (regression introduced when the blur became
  reliable; the old flaky Flash blur left hats visible). Now the blur uses the
  tight `fdBoundingPoly` (eyes-to-chin) with asymmetric padding — sides + down for
  the jaw, almost none upward — so a cap/hat stays visible and transfers, while the
  identity-bearing features (eyes/nose/mouth/jaw) are still neutralized. The
  outfit-ref prompt also gained an explicit "put the outfit photo's headwear on the
  identity person" line. Verified: red-cap source → cap now renders on the result
  across Pro/Flash, identity face intact. Model-agnostic (helps Pro too).
- **2026-07-02 · Try-on → Gemini 3.1 Flash @1K (−~47% cost, ~2-3× faster).** The
  virtual try-on (`virtualTryOn`) moved from `gemini-3-pro-image` @2K to
  `gemini-3.1-flash-image` @1K (`IMAGE_TRYON`). An A/B on 4 real men's outfit-ref
  looks (identity photo + public OOTD) showed Flash-3.1 matching Pro on identity
  (face/body) and outfit fidelity; Flash-Lite was dropped for occasional face
  artifacts. Output is **1K** because the result is normalized to 900×1200 anyway
  (2K would just be downscaled away) — same model, only the canvas differs.
  Measured ~$0.08 vs $0.150/img and ~8s vs ~25s — the win is mostly **speed/UX**
  (try-on volume is lower than item crop, so a few $/mo). Added an
  `ANATOMY_GUARD` to every try-on prompt: the image model sometimes fuses a draped
  garment into the legs (reads as extra limbs) — happens on Pro too, outfit-
  dependent — and the guard fixed it (Flash @2K 4/4 clean with it, 1/4 broken
  without). Still a single fixed model, no user-facing tier selector. Server-only.
  See `docs/COST.md`.
- **2026-07-02 · Item crop → Gemini 3.1 Flash-Lite @1K (−72% cost, ~3× faster).**
  The garment catalog crop (`processItem`) moved from `gemini-3-pro-image` @2K
  ($0.134/img) to `gemini-3.1-flash-lite-image` @1K (~$0.041/img). Decided by an
  A/B on 7 real photos (bunched khaki pants, single-shoe pair, long-sleeve bomber
  + shirt, white-on-white tee, washed cap) across Pro / Flash-3.1 / Flash-Lite ×
  1K/2K × prod/boosted prompts. Flash-Lite @1K matched or beat Pro for our needs:
  no pants→shorts, no sleeve cropping, shoes render as a matched pair; Pro actually
  lost a few (shifted black→olive, left a garment on a bedsheet, rendered items
  small). Pro's extra wrinkle detail is more than a phone thumbnail needs. 1K is
  invisible vs 2K on-device and halves stored size; latency dropped from ~21–27s to
  ~3–8s (shorter "processing" state). The crop prompt gained explicit hard
  constraints (hem/sleeve length, piece count, shoe pair, fill-frame). **Try-on
  stays Pro** (identity preservation). Server-only — reaches all platforms on
  deploy, no app build. See `docs/COST.md`.
- **2026-07-02 · In-app notification center — server writes live now.** The
  notification docs, unified push, per-post like batching (outfits + boards),
  moderation notices, and locale-aware push/DM copy all ship server-side and are
  live for everyone immediately; the bell UI + deep-link routing land natively in
  1.3.0. Full detail under the 1.3.0 section above (single source of truth).

- **2026-07-01 · Fix: outfit-ref try-on leaked the source person's face → Cloud
  Vision.** In outfit-ref mode the result kept the source face instead of the
  user's. `blurOutfitFace` asked `gemini-3.5-flash` for the face bounding box, but
  Flash repeatedly returned `{x:null}` on clearly-visible faces (confirmed in
  logs) → source passed UNBLURRED → the model copied its face. Flash's bbox output
  is inherently unreliable and prompt-tuning didn't help. Replaced it with **Google
  Cloud Vision `FACE_DETECTION`** (`@google-cloud/vision`, service-account/ADC auth
  — no key; Vision API enabled on drape-9e532). Reliable pixel-coordinate boxes;
  verified `APPLIED (Cloud Vision) {faces:1}` + the result face is now the user's.
  Only runs on outfit-ref; ~free (1000 faces/mo). Graceful fallback kept (any error
  → source unblurred). Removed the now-unused `@google/generative-ai` client from
  tryon.js. See `docs/COST.md` for the broader "purpose-built API vs Gemini" note.
- **2026-07-01 · Cut Gemini image cost ~44%: force 2K output (was 4K).** The
  Gemini bill spiked (June ~$217, image-output SKU ~$180). Root cause: both
  Pro-image calls — the **item-registration crop** (`processItem`, 595 real
  images in June) and **try-on** (107) — passed no resolution config, so
  `gemini-3-pro-image` defaulted to **4K** ($0.24/img). Dropping to **2K**
  ($0.134, identical to 1K; 4K→2K ≈ 44% off output) is plenty for a phone
  (closet thumbnails, 900×1200 try-on) with no silhouette-quality loss.
  Implementation: the old `@google/generative-ai@0.21` SDK can't set output
  resolution, so the two image-gen calls now use `@google/genai` with
  `config.imageConfig.imageSize: '2K'`; text/vision (tagging, analysis,
  face-blur) stays on the old SDK. Server-only — reaches all platforms on
  deploy, no app build. Item spike was real users (507 real / 88 dev / 0 seed),
  not test data. (Deferred: try-on daily quota + credits/invite; Flash-image
  model for the crop pending a quality test.)

Changes here ship to Cloud Functions or the marketing/web host and reach every
user immediately, independent of the installed app version. They are **not** a
new app release — the submitted app (1.1.1) keeps working and picks these up
automatically. Listed newest first, by date.

- **2026-06-30 · Unit tests for the pure helpers (4 → 38).** Extracted the
  firebase-free aggregation helpers from `functions/admin.js` into
  `functions/admin-helpers.js` (classify / dayKey / buildTrends / summarizeBuckets
  — behavior unchanged) so they're unit-testable, and added `tests/admin-helpers
  .test.js`, `tests/tryon-status.test.js`, `tests/currency.test.js`. Covers the
  cases that bit us this session — notably `dayKey` parsing Auth's RFC-1123
  `creationTime` and the `effectiveTryonStatus` 5-min boundary. `scripts/check.mjs`
  now runs the whole unit suite (all of `tests/` except the emulator-only
  firestore-rules suite) instead of just bulk-add.
- **2026-06-30 · Fix: background analyzers resurrecting deleted docs (ownerless
  orphans).** `analyzeGeneration`, `analyzeOotd`, and `processOotdPhoto` wrote
  their results with `set(patch, { merge: true })`. All three already confirm the
  doc exists + is owned by the caller up front, but the slow Gemini/segmentation
  call that follows gives the user time to delete the account/doc — and set-merge
  on a now-deleted doc RECREATES it with only the analysis fields (no userId /
  status / createdAt). That produced ownerless orphan docs (7 generations + 1
  outfit found) which the admin dashboard mis-aggregated into a phantom
  "(no handle)" user with 7 "pending" try-ons (they have no `status`, so
  cleanupStuckTryons — which targets `status=='pending'` — correctly never
  touched them). Switched all three writes to `update()` so a doc deleted
  mid-analysis stays deleted (the surrounding catch swallows the NOT_FOUND).
  Deleted the 8 existing orphans. Hardened `collectAll` in functions/admin.js to
  skip any userId-less doc so a stray orphan can't create a phantom row or inflate
  the pending count again. `deleteAccount` itself was never at fault — it deletes
  generations/outfits/items/etc. by userId thoroughly. Also added a **last-active
  column** to the admin Users table.
- **2026-06-30 · Admin: region breakdown + following count in the Users tab.**
  `adminUsers` now returns each user's `location` (raw city id) and
  `followingCount` alongside the existing follower count. The Users tab adds a
  Location column, a Following column, a "following" sort, and a region-rollup
  chip row that groups users by country (client maps city id → country via
  cities.js `cityCountry`) — click a country chip to filter the table to that
  region. UserDetail now renders location through `cityDisplay` instead of the
  raw id. Fetch limit raised 300→500.
- **2026-06-30 · Review-pass fixes on the session's changes.** (1) `dayKey` in
  functions/admin.js mis-parsed Firebase Auth `creationTime` (RFC-1123, not ISO)
  via `slice(0,10)` → garbage keys that dropped those signups from the trend and
  mis-sorted the Users table; now parsed through `Date`. (2) `nativeAnalytics()`
  cached the plugin import promise including its failure branch, so a transient
  chunk-load failure would memoize `{A:null}` and kill analytics until app
  restart; now clears the cache + warns on failure so the next call retries.
  (3) Consolidated the client "stuck try-on" heuristic into `utils/tryonStatus.js`
  (was a magic number split across GenerationDetail + the server sweep);
  TryOnHistory now shows a long-`pending` card as failed + deletable, so a
  regenerated/orphaned try-on isn't an unclearable ghost. (4) Dropped the unused
  per-load `adminStats` write in `adminOverview` (nothing reads it; the daily
  snapshot still accumulates history), guarded the empty-corpus infinite spinner,
  and shortened the sweep's error marker to `'timeout'`.
- **2026-06-30 · Fix: stuck 'pending' try-ons now recover into a retry.**
  `virtualTryOn` creates the Generation doc at `status:'pending'` and flips it to
  `ready`/`failed` when done — but if the process is killed mid-run (180s timeout
  / OOM / crash) it can't write the terminal status, so the doc span `pending`
  forever and GenerationDetail showed an eternal spinner with no way out. Unlike
  items, the client can't self-heal (the function owns the doc id and only returns
  it on success). Two-part fix: (1) new `cleanupStuckTryons` scheduled sweep
  (every 30 min) flips any generation still `pending` >15 min past creation to
  `failed` with "try-on timed out — tap to regenerate" (indexed on
  status+createdAt, new composite index, so it reads only stuck docs); (2)
  GenerationDetail treats a `pending` doc older than 5 min as failed client-side
  (with a timer for one being watched live) so the regenerate/delete UI appears
  immediately instead of spinning. No new locale keys (reuses tryOnFailed/
  regenerate). Also triaged the errorLogs "X is not defined" / useLocale-null
  cluster: all clustered on past deploy dates with zero in the last 24h — they're
  transient post-deploy stale-chunk errors that self-heal on refresh, not live
  bugs (the sole recent one, `TrendCard`, came from this session's admin redeploys).
- **2026-06-30 · Fix: native analytics silently broken + flooding errorLogs.**
  On native iOS every analytics call (`logEvent`/`setUserId`/`setUserProp`/
  `logScreen`) was a no-op AND logged an unhandled rejection: `nativeAnalytics()`
  returned the `@capacitor-firebase/analytics` plugin straight from an async
  function. The plugin is a Capacitor proxy that turns every property access into
  a native method call, so the promise-resolution machinery probed `.then` on it
  → the bridge threw `"FirebaseAnalytics.then() is not implemented on ios"`,
  rejecting before `logEvent` ever ran. So **native analytics recorded nothing**
  (web was unaffected — separate JS SDK path) and the Errors log filled with the
  same rejection on every screen change. Fix: cache the import and wrap the plugin
  in a plain `{ A }` object so it never sits in a thenable-probe slot. Native
  analytics now actually fires; reaches devices with the next app build (JS is
  bundled), web immediately.
- **2026-06-30 · Admin dashboard: date-range trends, axis charts, Errors tab.**
  Follow-ups on the `/admin` analytics page. (1) **Date range** — the Activity
  section now has a from/to date picker + 7d/30d/90d/all presets; the four trend
  charts and "in range" count tiles slice to the chosen window client-side.
  `adminOverview` now returns the full daily series (earliest data day → today,
  capped 800d) instead of a fixed 120-day tail, on one shared date axis so the
  charts stay aligned. (2) **Bigger charts with axes** — replaced the tiny
  sparklines with a larger inline-SVG line/area chart that draws y-axis tick
  labels + gridlines and x-axis date ticks (still no charting dependency).
  (3) **Errors tab** — new `adminErrors` callable serves recent `errorLogs`
  (newest first, message/url filter, expandable stack + context); the client
  can't run that ordered query under the admin-read rule, so it goes through the
  callable. Also clarified the try-on **pending** metric (started but never
  resolved to ready/failed — transient, or stuck/orphaned if old).
- **2026-06-30 · Admin analytics dashboard at `/admin`.** New owner-only surface
  to watch how drape is actually used and set product direction. Three tabs:
  **Overview** (real-user totals, 7d/30d active, item/outfit/OOTD/board/try-on
  volume, try-on success rate + variant yield, marketplace listings by currency,
  real/seed/dev bucket split, and trailing daily trend sparklines for
  signups/items/try-ons/OOTDs reconstructed from `createdAt`); **Top try-ons**
  (items ranked by how many generations reference them, with thumbnails);
  **Users** (sortable table per bucket → drill into one user's activity
  breakdown, category/color mix, and *already-public* content thumbnails).
  Architecture: all aggregation runs server-side in `functions/admin.js` via
  admin-SDK callables (`adminOverview` / `adminTopTryons` / `adminUsers` /
  `adminUserDetail`) — Firestore rules keep cross-account data owner-only, so the
  client can't read it directly. Email-gated (`uihyunkei@gmail.com`) in the
  callables (the real wall) plus a cosmetic route guard in `App.jsx`. A daily
  `dailyAdminSnapshot` scheduled function stamps point-in-time metrics (follower
  counts, that-day active) into `adminStats/{day}` for true history. Bucket
  classification mirrors `scripts/db-stats.cjs`. **Privacy:** drill-down exposes
  activity metrics + public content only — identity reference (face) photos, DMs,
  and private OOTD/closet photos are excluded at the function layer. Charts are
  hand-rolled inline SVG (no new dependency); the `Admin` page is its own lazy
  chunk so it never ships in the main user bundle.
- **2026-06-30 · No flicker on the profile count stats (own Items + public
  Outfits).** Both live counts started async, so they flashed `0`/stale then
  jumped to the real number on every open (unlike followers/following, which are
  stored on the profile doc and render instantly). Now stale-while-revalidate:
  seed from a per-user `localStorage` cache → renders at once, recounts in the
  background, writes back. Same value → no re-render (no flicker); only a real
  change moves it. First-ever open (no cache) shows blank, not 0. Applied to both
  `Profile.jsx` (Items) and `PublicProfile.jsx` (public Outfits). (Folded into 1.2.1.)
- **2026-06-30 · Profile header stat: own = Items, public = Outfits.** The first
  header stat is now context-aware. On your **own** profile it shows your **closet
  size** (`ItemService.countOwnedByUser`, live count of `kind:'owned'` items) and
  taps through to the Closet tab — that's the metric that reflects real usage here
  (closet + try-on), where "outfits: 0" was meaningless since most users never post
  OOTDs. On **someone else's** profile it stays the **public-outfit** count → Outfits
  tab (their shareable content; closet/try-on are private and hidden there anyway).
  Public default tab stays Outfits (feed-like). New `navItems` locale key (en/ko/ja).
- **2026-06-30 · Fix: profile outfit stat read 0 for OOTD users (public profiles).**
  The count came from denormalized `profiles.outfitCount`, maintained by a trigger
  that only fires on the **legacy `isListed`** flag. OOTDs (the main content) set the
  unified `isPublic` and never touch `isListed`, so OOTD-only profiles — every seed
  persona — showed 0. Public profiles now use the already-loaded public list length
  (mirrors the public Outfits grid exactly). (Own profile then moved to the Items
  stat above, superseding the live outfit count there.)
- **2026-06-30 · Engagement-stats tooling + snapshots.** `scripts/db-stats.cjs`
  buckets users (real / seed-by-`@extras-seed.example.com` / dev) and tallies core
  actions; `--save` writes a local JSON snapshot, `--firestore` upserts an
  aggregate-only snapshot to `adminStats/{date}` (locked in firestore.rules — admin
  access only) as the data source for a future admin/usability dashboard.

- **2026-06-28 · Native analytics + social push (like / try-on) + try-on count
  + deep-links.** Three things, all into the 1.2.0 (build 9) native build:
  - **Native Firebase Analytics** via `@capacitor-firebase/analytics` (the JS SDK
    is web-only). `firebase.js` now routes `logEvent`/`setUserId`/`logScreen`
    through the plugin on native, the web SDK on web. `App.jsx` logs a
    **screen_view on every route change** (drives the Screens report +
    time-on-screen/engagement), binds `setUserId` on login, and logs
    `notification_open` on a push tap — so reminder/social push impact on
    engagement + retention is finally measurable. **Play Data safety + Apple
    privacy label must be updated to declare analytics/usage-data collection
    before submitting build 9.**
  - **Social push** (`functions/social-push.js`): `onOutfitLiked` notifies the
    owner when someone likes their look; `onLookTriedOn` notifies when someone
    tries on their look (unique to drape). Both reuse `sendToUser`, skip
    self-actions, and coalesce per-target via `collapseKey`.
  - **Try-on count** (no UI yet): `onLookTriedOn` increments `tryOnCount` on the
    source outfit when an outfit-ref try-on completes (pending→ready, counted
    once). Display is deferred until volume justifies it (avoid "tried on 1×").
  - **Deep-links**: the push-tap handler now maps `data.type` (dm/like/tryon/
    reminder) → a route and the router navigates there (warm + cold start).
    `src/services/push-service.js`, `src/App.jsx`, `functions/{social-push,index}.js`,
    `firestore.rules` (tryOnCount), `firebase.js`.

- **2026-06-28 · Boards grid packs tightly (masonry).** The profile Boards tab
  was a 2-col CSS grid with `align-items:start`, so variable-ratio boards
  (portrait/square/landscape) left a tall empty gap in the shorter column.
  Switched `.board-list-grid` to CSS columns (`column-count` from the existing
  pinch `columns` + `break-inside:avoid`) so boards flow masonry-style with no
  gap. `src/styles/drape.css`, `src/pages/BoardList.jsx`.

- **2026-06-28 · Periodic friendly reminder push (timezone- + locale-aware,
  activity-gated).** Gentle nudges at the user's local evening (7pm), rotating a
  set of **14 varied, emoji-free** localized messages (closet / feed→try-on /
  log OOTD / try-before-buy / build outfit / plan tomorrow / rediscover / season /
  share / moodboard). On login the client stores IANA `timezone` + `lang` (and a
  `lastActiveAt` heartbeat) on the profile (`App.jsx` → `updateProfile`); an
  hourly `sendReminders` (`functions/reminders.js`) sends via a shared `sendToUser`
  helper (`functions/push-send.js`, extracted from `messages.js`) when ALL hold:
  local hour = 19, ≥2.5 days since the last reminder, **opened >~20h ago (skip
  currently-active users) but within 45 days (back off from the long-dormant)**,
  not opted out, and has a native fcmToken. Toggle lives simply under **Settings →
  Account** (like the language row), stored as `remindersOptOut`. Server is live
  now but only reaches users with BOTH a captured timezone (new client) AND a push
  token (native) — effectively switches on with the next native build.
  `functions/{reminders,reminders-copy,push-send,profile,messages,index}.js`,
  `src/App.jsx`, `src/services/profile-service.js`, `src/pages/Settings.jsx`, locale
  `remindersToggle`. (Deferred: deep-link from a reminder, contextual targeting.)

- **2026-06-28 · Selectable home screen (feed ↔ profile) + onboarding nudges.**
  The app always opened logged-in users on the feed, framing drape as an OOTD-SNS
  and burying the closet/OOTD/try-on hub. Now the cold-start landing follows a
  per-device preference (`src/services/homePref.js`, localStorage `drape_home` —
  read synchronously at routing time like the locale, so no first-paint flash;
  account sync deferred). Flow: first launch → feed with a one-time "drape is your
  closet too → go to your profile" nudge (dismiss/CTA sets the default to
  profile); next launch → profile; first profile-as-home visit → a one-time
  "switch home in Settings" hint. New **Settings → Home screen** selector
  (Profile | Feed). Routing change is the single `rootTarget` in `src/App.jsx`;
  the tab bar is unchanged (both surfaces stay one tap away). New
  `src/components/OnboardHint.jsx` (one-time dismissible banner, generalizes
  `SwipeHint`). `src/pages/{Feed,Profile,Settings}.jsx`, locale keys
  `homeScreen*`/`homeFeedIntro*`/`homeProfileHint` (en/ko/ja). (Web live now;
  native picks it up on the next build.)
  - **Onboarding slimmed 5→4 + home choice:** the first-launch `Onboarding`
    modal merged its 5 slides into 3 (closet+looks, try-on, discover+shop) and
    added a final **"how will you use drape?"** slide — *My closet* (→profile
    home) vs *Browse* (→feed home), or "decide later". Picking sets `drape_home`
    and lands the user there, so the home-screen choice is taught up front. The
    nudge banners remain the fallback for skippers / already-onboarded users.
    `src/components/Onboarding.jsx`, `onboardSlide1..3` + `onboardChoose*` locale.

- **2026-06-23 · Unified the outfit caption onto a single `caption` field.** The
  user's one-line post text lived in `name` (app) **and** `note` (seed) — a split
  that also clashed with `notes` (the AI style read), and meant captions in the
  legacy `note` field never translated. Renamed the caption field to **`caption`**
  everywhere (write/read/edit, `translateContent` extraction, firestore.rules
  outfit-update keys, `updateOutfit` allowlist) and migrated all 265 outfit docs
  `name`/`note` → `caption` (134 real captions preserved; backup taken), dropping
  both legacy fields. `notes` (style read) is unchanged. **Caption-only** going
  forward — the deployed 1.1.3 (which read `name`/`note`) shows blank captions on
  these until it updates, accepted because all data is the dev's own test/seed
  accounts (no third-party users yet). The seed generator must now write `caption`
  (+ `lang`), not `name`/`note`. `src/services/outfit-service.js`,
  `src/pages/{OutfitDetail,OutfitShare,OutfitBuilder}.jsx`,
  `src/components/OotdSheet.jsx`, `functions/translate.js`, `firestore.rules`.

- **2026-06-23 · "Translate" button for cross-language viewers (Phase 2).** Now
  that generated free-text is stored in the creator's language (Phase 1), a viewer
  in a different language gets a quiet **translate ↔ show original** toggle on the
  public surfaces — OutfitDetail (title, notes, palette names, piece names) and
  ItemDetail (item name; description stays the English shopping query). New
  `translateContent` callable (`functions/translate.js`): on first tap it Flash-
  translates the doc's free-text and caches the result under `i18n.<target>` (via
  admin SDK — no firestore.rules change; no `updatedAt` bump, so feeds don't
  reorder and `onCaptionChanged` stays a no-op), so every later viewer is free.
  The toggle only appears when the doc's `lang` ≠ the viewer's locale, so
  same-language posts (the common case) never see it and nothing is translated
  upfront. `src/services/translation-service.js`, `src/hooks/useContentTranslation.js`,
  `src/components/TranslateToggle.jsx`, `src/pages/{OutfitDetail,ItemDetail}.jsx`,
  locale `translateView`/`showOriginal`/`translating`. Verified Flash preserves the
  JSON shape (keys, array order) and keeps brand names. (Web + functions live now;
  native picks it up next build.)
  - **Refinements (same day):** translate the **whole post** incl. the user's
    caption (not just the analysis) — "translate this post", Instagram-style.
    Moved the toggle onto the **date line** (always-present row, right-aligned) so
    it never collides with the caption/notes/palette as they grow, and is in a
    fixed spot whether or not a caption exists. Fixed a blank-out: a translated
    field that comes back empty now falls back to the original (the caption no
    longer vanishes when toggled). Added **server-side cache invalidation** — each
    cached translation stores a `i18nSrc` hash of the source text; an edited
    caption/notes (or re-analysis) changes the hash so the next request
    regenerates, while unchanged content keeps serving the stored copy with no AI
    call. Cross-device: the cache lives on the doc, so any viewer/device gets the
    stored translation.

- **2026-06-23 · Generated text now comes out in the creator's language (Phase 1).**
  Auto-generated free-text was English-only regardless of app language. Now the
  generation callables (`processItem`, `analyzeOotd`, `analyzeGeneration`,
  `detectItems`) take the caller's `lang` (read non-reactively via
  `currentLang()` from `localStorage`) and emit free-text — item `name`, analysis
  `title`/`notes`, palette `name`s, per-piece `name`s, detect `style`/`mood`/
  `stylingTips` — in Korean/Japanese/English (`localeClause` in `functions/items.js`,
  appended to each prompt). **Enums stay English** (the search/filter SSOT — and
  `sanitizeTags` would drop a translated enum anyway) and so does `description`
  (it feeds the Google Shopping query). The doc stores `lang` for the upcoming
  "translate" affordance. Defensive: `lang` defaults to `'en'`, so the in-store
  native build (which doesn't pass it yet) behaves exactly as before — this is
  going-forward only, existing docs are untouched. Also localized the one raw
  enum label still rendered verbatim — OutfitDetail's style-bars label now uses
  `t('taxonomy.styles.…')` like AnalyzePhoto/GenerationDetail already did (the
  taxonomy label maps already existed in all three locales). `functions/items.js`,
  `src/hooks/useLocale.jsx`, `src/services/{item,outfit,generation}-service.js`,
  `src/pages/OutfitDetail.jsx`. (Native picks up the client half — passing `lang`
  — on the next build; web + functions are live now.)

- **2026-06-16 · Fixed the link-preview (OG) image + lowercased the title.** The
  social/iMessage share card for drape.nyc still showed the old **archelier**
  (voda) graphic — `public/og-image.png` (and its `resources/og-image.svg`
  source) were never regenerated for drape. Replaced with a brand OG image
  (ivory Didot-italic `drape` + lowercase tagline on ink #141312) via a new
  `scripts/build-og-image.cjs`, and lowercased the preview titles to match the
  all-lowercase brand: `<title>` / `og:title` / `twitter:title` / `og:image:alt`
  → "drape — digital closet & virtual try-on". `index.html`,
  `public/og-image.png`, `resources/og-image.svg`. (Note: iMessage/Slack/etc.
  cache previews hard. A same-name overwrite (`og-image.png`) kept serving the
  cached archelier graphic even after the page re-scraped, because the image URL
  is cached independently of the page — so the file was renamed to
  **`og-image-v2.png`** (a new URL no cache has seen) to force a fresh fetch.
  Test by re-sharing a fresh page URL, e.g. `drape.nyc/?v=3`.)
- **2026-06-15 · Gemini models migrated off `-preview` to GA.** The preview
  model IDs were retiring (`gemini-3-flash-preview` is already marked *Shut down*
  in the docs), so swapped to the stable GA endpoints — same family, same cost,
  better stability:
  - try-on / garment crop: `gemini-3-pro-image-preview` → **`gemini-3-pro-image`** (Nano Banana Pro, GA)
  - vision (auto-tag, OOTD/try-on analysis, moderation, outfit-ref face box):
    `gemini-3-flash-preview` → **`gemini-3.5-flash`** (GA)
  Every call site + shared constants + `ai-service` metadata: `functions/items.js`,
  `functions/tryon.js`, `functions/moderation.js`, `functions/test-item-pipeline.js`,
  `src/services/ai-service.js`. Deleted the dead `IMAGE_FLASH` / `imageFlash` /
  `visionPro` constants → **zero `-preview` references** anywhere. Model IDs are
  server-only, so a `firebase deploy --only functions` reaches every user — no app
  rebuild/resubmit. (The Imagen 4 discontinuation email was for the old
  `voda-7647c` project; drape uses no Imagen endpoints.)
- **2026-06-15 · Landing: Google Play shown as "coming soon."** The Play badge
  linked to a not-yet-live listing; now a dimmed, non-clickable "coming soon"
  badge (출시 예정 / COMING SOON / 近日公開) until the Android release goes out.
  App Store badge stays a live link. Web/marketing host only — never in the
  native app. `src/pages/Landing.jsx`, `src/styles/landing.css`.

---

## [1.2.1] — 2026-06-30 (iOS build 10 · Android versionCode 13 · profile polish)

versionName 1.2.1 · iOS build 10 · Android versionCode 13. A small **patch** on
top of 1.2.0 — already live on web, carried to native. (Android versionCode
climbed 11→12→13: 11 and 12 .aabs were each uploaded before the next no-flicker
fix landed, so each rebuild needed a fresh code. iOS stayed build 10 — not yet
uploaded.)

**Rollout:** submitted after 1.2.0 cleared review. iOS Archive build 10 →
Distribute; Android upload the versionCode-13 .aab.

### Fixed / changed
- **Profile header stat is now context-aware** — own profile shows **Items**
  (live owned-closet count) → taps to Closet; other people's profiles keep the
  **public-outfit** count → Outfits tab. Fixes the old stat reading 0 for users
  who build a closet but don't post OOTDs. (Full detail under "Server / web —
  continuous · 2026-06-30".)
- **Public-profile outfit count fix** (was 0 for OOTD-only users — read the legacy
  `isListed` flag instead of `isPublic`).

---

## [1.2.0] — 2026-06-28 (native build 9 · home screen + reminders)

versionCode/build: 9 · versionName 1.2.0. A **feature** release (not a patch) on
top of 1.1.4 — new user-facing surfaces, so the minor bump. All changes have been
live on web/functions; this carries them to native.

**Rollout:** Submitted to both stores 2026-06-29 (build 9), in review. Supersedes
1.1.4 (build 9 folds in all of 1.1.4's i18n/caption work). Android: build-9 .aab
uploaded.

### Added / changed (full detail in "Server / web — continuous · 2026-06-23/28")
- **Selectable home screen** (feed ↔ profile) + a 4-slide onboarding ending in a
  "how will you use drape?" choice; first-run feed nudge.
- **Periodic friendly reminder push** — timezone- + locale-aware (local 7pm, every
  ~2–3 days), opt-out in Settings. Switches on for users on this build (captured
  timezone + push token).
- **Social push** — notify on someone liking / trying on your look (try-on is
  drape-specific), aggregated + deep-linked.
- **Try-on count** accrued on the source look (server-side; no UI yet).
- **Native Firebase Analytics** — screen_view + time-on-screen, setUserId,
  notification_open (measures reminder/social push impact). Privacy policy +
  store data-safety updated to declare usage data.
- **Outfit caption unified** onto a single `caption` field (dropped `name`/`note`).
- **i18n** generated text in the creator's language + on-demand "translate" toggle
  (carried from 1.1.4).
- **Boards grid** packs tightly (masonry); profile section tabs / feed bar polish.

### Fixed (build 9 native build)
- **iOS build broke with `No such module 'FirebaseCore' / 'FirebaseAnalytics'`.**
  `@capacitor-firebase/analytics`'s default podspec subspec is `Lite`, which ships
  **no** Firebase dependency — so the analytics SDK was never installed and the
  plugin couldn't compile. (`FirebaseCore` only appeared transitively via
  Auth/Messaging, which is why it looked installed.) Editing the Podfile doesn't
  hold — `cap sync` regenerates the `capacitor_pods` block and drops any subspec.
  Fixed via **patch-package** (`patches/@capacitor-firebase+analytics+7.5.0.patch`):
  default subspec → `AnalyticsWithoutAdIdSupport` (full analytics, **no IDFA** → no
  App Tracking Transparency prompt, matching our data-safety disclosures). Survives
  both `cap sync` and `npm install`. Android was unaffected (Gradle resolves the
  Firebase deps automatically; the build-9 .aab already included analytics).
- **Android `versionCode 10`: strip the advertising-ID permissions.** Firebase
  Analytics merges `com.google.android.gms.permission.AD_ID` (and
  `android.permission.ACCESS_ADSERVICES_AD_ID`) into the manifest, so Play's
  "advertising ID" declaration couldn't honestly be answered **No** — build 9 was
  blocked at submission. Removed both via `tools:node="remove"` in
  `AndroidManifest.xml` so the build carries no ad-id (analytics only, matching
  iOS `WithoutAdIdSupport`). Android-only re-build (versionCode 10, versionName
  still 1.2.0); iOS stays at build 9 (no IDFA, never had this issue).

---

## [1.1.4] — 2026-06-23 (native build 8 · localized generation + translate)

versionCode/build: 8 · versionName 1.1.4. Native build that carries the
**client half of the i18n work** already live on web/functions (see "Server /
web — continuous · 2026-06-23"): generated free-text (item names, OOTD analysis
title/notes/palette/piece names) now comes out in the creator's app language,
and a **"translate" toggle** on OutfitDetail/ItemDetail gives cross-language
viewers a one-tap rendering in theirs. Enums + the English shopping `description`
stay English (search/filter SSOT). Going-forward only — existing docs are
untouched.

**Rollout:** Submitted to both stores 2026-06-24 (iOS build 8 + Android build 8
.aab), in review. Android went 1.1.3 → 1.1.4; iOS 1.1.3 → 1.1.4.

### Added / changed (all detailed under "Server / web — continuous · 2026-06-23")
- **Generated text in the creator's language** (Phase 1) + **on-demand "translate"
  toggle** for cross-language viewers (Phase 2), on the date line of OutfitDetail
  and on ItemDetail. Translates the whole post (caption + analysis); server-cached
  with source-hash invalidation. Enums + the English shopping `description` stay
  English.
- **Caption unified onto a single `caption` field** (dropped the legacy `name`/
  `note` split; all 265 outfit docs migrated). Fixes captions that never
  translated and the `note`/`notes` naming clash.
- Files: `functions/{items,translate}.js`, `src/hooks/{useLocale,useContentTranslation}.js`,
  `src/services/{item,outfit,generation,translation}-service.js`,
  `src/components/TranslateToggle.jsx`, `src/pages/{OutfitDetail,OutfitShare,OutfitBuilder,ItemDetail}.jsx`,
  `src/components/OotdSheet.jsx`, `firestore.rules`.

---

## [1.1.3] — 2026-06-18 (native build 7 · iOS resubmit · Android after Play 1.1.1)

versionCode/build: 7 · versionName 1.1.3. **This native build carries BOTH the
1.1.2 and 1.1.3 changes** — 1.1.2 was never released natively (iOS build 6 was
only in review; Android build 6 .aab was never uploaded), so both platforms go
1.1.1 → 1.1.3, skipping 1.1.2. iOS: resubmit build 7 (replaces the in-review
1.1.2). Android: upload the build 7 .aab once Play 1.1.1 clears. All changes have
been live on web/functions throughout.

### Added
- **Auto-hiding tab bars on Feed and Profile.** The feed kind/sort row and the
  profile section tabs (Outfits/Calendar/Closet/Boards/Try-on) now slide up out
  of view on scroll-down and slide back on a deliberate scroll-up
  (`useHideOnScroll`, upThreshold 130px so a tiny flick doesn't pop them down) —
  more room for content while browsing, the controls a flick away. On profile
  only the **section tabs** float; the full identity header (handle/avatar/stats/
  bio) scrolls away and returns at the very top. `src/hooks/useHideOnScroll.js`,
  `src/pages/Feed.jsx`, `src/pages/Profile.jsx`.

### Fixed
- **Notch/status-bar showed through behind the auto-hiding tab bars (native).**
  The native StatusBar overlays the webview, so when the sticky tab bar slid up
  into the safe-area, feed/profile content was visible behind the Dynamic Island.
  Added a fixed background filler over the safe-area-top region on both surfaces
  (`.community-feed::before`, `.profile:not(.profile--sub)::before`); the tab row
  now tucks cleanly behind the status bar. `src/styles/drape.css`.
- **Profile section tabs flew off before reaching the notch.** The auto-hide hook
  hid the bar on any down-scroll past `topThreshold`, but the profile tabs sit
  under a tall identity header, so they'd vanish while still in natural flow. Now
  a down-scroll only hides the bar once it has actually stuck at the notch
  (`getBoundingClientRect().top <= computed top`); before that it scrolls away
  with the header. No-op for the feed bar (stuck from the top). `src/hooks/useHideOnScroll.js`.
- **Sub-tab labels read larger than the section tabs above them.** On phones the
  `mine/saved/analyzed` (and Closet/Boards filter) row was 0.95rem while the
  parent section tabs shrink to 0.82rem — a child bigger than its parent. Aligned
  the sub-tab font to the section tabs (0.9rem / 0.82rem on phones).
  `src/styles/drape.css`.
- **Lists jumped to the top on Back; tabs shared one scroll.** AppShell reset
  window scroll to 0 on every navigation, so leaving a scrolled list to open a
  detail and returning lost your place. Now scroll is remembered **per view**
  (`pathname + search`), so every feed tab (`?kind=`) and profile sub-tab
  (`?ot=`, `?cv=`) is its own independent bucket — returning to a list resumes
  its place and one tab's scroll never bleeds into another. Implementation
  details that mattered (found by driving the real app headless): set
  `history.scrollRestoration='manual'` (stop the browser fighting us); save under
  the CURRENT view via a ref from a mount-once listener (a stale closure was
  writing ~0 onto the view being left); suppress saves briefly around our own
  programmatic scrolls; and retry the restore for a few frames while the cached
  list lays out. Global — covers feed, profile (outfits/closet/boards/tryon),
  marketplace, etc. Verified with Playwright: scroll → open in-view post → Back
  resumes; repeated; tabs independent. `src/App.jsx`.

---

## [1.1.2] — 2026-06-17 (superseded — folded into 1.1.3 build 7; never released natively on its own)

versionCode/build: 6 · versionName 1.1.2. App code, so web's had it; this build
carries it to native. (The config-read rules change is already live for all.)

### Added
- **Auto-hiding feed tab bar.** The kind tabs (OOTDs/Boards/Market + Following +
  sort) start in place, slide up out of view as you scroll down (more content),
  and slide back as a floating sticky bar the moment you scroll up — so you can
  switch tabs from anywhere, which pairs with the per-tab scroll memory.
  `useHideOnScroll` toggles a class via a ref (no list re-render; pure CSS
  transition). Needed `overflow-x: clip` (not `hidden`) on html/body — `hidden`
  silently breaks `position: sticky`. `src/hooks/useHideOnScroll.js`,
  `src/pages/Feed.jsx`, `src/styles/drape.css`, `src/styles/main.css`.
- **Pull-to-refresh on the feed.** Drag down at the top of any feed tab to force
  a fresh first page (bypasses the cache), updated in place so there's no loading
  flash. `src/hooks/usePullToRefresh.js`, `src/pages/Feed.jsx`. (Touch gesture —
  verify on a device.)
- **Server-tunable feed freshness.** The feed cache TTL dropped from 5 min to
  **1 min** (others' new/removed posts surface faster), and it's now read from a
  Firestore `config/app` doc at runtime (`getFeedTtlMs`), so it can be retuned
  from the console with **no app build**. Defensive: a missing/denied/malformed
  value falls back to the 1-min default and is clamped to 5s–60min, so a bad
  console entry can't break a deployed client. `config/{doc}` is public-read,
  console-write-only (firestore.rules). `src/services/appConfig.js`,
  `src/App.jsx`, `src/pages/Feed.jsx`, `firestore.rules`.

### Fixed
- **Stale lazy chunk after a deploy ("Failed to fetch dynamically imported
  module").** Found in `errorLogs`: a tab opened on an older build, then we
  deploy (Vite re-hashes chunk filenames), then the user navigates to a lazy
  route → the dynamic import 404s and the route renders nothing. The `page()`
  lazy helper now reloads once on import failure (fresh index.html → new chunks),
  guarded by a sessionStorage flag (cleared on successful mount) so it can't
  loop. `src/App.jsx`. (A side effect of the route-level `React.lazy` added for
  cold-start; harmless on native where chunks ship inside the app.)
- **Deleted post = infinite spinner.** OutfitDetail/ItemDetail couldn't tell
  "loading" from "deleted" (both were `null`), so tapping an already-deleted post
  (still in someone's cached feed) showed a spinner forever. They now distinguish
  `undefined`=loading from `null`=gone and render a **"no longer available" +
  Back** state; on detecting the tombstone they also `dropFromFeedCaches(id)` so
  going back shows the list without the ghost. Applies to outfit, item, and
  board details (BoardDetail already had a not-found state; aligned its copy +
  added the cache cleanup). `src/pages/OutfitDetail.jsx`, `src/pages/ItemDetail.jsx`,
  `src/pages/BoardDetail.jsx`, `src/services/uiCache.js`.

**Commits:** `99c2ff3`

---

## [1.1.1] — 2026-06-13 · resubmitted 2026-06-14 (iOS released 2026-06-15 · Android in review)

versionCode/build: 5 · versionName 1.1.1

Build 4 was the first submission. **Build 5 keeps version 1.1.1 and folds in the
fixes below** (all already live on web/functions — the resubmit just carries
them into the native binaries). What was briefly tracked as "1.1.2" is now part
of 1.1.1 build 5.

### Added (build 5)
- **Calendar photo-background toggle** (Settings → Display). The day cell can
  show either the segmented cutout (default — figure floating on the card) or
  the full OOTD photo with its background. Cutout quality depends on
  segmentation, which struggles on busy OOTD scenes, so this lets you opt into
  the original photo (which always looks right and reads like a photo diary).
  **Account-level**: the choice lives on the public profile, so it follows the
  account across devices AND applies to visitors viewing your calendar
  (`PublicCalendar` reads the same field) — your calendar looks the same to
  everyone, no you-vs-visitor asymmetry. Written through the `updateProfile`
  function (profiles are server-write-only); both URLs are already stored so
  it's a pure display switch with no reprocessing. `functions/profile.js`,
  `src/services/profile-service.js`, `src/pages/Settings.jsx`,
  `src/pages/Calendar.jsx`, `src/pages/Profile.jsx`, `src/pages/PublicProfile.jsx`.

### Fixed (build 5)
- **Feed cells sometimes stuck blank.** The card image (`CardImage`) had no
  `onError` path, so a single transient miss — most often the brief public-read
  propagation window right after an OOTD goes public — left that cell
  permanently blank until the feed remounted. It now retries a failed load up to
  3× with backoff and a cache-bust (so a cached 403 isn't reused).
  `src/components/CardImage.jsx`.
- **Calendar cutout dragged in background furniture.** The OOTD cutout
  (`processOotdPhoto`) kept whatever the segmentation model marked foreground,
  so café chairs behind the subject ended up floating in the calendar thumbnail.
  After segmentation it now keeps only the largest 8-connected component (the
  person) and drops detached blobs (chairs/furniture). No-op on an already-clean
  cutout; bails if the largest piece isn't a clear majority (so a fragmented
  mask can't lose half the subject); held bags stay (they connect through the
  hand/strap). Server-side, so it applies the moment you re-save an OOTD — no app
  update needed. `keepLargestComponent` in `functions/items.js`.

**Build 5 commits:** `9279d88` (cutout furniture) · `cbe8151` (docs) · `6212926` (calendar toggle) · `4222fbd` (feed retry + PROGRESS note) · `5be4e14` (changelog) · `4685b9e` (build-5 bump + notes) · `65a1778` (calendar bg → account-level). Native build archived from `65a1778` (versionCode 5).

---

_Below: the original **build 4** (first submission) notes._

### Added
- **Like your own posts.** Owners can now like their own outfit and board, and
  the like button + count are visible on your own posts (previously gated behind
  `!isOwner`, so you saw neither). Firestore rules already allowed an owner to
  write `likeCount`/`likedBy` on their own doc, so no rules change.
  `src/pages/OutfitDetail.jsx`, `src/pages/BoardDetail.jsx`.
- **Try-on from a post shows its source** ('Based on this look') and
  **Regenerate carries the outfit reference forward** (was failing
  'itemIds required' for outfit-ref try-ons). `src/pages/GenerationDetail.jsx`.
- **Outfit-ref try-ons reuse the borrowed look's analysis.** An outfit-ref
  try-on recreates an already-styled post, so re-running the palette/style/notes
  read just duplicated the source look's. It now skips `analyzeGeneration` and
  pulls the source outfit's existing analysis, shown as 'From the original look'
  (falls back to the always-present 'Based on this look' link). One fewer Gemini
  call per outfit-ref try-on; the two screens stay consistent. Item/custom
  try-ons keep their own analysis. `src/pages/GenerationDetail.jsx`.
- **Outfit-ref try-ons are tag-searchable again.** An outfit-ref try-on has no
  itemIds and skips its own analysis, so the look/tag filter (which matches on a
  try-on's item tags + style + pieces) had nothing to match — borrowed-look
  results fell out of tag search. The generation now denormalizes the source
  outfit's already-analyzed `style` + `pieces` onto its own doc (no extra Gemini
  call), so it's searchable by both. Forward-only — existing results gain it on
  Regenerate. `functions/tryon.js`.
- **Try-on date moved to the detail.** The try-on tab's card grid now shows just
  the render (no date line — cleaner), and the date appears when you tap in, in
  the same uppercase treatment a dated outfit uses. `src/pages/TryOnHistory.jsx`,
  `src/pages/GenerationDetail.jsx`.
- **Try-on detail reads as one system.** 'From the original look' had no styling
  and rendered as plain dark body text; it now matches the muted uppercase
  STYLE/palette header treatment. `src/styles/drape.css`.

### Fixed — virtual try-on (the big one)
- **Feed-post try-on quality.** Recreating someone's look ("outfit-ref" mode)
  was broken end-to-end; root causes, in order found:
  1. Garment input used the person-cutout, which looks like an identity ref →
     model confusion. Now loads the FULL worn photo, by storage path OR
     download URL (seed OOTDs carry only a URL), cutout last.
  2. The real echo cause was **safety**: at the default MEDIUM threshold the
     image model over-refused ordinary fashion photos (esp. young women in
     skirts/at a pool) and silently returned an INPUT photo. Relaxed to
     `BLOCK_ONLY_HIGH` → it generates. (Echo detection via perceptual hash was
     tried and removed — retry == the user's Regenerate button, no gain.)
  3. Result followed the OUTFIT photo's framing/pose/build → thigh-crops from
     seated sources + the source person's body/face bleeding in. Locked pose,
     framing, crop, BODY, and FACE to the FIRST identity photo (seated ref →
     seated result; full-body ref → full-body). Outfit photo is treated as a
     clothing catalog only.
  4. Off-center figure → center by the segmented ALPHA bbox, not color-trim.
  5. **Wrong face still leaking** ("rina's face on an amy try-on"): a crisp,
     front-facing face in the borrowed look photo overrode the user's identity
     refs — text couldn't stop a salient face. Now the outfit photo's face is
     **blurred at the source** (Flash returns the face box → sharp blurs just
     that region) before it's fed to the model, so there's no competing
     identity to copy. Styling/visor/hat survive; vision failure falls back to
     the untouched photo. `blurOutfitFace` in `functions/tryon.js`.
  6. **Custom background → echo.** With a requested background that resembled
     the borrowed photo's own scene (a Korean street ≈ "Seongsu"), the model
     kept the outfit photo and just retouched its backdrop — echoing the source
     person/pose, and the face blur from (5) then surfaced as a smudge. The
     outfit-ref background clause now forces a fresh re-render ("build the scene
     ANEW; the only thing from the outfit photo is the clothing").
  `functions/tryon.js`.
  7. **Scene results showed white margins.** The result card pads every variant
     7% onto a white card — right for a figure-on-white cutout, wrong for a real
     backdrop (Venice/beach renders sat letterboxed inside the card). The
     generation doc now carries a `scene` flag (true for a requested background
     or a preserved custom photo); the card drops the padding and fills
     edge-to-edge (`object-fit:cover`) for scene results, keeps the breathing
     room for cutouts. `functions/tryon.js`, `src/pages/GenerationDetail.jsx`,
     `src/styles/drape.css`.
- **Stuck 'Processing' closet items.** processItem is fire-and-forget; a
  killed app / failed call left permanent 'Processing' cards. Recovery is now
  client-side (item-service flips to 'failed' if the dispatch rejects, only if
  still processing), with a once-a-day indexed server backstop for the
  app-killed case. Failed cards show a **Retry** button (focus-aware, so one
  piece from a multi-item photo re-extracts the right garment). Processing
  shows a calm spinner, not the word "Processing". `functions/items.js`,
  `src/services/item-service.js`, `src/pages/Closet.jsx`.

### Fixed — native cold-start (the app looked like it crashed on launch)
- **Cold-start freeze / unresponsive first tap (native).** The native splash
  auto-hid on a fixed 2s timer (`launchAutoHide:true`) regardless of whether
  the JS app had mounted — so on a slow cold start it revealed a blank, tap-dead
  webview that read as a crash. Switched to `launchAutoHide:false`; the JsSplash
  overlay already calls `SplashScreen.hide()` on mount, so the splash now stays
  up until the app is actually painted (with a 5s belt-and-braces fallback in
  `main.jsx` so a render failure can't trap the splash). `capacitor.config.json`,
  `src/main.jsx`.
- **Laggy first taps after the splash (native).** App.jsx statically imported
  all ~25 route pages, so the main chunk was 414K parsed up front on a cold
  WKWebView — the main-thread block behind the janky first interactions. Route
  pages are now `React.lazy` behind a single `Suspense`; Vite emits a per-page
  chunk and the app chunk drops to ~150K (Firebase/React vendor unchanged — both
  needed early). Also removed 5 dead App.jsx imports (Closet/Calendar/OutfitList/
  BoardList/TryOnHistory, only used embedded in Profile). `src/App.jsx`.

**Commits** (`7e68946` → `27e8982`):
- `27e8982` style(tryon): match 'From the original look' to the section-header treatment
- `bb35d4d` fix(tryon): outfit-ref try-ons denormalize source style+pieces for tag search
- `a5453f3` feat(tryon): show the date on the detail, keep the card grid clean
- `93150c6` fix(tryon): scene results fill the card edge-to-edge (no white margins)
- `19c46b2` docs(changelog): note route lazy-loading under cold-start fixes
- `9864392` perf(native): lazy-load route pages to shrink the cold-start bundle
- `cad4b7d` fix(native): keep the splash up until JS mounts (no cold-start blank/freeze)
- `dc836a5` docs(changelog): finalize 1.1.1 release notes
- `cfedeee` chore: bump to 1.1.1 (versionCode/build 4) ← version bump
- `32de400` fix(tryon): force a fresh scene render for outfit-ref + custom background
- `34164c7` feat(tryon): outfit-ref try-ons reuse the borrowed look's analysis
- `2aeb402` fix(tryon): blur the outfit photo's face so it can't override identity refs
- `c677aac` docs(changelog): log the try-on fix cycle + stuck-item recovery under 1.1.1
- `a1a5cb2` fix(tryon): hard-lock the FACE to the identity photos
- `6012136` fix(tryon): drop auto echo-retry — manual Regenerate is equivalent
- `35c13c6` fix(tryon): result follows the identity photo's pose/framing
- `187a0fc` fix(tryon): follow the identity photo's framing (full-body) not the outfit photo's
- `43f0ba6` fix(tryon): restore the working prompt (natural pose + anti-echo) + body-lock + centering
- `66a4790` fix(tryon): lock body to identity (not the outfit person); center the figure
- `6830d62` fix(tryon/items): revert speculative prompt change; client-side stuck-item recovery
- `4d65002` fix(tryon): stop the model echoing the reference photo; focus-aware item retry
- `f50906b` fix(tryon): load full worn photo by path OR url; retry stuck items; loading spinner
- `4706879` fix(tryon): feed-post try-on quality, regenerate, source link, stuck items
- `f7ba616` docs(changelog): list all commits per version, mark the release commit
- `1ce9cce` docs(changelog): annotate each version with its git commit hashes
- `f4d151e` docs: add internal CHANGELOG + maintenance note in CLAUDE.md
- `7e68946` feat: owners can like their own outfit/board and always see the count

**Release:** version bumped at `cfedeee` (versionCode 4); the cold-start +
try-on-polish commits landed after the bump, so the 1.1.1 native build is
archived from `27e8982` (or later) at the same versionCode 4 — nothing was
submitted between, so no second bump is needed.

---

## [1.1.0] — 2026-06-10 (iOS + Android submitted)

versionCode/build: 3 · versionName 1.1.0

### Added
- **Swipe between details.** Tinder-style horizontal swipe on a detail hero
  jumps to the previous/next item in the list you came from. Drag right =
  previous, left = next; axis-locked so vertical scroll is untouched;
  `replace:true` keeps Back returning to the list.
  - Shared primitives: `src/services/swipeNav.js` (`buildSwipeState` + type→route
    map), `src/hooks/useSwipeNavigate.js` (gesture + nav, with a `moved` ref so a
    tap vs swipe can be told apart).
  - Wired across every surface that opens a detail: Feed (OOTDs/boards/market),
    OutfitList (mine/saved/analyzed), PublicProfile (outfits/boards/calendar),
    Calendar day-picker, BoardList, Closet (flat + usage/brand groups),
    Marketplace. Detail pages: OutfitDetail, BoardDetail, ItemDetail.
  - `Masonry.jsx` now passes the original index to its children.
  - ItemDetail keeps its tap = before/after toggle, distinguished from a swipe by
    the hook's `moved` ref.
- **Swipe coachmark** (`src/components/SwipeHint.jsx`): one-time hint — an
  animated hand sweeping between two pulsing chevrons — shown the first time a
  swipeable detail opens. Persisted via `localStorage['drape_swipe_hint_v1']`.
- **Store download links** on the drape.nyc landing — the previously inert
  App Store / Google Play badges are now links (App Store id6775511709,
  Play `com.uihyun.drape`). `src/pages/Landing.jsx`.

### Fixed
- **Feed no longer re-sorts on load.** The splash warm-up stored the feed as a
  bare array, so Feed treated it as stale and refetched + full-replaced the list
  on first view, which (with index-based masonry) visibly reshuffled the grid
  every time. Warm-up now stores the full `{items,cursor,hasMore,ts}` page shape
  so Feed restores it within TTL and skips the refetch; the post-TTL refetch also
  skips `setActive` when the fresh page is identical.
  `src/services/warmup.js`, `src/pages/Feed.jsx`.
- **Welcome screen fits every phone.** The phone mockups used a fixed-height
  visual taller than the leftover space, so they got cut off and the page
  scrolled on larger phones (16 Pro). The visual now fills the hero and the
  phones size by height; `overflow:visible` + a lighter shadow removes the hard
  grey band that read as a divider; bottom padding tightened. `src/styles/drape.css`.
- **Sign-in cancellation is not an error.** Cancelling Google/Apple sign-in no
  longer shows a red banner. Native cancellations arrive as a "…canceled the
  sign-in flow." message (not a web `auth/*` code); Welcome drops the error
  banner entirely (genuine failures are console-logged), and SignInModal matches
  the message to swallow it. `src/pages/Welcome.jsx`, `src/components/SignInModal.jsx`.
- **Follow-list ghost rows.** A deleted account could leave a handle-less profile
  shell that slipped past the `filter(Boolean)` guard and rendered a dead "@" row
  navigating to `/u/undefined`. Both follow lists now require a handle to render.
  `src/components/FollowListSheet.jsx`, `src/components/FollowListModal.jsx`.
  (Note: the count-vs-list mismatch from orphaned follow edges is a separate
  data-consistency artifact, not a code bug — see git discussion.)

### Notes
- The "find similar" onboarding claim was verified accurate — it opens a Google
  Images search per detected piece (`PieceRow.jsx`), distinct from the
  community-search "Find me this look" still on the roadmap.

**Commits** (`f6d4d16` → `4351eed`):
- `4351eed` chore: bump to 1.1.0 (versionCode/build 3) ← release commit
- `37ed742` fix(welcome): fit phone mockups to the screen, drop the clipped-shadow divider
- `c7ab71f` fix: feed no longer re-sorts on load (warm-up freshness + no-op refetch)
- `6e33ef3` fix: don't show a sign-in error banner for user cancellation
- `5dfb0dd` feat: link App Store + Google Play badges on drape.nyc landing
- `5d2729c` feat: swipe-between-details on board & item + animated swipe-hint coachmark
- `cfa38cd` feat: swipe between outfit details (feed/profile/calendar) + one-time hint
- `f6d4d16` fix: hide handle-less ghost rows in follow lists (deleted-account shells)

---

## [1.0.0] — 2026-06 (initial public release · iOS + Android)

versionCode/build: 2 · versionName 1.0.0

First public release. The full app: digital closet (auto background-removal +
auto-tagging), AI virtual try-on (identity-preserving), OOTD calendar, outfits &
boards, lookbook feed (follow/like/comment/bookmark), and a peer-to-peer
marketplace with DMs and push notifications.

### Launch-prep highlights (the work to get 1.0.0 shippable)
- **Infinite scroll everywhere** via real cursor pagination — feed
  (OOTDs/boards/market), profile lists, bookmarks; live-window growth for
  closet/try-on; 5-min scroll-state TTL so back-nav restores your place.
- **Deterministic 2-column masonry** (alternating L/R by index) so the grid
  can't reflow as images load.
- **Push notifications** end-to-end (APNs key, `@capacitor-firebase/messaging`
  for FCM tokens, timestamp-based presence, router-based tap deep-link).
- **Public account-deletion page** at `/delete-account.html` (Play Data safety
  requirement) + linked from the privacy policy.
- **Android Play app-signing** SHA registered; iOS build number + capacitor sync.
- **Calendar cell** press feedback uses `:active` (no sticky touch hover).
- Brand assets (ivory Didot wordmark on ink), drape.nyc landing + legal pages,
  data-safety / content-rating / store listings in en/ko/ja.

**Commits** (launch + final-prep window; full app history predates this changelog,
ends at `bb3b0ba` = last commit before the 1.1.0 cycle):
- Launch prep / store: `bb3b0ba` roadmap(native analytics) · `22c84b5` privacy→delete-account link · `4ddc2c6` public account-deletion page (Play Data safety) · `59d14ff` iOS build number 2 + cap sync · `0162293` Android Play app-signing SHA + versionCode 2 · `ae5e802` store-metadata(push wired)
- Infinite scroll: `7796304` profile lists cursor pagination · `d4095f3` closet/try-on live window + marketplace pagination · `309a6ce` feed infinite scroll + 5-min scroll TTL
- Grid/cards: `83cde7a` deterministic 2-col masonry · `0792957` board thumbnails render full board · `5157c12` / `10fc614` / `a9d1ab2` / `eabbabe` / `ba1d15a` card + avatar + note polish · `f1d3e52` clean cards / hide iOS keyboard bar / notch fix · `e92d78a` suppress iOS long-press callout
- Calendar: `d9df3a3` cell press feedback uses `:active`
- Push notifications: `a6d23a9` / `e6dabf1` timestamp presence · `bdae85a` / `94cf122` router deep-link + back behavior · `034eb43` clear tray + early tap handler · `c8e3cb5` iOS aps-environment · `f2c5fff` 30-day thread cleanup + image push · `c96fd8f` FCM tokens + chat-image/inbox/profile fixes · `a6fc744` push outcome logging
- DM: `b8288a0` create room on first message · `fbd3a96` Contact seller ↔ Open chat
- Upload/analyze: `e951cc8` photo-library-direct picker · `b6430c7` 8-photo session cap · `205ac71` simplify crop/detect prompts · `486b74c` owned bulk-add straight to closet
- Welcome: `175ab13` tagline copy under phones
