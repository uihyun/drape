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
