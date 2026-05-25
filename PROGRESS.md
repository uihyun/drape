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

---

## 2026-05-23 (later) — Audit pass + Boards + Photo analysis

After a live mobile-testing pass surfaced duplicate titles, broken camera trigger, missing delete-account flow and ugly stat-less profile header, this batch closes those out and lands the first two big "next-cycle" features.

### Done — audit / UX bugs

- MobileHeader becomes a floating ChevronLeft pill only — pages keep their own `<h1>` so the visible duplication on Settings / AddItem / OutfitBuilder is gone.
- Camera capture routes by platform: Capacitor → `@capacitor/camera`, mobile web → `<label>` wrapping `<input capture="environment">` (real user-gesture), desktop web → new `CameraCaptureModal` with `getUserMedia` (laptops have webcams; previously hidden, read as broken).
- OutfitBuilder: empty-closet state explains what to do + links to `/closet/add`; selected count surfaces in Save button label; Lekondo-tone `.page` shell.
- Settings: new Danger Zone card wires the existing `DeleteAccountModal` (voda's flow was orphaned). Full locale set added.
- Avatar onError fallback centralized into shared `<Avatar>` (used by Profile / PublicProfile / FeedCard / MobileTabBar) — Google profile photos that 403 in third-party contexts now show a letter/glyph instead of broken-image.
- `material-icons` swept out of Comments / OutfitList / Calendar / TryOn empty states.
- PWA `theme_color` and Capacitor splash bg flipped from #FAFAFA → #FFFFFF to match the white surfaces.

### Done — features

- **Profile stats** (`<ProfileStats>`): Wardrobe / Outfits / Posts three-up + scrollable per-category chips (only categories the user has > 0 items in). Wardrobe + Outfits counted client-side from existing subscriptions; Posts reads from the server-maintained `profile.outfitCount`.
- **Wear log** earlier this day: `ItemService.recordWear` writes `{date, ootdId, outfitId}` onto each item in an outfit when an OOTD is saved (idempotent on date, capped at 60 entries). ItemDetail shows "Last worn: YYYY-MM-DD · worn N×"; Closet search now matches wearLog dates so `"2026-05"` filters May 2026 items.
- **Sticker Boards** (`/boards`, `/boards/new`, `/boards/:id`): diary-style canvas. Pick items from the closet, drop them on a portrait board, drag / scale / rotate (S + R sliders when a sticker is selected), long-press for context menu (View item / Try-on / Last worn / Remove). Cover thumbnail = topmost sticker's photo. New `/boards` collection with owner-only Firestore rules. Wired into the create sheet.
- **Photo analysis** (`/analyze`): new `detectItems` Cloud Function (deployed) — Gemini Vision call against any uploaded photo, returns a short style label + per-piece category/colors/description/brand + a search query for each. UI lets the user save any detected piece into the closet (source photo as thumbnail) and follow a Google Images search link. Wired into the create sheet as "Analyze a photo".

### Live

- `https://drape-9e532.web.app` — hosting redeployed.
- `firestore.rules` redeployed (boards collection).
- `detectItems` Cloud Function created and deployed.

### Known gaps (deferred to next cycle)

- **[12] Magic Upload (multi-photo batch)** — `AnalyzePhoto` is a single-photo flow today. Extending it to accept `<input multiple>`, run `detectItems` per photo (sequentially to dodge timeouts), aggregate candidates, and dedupe is the next cycle's work.
- **[13] Item Animate / Save (AI video)** — needs a video-gen model (Veo etc.); not feasible until that's wired. Item Before/After toggle on the viewer is already in.
- **Per-detected-item cropping** — `detectItems` returns metadata only; the source photo is reused as the item's thumbnail. Gemini's bbox accuracy isn't good enough for clean cutouts yet without a second iterative prompt.
- **Sticker board sharing** — `boards.isPublic` is allow-listed in the rules but no UI publishes a board to the feed yet.
- **Wear log backfill** — past OOTDs don't populate existing items' wearLog. One-off script needed.
- **Profile stats outfitCount** counts only `isListed=true` outfits (server denorm). Private outfits don't bump it; could rename or add a private counter.
- **Email sign-in** — Welcome button still a placeholder; needs Firebase email-link auth wiring.
- **Bookmark / Save** — voda had this; not ported.
- **Looks comparison** — side-by-side outfit browse (Image 22/23).
- **Comments restyling** — `Comments` now uses lucide-free fallback for delete-`×` and Avatar for placeholder, but the bubble layout is still voda-tone.

### Suggested next cycle order

1. Magic Upload batch (extends `/analyze` to multi-photo).
2. Looks comparison view.
3. Comments tone + bookmark.
4. Per-detected-item cropping (second Gemini pass over the source photo with the picked bbox).
5. Email link auth.
6. Animate / Save — when video-gen access is sorted.

---

## 2026-05-24 — Magic Upload, item toolbar, IAM + Gemini model fix

Follow-on to the Lekondo cycle: live testing surfaced two blockers (everything stuck in "Processing", virtualTryOn returning 400) and a long tail of UI consistency issues. Closed the remaining `[12]` Magic Upload and `[13]` Item Action toolbar tasks, plus a string of polish fixes.

### Done — features

- **Magic Upload (`[12]`)** — `AnalyzePhoto` now accepts multiple files via `<input multiple>`. Each picked photo lands in a thumbnail row with status (pending / analyzing / done / failed). Analysis runs sequentially through `detectItems` to dodge Gemini rate-limits on a shared key. Results panel renders one block per source photo (style label + source-photo thumbnail + per-item rows). Save-to-closet works per item across any batch; remove individual photos with the × on the thumbnail.
- **Item action toolbar (`[13]`)** — ItemDetail "More" menu now exposes:
  - **Change photo** — file input → upload to the existing `items/{uid}/{itemId}/original.jpg` path → flip `status='processing'` → re-invoke `processItem`. Crop + tag pipeline reruns against the new source.
  - **Save image** — fetches the cropped URL and routes through `share-service.shareOrDownloadImage` (native share sheet on Capacitor, anchor download on web).
  - Animate stays deferred (needs a video-gen model). Before/After toggle on the photo was already in.
- **Profile shape unification** — Stats relabeled `Outfits · Closet · Boards` (no more `Wardrobe`); stat tiles are buttons that jump to the matching tab. Profile gets a Try-on tab (5 tabs total: Outfits / Calendar / Closet / Boards / Try-on). Quicklink chips removed from the stats row — the tab strip is the single source of truth. Tabs use `grid-auto-flow: column` so adding/removing one keeps a single row.
- **Avatar fallback** — Single `<Avatar>` component swaps to a letter / lucide User icon when the photoURL fails (Google profile images sometimes 403 in third-party contexts). Replaces the repeated inline pattern across Profile / PublicProfile / FeedCard / MobileTabBar.

### Done — fixes / polish

- **iPhone safe-area** via `--safe-top` (web = `env(safe-area-inset-top, 0px)`; native = `max(env, 50px) + 12px`), applied on every topmost surface (`.profile`, `.welcome`, `.community-feed`, `.header-mobile`).
- **MobileHeader** trimmed to a floating ChevronLeft pill — pages own their own `<h1>` so "설정 / 설정", "옷 추가 / 옷 추가" duplicates are gone.
- **Camera** routes by platform: Capacitor → `@capacitor/camera`; mobile web → `<label>` + `<input capture="environment">` (real user gesture, opens system camera); desktop web → new `CameraCaptureModal` (`getUserMedia` → `<video>` → canvas → JPEG). Laptops with webcams get the same flow.
- **Floating nav HIDE_NAV** extended to `/i/`, `/o/`, `/s/` (item viewer + outfit detail + share) — the pills were overlapping the dense edit / comments / chip rows.
- **AddItem / Analyze buttons** centered as narrow pills (320px max) — previously they spanned full container width and read as left-aligned.
- **Settings card titles** dropped the 0.12em uppercase tracking that was blowing out Korean syllables; section labels now use 0.02em (Latin opt-in keeps the small-caps look on `:lang(en)`).
- **PWA manifest** + Capacitor splash flipped from `#FAFAFA` → `#FFFFFF` to match the new surfaces.
- **Closet entrance** — items rain in with a 40ms staggered fade per index.

### Server-side fixes (the actually-blocking ones)

- **Cloud Run `allUsers` invoker** — all callable / https functions (`processItem`, `detectItems`, `claimHandle`, `deleteAccount`, `healthCheck`, `initializeUser`, `updateProfile`, `virtualTryOn`) were missing `roles/run.invoker` for `allUsers`, returning **401 at the Cloud Run gateway** before the function body ran. First deploy attempt had an org-policy build-permission warning; subsequent updates didn't re-establish the public IAM binding. Granted via `gcloud run services add-iam-policy-binding ... --member=allUsers --role=roles/run.invoker --region=us-central1` for each service.
- **Gemini model id** — `gemini-3-flash-image-preview` was returning 404 from v1beta. Verified via `listModels` that the model was rebranded to `gemini-3.1-flash-image-preview`. `processItem` (crop) was silently leaving items at `status='processing'` with the original photo as `croppedUrl` fallback; `virtualTryOn` Flash tier was failing outright. Updated constants in `functions/items.js` and `functions/tryon.js`; redeployed both functions.
- Pro model (`gemini-3-pro-image-preview`) and vision (`gemini-3-flash-preview`) kept their ids and were unaffected.
- Existing stuck items: open in ItemDetail → More → Reprocess. New uploads now crop + tag end-to-end.

### Live

- `https://drape-9e532.web.app` — hosting redeployed.
- `firestore.rules` redeployed (boards collection + wear-log fields earlier in the cycle).
- Functions redeployed: `updateProfile` (location field, earlier), `processItem` + `virtualTryOn` (model id fix), `detectItems` (created).

### Known gaps (next cycle)

- **Apple Sign-In** — user reported "permission denied". Needs Apple Developer Service ID Return URL verification and Firebase Apple provider config check. Code path is intact.
- **Item Animate** — AI video model wiring; defer until a video-gen API access is sorted.
- **Sticker board sharing** — `boards.isPublic` is allow-listed in rules but no UI publishes a board to the feed yet.
- **Wear-log backfill** — past OOTDs don't populate existing items' wearLog. A one-off script can scan.
- **Email link auth** — Welcome's third button still a placeholder.
- **Bookmark / Save** to a collection — voda pattern not yet ported.
- **Looks comparison** (Image 22/23) — side-by-side outfit browse.
- **Comments restyling** — Comments component uses Avatar fallback now but bubble layout is still voda-tone.
- **Per-detected-item cropping** — `detectItems` returns metadata only; source photo is reused as the item thumbnail.


---

## Cycle: 2026-05-25 — try-on polish, analyze depth, mobile, brand UX

### Try-on
- **Outfit-as-set picker** — TryOn page now has Items / Outfits sub-tabs. Picking an outfit pre-selects all ready items as a single set.
- **Bring-your-own photo (one-shot)** — `tryon-input/<uid>/<id>.jpg` storage path, `GenerationService.startTryOn({customPhotoBlob})`, `virtualTryOn(customPhotoPath)`. Prompt switches to surgical region-only swap; refs are bypassed.
- **Mode-split prompts** —
  - *custom-photo*: precise region replacement only; preserve background / pose / face / framing / unselected clothing exactly. Restored verbatim from 1bbfdbb after a region-by-region rewrite over-prescribed and broke results.
  - *identity-refs*: full strip-and-redress on a studio plate. Missing categories filled with neutral basics (explicitly forbids nude output).
- **`extractImage` bug fix** — Gemini Image echoes the input photos back in `candidates[0].content.parts` and appends the actual generation last. Taking the first inline image saved an input echo instead of the result. Walk all parts; keep last. Same fix applied to `functions/items.js` (item crop pipeline).
- **Async navigation** — TryOn submit + Regenerate fire-and-forget the callable, 1.5s race for fast results, navigate to `/profile/tryon` if it's still pending. TryOnHistory switched to a live `subscribeMyGenerations` so the pending card pops in within ~500ms (function pre-writes the pending doc before downloads).
- **Try-on reference thumbs** — uniform chip layout (object-fit:contain + 2px padding) so any source ratio shows at the same person-size; wrapped in a Link to `/settings` so tapping any thumb edits identity refs.
- **`identityRefs` empty state** — offers "Use a custom photo" alongside "Go to Settings" so first try-on doesn't require completing onboarding.

### Analyze
- **`AnalyzePhoto` redesign** — input mode (3:4 staged photo cards) and result mode (edge-to-edge hero photo, scrollable editorial breakdown). Storage permission rule added for `analyzed/{uid}/...`.
- **Detect prompt depth** — mirrors `analyzeOotd`: `mood`, 2-4 sentence editorial `notes`, 3 `stylingTips`, `palette` (3 swatches), `composition` (4 style axes × 0-5). `createAnalyzedOutfit` persists all fields.
- **Auto-name detected items** — `detectPrompt` returns a 2-4 word `name` per item; `createFromDetected` uses it first.
- **Detect-add crop** — `createFromDetected` writes `status='processing'` and triggers `processItem` with a `focus: {category, description}` hint so the model isolates the specific item from the multi-item source photo (instead of saving the raw photo as the closet item).
- **Saved-outfit flow** — analyses save into `outfits` with `kind='analyzed'`, source photo + `detectedItems[]` inline. OutfitList has Mine / Saved sub-tabs. Saved empty state gets two CTAs: Analyze a photo + Browse feed.

### Closet
- **Auto-name items** — `tagPrompt` returns a 2-4 word `name`; `processItem` patches `item.name` only if user hasn't set one.
- **Brands view + Usage view** — closet tabs are All / Categories / Brands / Usage. Brands grouped by `tags.brand` (case-insensitive); Usage = Worn (sorted by `wornCount`) + Never worn.
- **Editable brand** — ItemDetail tag editor has a free-text Brand row (60 chars).
- **Search** — already case-insensitive on name / category / brand (Closet.jsx:41-49).

### Identity refs
- **Head-crop fix** — `processIdentityRef` crop prompt explicitly demands TOP-OF-HEAD-to-FEET; stored PNG is `sharp.trim()`-ed after chroma-key so thumbnails render at uniform person-size regardless of source whitespace.
- **Settings thumbnail** — tap to lightbox-preview the full image; primary slot has accent border + "Primary" badge.

### Boards
- **Card thumbnail** — board cards now replay the sticker canvas (mini collage) at the stored x/y/scale/rotation instead of stretching the top sticker edge-to-edge.
- **Corner-drag resize + rotation handle** — sticker has 4 corner dots (resize by distance ratio) + 1 rotation dot above the top edge (angle delta from sticker center). Inverse-scale on handles so they stay constant visual size. Slider controls removed.
- **Missing composite index fix** — `boards (userId ASC, updatedAt DESC)` was missing from `firestore.indexes.json`; `subscribeMyBoards` failed silently and showed an empty list even when boards existed.

### OOTD likes
- `OotdService.toggleLike` mirrors `OutfitService.toggleLike`.
- Heart pill on OotdCard in Feed (optimistic + rollback).
- `LikeButton` inline component on OotdDetail.
- `firestore.rules` ootds update split into owner path + signed-in-user `likedBy/likeCount`-only path with strict ±1 validation.

### Handle
- **Editable** — Settings handle field unlocked (backend `claimHandle` already supported swap atomically).

### Mobile layout
- **No more horizontal overflow** — `closet-grid` / `outfit-grid` / `feed-grid` / `profile-tabs` use `minmax(0, 1fr)` so long item names don't push grid tracks past viewport; grid items get explicit `min-width: 0`; `outfit-grid` uses `minmax(min(220px, 100%), 1fr)`. `html, body { overflow-x: hidden; max-width: 100vw }` as safety net.
- **Profile tab font shrink** — @media (max-width: 480px) reduces `.profile-tab` font/padding so all 5 labels fit narrow phones.
- **Button stretch fix** — `.btn.board-action-btn` / `.btn.rate-regen` / `.btn.rate-delete` two-class compound selectors so they win specificity over `.btn { display:inline-flex }`. Removed legacy `main.css` mobile rule `.btn { max-width:300px }` that was clamping every button on phones.

### Feed
- **Sort tabs** (Latest / Popular) restored on Discover; Popular sorts by `likeCount` (single-field index).
- **OOTD-first feed** — Discover stream is `OotdService.listPublicFeed`.
- **Outfit / Board / OOTD card dates** — all card metas now include a `card-meta-date` next to the title (same pattern as try-on history).

### Items
- **Try-on outfit-missing-item tolerance** — TryOn filters out item ids the user no longer has when picking an outfit; backend rejects gracefully.
- **Crop prompt orientation** — `processItem` lets the model rotate/normalize the garment to a standard catalog product view per category (clothing axis-vertical, shoes side profile, bags upright, accessories centered). Length / silhouette / color / texture stay locked.

### Routing
- **`/u/:handle/:tab` alias** — handle-prefixed share URLs reserved for future public surfaces (boards, calendar). My-profile stays at `/profile/<tab>` per the explicit decision not to redirect (owner vs viewer have different perms and tabs).


---

## Cycle: 2026-05-25 — try-on root-cause sweep

Three real bugs surfaced during try-on testing and got tracked to their
actual roots after several wrong guesses. Notes here so we don't repeat
the mis-diagnoses next time.

### Bug 1 — "try-on result shows 6 identical tiles"
- Initial wrong theory: variantUrls had 6 entries (multiple runs / N
  default leaked / extractImage saving multiple images).
- Actual cause: variantUrls had ONE entry. Gemini Image returned a
  SINGLE PNG that contained a 6-up contact-sheet of the same
  composition. The if/then list structure in the identity-refs prompt
  ("If no top supplied, add ...; If no bottom supplied, add ...") read
  to the model as "show me options" and it laid them out as a grid.
- Fix: shortened the identity-refs prompt, dropped the listed
  if/then fallbacks (one neutral-fill sentence instead), and added
  an explicit OUTPUT FORMAT clause forbidding grid / collage /
  contact-sheet / side-by-side / before-after / multi-pose. Same
  guard added to the custom-photo prompt as a precaution.

### Bug 2 — "sneakers from a detect-add show up as 'Navy Athletic Shorts / Patagonia / bottom'"
- Initial wrong theory: detectItems prompt was returning bad
  categories; or sneakers were genuinely getting mis-classified.
- Actual cause: createFromDetected was writing correct tags from the
  detect step, then processItem ran tagPrompt on the FULL multi-item
  source photo (because that's the item's originalPath) and clobbered
  tags with whichever piece dominated the frame. The user picked
  sneakers, the source photo also had shorts and a top, Gemini Vision
  re-tagged the dominant garment.
- Fix: processItem now SKIPS the tag step when `focus` is provided
  (= detect-add path) and trusts the detect tags. status='ready'
  when focus is set even if crop fails, since the original photo +
  detect tags are already a usable item.

### Bug 3 — "custom-photo try-on swaps regions you didn't pick"
- Earlier rewrites (b5e1ebd) added a region-by-region itemized prompt
  intending to be more assertive, but ended up over-prescribing — the
  jacket got removed and trousers became shorts when the user only
  picked a top + footwear.
- Fix: restored the custom-photo prompt verbatim from commit 1bbfdbb
  ("REPLACE only the specific clothing region(s) that the supplied
  garments cover" + ABSOLUTE PRESERVATION RULES). identity-refs mode
  stays on the latest strip-and-redress shape with the neutral-fill
  sentence + anti-grid guard.

### Identity refs — held-item rule flip
- Old cropPrompt explicitly preserved "any items they are holding".
  Result: a bag in the ref photo showed up in every single try-on.
- New cropPrompt removes held / carried items (bags, phones, bottles,
  umbrellas, drinks, cameras, leashes), renders an empty hand in the
  same position, and explicitly KEEPS worn accessories (hats, glasses,
  earrings, necklaces, watches, belts). Reference = canvas of the
  person; props belong in the closet as separate items the user picks
  for a specific try-on.
- Existing refs were processed under the old prompt — user can delete
  & re-upload the ones with held items to pick up the new behavior.

### extractImage fix (kept)
- Gemini Image echoes input photos back in `candidates[0].content.parts`
  and appends the actual generation at the end. Returning the FIRST
  inline image saved an input echo. Now walks every part and keeps
  the LAST. Same fix in functions/items.js for the item crop pipeline.
