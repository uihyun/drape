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

## Stack reminders

- React 18 + Vite + react-router-dom v7 + Firebase v11 + Capacitor 7.
- Cloud Functions runtime: Node 22, v2 SDK. `onCall` for new endpoints (gives auth + CORS for free); `onRequest` only when we need raw HTTP.
- Gemini SDK is `@google/generative-ai` (already in `functions/package.json`). Model ids: `gemini-3-pro-image-preview` (Pro / Nano Banana Pro), `gemini-3-flash-image-preview` (Flash / Nano Banana 2), `gemini-3-flash-preview` (vision tagging).

## Don't

- Don't reintroduce voda's interior-design helpers (`paint-match`, `shopping-links`, `EditRegionModal`, the 38 interior styles). They were deliberately removed.
- Don't add a 4th tier of model routing. Two tiers (Pro / Flash) is enough until we hear from users.
- Don't write planning / spec docs unless asked — keep notes in `PROGRESS.md`.
- Don't commit secrets. `GEMINI_API_KEY` lives in a Firebase secret; the dev value is in `.env` (gitignored).

## Conventions worth keeping

- All comments in code are *why*, not *what*. If a comment just restates the line below it, delete it.
- Korean comments are fine where context is Korean-specific (regex of Korean profanity, KO-only feature decisions); everything else is English.
- One service per concern. Don't grow `item-service.js` into a god-module — split when it crosses 250 lines.
