# Progress log

Running notes on what's been built, what's been deferred, and what would break right now if you tried to ship. Updated chronologically.

## 2026-05-22 — Bootstrap from voda

Copied `../voda` (achelier.co interior-design app) into `./drape` and substituted the closet / try-on / calendar / OOTD layer for the interior-design layer. SNS plumbing (auth, credits, follows, comments, lookbooks, RevenueCat) carried over.

### Done

**Config + rebrand**
- `package.json`, `capacitor.config.json` (`com.uihyun.drape` / `Drape`), `public/manifest.json`, `index.html`, `vite.config.js` (cache name bumps, port 3000)
- `firestore.rules`, `firestore.indexes.json`, `storage.rules` rewritten around drape collections (`items` / `outfits` / `ootds` / `generations`)
- `src/firebase.js` reset to placeholders + setup comments
- `src/services/api-base.js` centralizes Functions base URL via `VITE_FIREBASE_PROJECT_ID`
- Indigo `#5B5BD6` accent + monotone neutrals applied to `main.css` design tokens; new `drape.css` for drape-only components
- Locales: en (full) + ko (full) + ja (lean fallback)

**Data model + services**
- `taxonomy.js` (client) + `functions/taxonomy.js` (server) — single closed vocab, auto-tag enforces enums
- `item-service.js` — async create flow: upload → status='processing' → fire-and-forget `processItem` callable → onSnapshot flips card to 'ready'
- `outfit-service.js` — CRUD + public feed query + like toggle
- `ootd-service.js` — doc id is `${uid}_${YYYY-MM-DD}`, month-load returns date-keyed map
- `identity-service.js` — user's 2–3 reference photos on the user doc
- `generation-service.js` — invokes `virtualTryOn`, exposes rating + regenerate

**Cloud Functions (Node 22)**
- `functions/items.js` — `processItem` runs Nano Banana 2 (Flash) crop + Gemini Flash vision tagging in parallel, normalizes tags to the closed vocab, writes back `croppedUrl` + `tags` + `status='ready'`
- `functions/tryon.js` — `virtualTryOn` feeds all identity refs + each cropped item + identity-preservation prompt, runs N parallel variants, always writes a Generation doc (even on failure) so the feedback loop captures every attempt
- `functions/index.js` rewritten — helpers (initializeAndApplyDaily, deductCredits, refundCredits, rate limit, verifyAuth) kept; voda-only endpoints (`generateDesign`, `editDesignRegion`, `chatWithDesign`) dropped; module re-exports for moderation / profile / counters / referrals / account
- `functions/moderation.js` — repointed at `outfits/{id}` instead of `designs/{id}`; reports schema generalized with `targetType`
- `functions/comment-counter.js`, `collection-counter.js`, `profile.js`, `account.js` — repointed at drape collections (`outfits`, `lookbooks/coverOutfitId`, `outfitCount`); account-deletion nukes `items` + `outfits` + `ootds` + `generations` + storage prefixes
- `functions/referral.js` — `VODA-` prefix → `DRAPE-`

**UI shell**
- `App.jsx` replaced with a clean drape shell (Closet/Outfits/Calendar/TryOn/Feed/Settings routing, sign-in modal, credit modal hook, BrowserRouter)
- `main.jsx` rewritten — drape branding, leftover voda cache sweep
- New components: `Header`, `MobileHeader`, `MobileTabBar`, `Onboarding`, `FeedCard` (replaces voda equivalents)
- New pages: `Closet`, `AddItem`, `ItemDetail` (with full tag editor), `OutfitList`, `OutfitBuilder`, `OutfitDetail`, `OutfitShare`, `Calendar` (month grid), `TryOn` (picker + tier toggle), `GenerationDetail` (variant gallery + rating), `Feed`, `Settings`, `Privacy/Terms/Support`
- `JsSplash` rebranded (drape wordmark, indigo accent line)
- `Camera.jsx`-service: added `takePhoto()` with Capacitor → web fallback
- `ReportModal` rewritten as generic target-aware report form

**Docs**
- `README.md` rewritten — overview, setup, deploy, dev
- `ROADMAP.md` — MVP / Phase 2 / Later, parity with brief
- `PROGRESS.md` — this file
- `_archive/voda-docs/` — original archelier docs preserved (PRODUCT_PLAN, SPRINT_A_LOG, BRANDING, BRAND_ASSETS, store-metadata) for reference

### In flight / known gaps before drape can ship

- **Firebase project wired:** `drape-9e532`. `src/firebase.js`, `.firebaserc`, and `.env` (`VITE_FIREBASE_PROJECT_ID`) all carry the real config. authDomain is the default `drape-9e532.firebaseapp.com` until a custom `drape.app` domain + verified OAuth handler are set up. Auth providers (Google + Apple), Firestore, Storage, Functions still need to be **enabled in the console**.
- **GEMINI_API_KEY not yet bound to the Cloud Functions runtime.** Local `.env` has the dev key (`AIzaSyD710fBlKxMZoUNp7nbctvvnsoDz72Hb20`); for the deployed callable, run `firebase functions:secrets:set GEMINI_API_KEY` and paste the same value. (Treat the key as a secret — rotate after launch.)
- **RevenueCat keys are placeholders.** Pricing / Account upgrade UI is not yet routed in this build — settings page is account + identity refs + language + legal only. Re-add paywall once the iOS/Android products + entitlement (`Drape Pro`) are configured.
- **iOS / Android native projects still carry the voda bundle id internally.** `capacitor.config.json` is updated to `com.uihyun.drape` / `Drape`, but the existing `ios/App/App.xcodeproj` and `android/app/build.gradle` were copied as-is. First `npx cap sync` will update most of this; you'll still want to:
  - Change iOS Bundle Identifier in Xcode signing settings
  - Update `android/app/build.gradle` `applicationId` + `namespace`
  - Reset Apple Sign-In Service IDs and Firebase iOS app entries
- **Calendar tap-to-log flow is not wired** — month view renders entries but tapping a cell doesn't yet open a sheet to attach an outfit or selfie. Service (`OotdService.upsertOotd`) is ready; UI sheet is the only missing piece.
- **Following tab in /feed dropped from this build** — restore by re-importing `FollowService.getFollowingIds` and adding the tab to `pages/Feed.jsx`. Voda's pattern is referenced in `_archive/voda-docs/PRODUCT_PLAN.md`.
- **billing-service.js still references Stripe endpoints** (`/createCheckoutSession`, `/stripeWebhook`) that no longer exist in `functions/`. Calls will 404 until web Pro is built. Module imports cleanly so the SPA still loads.
- **Comment-service handle denormalization** uses `profiles/{uid}.handle` — wires up only after `initializeUser` creates a profile. New users land in this path via the Settings auto-init; flow is untested end-to-end in a deployed project.
- **No Stripe-cancellation path in account deletion** — the brief defers Stripe to Phase 2 anyway; RevenueCat-side IAP cancellations remain user-initiated in App Store / Play Store settings.

### Tested

- `npm install` + `vite build` cleanly compile the new tree. See "Build verify" in this log for the run output.

### What to do next (suggested order)

1. Provision the drape Firebase project + paste config into `src/firebase.js` and `.firebaserc`.
2. Bind `GEMINI_API_KEY` as a Firebase secret + deploy functions.
3. Run through closet → try-on end-to-end with one real account; capture rough edges in this file.
4. Wire the calendar tap-to-log sheet.
5. Reinstate the following-tab in /feed once the closet has enough seeded outfits to make following meaningful.
6. iOS / Android native cleanup (bundle id, signing, Apple Sign-In Service ID swap).
7. RevenueCat product + entitlement setup; restore Pricing/Account paywall.

---

## 2026-05-23 — Lekondo redesign + first social loop

Multi-session arc reshaping drape's identity from voda-with-clothes into a Lekondo-style outfit journal with a real social side. All commits since `2b861ef first commit`; live at https://drape-9e532.web.app.

### Done — design tokens & shell

- Design tokens flipped from voda indigo (`#5B5BD6`) to Lekondo forest olive (`#3F5841`); Hanken Grotesk + Noto Sans KR; PWA `theme_color` and Capacitor splash bg both `#FFFFFF`.
- Lucide icons (`lucide-react@1.16.0`) replace Material Icons across new/touched components. (Lucide dropped brand glyphs, so IG is inlined SVG.)
- Safe-area pattern from voda: `--safe-top` = `env(safe-area-inset-top, 0px)` on web, `max(env, 50px) + 12px` on `body.is-native` (Capacitor often reports 0). Applied to `.profile`, `.welcome`, `.community-feed`, `.header-mobile`.

### Done — app shell

- `Welcome` (`/welcome`) — Lekondo capture 1 sign-in page: DRAPE wordmark, language picker, Continue with Google / Apple (functional via `AuthService.signInWith{Google,Apple}`) / Email (placeholder). Root `/` routes signed-in users to `/profile`, anonymous to `/welcome`.
- `Profile` (`/profile`) — Lekondo profile shell: handle row + Invite + bell + settings ring, identity row (avatar with outfit-count badge, name + IG glyph, followers/following, location), bio, three segmented tabs (Outfits / Calendar / Closet) rendering the existing pages in `embedded` mode (no duplicate page chrome).
- `PublicProfile` (`/u/:handle`) — read-only view of other users, Follow button replaces Invite, only public outfits surface.
- `Feed` (`/feed`) — Discovery: Pinterest-style 2/3-col masonry over `OutfitService.getFeedOutfits`; Home tab on the floating nav routes here.
- `Settings` — full Lekondo-tone rewrite: Profile (handle claim, displayName, bio, location, instagram), Identity refs, Account (language, credits, sign out), Legal links.
- `MobileTabBar` — three separate white pills (Home / + / Profile); the `+` opens a create sheet (Add item / New outfit / Try-on).
- `ClaimHandleModal` — appears on `/profile` for first-time users (empty handle); soft-dismissable but reappears until the handle is claimed.
- `MobileHeader` — hides on `/`, `/profile*`, `/feed`, `/welcome`; back-button + page-title on every other route. Voda desktop Header retired.
- `Onboarding` — gated behind `isLoggedIn && !isFullBleed` so the 3-slide intro no longer overlaps the Welcome page.

### Done — content surfaces

- `Calendar` — photo-first month grid (4:5 cells edge-to-edge, hairlines via inset shadow, day numbers tucked top-left, single-letter weekday header).
- `Closet` — 3-col borderless cards (cutout contained on white), CATEGORY + name meta; top filter row All / Usage / Brands / Categories + search icon (Usage/Brands disabled — "Coming soon"). Items "rain in" via staggered CSS fade on grid mount.
- `OutfitDetail` — editorial layout: hero, byline (avatar + @handle + Edit), uppercase date, large title, color palette swatches (3-up, hex bg, contrast-picked ink, %), aesthetic-composition continuous gradient bars (Amekaji / Workwear / Retro / Y2k style), notes, items strip, action row with Share.
- `AddItem` — fullscreen black confirm step after Camera/Gallery: photo centered, X top-left, Cancel/Upload pill buttons (Upload is accent-green with cloud icon).
- `ItemDetail` — fullscreen single-item viewer (Image 24 / Essembl style): photo dominates on white, tap toggles Before/After (`originalUrl` ↔ `croppedUrl`), right rail Try-on / Share / More menu, bottom CATEGORY + name strip, expandable tag editor.

### Done — server side

- `functions/profile.js` adds `location` field to `updateProfile` (60-char cap) and seeds `profiles/{uid}.location = ''` on create.
- `ItemService.recordWear`: pushes `{ date, ootdId, outfitId }` onto each item's `wearLog` when an OOTD is saved (idempotent on date, capped at 60 entries). Maintains `lastWornAt` + `wornCount` denorms. Wired into `OotdService.upsertOotd`. Closet search now matches `wearLog` dates so `"2026-05"` filters items worn that month.
- `firestore.rules` extended to allow `wearLog` / `lastWornAt` / `wornCount` on owner updates.
- Cloud Functions already deployed from prior cycle: `processItem`, `updateProfile`, `claimHandle`, `onFollowCreated/Deleted`, `onOutfitListChange`, `onOutfitListed`, `onOutfitDeletedDecrement` — counters maintained server-side.

### Live

- `https://drape-9e532.web.app` — hosting redeployed after every commit set this cycle.
- Firestore rules redeployed after the wear-log addition.
- `updateProfile` function redeployed for the `location` field.

### Known gaps (carried forward to next cycle)

- **Sticker Board** (diary-style canvas to drag clothing stickers around + save board). Long-press item → context menu (Detail / Try-on / Wear history) is part of this.
- **OOTD photo recognition + style analysis + buy links** — server-side Gemini call to identify clothes seen in a selfie or 3rd-party photo, return per-item info, save to closet on accept, generate Google-Lens links.
- **Magic Upload** (Essembl-style) — accept selfies / multiple items / screenshots, AI detects each piece and registers separately. Big functions work.
- **Item Before/After + Action toolbar** — Change Product / Edit / Animate / Save (Essembl). Before/After is in this cycle; Animate / Save are deferred.
- **Profile stats header** — Wardrobe / Outfits / Posts counts + per-category circles with item counts (Essembl 153 / 92 / 18 layout).
- **Comments UI restyling** — `Comments` component still carries voda tone.
- **OutfitBuilder + TryOn + GenerationDetail** — function but still voda-tone.
- **Recommendations** — weather / mood / travel / plan-driven suggestions.
- **Email sign-in** — Welcome page button is a "coming soon" placeholder; need Firebase email-link auth wiring.
- **Bookmark / Save** to a personal collection (voda had this; not ported).
- **Lookbook / "Looks" comparison** — side-by-side outfit browse (Image 22/23).
- **Server-side wear-log backfill** — past OOTDs don't populate existing items' wearLog. One-off script needed.
- **outfitCount field on profile** is server-maintained but only for `isListed=true` outfits; private outfits don't bump it (intentional or rename "publicOutfitCount"?).

### Suggested next cycle order

1. **Comments + share polish** on OutfitDetail (already has ShareButton; comments need restyling).
2. **OutfitBuilder + TryOn Lekondo-tone pass** so create flow looks consistent with the rest.
3. **Sticker Board** as a separate `/boards` route + service.
4. **OOTD photo recognition** — Gemini callable that returns item candidates + style label; UX confirms each before saving.
5. **Magic Upload** — bigger AI batch flow.
6. **Profile stats header + per-category circles** — purely client read against existing items.
