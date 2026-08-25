# Lekondo — competitor watch & drape direction

First written 2026-08-24 after their v1.65.0 release; expanded 2026-08-25 with
a logged-in IG content analysis and the full cross-cutting direction for drape
(product / marketing / personas / ads). Update when their releases or traction
move — stale competitor notes are worse than none.

## Company

- NYC, founded 2025, ~6 people. a16z Speedrun cohort 005; seed round backed
  by DG Daiwa Ventures. Positions as an **"AI-native fashion preference data
  platform"** — the taste graph is the asset, the app is the collector.
  (Compare our play: Generation docs as try-on training data. Same shape,
  different data: they harvest *preferences*, we harvest *try-on pairs*.)
- Founders: Yeng Tan (CEO), Mitchell Overfield (CTO — ex Dropbox Dash,
  Microsoft, Google).
- Self-description: "Third Space For Fashion" — identity/community framing,
  explicitly NOT shopping-first.

## Traction (as of ~Aug 2026, from press)

- Launched **January 2026**. ~**82,000 users**, **356,000 outfit posts**,
  10+ countries, reportedly **without significant marketing spend**.
- Growth concentrated in: Japan, Brazil, US, Taiwan, Hong Kong, South Korea —
  community-content-led, not ads-led (their IG spotlights users in São Paulo,
  Curitiba, Monterrey, Lagos).
- App Store: 4.9★ (241 ratings), v1.65.0 — ~65 releases in ~8 months ≈
  **2 releases/week ship cadence.**
- IG @lekondo.nyc: **14.2K followers**, 197 posts, follows 757 (they follow
  their users back — community management, not broadcast).

## Product loop

Post a fit (OOTD photo) → AI breakdown (colors, silhouette, aesthetic per
their ontology) → items detected and matched to your digital closet →
**items you don't own yet get auto-added** (new in v1.65.0, 8/22) → taste
graph accumulates → discovery feed by aesthetic/taste.

Supporting assets:
- **Aesthetics ontology** (lekondo.com/ontology): 50+ documented aesthetics
  (Acubi → Y3K), each with a definition, reference image, garment/material
  vocabulary. Community can propose additions. Doubles as SEO surface,
  editorial content source, and product vocabulary — their public-facing
  equivalent of our internal `taxonomy.js`.
- v1.65.0 also ships detection-highlight UI + 👍👎 feedback per detected
  piece — cheap labeled correction data AND a trust signal.

## IG content analysis (2026-08-25, logged-in browse)

Four content engines visible on the grid:

1. **"Weekly Spotlight — This week's top #OOTDs"** (recurring series, their
   core format): real user OOTD photos repackaged as cards — user handle +
   city credited, real in-app comments overlaid, an in-app save-count badge
   (480 / 449 / 527 on recent ones). **Faces are anonymized with a gray eye
   bar**, which doubles as their visual brand signature. Their IG is
   literally a window into the app's community — the marketing IS the UGC.
2. **Aesthetic editorial cards** from the ontology ("Y2K LOOKED BACK. Y3K
   LOOKS 1,000 YEARS AHEAD", "AMEKAJI — MAXXING") + a taste-graph
   illustration (plant/roots: "repetition reveals preference … taste evolves
   through experiences"). Fashion-zine typography, muted palette.
3. **Product demo pins**: phone mockups over street-style photos ("Third
   space for fashion", "Explore the global lookbook").
4. **Meme-voice + community ops**: "wtf is buying for your fantasy self";
   a "Part-time Content Creator — WE'RE HIRING" post styled as a Y2K
   flip-phone — they hire creators to scale reels.

**Reels — the decisive finding.** View counts on the reels tab:

| Format | Views |
|---|---|
| Creator talking-head w/ mini mic: "Most fashion icebergs" | **65.8K** |
| Creator talking-head (same creator, another episode) | **23.5K** |
| Creator listicle in Ukrainian: "3 apps that upgrade your style" (Lekondo among mush, TAGWALK) | **18K** |
| Street-style / trend clips (CPHFW SS27, fabric details) | 596–2,550 |
| Wardrobe-breakdown in Russian | 1,325 |
| "most digital closet apps" mirror-selfie | 1,155 |

**Real humans talking to camera outperform everything else 10–50×.** Their
aesthetic clips (the format closest to our composite reels) sit at a few
hundred to 2.5K views; the person-with-a-mic explainers pull tens of
thousands. They run multilingual creators (EN/RU/UK visible) matching their
multi-country growth, and the "app listicle" format places Lekondo inside a
neutral-looking recommendation video.

## Where they're ahead of us

1. **OOTD → closet auto-registration** (v1.65.0). We detect pieces and link
   *owned* items (`pieceLinks`); unowned pieces dead-end. They cut unowned
   pieces into closet items automatically. We already own every part needed
   (OOTD piece detection + the items.js crop pipeline) — this is our biggest
   actionable gap and directly attacks our registration friction.
2. **UGC flywheel**: app community content → IG spotlight → app installs.
   Our IG runs on manufactured content (persona composites); theirs runs on
   real users, anonymized. Theirs compounds; ours doesn't.
3. **Creator-format reels** at 10–50× our best format's relative reach.
4. **Public taxonomy as content** — marketing, SEO, and product vocabulary
   at once.
5. **Ship cadence** (~2 releases/week vs our held native build).

## Where we're ahead / differentiated

- **Virtual try-on with identity preservation.** They have none — their loop
  stops at documentation + discovery. This is the wedge they can't quickly
  follow, and it's also the feature our own users under-discover.
- **Marketplace + DMs** — no commerce layer on their side.
- **Face-blur tech in production** (Cloud Vision) — ironically the exact
  tool their eye-bar signature imitates editorially.
- Multi-locale product (en/ko/ja) from day one.

## Threats

- 82k users vs our ~79 real accounts. If they add try-on later they subsume
  our wedge — speed matters more than polish this quarter.
- Their aesthetic vocabulary out-depths our closed tag enums for discovery;
  becomes the battleground if we grow feed/discovery.

---

# Direction for drape (decided/proposed 2026-08-25)

## Product

1. **P1 — OOTD auto-registration.** From an OOTD photo: detected pieces the
   user doesn't own get cropped (items.js pipeline) and offered as one-tap
   closet adds ("이 룩의 아이템을 옷장에 추가"). Closes the lekondo gap AND
   feeds try-on with material faster. Add 👍👎 on detections while we're
   there (labeled data + trust).
2. **P1 — ship the held 1.5.1 native build.** Try-on discovery (onboarding
   v4 + hints), remote copy layer, fits balance, native sign_up GA event are
   all stranded while signups run 5× through the old build. Auto-registration
   can ride 1.5.2; don't hold 1.5.1 for it.
3. **P2 — try-on as the loud differentiator** in-app and in store listing
   copy: lekondo can document your closet; only drape shows it ON you.
4. **Watch, don't chase**: public ontology/discovery vocabulary. Not urgent
   at our scale; revisit when feed/discovery matters.

## Marketing / content

1. **Start a UGC spotlight engine (their best idea, our tech).** "This
   week's try-ons" / weekly OOTD spotlight cards from REAL drape users —
   face-blurred with our own Cloud Vision pipeline (our answer to their
   eye-bar, and it doubles as a product demo of privacy). Needs a consent
   path first: start with manual DM asks; later an in-app "feature me"
   opt-in toggle. This is also the persona exit ramp — every real spotlight
   replaces a manufactured post.
2. **Add creator talking-head reels to batch 2.** The 10–50× evidence says
   person-with-a-mic explainers beat aesthetic edits. Concretely: (a) test
   the "app listicle" format ("3 apps that upgrade your style" got 18K —
   drape belongs in that genre with try-on as the hook), (b) consider a
   part-time content creator like lekondo does (their hiring post is the
   playbook). Composite/product reels stay in the mix but stop being the
   whole strategy.
3. **Veo/synthetic rules stand** (max quality, faceless b-roll only, faces =
   real app output). lekondo's data reinforces it: their winning faces are
   real humans, not renders.
4. **Editorial angle, differentiated**: not aesthetics education (their
   lane) — try-on education. "Seen on IG → seen on YOU" formats.

## Personas / community (ties to the 8/25 persona review)

- lekondo shows the endgame: real community content as both product and
  marketing. Our feed is 87% bot outfits (540/623) from 30 seed accounts,
  KR/JP-skewed while ads target US women.
- Plan stands, now with a destination: **① stamp `isSeed` on the 30 accounts
  + 540 outfits (restore separability) → ② taper bot posting probability +
  rebalance persona mix toward US looks → ③ sunset bots when the real-UGC
  spotlight engine produces enough weekly content.** Persona faces phase out
  of marketing entirely as real spotlights ramp.

## Ads

- US-first stands (8/24 review). lekondo's organic Asia growth is NOT a
  reason to resume Asia ads — their Asia came from community content. If we
  ever go back to Asia it's creator/community-led, not paid.

## Metrics to watch

- Closet fill speed (items per new user in week 1) — the number OOTD
  auto-registration should move.
- Try-on rate after 1.5.1 ships (currently ~0; 1 real try-on since 8/17).
- lekondo release notes weekly (App Store), follower count monthly (14.2K
  @ 8/25).

## Sequence

1. Ship 1.5.1 native build (owner builds/uploads).
2. Build OOTD auto-registration → 1.5.2 + functions deploy.
3. isSeed stamp script + bot taper config.
4. Batch 2 content: tryon reel publish → 1 creator-format experiment →
   UGC spotlight pilot (manual consent).
5. Re-pull country funnel + try-on metrics after 1.5.1 to validate.

## Sources

- App Store: https://apps.apple.com/us/app/lekondo/id6755449231
- Ontology: https://lekondo.com/ontology
- a16z Speedrun profile: https://speedrun.a16z.com/companies/lekondo
- Dealroom (DG Daiwa seed; traction): captured 8/24 via search snippet
- Interview: okreporter.com "How Mitchell Overfield is building Lekondo…"
- IG @lekondo.nyc grid + reels: logged-in browse 2026-08-25 (screenshots:
  session scratchpad, not committed)
