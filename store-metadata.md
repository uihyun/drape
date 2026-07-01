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

## Listing copy (current, finalized)

**Promotional text (170)**
Build your digital closet, try anything on yourself with AI, and log every outfit. Your wardrobe, finally in one place.

**Description** — see the screenshot/ASC; lead is "drape is where your wardrobe lives." with the six bullets (closet / try-on / OOTD calendar / outfits & boards / lookbook feed / marketplace).

**Keywords (100)**
wardrobe,fashion,style,lookbook,clothes,ai stylist,dressing room,fit check,capsule,virtual fitting
- Optional swap now that marketplace shipped: drop one low-value term for `resale` or `preloved`.

(KO / JA description + keyword strings: keep the versions already entered in ASC.)

---

## Release notes (What's New) — per version

Store-facing copy (App Store Connect "What's New" / Play Console "Release notes").
Keep these short and stylish; the full internal record is `CHANGELOG.md`. Newest first.

### 1.2.2 (iOS build 11 · Android versionCode 14) — try-on browsing + fixes

**Rollout:** patch on top of 1.2.1. iOS Archive build 11; Android upload
versionCode-14 .aab (Advertising ID still = No). Internal driver this cycle:
native analytics was silently dropping our custom events on iOS/Android (the
`FirebaseAnalytics.then` no-op) — fixed, so this build is the first that actually
records them. User-facing: swipe between try-on results, a stuck try-on now
offers a retry instead of spinning, and the boards grid lays out consistently
across devices.

**Release notes (store-facing, same for iOS + Android):**
> EN: Swipe left and right to browse your try-ons, plus a smoother, more polished experience throughout.
> KO: 이제 좌우로 넘기며 트라이온을 감상하세요. 전반적으로 더 매끄럽게 다듬었어요.
> JA: 左右にスワイプして試着を見返せるように。全体的により快適に整えました。

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

## Pre-archive technical state — VERIFIED in repo (2026-06-04)

These are the archive/build gotchas archelier (../voda) hit; for drape they're already handled:
- ✅ `ENABLE_USER_SCRIPT_SANDBOXING = NO` in project.pbxproj — Archive won't fail with the
  CocoaPods "Sandbox: bash deny …Pods-App-frameworks.sh" error.
- ✅ `ITSAppUsesNonExemptEncryption = false` in `ios/App/App/Info.plist` — no export-compliance
  dialog on every upload.
- ✅ Sign in with Apple entitlement present (`ios/App/App/App.entitlements`).
- ✅ In-app account deletion exists (`functions/account.js` nuclear delete + `DeleteAccountModal.jsx`).
- ✅ No IAP / no subscriptions → none of archelier's subscription-review gotchas (3.1.2(c),
  45-char subscription description, paywall clarity) apply.
- Version 1.0.0, build 1 (first submission — build 1 is fine; bump CURRENT_PROJECT_VERSION for any
  resubmission, keep MARKETING_VERSION).

## ⚠️ Outstanding — verify BEFORE submitting (beyond screenshots + archive)

1. **Apple Sign-In end-to-end** — the reviewer will likely log in with Sign in with Apple. Portal
   setup was previously flagged outstanding. **On a real device, complete a full Apple sign-in →
   land in the app** before submitting. (Firebase Apple provider enabled + key; native iOS uses
   the device Apple ID.) A broken reviewer login = rejection.
2. **Push notifications** — ✅ WIRED (2026-06-05). `aps-environment` entitlement added to
   `App.entitlements`; APNs **auth key** `L2JVATZ6W2` (team `WG75TG59NJ`, Sandbox & Production)
   uploaded to Firebase → Cloud Messaging → Apple app config (covers dev + prod). `PushService`
   registers tokens to `users/{uid}/fcmTokens`; `onMessageCreated` fans out push for text + image
   DMs. The `.p8` lives OUTSIDE the repo (`~/Desktop/idea/drape/keys/apple_push/`) — back it up,
   Apple won't re-issue. Remaining: rebuild in Xcode (Automatic signing provisions Push on the App
   ID) + test on a REAL device (sim can't receive push).
3. **App Review 메모** — paste the block above into ASC → App Review Information → Notes (it was
   empty in the screenshot). This is the #1 thing reviewers read.
4. **Cold-start with a brand-new account** — no crash, empty feed/marketplace shows a placeholder
   not a blank/hanging screen. Test on a real device + simulator; if universal, test **iPad
   landscape** (archelier was reviewed on an iPad).

## Submission gotchas to remember (from archelier's actual review)

- **Screenshots:** upload to the **6.9" (1290×2796) slot** — Apple auto-derives the smaller sizes.
  Putting a 6.9" image in the 6.5" slot errors. 3–8 shots, EN/KO/JA.
- **Build selection:** the build must be **"Ready to Submit" in TestFlight** (not "Processing") and
  have export compliance answered, or it won't appear in the build picker.
- **One active submission per app**; the submission draft should show just "iOS App 1.0.0".
- **Account-deletion screen recording** is only requested if 5.1.1 gets flagged on resubmission —
  film it on a **real device** (sign in → Settings → Delete Account → confirm), host the link, and
  paste it into the **permanent** App Review Notes so future builds aren't re-asked.

## Still-to-do checklist (ASC, user-side)

- [ ] **Review Notes (메모)** — paste the block above (this is the empty field in the screenshot).
- [ ] **로그인 정보** — uncheck "로그인 필요" OR note Sign in with Apple (fields can stay empty).
- [ ] **Screenshots** — 6.7" (and any required sizes), EN + KO + JA.
- [ ] **Support URL** = `https://drape-9e532.web.app/support.html` (standalone, live).
- [ ] **Privacy Policy URL** = `https://drape-9e532.web.app/privacy.html` (standalone, live).
- [ ] **App Privacy** questionnaire matches the Privacy Policy (done earlier — re-verify after marketplace/DM).
- [ ] **Export compliance** — `ITSAppUsesNonExemptEncryption = false` in Info.plist (HTTPS-only).
- [ ] **Sign in with Apple** entitlement present (Guideline 4.8 — Google is offered, so Apple is required).
- [ ] **Build** uploaded via TestFlight + export-compliance answered.
- [ ] **Developer name → "uhz LLC"** — the App Store seller name follows the Apple Developer
      account type: Individual shows the personal legal name (Uihyun Kim), Organization shows the
      LLC. To show "uhz LLC" you need an **Organization account** (D-U-N-S # for the LLC). No
      payout/tax impact while there are NO in-app purchases, so it's cleanest to set the entity
      **before monetizing**. Individual→Org later = an app transfer + splitting that year's income
      across two tax entities. Can be changed/re-applied later, but more friction.
