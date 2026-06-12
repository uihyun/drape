# Changelog

Internal release notes for drape — the detailed record (store-facing copy is
shorter; this is the full picture). Newest first.

Conventions:
- **Web** ships continuously to drape-9e532.web.app / drape.nyc on every change.
- **Native** (iOS/Android) ships per version below. A web-only fix lands in the
  next native build, so a change can be live on web before it reaches the apps.
- Versions track `versionName` (display) + `versionCode`/iOS build number.

---

## [1.1.1] — Unreleased (web live; queued for next native build)

versionCode/build: TBD (bump from 3 when building native)

### Added
- **Like your own posts.** Owners can now like their own outfit and board, and
  the like button + count are visible on your own posts (previously gated behind
  `!isOwner`, so you saw neither). Firestore rules already allowed an owner to
  write `likeCount`/`likedBy` on their own doc, so no rules change.
  `src/pages/OutfitDetail.jsx`, `src/pages/BoardDetail.jsx`.
- **Try-on from a post shows its source** ('Based on this look') and
  **Regenerate carries the outfit reference forward** (was failing
  'itemIds required' for outfit-ref try-ons). `src/pages/GenerationDetail.jsx`.

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
  `functions/tryon.js`.
- **Stuck 'Processing' closet items.** processItem is fire-and-forget; a
  killed app / failed call left permanent 'Processing' cards. Recovery is now
  client-side (item-service flips to 'failed' if the dispatch rejects, only if
  still processing), with a once-a-day indexed server backstop for the
  app-killed case. Failed cards show a **Retry** button (focus-aware, so one
  piece from a multi-item photo re-extracts the right garment). Processing
  shows a calm spinner, not the word "Processing". `functions/items.js`,
  `src/services/item-service.js`, `src/pages/Closet.jsx`.

**Commits:**
- `7e68946` feat: owners can like their own outfit/board and always see the count
- `f4d151e` docs: add internal CHANGELOG + maintenance note in CLAUDE.md

**Release commit:** _pending_ — set at the next native build (bump from versionCode 3).

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
