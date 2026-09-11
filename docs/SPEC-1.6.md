# drape 2.1.0 — "your stylist" (spec, locked 2026-09-08; renumbered 1.6.0→2.0.0→2.1.0, file name kept for link stability)

Owner call (2026-09-08): build complete, not staged MVPs. This file is the
single source of truth for the 2.0 scope; PROGRESS.md tracks execution.

**STATUS 2026-09-11:** ✅ C feedback (9/8) · ✅ D stylist v1+v2 UI (9/8–9/10;
economics changed to 3 free/day then 1 fit — supersedes §D's "10/day free";
rec rating lives on `stylistRecs.feedback`, whole-batch) · ✅ B profile +
Settings "My style" (9/11; stated prefs also injected fresh per rec) ·
✅ A web half (share_target GET + /import + importFromUrl, 9/11) ·
⏳ remaining: A native (Android ACTION_SEND, iOS Share Extension),
TryOnHistory card 👍👎, store metadata/release notes → 2.1.0 submission.

**Versioning decision:** this is **1.6.0** (not 2.0 — 2.0 is a repositioning
event, save it). ~~1.5.1 ships first~~ **REVERSED (owner, 2026-09-08): 1.5.1
is SKIPPED** — versionCode 19 / build 15 were never submitted; the whole
1.5.1 payload (onboarding v4, remote copy layer, fits balance, native
sign_up, API-36 target) rides 1.6.0 instead. Accepted risk: Play's API-36
update block stays until 1.6.0 submits, so the 1.6 core build moves fast.
1.6.0 = versionCode 20 / iOS build 16 (bumped in repo 2026-09-08).

The four features share one spine: every user action (register, try on,
rate, wear) feeds a persistent **style profile**, and the **stylist** reads
that profile to recommend outfits that end in a try-on. Try-on stays the
economic center (fits unchanged); everything new funnels INTO it.

---

## A. Share-to-drape (import anything)

Share an image from any app/browser → drape analyzes it → registers items.

- **Entry points (all three, complete):**
  - iOS: Share Extension target (`DrapeShare`) — accepts images + URLs;
    hands off to the main app via app group + custom URL
    (`drape://import?...`). pbxproj surgery; rides the 1.6.0 build.
  - Android: `ACTION_SEND` (image/*, text/plain with URL) intent-filter on
    MainActivity → Capacitor `appUrlOpen`/intent plugin → same route.
  - Web (PWA): `share_target` in manifest.json (POST, multipart image) →
    `/import` route. Ships with hosting deploy, no store release.
- **Flow:** `/import` (new page) receives the image → runs the EXISTING
  OOTD/analyze pipeline (pieces detection) → shows detected pieces with
  crops → each piece: one-tap **"save to closet"** → items created with
  `kind:'wishlist'` by default ("I own this" flips to owned — existing
  toggle). Single-garment images (product shots) skip the picker and go
  straight to a prefilled AddItem.
- **URL shares** (no image): fetch og:image server-side (new callable,
  SSRF-guarded: https only, no private IPs) → same flow. Keep the source
  URL on the item (`sourceUrl`) — future "buy it" link, and the taste
  signal of where the user shops.
- **Then the hook:** after saving, offer "입어보기" immediately — imported
  piece → try-on → this is the "would this suit me?" loop no competitor
  has end-to-end on mobile.
- Credits: analyze/import free (same as OOTD analyze today); try-on charges
  fits as always.

## B. Style profile (the "summary that keeps watching")

Per-user compressed taste document — because we can't feed the whole
history into every stylist call.

- **Doc:** `users/{uid}/private/styleProfile` (owner-read, server-write):
  `{ summary: string (≤2k chars, the distilled taste portrait),
     signals: { topStyles[], topColors[], avoidList[], bodyNotes?,
     recentLoves[] }, statedPrefs: {...}, updatedAt, rev }`.
- **Inputs:** closet items (tags/colors/categories + owned vs wishlist),
  OOTD analyze results (style levels, palettes), try-on history with
  feedback (C), outfits published/kept private, wear frequency
  (pieceLinks), and **stated preferences** the user edits directly
  (Settings → "My style": free-text likes/dislikes, favorite styles from
  the taxonomy axes, colors to avoid, fit notes). Stated prefs ALWAYS
  outrank inferred ones in the prompt.
- **Refresh:** debounced server job (`updateStyleProfile` callable invoked
  fire-and-forget after signal events; min 30-min gap, also nightly cron
  catch-up). gemini-3.5-flash, input = previous summary + delta since rev.
  Incremental: never recompute from full history.
- Deleting the account deletes the profile (rides existing account
  deletion).

## C. Preference signals on try-on (👍👎)

- Extend the existing `liked` toggle to explicit **up/down**:
  `feedback: 'up'|'down'`, `feedbackAt` on the Generation doc.
  firestore.rules allowlist gains these two fields (client-writable,
  owner-only — same pattern as liked/likedAt). `liked` stays for backward
  compat; reads prefer `feedback`.
- UI: thumbs pair on GenerationDetail (result page, next to the existing
  actions) + on TryOnHistory cards. One tap sets, tap again clears.
- Every feedback write nudges the style-profile refresh (B) and lands in
  the Generation doc — which doubles as preference labels for the
  self-hosted-model training set (brief §8). GA events `tryon_feedback`
  {value}.

## D. Stylist (persona-fronted recommendations)

- **Callable `styleRecommend`** (functions/stylist.js — new Gemini call
  site, allowed: it's text-only flash, keep image models in items/tryon):
  input = style profile summary + closet inventory digest (id, category,
  subcat, colors, style tags — capped ~150 items, wishlist flagged) +
  persona + optional user ask ("데이트룩", "비 오는 날").
  Output (JSON-schema'd): 2–3 outfits, each = item ids from the closet
  (+ at most one wishlist item, flagged "you saved this"), a one-line why
  tied to the user's taste, and a confidence.
  Validation: server drops hallucinated item ids before returning —
  the same closed-vocab discipline as sanitizeTags.
- **Personas: 4, illustrated (NOT photoreal — house rule), explicitly AI.**
  Names/lenses (bilingual-safe, from our taxonomy axes):
  - **Noa** — minimal/classic. 절제, 실루엣, 롱런 아이템.
  - **Remy** — street/casual. 프로포션 플레이, 스니커 문법.
  - **Sol** — romantic/feminine. 색·텍스처, 계절감.
  - **Juno** — bold/experimental. 와일드카드, 옷장 재발견.
  Persona = system-prompt variant + avatar + tone. User picks "my
  stylist" (Settings + first-use sheet); switchable anytime; choice
  stored on profile. Same profile data, different lens.
- **Surface:** new **Stylist tab/page** (`/stylist`): persona header,
  "오늘 코디 추천" button, result cards rendering real item thumbnails,
  each with **[전부 입어보기]** (→ try-on with those itemIds, charges a
  fit) / [아웃핏으로 저장] / 👍👎 on the recommendation itself
  (`stylistFeedback` collection — more profile signal).
- **Credits:** recommendations FREE, capped 10/day per user (server-side
  counter on the user doc, fitDayKey pattern). Try-on from a rec charges
  normal fits. Rationale locked 2026-09-08: recs exist to manufacture
  try-on demand; don't toll the on-ramp.

## E. "iPhone-only" misperception fix

ChatGPT's comparison called us iPhone-only (it never found the Play
listing). Store metadata can't cross-reference (Apple guideline risk), so
the fix is on OUR surfaces, which AI search reads:
- llms.txt + JSON-LD already list both stores (shipped 8/26) ✓
- Landing/support pages: ensure "iPhone · Android · Web" phrasing appears
  in crawlable text (seo-only block + landing copy).
- After Bing indexes drape.nyc, re-ask ChatGPT; track in docs/SEO.md.

## Rollout order (dependencies, not stages)

1. Server + web core: C (feedback ✓ 9/8) → B (profile) → D (stylist
   callable + page) → A web share target + /import. All hosting/functions
   deploys.
2. Native 1.6.0 (carries the skipped 1.5.1 payload too): Android
   intent-filter + iOS Share Extension + stylist entry in native nav →
   versionCode 20 / build 16 → stores. This submission also clears Play's
   API-36 block.
3. E rides along (copy + docs).

## Analytics

`import_shared` {source: ios|android|web, kind: image|url},
`import_item_saved`, `tryon_feedback` {value}, `stylist_recommend`
{persona}, `stylist_tryon` (rec → try-on conversion — THE number),
`stylist_feedback` {value}. Success metric for 1.6: weekly try-ons per
active user, and rec→try-on conversion ≥25%.

## Non-goals (explicit)

- No chat thread with the stylist (v1 is request→cards; chat is a 1.7
  candidate if rec engagement proves out).
- No web-browser extension (mobile share sheet covers the job).
- No new image-generation call sites; stylist is text-only flash.
- Personas never post content or appear as users (persona-sunset rules
  unaffected).
