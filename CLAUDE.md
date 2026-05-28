# Working notes for Claude Code sessions

Short, durable rules of engagement for drape. If you're picking up a session, read this first — it's faster than re-deriving from the code.

## Where things live

- `src/services/` — all data layer. Pages talk to services, never directly to Firestore. Adding a new server-touching call? Put it in a service first.
- `src/services/taxonomy.js` is the single source of truth for the closet tag vocab. `functions/taxonomy.js` must mirror it character-for-character; the auto-tag prompt enforces enums against the server copy.
- `functions/items.js`, `functions/tryon.js` are the only Gemini-touching call sites. Keep new model usage there — don't sprinkle `GoogleGenerativeAI` instantiation across modules.
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

## Stack reminders

- React 18 + Vite + react-router-dom v7 + Firebase v11 + Capacitor 7.
- Cloud Functions runtime: Node 22, v2 SDK. `onCall` for new endpoints (gives auth + CORS for free); `onRequest` only when we need raw HTTP.
- Gemini SDK is `@google/generative-ai` (already in `functions/package.json`). Model ids: `gemini-3-pro-image-preview` (try-on — Pro only, the Flash image tier was removed), `gemini-3-flash-preview` (vision tagging + OOTD analysis). The vision/tagging Flash use is unrelated to the dropped image tier.

## Don't

- Don't reintroduce voda's interior-design helpers (`paint-match`, `shopping-links`, `EditRegionModal`, the 38 interior styles). They were deliberately removed.
- Don't reintroduce a Flash try-on tier or any model-tier selector. Try-on is Pro-only — the split wasn't worth the quality drop. `virtualTryOn` ignores any `modelTier` param older clients still send.
- Don't write planning / spec docs unless asked — keep notes in `PROGRESS.md`.
- Don't commit secrets. `GEMINI_API_KEY` lives in a Firebase secret; the dev value is in `.env` (gitignored).

## Conventions worth keeping

- All comments in code are *why*, not *what*. If a comment just restates the line below it, delete it.
- Korean comments are fine where context is Korean-specific (regex of Korean profanity, KO-only feature decisions); everything else is English.
- One service per concern. Don't grow `item-service.js` into a god-module — split when it crosses 250 lines.
