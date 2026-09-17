# drape — App Store Connect metadata (paste-ready)

Single source for the ASC text fields + the **App Review 메모 (Review Notes)** body.
Keep in sync with `APP_STORE_SUBMISSION.md` (the how-to) and the in-app legal copy.

Contact: hello@uhzlab.com
- **Support URL** (ASC field): `https://drape-9e532.web.app/support.html`
- **Privacy Policy URL** (ASC field): `https://drape-9e532.web.app/privacy.html`
- Marketing URL (optional): `https://drape.nyc`
- These three (`support/privacy/terms.html`) are standalone static pages (no app shell — external
  visitors can't navigate into the web app). Generated from `src/data/legal.js` via
  `node scripts/build-web-pages.mjs`. Swap to `https://drape.nyc/…` once that custom domain is wired.

---

## App Review Information — 로그인 정보

The app offers **Sign in with Apple**, so a demo account is NOT required — the
reviewer signs in with their own Apple ID. Anonymous "guest" browsing also works.

→ In ASC: either **uncheck "로그인 필요"** (login is optional — guest browsing covers
the core), or leave it checked and paste the note below. Username/password fields
can stay empty (we have no email/password login).

If a reviewer prefers a seeded account, provide a Google test account's
email + password in the fields and tell them to tap "Continue with Google".

---

## App Review Information — 메모 (Review Notes) — paste this

```
Thanks for reviewing drape.

AUTHENTICATION / GUEST ACCESS
- Sign in with Apple or Google. You can use your own Apple ID — no demo
  account needed. Anonymous "guest" browsing is also available from the
  welcome screen, so the feed and most browsing work without signing in.
- Signing in is only needed to build a closet, run try-on, post, or message.

AI VIRTUAL TRY-ON
- The user uploads 2–3 of their OWN full-body photos ("identity photos").
- We generate a try-on image of the user's body wearing a selected garment
  using Google's Gemini image model. Identity photos are private to the
  account, used ONLY for generating the user's own try-ons, and are NOT used
  to train any model. They can be removed in Settings.
- Generated try-ons can be deleted by the user (Try-on history → delete).
- No third-party model/celebrity photos are used.

USER-GENERATED CONTENT & MESSAGING (Guideline 1.2)
- Users can post looks to a public feed, comment, send direct messages, and
  list items in a peer-to-peer marketplace.
- REPORT: a post/OOTD/board/listing via its ⋯ menu → Report; a user via their
  profile ⋯ → Report. BLOCK: a user via their profile ⋯ → Block — a blocked
  user's posts/messages are hidden from the blocker.
- A EULA prohibiting objectionable content and abusive users is shown at
  sign-up; reported content/users are reviewed and removed (within 24h).

MARKETPLACE (physical goods)
- Listings are pre-owned clothing (physical goods). Buyers and sellers arrange
  the transaction OFF-PLATFORM via in-app direct messages.
- There is NO in-app payment for marketplace items.

IN-APP PURCHASES / SUBSCRIPTIONS
- drape has NO in-app purchases and NO subscriptions. All features are free.

ACCOUNT DELETION (Guideline 5.1.1(v))
- Settings → Delete Account → confirm. This deletes the Firebase Auth user and
  all of the user's Firestore data + Storage files (closet, outfits, OOTDs,
  generations, messages). A screen recording of this flow is available on request.

CONTACT
- hello@uhzlab.com
```

---

## Categories

Live today: **Lifestyle** (primary) + **Social Networking** (secondary).
Lekondo ships the same pair — but they have ~82k users and ~356k outfit posts,
so social is true for them; for us the feed is behind Trends, the community is
small and DMs only start from a marketplace listing.

Recommended change: keep **Lifestyle** primary, move the secondary to
**Photo & Video**. The core loop is camera in → cut-out → a generated image of
you, which is what Photo & Video describes, and it is a far less crowded
ranking pool than Social Networking, where a small app cannot chart and the
label sets an expectation the product no longer meets. Shopping was the other
candidate and was rejected: the marketplace is real but secondary, and a
shopper who lands on a closet organiser bounces.

Category is an App Store Connect **App Information** field — changeable any
time without a new build, and reversible. Worth trying for a release cycle and
watching Browse impressions in /admin.

## Currently LIVE in the consoles — baseline, do not delete

The only record of what is actually live. Everything else (KO/JA listing text,
the real screenshots) exists ONLY in App Store Connect and has never been in
this repo. Read this before proposing any change, so a swap can be weighed
against what it replaces.

**Promotional text, EN (170)**
> Build your digital closet, try anything on yourself with AI, and log every
> outfit. Your wardrobe, finally in one place.

**Subtitle, EN (30)** — `plan outfits & log your ootd` (all lowercase, per the
brand rule).

**Keywords, EN (100)**
> wardrobe,fashion,style,lookbook,clothes,ai stylist,dressing room,fit check,capsule,virtual fitting

**Descriptions** — pulled from the public iTunes Lookup API on 2026-09-16, so
this no longer depends on anyone remembering to copy them out:

    curl -s "https://itunes.apple.com/lookup?id=6775511709&country=us" | jq -r '.results[0].description'

Swap `country=` for `kr` / `jp` to get the other storefronts. The same response
carries the live screenshot URLs, the version, and the category pair. Keywords
are the one field the API does NOT expose — those still have to be read out of
App Store Connect by hand.

Live at 1.5.0, EN:

```
drape is where your wardrobe lives.

Snap each piece you own and drape builds a clean digital closet — auto-cut and auto-tagged. Add a few full-body photos and try anything on with AI: see clothes on your real body and face before you wear or buy them. Love a look you saw on someone else? Recreate the whole thing, right on you.

• Digital closet — photograph your clothes; we cut out the garment and tag category, color, and season automatically.
• Virtual try-on — see any item, or a full outfit, on your own body. Identity-preserving AI keeps your face and pose.
• OOTD calendar — log what you wore each day and build your style history.
• Outfits & boards — combine pieces into looks and mood boards.
• Lookbook feed — follow others, discover looks, save pieces to your wishlist.
• Marketplace — buy and sell pieces from real closets.

Your closet, your fitting room, your style diary — all in drape.
```

Live at 1.5.0, KO:

```
옷장 전체가, 이제 손안에.

가진 옷을 한 장씩 찍기만 하면 drape가 배경을 깔끔하게 지우고 카테고리·색·계절까지 자동으로 정리해 디지털 옷장을 만들어줘요. 전신 사진 몇 장이면 AI 가상 피팅으로 무엇이든 입어볼 수 있어요. 사기 전에, 입기 전에 — 진짜 내 얼굴과 몸에 걸친 모습을 미리 확인하세요.

마음에 드는 누군가의 착장? 그 룩을 통째로 내 몸에 입혀 보세요.

• 디지털 옷장 — 찍기만 하면 배경 제거부터 카테고리·색·계절 태그까지 자동으로.
• 가상 피팅 — 한 벌이든 코디 전체든, 내 얼굴과 포즈를 그대로 살리는 AI로.
• OOTD 캘린더 — 매일의 착장을 기록하고 나만의 스타일을 쌓아가요.
• 코디 & 보드 — 옷을 조합해 룩을 짜고, 무드보드로 영감을 모아요.
• 룩북 피드 — 취향이 맞는 사람을 팔로우하고, 새로운 룩을 발견하고, 갖고 싶은 건 위시리스트에.
• 마켓 — 안 입는 옷은 팔고, 탐나는 옷은 사고.

옷장, 피팅룸, 스타일 다이어리. 전부 drape 안에.
```

Live at 1.5.0, JA:

```
ワードローブまるごと、手のひらに。

持っている服を1枚ずつ撮るだけで、drape が背景をきれいに消し、カテゴリー・色・季節まで自動で整理してデジタルクローゼットに。 全身写真が数枚あれば、AIバーチャル試着で何でも着られます。買う前に、着る前に — 本物の自分の顔と体にまとった姿を、先に確かめて。

気になる誰かのコーデ？ そのルックをまるごと自分の体に着せてみて。

• デジタルクローゼット — 撮るだけで、背景除去からカテゴリー・色・季節のタグ付けまで自動で。
• バーチャル試着 — 1点でもコーデ全体でも、顔とポーズをそのまま活かすAIで。
• OOTDカレンダー — 毎日の装いを記録して、自分だけのスタイルを積み重ねて。
• コーデ＆ボード — 服を組み合わせてルックを作り、ムードボードでインスピレーションを。
• ルックブックフィード — 好みの合う人をフォローし、新しいルックを見つけ、欲しいものはウィッシュリストへ。
• マーケット — 着ない服は売って、欲しい服は買って。

クローゼット、試着室、スタイル日記。すべては drape の中に。
```

The shape to preserve: an opening line, one dense paragraph, six single-line
bullets in `• Label — sentence` form, and a closing line. 905 / 509 / 486
characters. Tight on purpose — a long sectioned description is a different
product's voice.

**Screenshots** — the live decks were uploaded directly to ASC and were never
committed. `resources/app-store/posters-shipped/1.5.0-{en,ja}` is a recovery of
them off Apple's CDN, and `posters-2.1.0-{en,ja,es,fr}` is what goes up next;
see that folder's README for the deck and the order. No Korean deck — the KR
storefront keeps inheriting the English set, as it already does today. The
`screenshots-6.7-en*` folders that used to sit in `resources/app-store/` were
voda (interior design) assets and were deleted 2026-09-16; they were never
drape's.

## Listing copy

Lives in `resources/app-store/listing-{en,ko,ja,es,fr}.md` — name, subtitle,
keywords, promotional text, description and What's New per locale, each capped
field checked against its limit. Kept there rather than duplicated here so the
two can't drift; this file stays the home of the App Review notes above.

## Release notes (What's New) — per version

Store-facing copy (App Store Connect "What's New" / Play Console "Release notes").
Keep these short and stylish; the full internal record is `CHANGELOG.md`. Newest first.

### 1.4.0 (iOS build 13 · Android versionCode 16) — try-on quota + invite rewards

**Rollout:** minor feature release. iOS Archive build 13; Android upload
versionCode-16 .aab (Advertising ID still = No). Headline is the try-on daily
allowance + two-sided invite reward (invite a friend → you both get +10 bonus
try-ons). Also carries the contact-sheet ("several people in one image") try-on
fix, the multi-item focus-crop fix, and public-profile tab/notch polish. Store
note leads with the invite hook; kept short. Do NOT say "fits" — user-facing
name is "try-on".

**Release notes (store-facing, same for iOS + Android):**
> EN: Invite a friend and you both get bonus try-ons. Now with a daily free allowance, more reliable results, and fixes throughout.
> KO: 친구를 초대하면 둘 다 보너스 트라이온을 받아요. 매일 무료 제공과 더 안정적인 결과, 그리고 곳곳의 개선까지.
> JA: 友達を招待すると二人ともボーナス試着がもらえます。毎日の無料枠、より安定した仕上がり、各所の改善も。

### 1.3.0 (iOS build 12 · Android versionCode 15) — notifications + faster try-on · RELEASED 2026-07-05

**Rollout:** feature release. iOS Archive build 12; Android upload versionCode-15
.aab (Advertising ID still = No). Headline is the in-app notification center; also
carries the faster/cheaper try-on + item crop, headwear transfer, try-on counts,
invite/share deep-link fixes, and the 1.2.2 native analytics fix. Store note kept
short — leads with notifications.

**Release notes (store-facing, same for iOS + Android):**
> EN: New notifications, faster try-on, and improvements throughout.
> KO: 새로운 알림, 더 빨라진 트라이온, 그리고 곳곳의 개선.
> JA: 新しい通知、より高速な試着、そして各所の改善。

### 1.2.2 (iOS build 11 · Android versionCode 14) — fixes + polish

**Rollout:** patch on top of 1.2.1. iOS Archive build 11; Android upload
versionCode-14 .aab (Advertising ID still = No). Internal-only this cycle: native
analytics fix (custom events were silently dropped on iOS/Android). User-facing
changes are small polish/fixes (try-on swipe, stuck try-on retry, board grid) —
kept the store note generic, not a feature list.

**Release notes (store-facing, same for iOS + Android):**
> EN: Improvements and bug fixes for a smoother experience.
> KO: 더 매끄러운 사용을 위한 개선과 버그 수정.
> JA: より快適にお使いいただくための改善とバグ修正。

### 1.2.1 (iOS build 10 · Android versionCode 13) — profile polish

**Rollout:** patch on top of the now-released 1.2.0. iOS Archive build 10; Android
upload versionCode-13 .aab (Advertising ID still = No — AD_ID stays stripped).
(versionCode 11 and 12 were each uploaded before the next no-flicker fix; now 13.)

**Release notes (store-facing, simple — same for iOS + Android):**
> EN: Minor improvements and bug fixes.
> KO: 소소한 개선 및 버그 수정.
> JA: 細かな改善とバグ修正。

### 1.2.0 (versionCode/build 9) — home screen + reminders

**Rollout:** iOS submitted 2026-06-29 (build 9), in review. Android re-built as
**versionCode 10** (build 9 was blocked by the advertising-ID declaration — AD_ID
permissions now stripped); upload the build-10 .aab and answer Advertising ID = No.
Supersedes 1.1.4.

(i18n/translate shipped in 1.1.4 — not repeated here. Kept generic; the real
features this cycle: home-screen choice, like/try-on notifications, reminders.)

**KO**
> 사용 편의를 위해 UI와 기능을 개선했어요.

**EN**
> UI and feature improvements for a smoother experience.

**JA**
> より快適にお使いいただけるよう、UIと機能を改善しました。

### 1.1.4 (versionCode/build 8) — localized analysis + translate

**Rollout:** Submitted to both stores 2026-06-24 (iOS build 8 + Android build 8),
in review. (iOS 1.1.3 → 1.1.4; Android 1.1.3 → 1.1.4.)

**KO**
> 분석과 옷장이 이제 내 언어로 나와요. 코디 분석의 제목·설명과 아이템 이름이 한국어로 표시되고, 다른 언어로 올라온 글은 '번역 보기'로 바로 볼 수 있어요. 자잘한 다듬기도 함께.

**EN**
> Your analysis and closet now speak your language. Outfit analysis titles, notes, and item names appear in your language, and you can tap "Translate" on posts shared in another. Plus a round of polish.

**JA**
> 分析とクローゼットがあなたの言語に。コーデ分析のタイトル・説明やアイテム名が日本語で表示され、別の言語の投稿は「翻訳を見る」ですぐ確認できます。細かな改善も。

### 1.1.3 (versionCode/build 7) — the native release (carries 1.1.2 + 1.1.3; 1.1.2 skipped)

**Rollout:** iOS resubmit build 7 (replaces the in-review 1.1.2). Android: upload
the build 7 .aab once Play 1.1.1 clears. Both go 1.1.1 → 1.1.3.

**KO**
> 피드가 한층 매끄럽고 빨라졌어요. 위로 당겨 새로고침하고, 스크롤하던 자리에서 그대로 이어볼 수 있어요. 탭 바는 내릴 때 살짝 숨고 올릴 때 다시 나타나 화면을 더 넓게 쓰고요. 그 밖에 속도·안정성을 다듬고 자잘한 버그를 고쳤습니다.

**EN**
> A smoother, faster feed. Pull to refresh, and pick up right where you left off — your scroll position is remembered. The tab bar tucks away as you scroll down and slides back when you scroll up, for more room. Plus speed, stability, and bug fixes.

**JA**
> フィードがより快適で高速に。下に引いて更新でき、スクロール位置も記憶されるので続きからすぐ見られます。タブバーは下スクロールで隠れ、上スクロールで再表示され画面を広く使えます。さらに高速化・安定化とバグ修正も。

---

### 1.1.2 (versionCode/build 6) — superseded by 1.1.3 (never released natively)

**Rollout:** App Store FIRST (1.1.1 already live, so 1.1.2 can submit now).
**Play Store LATER** — Android 1.1.1 (versionCode 5) is still in review; uploading
6 now would replace that in-review build. Wait until Play 1.1.1 is live, then
upload the versionCode 6 `.aab`. (Same notes/copy for both stores.)

**KO**
> 피드가 한결 매끄러워졌어요. 위로 당겨 새로고침하면 새 게시물이 바로 보이고, 전체적으로 더 빠르고 안정적으로 동작합니다. 자잘한 버그도 다듬었어요.

**EN**
> A smoother feed. Pull down to refresh and new posts show right away, with a faster, more reliable experience throughout. Plus a round of polish and bug fixes.

**JA**
> フィードがより快適に。下に引いて更新すると新着がすぐ表示され、全体的に速く安定して動作します。細かな改善とバグ修正も。

---

### 1.1.1 (versionCode/build 5 — resubmit; build 4 was the first submission)

**KO**
> 가상 피팅이 한층 좋아졌어요. 피드 속 어떤 룩이든 내 모습 그대로 입어보세요. 얼굴과 체형은 진짜 나로 유지되고, 베니스 운하부터 해변까지 원하는 배경에 세울 수 있어요. 더 매끄러워진 UI와 함께, 마무리되지 않은 옷장 아이템은 한 번의 탭으로 다시 시도할 수 있습니다. 달력은 컷아웃과 배경 사진 중 원하는 표시를 고를 수 있고, 피드 이미지도 더 안정적으로 불러옵니다.

**EN**
> Virtual try-on, leveled up. Recreate any look from the feed on yourself. Your face and body stay true to you, and you can set the scene anywhere, from a Venice canal to the beach. Enjoy a smoother UI throughout, plus one-tap retry for any closet item that didn't finish. On the calendar you can now choose between a clean cutout or the full photo, and feed images load more reliably.

**JA**
> バーチャル試着がさらに進化しました。フィードのどんなルックも自分の姿で試せます。顔も体型も本当の自分のままで、ベネチアの運河からビーチまで好きな背景に立てます。よりなめらかなUIに加えて、未完了のクローゼットアイテムはワンタップで再試行できます。カレンダーは切り抜きと背景付き写真を選べるようになり、フィードの画像もより確実に読み込まれます。

(1.0.0 / 1.1.0 notes: as already entered in ASC / Play.)

---

## Settled — do not re-litigate these

Everything here is built, verified in the repo, and was accepted at the 2.1.0
submission. Listed so a future session confirms by reading rather than by asking
whether it exists.

| Requirement | Where it lives |
|---|---|
| In-app account deletion (**Guideline 5.1.1(v)**) | Settings → Delete account → `DeleteAccountModal.jsx` → `AuthService.deleteAccount()` → `functions/account.js`. Starts and completes in-app; no web hand-off. |
| **Sign in with Apple** (Guideline 4.8, required because Google is offered) | `ios/App/App/App.entitlements`, Firebase Apple provider enabled, portal configured. Reviewer login works. |
| Export compliance | `ITSAppUsesNonExemptEncryption = false` in `Info.plist` — HTTPS only, no dialog per upload. |
| Archive sandboxing | `ENABLE_USER_SCRIPT_SANDBOXING = NO` in `project.pbxproj`. |
| iOS deployment target | `ios/App/Podfile` `post_install` lifts any pod under 15.0. Capacitor pins them to 14.0 and current Xcode rejects that as an error. |
| Push notifications | `aps-environment` entitlement; APNs auth key `L2JVATZ6W2` (team `WG75TG59NJ`) uploaded to Firebase Cloud Messaging, covers dev + prod. The `.p8` lives outside the repo at `~/Desktop/idea/drape/keys/apple_push/` — Apple will not re-issue it, keep the backup. |
| Subscription review rules (3.1.2(c) etc.) | Not applicable — no IAP, no subscriptions. |
| Support / Privacy URLs | `https://drape-9e532.web.app/support.html`, `.../privacy.html` — standalone, live. |

**Seller name.** The App Store shows the Apple Developer account type's name:
Individual → "Uihyun Kim", Organization → the LLC. Showing "uhz LLC" needs an
Organization account (D-U-N-S for the LLC). No payout or tax impact while there
is no IAP, so the clean moment to switch is **before monetizing** — doing it
later means an app transfer and splitting that year's income across two entities.

## Every release — redo these

Per-version fields and checks. Clearing them last time does not clear them now.

- [ ] **App Review Notes** — paste the block near the top of this file. Reviewers
      read it first, and it resets to empty on a new version.
- [ ] **로그인 정보** — uncheck "로그인 필요", or note Sign in with Apple.
- [ ] **Screenshots** — App Store takes all ten from
      `resources/app-store/posters-2.1.0-<locale>/` into the **6.9" (1290×2796)**
      slot (it derives the smaller sizes; a 6.9" image in the 6.5" slot errors).
      Play takes the eight without `-ios-only` in the filename.
- [ ] **Release notes** — the App Store block and the **Play block are different
      text**, not the same copy trimmed: Play caps at 500 characters, the App
      Store at 4000. Both are in `resources/app-store/listing-*.md`.
- [ ] **Build is "Ready to Submit" in TestFlight** — not "Processing" — and
      export compliance answered, or it will not appear in the build picker.
- [ ] **Cold start on a brand-new account** — real device and simulator. Empty
      states must show a placeholder, never a blank or hanging screen. If the
      app is universal, check iPad landscape too.
- [ ] **App Privacy questionnaire** still matches the Privacy Policy.
- [ ] Bump all three version places together: `package.json`,
      `android/app/build.gradle` (versionName + versionCode), iOS
      `project.pbxproj` (MARKETING_VERSION + CURRENT_PROJECT_VERSION).

**One active submission per app.** If a draft is stuck, that is usually why.

**If 5.1.1 gets flagged on a resubmission** Apple asks for a screen recording of
the deletion on a real device (sign in → Settings → Delete account → confirm).
Host it and paste the link into the **permanent** App Review Notes, not the
per-version field, so later builds are not asked again.

## Submission log

**2.1.1 — iOS build 17 / Android versionCode 21.** The 2.1.0 resubmission. Store
copy is byte-identical apart from the version number: 2.1.0 never reached a
user, so from outside this *is* that release.


**2.1.0 — submitted 16 Sep 2026, rejected the same day** under Guideline 2.1(a):
crash on launch on iOS 27. Superseded by 2.1.1. Details: iOS build 16 /
MARKETING_VERSION 2.1.0; Android versionCode 20 / versionName 2.1.0. Listings in
en · ko · ja · es · fr; poster decks in en · ja · es · fr (Korean inherits the
English set on purpose — see `resources/app-store/README.md`). App Store got all
ten slides, Play the eight without `-ios-only`.

**1.5.0** — the version live before this one; its decks are recovered under
`resources/app-store/posters-shipped/1.5.0-{en,ja}` and its listing text is the
baseline recorded above.
