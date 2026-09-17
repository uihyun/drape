# Working notes for Claude Code sessions

Short, durable rules of engagement for drape. If you're picking up a session, read this first — it's faster than re-deriving from the code.

## Where things live

- `src/services/` — all data layer. Pages talk to services, never directly to Firestore. Adding a new server-touching call? Put it in a service first.
- `src/services/taxonomy.js` is the single source of truth for the closet tag vocab. `functions/taxonomy.js` must mirror it character-for-character; the auto-tag prompt enforces enums against the server copy.
- `functions/items.js`, `functions/tryon.js`, `functions/stylist.js` are the only Gemini-touching call sites (stylist added 2026-09-08, SPEC-1.6 — text-only flash, no image models there). Keep new model usage in these three — don't sprinkle `GoogleGenerativeAI` instantiation across modules.
- `functions/index.js` is exclusively wiring + helpers (auth, credits, rate limit). Real work belongs in a sibling module.

## Invariants

- **Item registration must feel instant.** `createItem()` returns as soon as the original is in Storage + the doc is at `status='processing'`. Never await the crop / tag work from the client.
- **Identity refs go into every try-on call.** Don't strip them to save tokens — face/body preservation is the product's reason to exist.
- **Every try-on writes a Generation doc, including failures.** That table is the feedback-loop training data for an eventual self-hosted model (brief §8).
- **Auto-tag output is sanitized against the closed vocab** (`sanitizeTags` in `functions/items.js`). Don't loosen that — a hallucinated tag silently breaks search/filter.
- **OOTD doc ids are not constrained.** Multiple OOTDs per day is supported — `OotdService.upsertOotd({ id?, date, ... })` creates auto-id when no `id`, updates the given one when set. Pick the calendar representative via `isCalendarRep: true` (set by `setCalendarRepresentative`); fallback is most-recent `createdAt`.
- **Marketplace currency lives on the item.** Stamped from the seller's `profile.location.country` at list time and rendered via `utils/currency.js`. Never derive currency from the viewer's locale.
- **DM thread id is deterministic.** `${sortedUidPair}_${itemId}`. `MessageService.openThread` does setDoc-with-merge (no getDoc — the participants-only read rule denies on non-existent docs). `activeIn[uid]` presence flag suppresses unread bumps for the recipient when they're already watching the room.
- **Comments parent collection is a parameter.** `CommentService.subscribe / addComment / deleteComment` take `(parentColl, parentId, …)`. Allowed parents are `outfits | ootds | boards` (whitelisted in the service).
- **Push notifications are native-only.** `PushService.ensureRegistered()` is gated on `Capacitor.isNativePlatform()`; web is a no-op (the Firestore stream + in-app badge cover web). Tokens go to `users/{uid}/fcmTokens/{token}`, fanned out by `functions/messages.js`.
- **Unlisting a marketplace item keeps its price/condition.** "Remove from sale" sets `forSale: false` only — `priceAsking`/`priceOriginal`/`conditionGrade`/`currency` stay so a re-list restores them, and the listing's DM threads survive. "Edit listing" updates in place (never delete + recreate — that would orphan the threads).
- **Linked items slot under their detected piece.** `outfit.pieceLinks` = `{ pieceIndex: [itemId] }` (index into `outfit.pieces`). Assigned in `OutfitLink` (0 matching-category pieces → unsorted, 1 → auto, 2+ → picker modal; `piecesForItem` narrows by subcategory first). OutfitDetail renders linked items under each `PieceRow`; unmatched go to "Other items". Keep `pieceLinks` in the `updateOutfit` allowlist + firestore.rules.
- **Trends is self-running.** `functions/trends.js` re-picks "This week's looks" whenever the ISO week (Monday) rolls over, the daily 04:30 UTC cron refreshes the stats, and the masthead photo rotates per page load from that slate (excluded from the row below). Admin feature/cover/hide overrides the CURRENT week only. `LOOKS_MAX` caps both the auto-pick and the manual list — keep them on that one constant, and never hardcode content exclusions (watermarks etc. belong to the seed pipeline).
- **AI model ids are server config, not constants.** `functions/model-config.js` reads `config/models` (5-min cache, strict id/size validation, falls back to baked defaults on anything malformed) and every Gemini call site resolves through `getModels()`. Switching or rolling back a model is an /admin → Config edit — never a functions deploy. Keep new call sites on `getModels()`; the constants in items/tryon/stylist are documentation of the defaults only.
- **Stylist economics: 3 free recs/day, then 1 fit per rec — ONE wallet.** `reserveRecOrFit` in `functions/stylist.js` shares the fits reserve/refund with try-on; never add a second refillable currency. Recs are text-only flash; stated prefs (`profiles.stylePrefs`) are read fresh on every call and outrank inferred taste. Personas are illustrated, explicitly-AI characters — never photoreal, never posing as users.
- **Five locales: en / ko / ja / es / fr.** Spanish is ONE neutral Spanish for
  every market (`tú`, never `vosotros`; vocabulary a reader in Madrid, Mexico
  City or Buenos Aires all recognises) — not a national variant, and not split
  into es-ES/es-419. French is France French, vouvoiement throughout. Adding a
  language is not just a locale file: `useLocale` (LOCALES + LANG_LABELS),
  `Landing` (LANG_FLAG), `remote-copy`, `cities`, `Trends` (BCP47), `Admin`
  (CFG_LANGS), `functions/{admin,notifications,stylist,profile,items,translate}.js`,
  `scripts/{check,build-web-pages}.mjs`, `legal.js`, `index.html`
  (hreflang + og:locale + the crawlable "Languages:" line), iOS
  `CFBundleLocalizations`, and the screenshot captions in
  `build-app-store-screenshots-b.cjs`. Miss `translate.js` and the
  translate-this-post toggle silently falls back to English for that language;
  miss `CFBundleLocalizations` and the App Store lists the app as English-only.
  `npm run check` enforces key parity across all five.
- **Home screen follows the closet, unless the user said otherwise.**
  `getHomeRoute(uid)` in `services/homePref.js`: an explicit pref wins; with
  none, an empty closet lands on `/trends` and a stocked one on `/profile`
  (read synchronously from the `drape:itemCount:{uid}` cache). The profile asks
  once, via `HINT_HOME_FLIP`, the first time a closet stops being empty. A
  fixed default can't serve both ends — don't "simplify" it back to one.
- **Onboarding is a deck then a tour, never stacked popups.** `Onboarding`
  says what drape is; `Tour` (scrim + spotlight on one real control) says where
  it lives. Tour steps carry `data-tour` attributes on the targets and locale
  keys for copy, so both the flow and the words survive a restyle and are
  server-overridable. Don't add a third simultaneous overlay.
- **Never use `animation-fill-mode: both` on a grid card.** A filling animation
  outranks inline styles, so it permanently pins `transform` and silently kills
  every FLIP/transform effect on that element (cost us the closet pinch
  animation; `itemDrop` uses `backwards`). Same trap applies to any card the
  `useFlipGrid` hook animates.
- **`npm run check` is the runtime-crash gate, not a linter.** It carries the
  named-import audit, locale parity across all four languages, an undefined-CSS-var
  scan, and eslint with `rules-of-hooks` + `no-undef` — every rule there exists
  because that exact class of bug shipped once. Add to it when a new class
  escapes; don't relax it.
- **Server-editable copy layer** (`config/copy`): t() string overrides, onboarding steps, and the notice banner — edited in /admin → Config via `adminSetConfig` (server validates against the client parsers). Missing/malformed doc always falls back to bundled; don't break that contract.
- **Share-import fetches stay SSRF-disciplined** (`functions/import.js`): https only, DNS-checked public IPs, every redirect hop re-validated, size/time caps. Don't loosen for a convenience case.
- **iOS uses the UIScene lifecycle; don't put URL handling back on AppDelegate.**
  iOS 27 traps at launch (`EXC_BREAKPOINT` in
  `__UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`) for any app
  linked against the iOS 27 SDK without a scene manifest — it rejected 2.1.0
  build 16. Capacitor's template is still legacy, so `Info.plist`'s
  `UIApplicationSceneManifest` and `SceneDelegate.swift` are ours to maintain
  across `npx cap sync`. Google OAuth and Sign in with Apple callbacks arrive at
  `scene(_:openURLContexts:)` and at `connectionOptions.urlContexts` on cold
  start; `application(_:open:options:)` is never called again and re-adding it
  compiles, runs, and silently never fires.
- **Store assets live in `resources/app-store/`, not on the Desktop.** Captures,
  the recovered shipped decks, the current poster decks, the look photos the
  hero slides are cut from, and the per-locale listing copy. The renderer is
  `scripts/build-store-posters.cjs` and that folder's README carries the deck
  order and why each slide sits where it does. They were once outside any repo,
  which is how they went missing. `store-metadata.md` separates **settled** App
  Review requirements (account deletion, Apple Sign-In, export compliance, push
  — all built, verified, accepted) from the fields that reset every version;
  read it before asking whether something exists.
- **The two stores do not take the same submission.** App Store: 10 screenshots,
  4000-character release notes. Play: 8 screenshots, **500**. Poster filenames
  carry `-ios-only` for the two Play cannot take, and each `listing-*.md` holds a
  separate, shorter Play release-note block — never a truncation of the App Store
  text.
- **A stylist persona needs a signature, refusals and a voice, not just a lens.**
  `functions/stylist.js` feeds the user's taste profile, stated preferences
  (marked authoritative), thumbs history and avoid-list *below* the persona line,
  and all of it is more specific — so a lens alone lets four stylists converge on
  the same safe pick. The refusals separate them hardest (they remove options the
  others would take) and the voice is what the user actually reads. Verify a
  persona change by running all four against one closet before shipping; that
  check is what caught Juno sneering at the user's clothes.
- **Brand mark is the ivory Didot-italic `drape` wordmark on espresso ink `#141312`.** Sources in `resources/*.svg` (+ `public/wordmark.png`, `public/favicon.*`, `public/icons/*.webp`); regenerate via the sharp-based build (Didot is a macOS system font, baked into the rasters). Favicon is the single `d` monogram. After changing them, native needs `npx capacitor-assets generate && npx cap sync`.

## Stack reminders

- React 18 + Vite + react-router-dom v7 + Firebase v11 + Capacitor 7.
- Cloud Functions runtime: Node 22, v2 SDK. `onCall` for new endpoints (gives auth + CORS for free); `onRequest` only when we need raw HTTP.
- Gemini SDK is `@google/generative-ai` (already in `functions/package.json`); image generation uses the newer `@google/genai` (supports `imageConfig.imageSize`). Model ids: `gemini-3.1-flash-image` @1K (try-on, `IMAGE_TRYON` in tryon.js — moved off Pro after an A/B showed parity at much lower cost + ~2x faster; 1K because the result is normalized to 900×1200 anyway), `gemini-3.1-flash-lite-image` @1K (item crop, `IMAGE_CROP` in items.js), `gemini-3.5-flash` (vision tagging + OOTD analysis). Image moderation is Cloud Vision SafeSearch, face-blur is Cloud Vision FACE_DETECTION.

## Don't

- Don't reintroduce voda's interior-design helpers (`paint-match`, `shopping-links`, `EditRegionModal`, the 38 interior styles). They were deliberately removed.
- Don't add a user-facing model-tier selector for try-on. Try-on is a SINGLE fixed model (now `gemini-3.1-flash-image` @2K, `IMAGE_TRYON`); `virtualTryOn` ignores any `modelTier` param older clients still send. (Moving the fixed model is fine when an A/B justifies it — that's how it went Pro→3.1-flash; a per-user *selector* is what we don't want.)
- Don't write planning / spec docs unless asked — keep notes in `PROGRESS.md`.
- Keep `CHANGELOG.md` current: every shippable change gets a detailed entry under the right version (newest first). The store-facing release notes are a short subset; `CHANGELOG.md` is the full internal record. Bump the version in 3 places together when building native — `package.json`, `android/app/build.gradle` (versionName + versionCode), iOS `project.pbxproj` (MARKETING_VERSION + CURRENT_PROJECT_VERSION).
- Don't commit secrets. `GEMINI_API_KEY` lives in a Firebase secret; the dev value is in `.env` (gitignored).

## Conventions worth keeping

- All comments in code are *why*, not *what*. If a comment just restates the line below it, delete it.
- Korean comments are fine where context is Korean-specific (regex of Korean profanity, KO-only feature decisions); everything else is English.
- One service per concern. Don't grow `item-service.js` into a god-module — split when it crosses 250 lines.
