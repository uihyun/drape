# Changelog

Internal release notes for drape — the detailed record (store-facing copy is
shorter; this is the full picture). Newest first.

Conventions:
- **Web** ships continuously to drape-9e532.web.app / drape.nyc on every change.
- **Native** (iOS/Android) ships per version below. A web-only fix lands in the
  next native build, so a change can be live on web before it reaches the apps.
- Versions track `versionName` (display) + `versionCode`/iOS build number.

---

## Server / web — continuous (live for everyone; NO app version / build needed)

Changes here ship to Cloud Functions or the marketing/web host and reach every
user immediately, independent of the installed app version. They are **not** a
new app release — the submitted app (1.1.1) keeps working and picks these up
automatically. Listed newest first, by date.

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

## [1.1.2] — Unreleased (web live; queued for next native build)

versionCode/build: TBD (bump from 5). App code, so web has it now; native users
get it in the next build. The rules change (config read) is already live for all.

### Added
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
- **Deleted post = infinite spinner.** OutfitDetail/ItemDetail couldn't tell
  "loading" from "deleted" (both were `null`), so tapping an already-deleted post
  (still in someone's cached feed) showed a spinner forever. They now distinguish
  `undefined`=loading from `null`=gone and render a **"no longer available" +
  Back** state; on detecting the tombstone they also `dropFromFeedCaches(id)` so
  going back shows the list without the ghost. `src/pages/OutfitDetail.jsx`,
  `src/pages/ItemDetail.jsx`, `src/services/uiCache.js`.

**Commits:** `99c2ff3`

---

## [1.1.1] — 2026-06-13 · resubmitted 2026-06-14 (iOS + Android — submitted)

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
