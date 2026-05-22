# Roadmap

Source of truth for what drape is building, in order. Adapted from `drape-app-brief.md`. Updated as we ship.

## MVP — first public release

The point of v0 is to prove **the loop**: snap clothes → tag automatically → try them on → save outfit → log OOTD. Anything that doesn't reinforce that loop waits.

- [x] Closet
  - [x] Camera + upload → item upload with placeholder skeleton card
  - [x] Background-remove (Nano Banana Pro/Flash) + auto-tag (Gemini Flash vision) running asynchronously after upload
  - [x] Closed tag vocabulary (category, subcategory, colors, seasons, styles, fit)
  - [x] Owner-only edit / favorite / archive / re-process / delete
  - [x] Filter chips by category
- [x] Virtual try-on
  - [x] Identity reference photos (2–3 full-body) stored on user doc, used in every try-on call
  - [x] `virtualTryOn` callable — N parallel variants, identity-preservation prompt, model-tier routing (Pro vs Flash)
  - [x] Variant gallery + 👍 / 👎 / regenerate
  - [x] Generation table records inputs + outputs + rating (feedback loop foundation, brief §8)
- [x] Outfits
  - [x] Build an outfit from closet items (picker UI)
  - [x] Outfit detail page — try-on, publish/unlist, delete
- [x] OOTD calendar
  - [x] Month view, per-day cells with selfie or outfit pill
  - [ ] Tap-day flow to attach an outfit or selfie  *(scaffold present, action sheet TBD)*
- [x] Feed
  - [x] Latest / popular sort
  - [x] Like + comment (existing voda plumbing migrated to outfits)
  - [ ] Following tab + style-tag filter chips  *(component scaffold exists; wire after first users)*
- [x] Identity / settings
  - [x] Identity ref management
  - [x] Language switcher (en / ko)
  - [x] Sign-in / out, legal links
- [x] Auth, credits, anonymous → signed-in claim
- [x] Reports + automated SFW moderation gate (carried over from voda, repointed at outfits/items)
- [ ] Onboarding camera-guide overlay  *(brief §7 — show good/bad ref examples inline; today only modal copy)*

## Phase 2 — once v0 has real users

- Hair / lip / makeup variations on the existing try-on result *(same Nano Banana Pro call, different prompt template)*
- "Same outfit, different place / TPO" backgrounds
- Friend / couple matching — share closets, generate matching outfits, try each other's clothes
- Outfit suggestions (today's weather + my closet)
- Lookbook (`/c/:id`) curation pages, public collections

## Later

- Card-style clothing swap / sale (당근식 교환)
- "Find me this look" — snap a shop product, search across the community closet
- Self-hosted try-on (IDM-VTON / CatVTON / Leffa) trained on the accumulated Generation table — only worthwhile once we have signal on the closed-API ceiling

## Known cuts

- **3D scanning** — explicit non-goal for MVP. Registration friction is too high; we'd lose the "open the app, snap a piece" simplicity.
- **Stripe web checkout** — not in v0. Pro tier is iOS/Android IAP via RevenueCat first; web billing comes when we have web sign-ups asking for it.
