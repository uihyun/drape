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
- **Every try-on writes a Generation doc, including failures.** That table is the feedback-loop training data for an eventual self-hosted model (brief §8). A *duplicate request* is not a try-on: an identical call while one is still running returns the running generation (`duplicate: true`) with no doc and no charge — the lock is `users/{uid}/private/tryonLock`, claimed in a transaction. Keep that server-side guard even though the client guards too; one tap once spent three fits.
- **Auto-tag output is sanitized against the closed vocab** (`sanitizeTags` in `functions/items.js`). Don't loosen that — a hallucinated tag silently breaks search/filter.
- **OOTD doc ids are not constrained.** Multiple OOTDs per day is supported — `OotdService.upsertOotd({ id?, date, ... })` creates auto-id when no `id`, updates the given one when set. Pick the calendar representative via `isCalendarRep: true` (set by `setCalendarRepresentative`); fallback is most-recent `createdAt`.
- **Marketplace currency lives on the item.** Stamped from the seller's `profile.location.country` at list time and rendered via `utils/currency.js`. Never derive currency from the viewer's locale.
- **DM thread id is deterministic.** `${sortedUidPair}_${itemId}`. `MessageService.openThread` does setDoc-with-merge (no getDoc — the participants-only read rule denies on non-existent docs). `activeIn[uid]` presence flag suppresses unread bumps for the recipient when they're already watching the room.
- **Comments parent collection is a parameter.** `CommentService.subscribe / addComment / deleteComment` take `(parentColl, parentId, …)`. Allowed parents are `outfits | ootds | boards` (whitelisted in the service).
- **Push notifications are native-only.** `PushService.ensureRegistered()` is gated on `Capacitor.isNativePlatform()`; web is a no-op (the Firestore stream + in-app badge cover web). Tokens go to `users/{uid}/fcmTokens/{token}`, fanned out by `functions/messages.js`.
- **Unlisting a marketplace item keeps its price/condition.** "Remove from sale" sets `forSale: false` only — `priceAsking`/`priceOriginal`/`conditionGrade`/`currency` stay so a re-list restores them, and the listing's DM threads survive. "Edit listing" updates in place (never delete + recreate — that would orphan the threads).
- **Linked items slot under their detected piece.** `outfit.pieceLinks` = `{ pieceIndex: [itemId] }` (index into `outfit.pieces`). Assigned in `OutfitLink` (0 matching-category pieces → unsorted, 1 → auto, 2+ → picker modal; `piecesForItem` narrows by subcategory first). OutfitDetail renders linked items under each `PieceRow`; unmatched go to "Other items". Keep `pieceLinks` in the `updateOutfit` allowlist + firestore.rules.
- **Trends is self-running.** `functions/trends.js` re-picks "This week's looks" whenever the ISO week (Monday) rolls over, the daily 04:30 UTC cron refreshes the stats, and the masthead photo rotates per page load from that slate (excluded from the row below). Admin feature/cover/hide overrides the CURRENT week only. `LOOKS_MAX` caps both the auto-pick and the manual list — keep them on that one constant, and never hardcode content exclusions (watermarks etc. belong to the seed pipeline). The auto-pick puts **real users' looks ahead of seeds**, but only ones that pass `featurable()` (2+ AI-detected pieces, cutout ready, no reports) — priority for real people, never an unconditional slot.
- **Models: newest GA, best value, never `-preview`/`-latest` (owner,
  2026-10-09).** The inventory, prices and switch plan are in
  `docs/AI-MODELS.md`; A/B before any switch, and keep that doc current.
- **AI model ids are server config, not constants.** `functions/model-config.js` reads `config/models` (5-min cache, strict id/size validation, falls back to baked defaults on anything malformed) and every Gemini call site resolves through `getModels()`. Switching or rolling back a model is an /admin → Config edit — never a functions deploy. Keep new call sites on `getModels()`; the constants in items/tryon/stylist are documentation of the defaults only.
- **Credits are the one currency (owner, 2026-10-09).** `functions/credits.js`
  owns the wallet. Users see "credits / 크레딧", never "fits", because "fit"
  is also a closet filter and means silhouette in Korean.
  - Prices are whole numbers on a 10x scale: a try-on (or regenerate) costs
    10, and a chat message, verdict or legacy rec costs 1. That roughly
    follows cost (an image is ~$0.07, a Flash text call ~$0.005).
  - 50 free a day, reset at local midnight (`profiles.timezone`, synced from
    the device). Invites give +100 to both sides.
  - **The free allowance doesn't carry over; the balance always does**
    (`creditDailyUsed` vs `creditBalance`). Free is spent first, and a charge
    can split across the two. Something earned or paid for must never expire.
  - `refundCredits` gives back exactly the charge. The daily part only on the
    same day.
  - Legacy fits docs convert on first touch, value for value (`fitBonus` x10,
    `style*Extra` +1). The `fit*` fields stay written as a mirror because
    2.2.1 apps draw their N/5 meter from them; drop the mirror once 2.2.1 is
    gone.
  - The out-of-credits error token stays `out_of_fits`, because every app
    build matches on it. `src/hooks/useCredits.js` mirrors `walletOf`.
  Never add a second refillable currency. Recs are text-only flash; stated prefs (`profiles.stylePrefs`) are read fresh on every call and outrank inferred taste. Personas are illustrated, explicitly-AI characters — never photoreal, never posing as users.
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
- **The bottom bar is the map: Trends · Stylist · (+) · Closet · Settings.**
  Stylist and Settings live in the bar, not the Profile header (which keeps
  only inbox + bell). A 5th slot for notifications/DMs was rejected on data —
  nearly nobody receives either yet; revisit when that changes. The Tour walks
  the bar; bump `TOUR_KEY` only when where things live changes, never for copy.
- **The stylist is a chat; threads are server-written.**
  `users/{uid}/stylistChats/{persona}_{YYYY-MM-DD}/messages`: one thread per
  persona per local day; past days are the read-only archive. Rules allow
  owner read only, and `stylistChat` writes both turns in one batch. Outfits
  in a reply are closet ids validated by `cleanOutfits`. Any reply with
  outfits also writes a `stylistRecs` doc, so thumbs and the admin charts keep
  working. `styleRecommend` stays deployed for older app builds.
- **Weather place is private and comes from the device or a search, never a
  guess.** It is stored at `users/{uid}/private/weatherPlace`, never on the
  world-readable profile.
  - Asked once, the first time a weather screen opens. Rounded to ~1km on the
    device before sending, so it stays "approximate location" for the store
    labels.
  - Declined → city search; nothing → no weather. A timezone guess showed LA
    weather in Seattle, so don't add one back.
  - City search runs on the server (`weatherSearch`) and merges Open-Meteo
    with Nominatim, because Open-Meteo returns nothing for Hangul/Kanji.
    Keep Nominatim server-side: it allows 1 req/s and needs a User-Agent.
    North Korea is excluded.
- **Personal color is stated, never inferred from a photo.** Lighting and
  phone processing move undertone more than the gap between seasons.
  `stylePrefs.personalColor` is a closed enum (`PERSONAL_COLORS`, mirrored in
  both taxonomy files) and steers near-face colours only — a preference, not a
  ban; `avoidColors` stays the only hard colour rule.
- **Bottom-bar pill: position on `translate`, size on `scale` — never
  `transform` with `scale`.** The individual `scale` property is applied AFTER
  `transform`, so a `translateX` in `transform` gets multiplied by the lens
  size: the swollen pill drifted ~45px off its tab and slid back as it shrank
  (the first droplet attempt, reverted 2026-10-07). `translate` is applied
  before `scale` and isn't scaled. Same rule for any element that slides and
  scales independently. Also clear the press position only on a real route
  change, never on a timer after pointer-up.
- **`npm run check` is the runtime-crash gate, not a linter.** It carries the
  named-import audit, a service-object member audit (`XService.fn` must exist
  on the exported object — Settings crashed on that once), locale parity
  across all five languages, an undefined-CSS-var
  scan, and eslint with `rules-of-hooks` + `no-undef` — every rule there exists
  because that exact class of bug shipped once. Add to it when a new class
  escapes; don't relax it.
- **Server-editable copy layer** (`config/copy`): t() string overrides, onboarding steps, and the notice banner — edited in /admin → Config via `adminSetConfig` (server validates against the client parsers). Missing/malformed doc always falls back to bundled; don't break that contract.
- **Share-import fetches stay SSRF-disciplined** (`functions/import.js`): https only, DNS-checked public IPs, every redirect hop re-validated, size/time caps. Don't loosen for a convenience case.
- **iOS is on the UIScene lifecycle; don't put URL handling back on AppDelegate.**
  iOS 27 traps at launch (`EXC_BREAKPOINT` in
  `__UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`) for any app
  linked against its SDK without a scene manifest — it rejected 2.1.0 build 16.
  Capacitor 8.5 adopts scenes officially, so `SceneDelegate.swift` is Capacitor's
  file plus one line: GIDSignIn gets first refusal in `scene(_:openURLContexts:)`
  before `SceneDelegateProxy`. Google OAuth and Sign in with Apple arrive there,
  and at `connectionOptions.urlContexts` on a cold start;
  `application(_:open:options:)` is never called again, and `cap migrate` leaves
  the stale copy behind with only a warning — re-adding it compiles, runs, and
  silently never fires.
- **`@capacitor-firebase/*` stays on 7.5.0 while the rest of Capacitor is on 8.**
  Its 8.x line peers on `firebase@^12` and the web SDK is on 11. The 7.5.0 peer
  is `@capacitor/core: >=7.0.0`, so it runs on 8 unchanged.
  `@capacitor-community/apple-sign-in` has no 8.x at all, same open peer.
- **Share passes EITHER `url` OR a self-contained `text`, never both.**
  `shareLink` drops `text` whenever a `url` is present, because iOS's share
  sheet and several Web Share targets flatten the two into one string with no
  separator. That welded the category label onto every shared item link
  (".../i/dt_…_hgykmvAccessory" — a dead link) on 2,365 of 2,387 items from
  2026-05-23 to 2026-09-21, and appended the whole notes paragraph on outfits.
  So: a LINK share passes `url` and puts anything descriptive in `title`; a
  MESSAGE share (invites, where the code must survive and nothing reads
  `?invite=` yet) writes the link into `text` and omits `url`. Same trap on
  `shareOrDownloadImage`, whose `url` is a file:// URI.
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
- Gemini SDK is `@google/generative-ai` (already in `functions/package.json`); image generation uses the newer `@google/genai` (supports `imageConfig.imageSize`). Model ids: `gemini-3.1-flash-image` @1K (try-on, `IMAGE_TRYON` in tryon.js — moved off Pro after an A/B showed parity at much lower cost + ~2x faster; 1K because the result is normalized to 900×1200 anyway), `gemini-3.1-flash-lite-image` @1K (item crop, `IMAGE_CROP` in items.js), `gemini-3.8-flash` (vision tagging + OOTD analysis + stylist + translate; was 3.5-flash until 2026-10-09). Image moderation is Cloud Vision SafeSearch, face-blur is Cloud Vision FACE_DETECTION.

## Don't

- Don't reintroduce voda's interior-design helpers (`paint-match`, `shopping-links`, `EditRegionModal`, the 38 interior styles). They were deliberately removed.
- Don't add a user-facing model-tier selector for try-on. Try-on is a SINGLE fixed model (now `gemini-3.1-flash-image` @1K, `IMAGE_TRYON`; see docs/AI-MODELS.md); `virtualTryOn` ignores any `modelTier` param older clients still send. (Moving the fixed model is fine when an A/B justifies it — that's how it went Pro→3.1-flash; a per-user *selector* is what we don't want.)
- Don't write planning / spec docs unless asked — keep notes in `PROGRESS.md`.
- Keep `CHANGELOG.md` current: every shippable change gets a detailed entry under the right version (newest first). The store-facing release notes are a short subset; `CHANGELOG.md` is the full internal record. Bump the version in 3 places together when building native — `package.json`, `android/app/build.gradle` (versionName + versionCode), iOS `project.pbxproj` (MARKETING_VERSION + CURRENT_PROJECT_VERSION).
- Don't commit secrets. `GEMINI_API_KEY` lives in a Firebase secret; the dev value is in `.env` (gitignored).

## Conventions worth keeping

- All comments in code are *why*, not *what*. If a comment just restates the line below it, delete it.
- Korean comments are fine where context is Korean-specific (regex of Korean profanity, KO-only feature decisions); everything else is English.
- One service per concern. Don't grow `item-service.js` into a god-module — split when it crosses 250 lines.
