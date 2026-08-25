# Lekondo — competitor watch

First written 2026-08-24 after their v1.65.0 release (8/22). Update this file
when their releases or traction move; don't let it rot silently — stale
competitor notes are worse than none.

## Company

- NYC, founded 2025, ~6 people. a16z Speedrun cohort 005; seed round backed
  by DG Daiwa Ventures. Positions as an **"AI-native fashion preference data
  platform"** — the taste graph is the asset, the app is the collector.
  (Compare our play: Generation docs as try-on training data. Same shape,
  different data: they harvest *preferences*, we harvest *try-on pairs*.)
- Founders: Yeng Tan (CEO), Mitchell Overfield (CTO — ex Dropbox Dash,
  Microsoft, Google).
- Self-description: "Third Space For Fashion" — identity/community framing,
  explicitly NOT shopping-first ("beyond 'what should I buy next?'").

## Traction (as of ~Aug 2026, from press)

- Launched **January 2026**. ~**82,000 users**, **356,000 outfit posts**,
  10+ countries, reportedly **without significant marketing spend**.
- Growth concentrated in: Japan, Brazil, US, Taiwan, Hong Kong, South Korea.
  (Notable inversion of our funnel: Asia works for them organically; our
  paid Asia traffic was junk. Their JP/KR/TW pull is community-content-led,
  not ads-led.)
- App Store: 4.9★ (241 ratings), v1.65.0 — ~65 releases in ~8 months ≈
  **2 releases/week ship cadence.**

## Product loop

Post a fit (OOTD photo) → AI breakdown (colors, silhouette, aesthetic per
their ontology) → items detected and matched to your digital closet →
**items you don't own yet get auto-added** (new in v1.65.0, 8/22) → taste
graph accumulates → discovery feed by aesthetic/taste.

Supporting assets:
- **Aesthetics ontology** (lekondo.com/ontology): 50+ documented aesthetics
  (Acubi → Y3K), each with a 4-7 sentence definition, reference image,
  garment/material vocabulary. Community can propose additions. Doubles as
  SEO surface and product vocabulary — their equivalent of our
  `taxonomy.js`, but public-facing and editorial.
- v1.65.0 also ships detection-highlight UI (shows which pieces the AI
  found on the photo) + 👍👎 feedback per detection — they're collecting
  labeled correction data on detection quality.

## Where they're ahead of us

1. **OOTD → closet auto-registration.** They close the loop we leave open:
   our OOTD analysis detects pieces and `pieceLinks` links *already-owned*
   items, but unowned pieces dead-end. They cut unowned pieces into closet
   items automatically. This is our biggest actionable gap — and we already
   own every part needed (OOTD piece detection + the items.js crop pipeline).
   Directly attacks our registration friction (users register items one by
   one; item counts show closets fill slowly).
2. **Detection feedback loop** (👍👎 per detected piece) — cheap labeled
   data, also a trust signal in the UI.
3. **Public taxonomy as content.** The ontology is marketing, SEO, and
   product vocabulary at once.
4. **Organic Asia growth** via community content — no ad spend claimed.

## Where we're ahead / differentiated

- **Virtual try-on.** They have none — their loop stops at documentation +
  discovery. Try-on with identity preservation is ours alone in this
  head-to-head; it's also the feature our own users under-discover (see
  8/17-8/18 discovery work). Marketing should lean on it harder precisely
  because lekondo can't follow quickly.
- **Marketplace + DMs** — they have no commerce layer.
- Multi-locale product (en/ko/ja) from day one.

## Threats

- They're at ~82k users vs our ~73 real accounts; if they add try-on later
  they subsume our wedge. Speed on the closet-registration gap matters more
  than polish.
- Their aesthetic-tag vocabulary is richer than our closed taxonomy for
  discovery purposes (50+ aesthetics vs our tag enums). Not urgent, but if
  we ever grow feed/discovery, tags become the battleground.

## Marketing notes

- IG: @lekondo.nyc (owner notes their content is well-made; not yet
  analyzed from here — IG requires a logged-in browser session, do a
  /browse pass later and record findings here).
- Their growth story ("no significant marketing") suggests
  share-out-of-the-app content loops — worth studying what users share.

## Sources

- App Store: https://apps.apple.com/us/app/lekondo/id6755449231
- Ontology: https://lekondo.com/ontology
- a16z Speedrun profile: https://speedrun.a16z.com/companies/lekondo
- Dealroom (DG Daiwa seed; traction numbers): app.dealroom.co (403s from
  scripts — numbers captured 8/24 via search snippet)
- Interview: okreporter.com "How Mitchell Overfield is building Lekondo…"
