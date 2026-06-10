# Roadmap

Source of truth for what drape is building, in order. Adapted from `drape-app-brief.md`. Updated as we ship.

## MVP — first public release

The point of v0 is to prove **the loop**: snap clothes → tag automatically → try them on → save outfit → log OOTD. Anything that doesn't reinforce that loop waits.

- [x] Closet
  - [x] Camera + upload → item upload with placeholder skeleton card
  - [x] Background-remove (Nano Banana Pro/Flash) + auto-tag (Gemini Flash vision) running asynchronously after upload
  - [x] Closed tag vocabulary (category, subcategory, colors, seasons, styles, fit)
  - [x] Owner-only edit / favorite / archive / re-process / delete
  - [x] Filter chips by category, brand, usage (elapsed-time buckets)
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
  - [x] Tap-day flow — OotdSheet to attach an outfit / board / try-on / selfie
  - [x] Multi-OOTD per day with user-pickable representative for the calendar cell
- [x] Feed
  - [x] Latest / popular sort (OOTDs + boards)
  - [x] Like + comment on outfits, OOTDs, boards
  - [ ] Following tab + style-tag filter chips  *(component scaffold exists; wire after first users)*
- [x] Identity / settings
  - [x] Identity ref management
  - [x] Language switcher (en / ko / ja)
  - [x] Sign-in / out, legal links
- [x] Auth, anonymous → signed-in claim
- [x] Reports + Block, exposed via reusable ⋯ MoreMenu on item / ootd / board / profile
- [x] Automated SFW moderation gate (carried over from voda, repointed at outfits/items)
- [ ] Onboarding camera-guide overlay  *(brief §7 — show good/bad ref examples inline; today only modal copy)*

## Phase 2 — once v0 has real users

- [x] Card-style clothing swap / sale (당근식 교환) — shipped as marketplace v1: listing fields on items (sale toggle, original/asking price, condition grade, currency stamped from seller's city), `/market` grid with condition filter, DM (`threads/{threadId}/messages`) with presence-aware unread badges, idempotent thread opening, deep-linkable from Inbox.
- [ ] Marketplace v2 — city / location filter (denormalize sellerCity), price-range, Toss Payments escrow, CJ방문수거 합배송.
- [ ] Push notifications — code scaffold complete (`functions/messages.js` for DM + `push-service.js` for token registration). Pending user actions: APNs key upload to Firebase, Xcode Push + Background Modes capabilities, Android google-services.json. See `CAPACITOR_SETUP.md` §8-3.
- [ ] Per-user notification settings page (`/settings/notifications`).
- [ ] Native analytics — web `firebase/analytics` is gated to web-only (`if (!isNativeApp())` in `src/firebase.js`; the JS SDK doesn't work in the Capacitor webview), so iOS/Android currently collect no analytics. Add `@capacitor-firebase/analytics` (same family as the auth/messaging plugins) to feed the same Firebase project from native, route `logEvent` through it on native. NOTE: changes the Play Data safety declaration — must add App interactions, Device or other IDs (AD_ID), approximate location, "Analytics" purpose, and the Android 13+ AD_ID permission. Do as a fast-follow after first launch and update Data safety + Data types then.
- [ ] Push triggers for like / follow / weekly digest / dormant OOTD reminder — same `messages.js` shape, different Firestore events.
- [ ] Hair / lip / makeup variations on the existing try-on result *(same Nano Banana Pro call, different prompt template)*.
- [ ] "Same outfit, different place / TPO" backgrounds.
- [ ] Friend / couple matching — share closets, generate matching outfits, try each other's clothes.
- [ ] Outfit suggestions (today's weather + my closet).
- [ ] Lookbook (`/c/:id`) curation pages, public collections.

## Later

- Rebrand consideration (decide after traction). "drape" is generic + crowded in App Store search (many fashion/wardrobe "Drape*" apps, some with hundreds of ratings) — hurts *organic store-search* discovery and is hard to trademark/defend. Mitigation for now: drive acquisition through owned channels (drape.nyc + direct store links) and ASO subtitle/keywords rather than the bare name. A distinctive Lekondo-style name would help long-term organic discovery + trademark, but a post-launch rename is costly (brand assets, both store names, domain). Revisit only with traction signal.
- "Find me this look" — snap a shop product, search across the community closet.
- Self-hosted try-on (IDM-VTON / CatVTON / Leffa) trained on the accumulated Generation table — only worthwhile once we have signal on the closed-API ceiling.

## Known cuts

- **3D scanning** — explicit non-goal for MVP. Registration friction is too high; we'd lose the "open the app, snap a piece" simplicity.
- **Stripe web checkout** — not in v0. Pro tier is iOS/Android IAP via RevenueCat first; web billing comes when we have web sign-ups asking for it.
- **Platform-mediated payment for marketplace** — explicit choice (Karrot model). Drape hosts the listing + DM; buyers/sellers handle payment + delivery themselves. Lowers compliance + onboarding friction; reconsider only if abuse pops up.
