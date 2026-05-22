# Sprint A — iOS / Android 네이티브 출시 작업 로그

PWA → Capacitor 네이티브 앱 까지의 **2026-04-27 ~ 2026-04-29** 작업 시간순 기록 + 트러블슈팅 카탈로그 + 미해결 문제 + 다음 단계.

연관 문서:
- **`CAPACITOR_SETUP.md`** — 작업 절차 walkthrough (재셋업 시 따라할 수 있는 형태)
- **`ANDROID_DEPLOYMENT.md`** — Android 배포 통합 walkthrough (Sprint B 의 procedural 정리)
- **`REVENUECAT_SETUP.md`** — IAP (RevenueCat) 전체 walkthrough — iOS §1~10 + Android §11
- **`CREDENTIALS.md`** — 모든 토큰·키·서비스 계정의 인벤토리·위치·회전 절차
- **`IOS_BUILD_GUIDE.md`** — Xcode → TestFlight 빠른 참조
- **`APP_STORE_SUBMISSION.md`** — App Store 정식 제출 walkthrough — 버전 메타데이터 / 첫 구독 attach / 심사 제출 + 함정 카탈로그 + 거부 → 재제출
- **`APP_STORE_OPERATIONS.md`** — 출시 후 운영 가이드 — 변경 가능 항목 매트릭스 / 버전 번호 정책 / 거부 사유 카탈로그
- **`store-metadata.md`** — App Store Connect / Play Console 입력용 EN+KO 텍스트
- **`BRAND_ASSETS.md`** — 아이콘·스플래시·OG 자산 파이프라인 + 반복 실수 방지 룰
- **`PRODUCT_PLAN.md` §8-5** — 단계별 체크리스트
- 이 문서 (`SPRINT_A_LOG.md`) — 어떤 결정을 왜 했고, 어떤 문제가 있었으며, 무엇이 미해결인지

---

## 0. 의사결정 (2026-04-29)

| 항목 | 결정 | 이유 |
|------|------|------|
| 래퍼 | **Capacitor 7** (8 아님) | `@capacitor-community/apple-sign-in@7.1.0` 이 최신인데 아직 Capacitor 8 미지원. v7 + CocoaPods 로 통일. v8 호환 버전이 나오면 그때 업그레이드 |
| 번들 ID | **`com.voda.app`** | 표준 reverse-domain. 한 번 박히면 변경 시 IAP / 사용자 / 빌드 다 새로 시작 |
| 푸시 알림 | **Sprint C 분리** | 출시 v1.0 가 너무 커지지 않게. 푸시 없이도 출시 가능 |
| iOS IAP | **RevenueCat 사용 결정, 단 v1.0 TestFlight 는 IAP 없이** | 매출 $2,500/mo 까지 무료 + 그 이후 1%. v1.0 은 native 동작 확인 우선 |
| Android | **Sprint B 로 분리** | iOS 가 더 risky path. Android 는 거의 동일 코드 |
| Apple Sign-In 웹 활성? | **활성** | App Store 가 Google 외 소셜 로그인 있으면 Apple 도 의무 |
| App Store 표시명 | **미결정** | 「Voda」 단독은 ASO 약함, 「App」 은 이미 점유. `Voda: AI Interior Design` 추천 |

---

## 1. 진행한 작업 (커밋 시간순)

| 커밋 | 단계 | 내용 |
|------|------|------|
| `c090709` | Sprint A 1+2 | Capacitor 8 셋업 + `platform-service.js` (isNativeApp / isIOS / isAndroid / isWeb) |
| `cb6ab68` | Sprint A 3 | Sign in with Apple (`OAuthProvider('apple.com')` + `@capacitor-community/apple-sign-in` + iOS App.entitlements) |
| `15c94f0` | Sprint A 5 | 네이티브 share / 다운로드 (`@capacitor/share` + `@capacitor/filesystem` + `share-service.js` 단일 진입점) |
| `75825c4` | Sprint A 6 | Universal Links (AASA + entitlement + NativeUrlHandler + 배포 + Content-Type 헤더 + SW denylist) |
| `d4d2039` | Sprint A 7 | 스토어 자산 (자동 생성 + Privacy Manifest + 메타데이터 초안) |
| `f98d071` | post-fix | Manifest 복구 (capacitor-assets 부작용) |
| `dde7f49` | Sprint A 8 | iOS 결제 UI hide (App Store 정책 — 외부 결제 안내 금지) |
| `a10ddbf` | docs | `CAPACITOR_SETUP.md` 신규 (전 과정 walkthrough) |
| `9bddee5` | refactor | **Capacitor 8 → 7 다운그레이드** (apple-sign-in 호환성) |
| `f4d5771` | fix | User Script Sandboxing OFF (CocoaPods 호환) |
| `93cc7fd` | fix | iOS status bar safe-area inset (헤더가 시간과 겹치는 문제) |

---

## 2. 사용자 작업 (Apple Developer Console + Firebase Console)

### Apple Developer Console (https://developer.apple.com/account)

- [x] App ID `com.voda.app` 생성 + Capabilities:
  - Sign In with Apple
  - Associated Domains
- [x] Service ID `com.voda.app.signin` 생성 (웹 Sign-In 용)
  - Domain: `voda-7647c.firebaseapp.com`
  - Return URL: `https://voda-7647c.firebaseapp.com/__/auth/handler`
- [x] Sign in with Apple Key 생성: **`AuthKey_G3Q44RRZ7R.p8`** (Key ID: `G3Q44RRZ7R`, Team: `WG75TG59NJ`)
- [x] Apple Developer Program License Agreement (PLA) 업데이트 동의 — 동의 안 하면 Keys 페이지 잠김
- [x] Xcode > Settings > Accounts 에 Apple Developer 가입한 Apple ID 추가 — Personal Team 만 보였던 문제 해결

### Firebase Console (https://console.firebase.google.com/project/voda-7647c)

- [x] Authentication > Sign-in method > Apple 활성화
  - 서비스 ID: `com.voda.app.signin`
  - Apple Team ID: `WG75TG59NJ`
  - Key ID: `G3Q44RRZ7R`
  - 개인 키: .p8 파일 내용 paste
- [x] Authorized Domains 에 `localhost` 확인 (Capacitor 네이티브 앱이 사용)
  - `capacitor://localhost` 는 Firebase 가 도메인 형식만 받아 추가 불가. `localhost` 만으로 OK.

---

## 3. 빌드 트러블슈팅 카탈로그

작업 중 만난 모든 함정. **다시 같은 길 갈 때 참고용**.

### 3-1. Apple Developer Console

| 증상 | 원인 / 해결 |
|------|-------------|
| Identifiers 에 「There are no identifiers available that can be associated with the key」 | App ID 의 Sign In with Apple capability 가 먼저 활성화 안 됨. Identifiers > `com.voda.app` > Capabilities 에서 ☑ Sign In with Apple → Save 후 Keys 페이지 재시도 |
| Keys 페이지 접속 시 「Unable to process request - PLA Update available」 | Apple Developer Program License Agreement 가 업데이트됨. https://developer.apple.com/account/#/membership/ 또는 메인 화면 배너에서 약관 동의 (Account Holder 권한 필요). 동의 후 5-10분 캐시 |
| 「Personal Team」 만 보임 | Xcode > Settings > Accounts 에 Apple Developer Program 가입한 Apple ID 로그인 누락. 추가 후 Team 드롭다운에 「Uihyun Kim (Admin)」 = paid team 으로 표시 (Team ID 는 UI 에 노출 안 되지만 `WG75TG59NJ` 가 박혀있음) |

### 3-2. Xcode

| 증상 | 원인 / 해결 |
|------|-------------|
| 처음 열 때 「Update to recommended settings」 다이얼로그 + ⚠️ 1 | Capacitor 가 Xcode 8 compatibility version 으로 프로젝트 만들어서. 모든 체크박스 그대로 두고 「Perform Changes」 |
| Archive 메뉴가 회색 | Device target 이 시뮬레이터로 되어있음 → 「Any iOS Device (arm64)」 선택 |
| Xcode Cloud 권유 다이얼로그 | 우리는 로컬 Archive 라 불필요. 「Remind Me Later」 |
| App Store Connect 등록 시 「App」 이름 충돌 「already in use」 | 「App」 은 너무 일반적 — 이미 점유. `Voda: AI Interior Design` 등으로 변경 |
| 새 프로젝트 만들기 화면 (Choose options for your new project) 가 뜸 | 잘못된 메뉴 — 새 프로젝트 만드는 게 아니라 기존 `ios/App/App.xcworkspace` 를 열어야 함. `npm run cap:open:ios` 또는 Finder 에서 워크스페이스 더블클릭 |

### 3-3. 빌드 에러

| 증상 | 원인 / 해결 |
|------|-------------|
| `Missing package product 'CapApp-SPM'` + `apple-sign-in depends on capacitor-swift-pm 7.x and share depends on 8.x` | Capacitor 8 + apple-sign-in 의 호환성 충돌. v7 로 다운그레이드 (커밋 `9bddee5`) |
| `Sandbox: bash deny(1) file-read-data Pods-App-frameworks.sh: Operation not permitted` | 「Update to recommended settings」 가 켠 User Script Sandboxing 이 CocoaPods 의 「[CP] Embed Pods Frameworks」 스크립트와 충돌. NO 로 (커밋 `f4d5771`). 명령: `sed -i '' 's/ENABLE_USER_SCRIPT_SANDBOXING = YES;/ENABLE_USER_SCRIPT_SANDBOXING = NO;/g' ios/App/App.xcodeproj/project.pbxproj` |

### 3-4. 시뮬레이터 / Webview

| 증상 | 원인 / 해결 |
|------|-------------|
| 헤더 「Voda」 와 iOS 시간 (6:18) 이 같은 줄에 겹침 | PWA 모드에선 브라우저가 status bar 영역 차지. 네이티브 앱은 화면 전체 사용. CSS 의 `env(safe-area-inset-top)` + `viewport-fit=cover` (커밋 `93cc7fd`) |
| CSS 변경 / 코드 변경이 시뮬레이터에 반영 안 됨 | (1) `npm run cap:sync` 안 돌렸음 → 돌리면 dist 가 native bundle 로 복사. (2) PWA Service Worker 가 옛 자산 캐싱 → 시뮬레이터에서 Voda 앱 길게 눌러 「앱 삭제」 후 Run 다시 |
| Develop 메뉴에 시뮬레이터가 안 보임 | 시뮬레이터에서 Voda 앱이 백그라운드 또는 죽음. 앱 다시 띄우고 Safari Develop 메뉴 재오픈. 또는 시뮬레이터 재시작 |

### 3-5. capacitor-assets 부작용

| 증상 | 원인 / 해결 |
|------|-------------|
| `npx capacitor-assets generate` 실행 후 PWA 가 깨짐 | 도구가 `public/manifest.json` 의 icon path 를 `../icons/*.webp` 로 망가뜨리고 `public/icon.svg` 삭제. 매번 실행 후 manifest.json 을 `/icon-192.png`, `/icon-512.png` 로 복구 (커밋 `f98d071`) |
| iOS Splash imageset 에 옛 default 파일 (`splash-2732x2732*.png`) 잔존 | Contents.json 에 새 `Default@*~universal~anyany.png` 만 참조하는데 옛 파일이 같이 남음. `rm ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732*.png` |

---

## 4. 미해결 / 검증 미완 문제

### 4-1. 시뮬레이터 / 실기 첫 실행 후 발견 → ✅ 해결됨 (2026-05-05)

#### ✅ status bar 헤더 겹침 — 해결
- `env(safe-area-inset-top)` 만으론 Capacitor 7 webview 에서 0 으로 평가되는 케이스가 있어 헤더가 dynamic island 와 같은 줄에 옴.
- **fix**: `src/main.jsx` 에서 native 일 때 `<body>` 에 `.is-native` 클래스 추가. CSS 에서 `body.is-native .header` 의 padding-top 을 `calc(0.75rem + max(env(safe-area-inset-top, 0px), 50px))` 로 — system 값이 0 이어도 최소 50px fallback 보장. (커밋 `91006ea`, `5620625`)
- `@capacitor/status-bar` 플러그인 + `setOverlaysWebView({ overlay: true })` + `Style.Dark` — webview 가 화면 끝까지 채우면서 status bar 영역도 흰 배경, 시간/배터리 글자는 검은색.

#### ✅ Community 피드 안 뜸 — 해결 (진짜 root cause 발견까지 오래 걸림)

**범인**: Firebase Auth 의 popup-based OAuth helper. default `getAuth()` 는 redirect/popup 코드 경로가 호출될 때 `apis.google.com/_/scs/...` 에서 외부 헬퍼 스크립트를 동적 로드한다. WKWebView 의 `capacitor://localhost` origin 에선 그 cross-origin 평가가 거부 → opaque `Script error.` 로 마스킹 된 채 throw → main thread 가 죽고 그 아래의 Firestore.getDocs() 가 영원히 resolve 안 됨 (= 「피드 계속 로딩」 의 진짜 원인).

진단을 결정 지은 디버그 패널 단서:
```
[xhr>] POST https://apis.google.com/_/jserror?script=https%3A%2F
       %2Fapis.google.com%2F_%2Fscs
[xhr ERR] https://apis.google.com/_/jserror?...
```

처음에 의심한 건 다 무관:
- ❌ `capacitor://` origin 자체 (cross-origin 처럼 보였지만 Auth 의 helper 만 문제)
- ❌ Firestore transport (WebChannel/long-polling — 여전히 long-polling 으로 강제는 했지만 그게 진짜 원인은 아니었음)
- ❌ Service Worker (껐어도 변화 X)
- ❌ Firestore 룰 / Authorized domains
- ❌ 시뮬레이터 캐시 (실기에서도 같은 증상)

**fix** (커밋 `68d83d3`):
- `src/firebase.js`: native 일 땐 `getAuth(app)` 대신 `initializeAuth(app, { persistence: indexedDBLocalPersistence })`. 이 path 는 popupRedirectResolver 를 안 끌어와서 `apis.google.com` helper 가 로드되지 않음. Apple Sign-In on native 는 `@capacitor-community/apple-sign-in` 이 처리하므로 popup helper 불필요.
- `getRedirectResult(auth)` 호출도 native 에선 skip — 그것도 popup helper bootstrap 의 trigger.

**같이 살린 부수 fix들** (전부 final 빌드에 그대로 들어감):
- `experimentalForceLongPolling: true` + `useFetchStreams: false` (Firestore transport, Capacitor + Cordova 표준 권장)
- `getAnalytics` 를 native 에선 호출 안 함 (cookie 거부 throw 로 firebase.js 의 다른 export 까지 깨질 수 있음). `analytics` 를 callable Proxy 로 export 해서 `logEvent(analytics, ...)` 호출 사이트가 silent no-op.
- vite-plugin-pwa 의 `injectRegister: null` + `main.jsx` 에서 native 가 아닐 때만 SW 등록. 네이티브 앱 안에 PWA 캐시 레이어 불필요 + 충돌 가능성 차단.

### 4-2. App Store 출시 전 진행 필요

#### 🟡 App Store 표시명 미결정
- 「App」 으로 시도 → 이미 사용 중 에러
- 추천: **`Voda: AI Interior Design`** (23자, ASO + 브랜드 균형)
- 백업 후보: `Voda - AI Room Design`, `Voda — Redesign Your Room`, `Voda Interior AI`
- App Store Connect 등록 시 30일 이내 자유 변경 가능, 그 이후엔 새 버전 제출 시에만 변경 가능

#### 🟡 App Store Connect 앱 등록 미완
- Validate App 시 「Create app record」 단계에서 멈춤
- 앱 이름 결정 후 진행
- Bundle ID `com.voda.app`, SKU `voda-ios` 또는 `com.voda.app`, Primary Language Korean / English

#### 🟡 TestFlight 업로드 미완
- Archive `1.0 (1)` 가 Organizer 에 있음 (1년 유효)
- App Store Connect 등록 후 Validate App → Distribute App → Upload → Internal Testing 그룹

#### 🟡 실기 USB 테스트 미완
- 시뮬레이터에선 Sign in with Apple, 카메라, Universal Links 가 일부 제한적
- 본인 iPhone USB 연결 → Xcode Run → 진짜 native 동작 검증
- 첫 실행 시 iPhone Settings > General > VPN & Device Management > Trust 필요

### 4-3. 보안 / 보관

#### 🔴 `AuthKey_G3Q44RRZ7R.p8` 가 repo 루트에 있음
- `.gitignore` 로 git 진입은 막혔지만 디스크엔 그대로
- 백업 도구 / 동기화 도구 / 검색 인덱서가 가져갈 위험
- **다음 액션**: 1Password 또는 비번 매니저의 secure file attachment 로 이동 → 로컬에서 `rm AuthKey_G3Q44RRZ7R.p8`

### 4-4. 디자인 / 마케팅

#### 🟡 placeholder 아이콘 그대로
- 검정 배경 + 흰 「V」 letter — TestFlight 내부 테스트용 OK, 정식 출시 전 디자이너 작업 필요
- 마스터 SVG 4개 (`assets/icon-only.svg`, `icon-foreground.svg`, `icon-background.svg`, `splash.svg`) 만 교체하면 `npx capacitor-assets generate` 한 번으로 모든 사이즈 재생성

#### 🟡 App Preview 영상 / 스크린샷 미준비
- App Store Connect 제출 시 iPhone 6.7" / iPad 등 스크린샷 3-8장 필요
- 앱이 native 에서 잘 동작하는 게 확인된 후 진짜 화면 캡처해서 만들기

#### ✅ Support URL — 해결 (2026-05-06)
- `src/pages/Support.jsx` 신규. `/support` 라우트. mailto `hello@uhzlab.com` + 자주 묻는 질문 3개 (계정·디자인 삭제 / 크레딧 / 결제 이슈) + Privacy / Terms 링크.
- Account 페이지 하단에 Support / Privacy / Terms inline 링크 노출 (`account-footer-links`).
- `store-metadata.md` Support URL 메모 갱신.

---

## 5. 장기 관찰 사항

| 항목 | 메모 |
|------|------|
| Capacitor 8 호환 apple-sign-in | 나오면 v8 로 업그레이드 검토. `npm view @capacitor-community/apple-sign-in versions` 로 가끔 확인 |
| PWA Service Worker 가 Capacitor webview 캐시 | 변경 반영 위해 매번 앱 삭제 / 재설치 필요 → 추후 native 빌드에서 SW 비활성화 검토 (vite.config.js 의 VitePWA 옵션 분기) |
| Node 20 deprecation | Functions runtime 은 이미 22 로 (커밋 `d4e77e1`). iOS Capacitor 와 무관. |
| firebase-admin 12 → 13 | 별도 PR 로 검토 |

---

## 6. 다음 단계 (우선순위 순)

### ✅ 완료 (2026-05-14) — D2 sandbox 검증 + RC webhook 실연결 + E App Store 정식 제출

1. **TestFlight Build 2 → sandbox 결제 e2e 검증**
   - Internal 테스터 그룹 (`Internal`, 자동 배포 ON) + 본인 추가 → Build 2 설치.
   - Sandbox tester 로 구독 → "You're all set" 성공. Paywall 의 trial 표기 `Try free for 3 days` 정상 (앞선 RC paywall 템플릿 하드코딩 fix 반영 확인).
   - Apple Customer Center (RC `presentCustomerCenter`) — `archelier Pro · Free Trial · next charge $9.99 on 2026-05-15` 정확.

2. **RevenueCat webhook — 미설정 상태였음 → 실연결 (핵심 fix)**
   - 증상: 결제 성공·Pro 배지 정상인데 Account 화면이 `Subscription cancelled` + 과거 만료일 표시. Apple Customer Center 와 불일치.
   - 진단: `functions/revenuecat.js` (webhook handler) 코드·배포 다 정상, `billing-service.js` 필드 매핑도 정상. 하지만 **함수 호출 로그 0건** — RevenueCat dashboard 에 webhook 이 한 번도 등록 안 돼 있었음. `REVENUECAT_WEBHOOK_AUTH` secret 도 `placeholder_...` 값 그대로.
   - Fix:
     - `openssl rand -hex 32` 로 실 secret 생성 → `firebase functions:secrets:set REVENUECAT_WEBHOOK_AUTH` → `revenueCatWebhook` 함수 재배포 (secret 반영).
     - RC Dashboard → Integrations → Webhooks → `Firestore sync` 등록. URL `https://us-central1-voda-7647c.cloudfunctions.net/revenueCatWebhook`, Authorization header = 그 secret 값 (Bearer 접두어 없이 raw — 함수가 헤더 전체를 `===` 비교), Environment `Both Production and Sandbox`.
     - Test event 발사 → 함수 로그에 `untracked event type TEST` 확인 = 연결·인증 정상 (TEST 는 우리가 핸들하는 INITIAL_PURCHASE/RENEWAL/CANCELLATION/EXPIRATION 이 아니라 skip 하는 게 정상).
   - 이후로 실사용자 결제 시 RC → 함수 → Firestore `users/{uid}` 자동 동기화.

3. **오염된 sandbox 테스트 계정 정리**
   - 테스트 계정 (`@vodaqaxv9mgs`) 이 3중 오염: ① webhook 설정 전 RC 결제, ② 옛 Stripe 웹 테스트의 `stripeCustomerId`/`stripeSubscriptionId` 잔재, ③ DB 수동 편집. → 앱이 stale 데이터 (`Subscription cancelled` / "웹에서 관리" 힌트) 표시.
   - `scripts/fix-sandbox-sub.cjs` (일회용, firebase-admin + ADC) — 처음엔 수동 교정용으로 만들었다가, 결국 `users/{uid}` 의 구독 필드 9종 (`plan / subscriptionStatus / subscriptionRenewsAt / cancelAtPeriodEnd / stripeCustomerId / stripeSubscriptionId / iosLastEventType / iosLastEventAt / iosProductId`) 을 전부 `FieldValue.delete()` 하는 **wipe 스크립트**로 변경. → "한 번도 구독 안 한 free 유저" 로 리셋.
   - 그 다음 fresh sandbox 테스터로 깨끗한 결제 1번 → webhook 의 `INITIAL_PURCHASE` 가 정확한 값으로 채움. 앱 Settings · Apple Customer Center · Apple 결제 다이얼로그 셋 다 `2026-05-15` 일치 확인. webhook 파이프라인 e2e 검증 완료.
   - 실행 전제: `gcloud auth application-default login` 1회.

4. **참고 — Account.jsx 의 RC-우선 읽기 검토 후 보류**
   - "iOS+RC 일 땐 Firestore subscription 대신 RC `customerInfo` 에서 status/날짜 직접 읽기" 를 한 번 구현했다가 revert. webhook 이 정상 동작하면 Firestore 가 single source 로 일관 (web/iOS 동일) — UI 이중 경로는 불필요한 복잡도. webhook latency 가 실제 UX 문제가 되면 그때 재검토.

5. **E — App Store 1.0.0 정식 제출 (Build 2 + 첫 IAP)**
   - 버전 메타데이터 (스크린샷 10장 / 설명 / 키워드 / URL) + Build 2 선택 + App Review 메모 (Apple 로그인이라 데모 계정 불필요 명시) 완료.
   - ★ 함정: 첫 구독을 버전에 attach 하려는데 구독이 `메타데이터 누락됨` 에서 안 풀림. **원인은 구독 *그룹* 의 현지화 누락** — 경고는 개별 구독에 뜨지만 빠진 건 그룹 쪽. 그룹 현지화 1개 생성하니 `제출 준비 완료` 로 전환.
   - 구독이 Ready 가 되니 버전 페이지에 "앱 내 구입 또는 구독" 섹션이 나타남 → 거기서 `archelier Pro Monthly` 선택. "심사에 추가" → "심사를 위해 제출". submission `심사 대기 중` (제출 ID `fa4f55aa-...`).
   - 전 과정 + 함정 카탈로그를 **`APP_STORE_SUBMISSION.md`** 로 별도 정리 (다음 앱 재사용).

6. **문서화**
   - `REVENUECAT_SETUP.md` (신규) — IAP 전체 walkthrough.
   - `APP_STORE_SUBMISSION.md` (신규) — App Store 제출 walkthrough + 함정 카탈로그.
   - `IOS_BUILD_GUIDE.md` §9, 이 문서 참조 목록 cross-link 갱신.

### 🛠 진행 중 (2026-05-16) — Sprint B Android 통합 1차

archelier iOS 1.0 출시 직후 (2026-05-15) Android Sprint 착수. 골격은 Capacitor scaffold 이미 있었고 Sprint A 에서 만들어둠. 이번 라운드는 Firebase 통합 + 로그인 + RC + splash + 앱 이름 같은 "동작 가능한 베이스" 확보. Play Console 등록 / IAP / keystore 는 후속.

1. **Firebase Android 통합**
   - Firebase Console → Android app 추가 (`com.voda.app`) + debug SHA-1 등록 (`0F:4E:E6:00:5A:8C:86:B1:8E:99:3B:B6:F8:B5:63:5E:51:58:B8:29`).
   - ★ 함정: 처음 google-services.json 다운로드 시 `client_type: 1` (Android OAuth) 누락. **SHA-1 등록 *후* 재다운로드 필수** — 안 그러면 OAuth client 자동 생성 안 됨. 재다운로드 후 정상.
   - Capacitor 가 root + app build.gradle 에 `google-services` plugin 이미 깔아둠 → Firebase Console 의 "Add Firebase SDK" Gradle step 무시 OK. native Android 프로젝트 가정이라 Capacitor 와 무관.

2. **minSdk 23 → 24** (`android/variables.gradle`)
   - `purchases-hybrid-common-ui:17.25.0` 가 minSdk 24 요구 → Manifest merger 실패. 24 (Android 7.0) 로 올림. 활성 디바이스 99%+ 커버 — 안전.

3. **앱 이름 Voda → archelier** (`strings.xml`)
   - `app_name` + `title_activity_main` 변경. iOS 와 통일 (글로벌 단일 archelier 정책).

4. **Splash 통일 — 시스템 splash + Capacitor splash 두 번 보임 → 한 번처럼**
   - Android 12+ system splash 는 OS 강제 (완전 비활성화 불가). adaptive launcher icon 의 background 가 `#FFFFFF` 라 둥근 영역 흰색 + outer 베이지 두 톤 보임 → 어색.
   - Fix:
     - `values/ic_launcher_background.xml`: `#FFFFFF` → `#C8BFAF` (베이지)
     - `mipmap-anydpi-v26/ic_launcher.xml` + `ic_launcher_round.xml`: background reference 를 `@mipmap/ic_launcher_background` (PNG) → `@color/ic_launcher_background` 로 (단색)
     - `styles.xml` 의 `AppTheme.NoActionBarLaunch` 에 Android 12+ splash attributes 추가: `windowSplashScreenBackground=#C8BFAF`, `windowSplashScreenAnimatedIcon=@drawable/splash_transparent`, `postSplashScreenTheme=@style/AppTheme.NoActionBar`
     - 신규 `drawable/splash_transparent.xml` — system splash 의 icon 자리 빈 shape. 둥근 마스킹 / launcher icon 안 보이고 베이지 배경만.
     - `capacitor.config.json`: SplashScreen `launchShowDuration` 3000 → 2000, `launchAutoHide` false → true. webview 로딩 동안 splash 표시 + 자동 hide.
   - 결과: system splash 의 베이지 빈 화면 → Capacitor splash D → 앱. 한 톤으로 매끄럽게 이어짐.

5. **Google Sign-In 동작 — Credential Manager API**
   - Android 14+ 는 `androidx.credentials` Credential Manager 사용. `@capacitor-firebase/authentication@7.5` 가 자동 호출.
   - ★ 함정 1: google-services.json 의 Android OAuth client_type 1 누락 → "client not found" — 위 1번에서 해결.
   - ★ 함정 2: emulator 에서 `NoCredentialException: No credentials available` — emulator 시스템 settings 에 Google 계정 미추가 (Gmail 앱 sign-in 과 별개). 시스템 Settings → Passwords & accounts 에서 추가 필요.
   - 추가 옵션 `mode: 'select_account'` 적용 (`src/services/auth-service.js`) — Credential Manager 가 자동 검색 안 하고 계정 선택 chooser 강제. emulator 에서 NoCredentialException 회피 + 여러 계정 가진 사용자도 선택 가능.

6. **Apple Sign-In Android 에서 숨김** (`src/App.jsx`)
   - Apple 가이드라인 4.8 (다른 third-party sign-in 있으면 Apple 도 필수) 는 iOS 정책. Android 무관.
   - Android 의 Apple Sign-In 은 Web OAuth flow 라 UX 좋지 않음. `isAndroid()` 분기로 hide.

7. **RevenueCat API key — platform 별 분리**
   - iOS 는 `appl_...`, Android 는 `goog_...` 필수. RC SDK 가 자동 감지 안 함 — 잘못된 key 면 `"API Key is not recognized"` 에러.
   - RC dashboard → Project → Apps & providers → New Play Store configuration → `archelier Play Store` (package `com.voda.app`) 추가. Service account credentials 는 일단 비워둠 (결제 검증 단계 전까지 불필요). Public SDK key `goog_XByQcYxCPMygCZlxVwepsVdnAal` 받음.
   - `revenuecat-service.js` 에 `getApiKey()` 함수 — `Capacitor.getPlatform()` 으로 분기. `.env` + `.env.production` 에 `VITE_REVENUECAT_PUBLIC_KEY_IOS` + `VITE_REVENUECAT_PUBLIC_KEY_ANDROID` 추가. `VITE_REVENUECAT_PUBLIC_KEY` 는 backward-compat (iOS fallback).

8. **검증 — emulator (Pixel 8 Pro API 36)**
   - 앱 실행 / 스플래시 / 홈 OK
   - Google Sign-In 성공 (`Purchases.logIn(appUserID: ...)` 까지 도달)
   - RC API key 인식 OK (`"API Key is not recognized"` 사라짐). 마지막 남은 에러 = `"no Play Store products registered"` — Play Console IAP 등록 전이라 **정상 동작**.

9. **남은 작업 (다음 라운드)**
   - Production keystore 생성 + release SHA-1 Firebase 등록 + build.gradle signingConfigs
   - Google Play Console 앱 등록 (메타데이터 / 스크린샷 / Data safety / 콘텐츠 등급)
   - Play Console 에 IAP `archelier_pro_monthly` 등록 (월 구독, 3일 무료 체험)
   - Service Account 생성 → RC dashboard 업로드 → RC offering 에 Android product attach
   - Internal Testing → Closed → Production 트랙 promotion

### 🛠 진행 중 (2026-05-18) — Sprint B 2차: Production keystore + Play Console 제출

1차 라운드의 "동작 가능한 베이스" 위에 production 신호 — 진짜 keystore 로 서명한 .aab, Play Console 의 모든 App Content 양식, Production 트랙 제출. 결제는 아직 (3차에서). 핵심 메모만:

1. **Production keystore — `uhz LLC` 명의로 발급** (`~/Desktop/idea/voda/keys/playstore_rc/...` 외부 보관)
   - `keytool -genkeypair -keyalg RSA -keysize 2048 -validity 10000 -alias archelier-upload -keystore archelier-upload.keystore` — CN=Uihyun Kim, O=uhz LLC, L=New York, ST=NY, C=US.
   - SHA-1 `4F:27:AE:05:8D:7D:5C:0D:53:20:B3:EE:D1:69:1B:AD:2F:44:F5:DE` → Firebase Console Android app 에 release SHA-1 로 추가 → `google-services.json` 재다운로드 (debug 와 release 둘 다 client OAuth 1 entry 있어야 함).
   - **분실 시 앱 업데이트 불가**. 외장 SSD + 1Password + 다른 클라우드 3-tier 백업. 비밀번호는 1Password.
   - `android/app/build.gradle` 의 `signingConfigs.release` 가 `~/.gradle/gradle.properties` 에서 `ARCHELIER_UPLOAD_STORE_FILE` / `PASSWORD` / `KEY_ALIAS` / `KEY_PASSWORD` 읽음 (repo 에 안 들어감).
   - Play App Signing 가입 — Google 이 final signing key 보관, 우리는 upload key 만 관리. 이후 키 분실 시 Google 통해 재발급 가능.

2. **Play Console 앱 등록 — Setup → Production 12개 작업 다 통과**
   - App access — anonymous flow 지원이라 username/password 강제 아님. 단, 정책상 reviewer 가 일부 기능 검증 필요할 수 있어 더미 계정 `uhzdev@gmail.com` 만들어서 정보 제공 + "No other information is required" 체크.
   - Content rating — IARC questionnaire 정직 답변 → ESRB Everyone, PEGI 3, GRAC 3+. **단 Brazil ClassInd 14+** (UGC 피드가 있어 자동 적용. 정상).
   - Target audience — 18+ 단일 선택 (성인 대상).
   - Data safety — 모든 SDK / Firebase / Stripe / RC 가 수집하는 데이터 정직 신고. Personal info / Photos / Account / App activity / Device or other IDs / Crash logs / Diagnostics 다 ✅. 암호화 in-transit ✅, 사용자가 삭제 요청 가능 ✅.
   - Ads / Financial / Health / Government / News / COVID 신고 — 모두 No (해당 없음).
   - ★ 카테고리 선택 — Apple 측은 `Lifestyle` 1차이지만 Play 는 `House & Home` + tags `Interior design / House & home / Lifestyle / Social / Photo editor`. 룸AI / Reroom AI 같은 비슷한 앱 패턴 따라감.

3. **Store listing — 3개 언어 (en/ko/ja)** + 그래픽 자산
   - Short / Full description 은 `store-metadata.md` 의 값 그대로.
   - **Feature graphic 1024×500** — Play 만 요구하는 자산. `scripts/build-play-feature-graphic.cjs` 신규. 베이지 그라데이션 배경 + Hoefler serif 'archelier.' wordmark (terracotta 점) + atelier window line motif. 출력 `resources/app-store/play-feature-graphic.png`.
   - Phone screenshots — App Store 용 6.9" (1290×2796) marketing 변종 B 그대로 재사용. Play 가 9:16 비율 받아주는 6.9" Display size 로 인정.

4. **Production submission (1.0)** — 176개 국가, 모든 App Content task ✅, 경고 없음. Google review (~24-72h) 큐 진입.
   - Internal Testing 에 동일 .aab 도 업로드 (테스트 트랙 유지용).
   - Geo-blocking regulation 경고는 부가 declaration 안 해도 통과 OK (EEA 외 대상 + standard Google Play 분배).

---

### ✅ 완료 (2026-05-20) — Sprint B 3차: Google Play Billing + RC integration

iOS 측은 1.0.1 (BeforeAfterSlider 수정 + 신규 유저 온보딩) + 1.0.2 (App Store screenshots 마케팅 변종 B 교체, metadata-only) 작업이 동시 진행됐고 둘 다 review 대기 중. 이 라운드 핵심은 **Android 결제 연결**.

#### 사전 준비
- Play Console → Subscriptions → `archelier_pro_monthly` 생성 (월 $9.99 USD base plan, 4개 benefits — Unlimited design generations / Watermark-free saves / Unlimited region edits / Unlimited AI chat per design, en/ko/ja localized, 174개국 활성).
- Auto-renewing / Grace period 3 days / Calculate account hold auto / Resubscribe Allow.
- ★ Play Console UI 의 base plan ID 는 user-defined (보통 `monthly` 또는 `p1m`). RC 의 Play product identifier 는 `<subscription_id>:<base_plan_id>` 형태 — 우리는 `archelier_pro_monthly:monthly`.

#### Service Account 생성 — RC 가 결제 검증 / 환불 / 구독 cancel 호출
Play Console API access 페이지는 **2024 이후 제거**되어 있음. 새 흐름:

1. **Google Cloud Console → IAM & Admin → Service Accounts** (`voda-7647c` project)
   - `+ CREATE SERVICE ACCOUNT` → Name `archelier-revenuecat` → role 부여 skip → DONE.
   - 행 클릭 → **KEYS** 탭 → ADD KEY → Create new key → JSON → 다운로드. `keys/playstore_rc/voda-7647c-<keyid>.json`. **이 키는 비밀번호급** — repo 밖 보관, .gitignore.
2. **Cloud Pub/Sub API enable** — RC 의 real-time developer notifications 가 Pub/Sub 사용. Cloud Console → APIs & Services → Library → "Cloud Pub/Sub API" → ENABLE.
3. **IAM → 새 service account 에 `Pub/Sub Admin` role 부여** — RC 가 topic + subscription 자동 생성/관리.
   - ★ 함정: API enable 안 한 상태에서 IAM 검색하면 `Pub/Sub Lite` 만 나옴 (다른 서비스). API enable 후 검색해야 `Pub/Sub Admin` 보임.
4. **Play Console → Users and permissions → Invite new users** (계정 레벨)
   - 이메일 `archelier-revenuecat@voda-7647c.iam.gserviceaccount.com`
   - archelier 앱에 4개 권한: ✅ View app information / ✅ **View financial data** / ✅ **Manage orders and subscriptions** / ✅ View store performance.
   - ★ 함정: subscriptions API 호출에 `View financial data` + `Manage orders and subscriptions` 둘 다 필수. RC 가 검증 시 "Permissions to call subscriptions API ❌" 로 정확히 짚어줌 — 이 두 개 빠지면 결제 검증 안 됨.
5. **권한 전파** — 보통 1-5분, 가끔 10-30분. RC dashboard 의 ⚠️ "Credentials need attention" 옆 🔄 새로고침 안 되면 RC config 에서 "Replace?" 클릭 후 같은 JSON 다시 업로드 + Save → 강제 재검증 (캐시된 실패 상태 초기화).

#### RC dashboard 연결
- Apps & providers → archelier Play Store → Service Account JSON 업로드 → ✅ Valid credentials.
- Google developer notifications → Topic name `Play-Store-Notifications` 자동 생성 (RC 가 Pub/Sub topic 자동 생성). Topic name = `projects/voda-7647c/topics/Play-Store-Notifications`.
- Play Console → archelier → Monetization setup → Real-time developer notifications → Enable + Topic name 위 값 붙여넣기 → "Subscriptions and voided purchases only" → Send test notification 으로 검증.
- RC → Products → archelier Play Store row 의 **Import Products** 버튼 → `archelier_pro_monthly:monthly` 자동 import. Status ✅ Published.
- RC → Entitlements → `archelier Pro` → Attach 로 Android product 추가. iOS `archelier_pro_monthly` + Android `archelier_pro_monthly:monthly` 한 entitlement 에 묶임 (cross-platform restore 의 근거).
- RC → Offerings → `default` → Monthly package 에 Android product attach.

#### iOS 측 미설정 발견 — App Store Connect API 키
RC Products 페이지의 iOS row 가 "Could not check" 였음. 두 개 P8 키가 필요한데 In-app purchase key (`D5U4FUVTFT.p8`) 만 올라가 있고 **App Store Connect API key** 가 비어 있었음.

- ASC → 사용자 및 액세스 → 통합 → **App Store Connect API** (≠ 앱 내 구입) 에서 별도 키 생성. Access: Developer 또는 App Manager.
- 파일명 `AuthKey_<KEYID>.p8` 다운로드 (1회만 가능). `keys/appstore_rc_asc_api/` 보관.
- RC 의 같은 페이지 하단 "App Store Connect API" 섹션에 P8 + Key ID + Issuer ID 업로드 → ✅. iOS product Status "Could not check" → **Approved**.

#### 코드 측 검증 — 추가 변경 불필요
- `revenuecat-service.js` 의 `getApiKey()` platform 분기는 Sprint B 1차에서 이미 작성.
- `.env.production` 에 `VITE_REVENUECAT_PUBLIC_KEY_ANDROID=goog_XByQcYxCPMygCZlxVwepsVdnAal` 도 1차 commit 에 포함.
- 5/18 빌드 `app-release.aab` 의 JS 번들에서 `goog_` + `appl_` 두 key 다 baked-in 확인됨 (`unzip` 후 grep).
- → **현재 production 으로 제출된 .aab 그대로 결제 동작**. dashboard 연결만 늦었던 거.

#### 남은 작업
- **License testers 등록** (Play Console → Settings → License testing) — sandbox 결제 테스트용 (`uihyunkei@gmail.com`, `uhzdev@gmail.com`). License response: `RESPOND_NORMALLY`.
- Internal Testing 트랙 opt-in 링크로 실기 디바이스에서 구매 플로우 한 번 돌리기 — "Test card. always approves" 표시 / Pro 활성 / Firestore 의 `users/{uid}.plan === 'pro'` 동기화 확인.
- Production review 통과 후 production 트랙에서도 동일 검증 (license tester 면 production 트랙에서도 sandbox).

#### 🛠 추가 (2026-05-21) — emulator 검증 중 발견한 함정 3건

License tester 등록 전에 **emulator 에서 paywall + 구매 흐름 확인** 시도. 다음 함정들을 차례로 만나 모두 해결.

1. **★ 함정: debug.keystore 가 5/19 에 재생성됨** — Android Studio 가 어떤 시점에 `~/.android/debug.keystore` 를 자동 재생성. 새 SHA-1 (`54:85:87:6C:29:E5:F8:82:75:1F:21:64:0F:EF:79:9B:BE:09:F7:D6`) 이 Firebase Console 에 미등록 → Google Sign-In 시 `NoCredentialException: No credentials available` (Credential Manager 가 매칭되는 OAuth client 못 찾음).
   - 시스템 Settings 에 Google 계정 있어도 동일. 시스템 계정과 별개 — 앱 시그너처 ↔ Firebase OAuth client 의 SHA-1 매칭이 필요.
   - Fix: Firebase Console → Project settings → archelier Android 앱 → Add fingerprint → 새 SHA-1 추가 → `google-services.json` 재다운로드 → `android/app/google-services.json` 덮어쓰기 → Sync Gradle. release SHA-1 (`4f27ae05...`) 는 그대로.
   - 교훈: **머신 간 이동 / Android Studio 업데이트 / `.android/debug.keystore` 삭제 시 SHA-1 재등록 필수**. 만약 팀원 디바이스도 추가되면 그 SHA-1 들도 모두 등록 필요.

2. **★ 함정: RC SDK API key 가 회전됨** — Sprint B 1차 (5/16) 에 적어둔 Android key `goog_XByQcYxCPMygCZlxVwepsVdnAal` 가 3차 (5/21) RC dashboard 의 archelier Play Store config 재설정 과정에서 **새 값으로 발급됨**. `.env` 의 옛 키로 SDK configure → RC 가 401 "Invalid API Key" 반환. RC SDK 는 이를 `InvalidCredentialsError` 로 wrap 하고, 일부 logcat 에는 "Unable to start a network connection due to a network configuration issue" 로도 표시 — 디버깅 시 네트워크 / 인증서 / DNS 다 의심하게 만드는 misleading 메시지.
   - 진단: host 에서 `curl -H "Authorization: Bearer <key>" https://api.revenuecat.com/v1/subscribers/test-anon/offerings` → 401 받으면 키 자체 무효 확정.
   - Fix: RC dashboard → **Project settings → API keys** (Apps & providers 의 "Public API Key" 가 아니라 좌측 메뉴 별도) 에서 platform 별 정확한 SDK key 복사 → `.env` + `.env.production` 의 `VITE_REVENUECAT_PUBLIC_KEY_ANDROID` 갱신 → rebuild → cap sync.
   - 교훈: **Play Store config 를 RC dashboard 에서 재생성하면 SDK API key 도 같이 바뀐다**. Apps & providers 페이지의 "Public API Key" 와 Project settings 의 SDK API keys 는 별도 표시지만 동일 키. config 가 회전하면 둘 다 회전.

3. **★ 함정: Pricing / Account 의 UI gating 이 `isIOS()` 로만 분기** — Sprint B 1차에서 `revenuecat-service.js` 만 platform 분기 (`getApiKey()`) 추가. UI 측 (`src/pages/Pricing.jsx`, `src/pages/Account.jsx`) 은 여전히 `isIOS()` 로 native vs web 구분 → **Android 에서 "Upgrade to Pro" 누르면 web Stripe checkout (Chrome 외부 브라우저)** 으로 빠짐. Play 정책상 외부 결제 promote 는 명백한 거부 사유.
   - Fix: `isIOS()` → `isNativeApp()` 로 6 곳 변경 (Pricing 2, Account 4). Stripe portal 버튼 / Customer Center / Upgrade CTA / effectivePlanId fallback / Stripe migration hint / hasNativeIAPSubscription 판단 모두 동일 처리.
   - 코멘트 / "iOS" 언급도 "Native (iOS / Android)" 로 정리. `isIOS` import 제거.
   - 교훈: Sprint B 3차에서 service layer 만 native 화 하고 UI 화면을 안 바꾸면 **결제 흐름이 통째로 web 으로 빠짐** — 다음 platform 추가 시 service + UI + 라우팅 한 묶음으로 검토.

4. **★ 함정: Play App Signing SHA-1 누락** — sideload debug 본 (1.0.1) 빌드 후 Play Store internal testing 트랙에서 설치한 release 본을 emulator 에서 실행하니 또 `NoCredentialException`. 원인: **Play Store 가 배포하는 .aab 는 Google 의 Play App Signing key 로 재서명** 되어 사용자 디바이스에 도달. upload key SHA-1 (`4f27ae05...`) 이 아니라 Play App Signing key 의 SHA-1 (`e665bf71...`) 로 동작 → Firebase OAuth client 가 그 SHA-1 모름 → 매칭 실패.
   - Fix: Play Console → **Protected with Play → Play Store distribution → Go to Play app signing** 페이지에서 **App signing key certificate** 의 SHA-1 복사 → Firebase Console 에 Add fingerprint → google-services.json 재다운로드 → versionCode 2→3 / versionName 1.0.1→1.0.2 bump → 재빌드 → Internal Testing 재업로드.
   - 결과 google-services.json 에는 SHA-1 4개: 옛 debug (`0f4ee600...`) + Play App Signing (`e665bf71...`) + upload (`4f27ae05...`) + 새 debug (`5485876c...`).
   - 교훈: **Play App Signing 사용 시 upload SHA-1 만 등록하면 sideload (debug) 와 Play Store internal/production 본의 Sign-In 동작 SHA-1 이 달라짐.** Play App Signing key SHA-1 도 반드시 함께 등록 — 처음 release 트랙 배포 직전에 같이 처리하는 게 안전. Play Console UI 가 자주 바뀌니 위치 못 찾으면 docs 확인하거나 "Protected with Play" 메뉴부터 탐색.

#### 최종 검증 (2026-05-21 16:00–16:39 EDT)

1.0.2 .aab 를 Internal Testing 트랙 업로드 → Play Store 에서 install → 모든 단계 통과:

| 단계 | 결과 |
|---|---|
| Google Sign-In | ✅ (Play App Signing SHA-1 등록 후) |
| RC SDK init + offerings fetch | ✅ (새 API key) |
| Paywall sheet present | ✅ |
| Test card sandbox 결제 (INITIAL_PURCHASE) | ✅ "Payment successful" |
| Webhook → Firestore `plan='pro'` | ✅ uid `z9ZVU1x51gVgvQGcD7DvvhfEwC83` |
| Auto RENEWAL × 6 (5분 cycle) | ✅ |
| Sandbox 한계 도달 → 자동 CANCELLATION | ✅ "billing error simulated" |
| EXPIRATION → `plan='free'` | ✅ |
| 앱 UI 자동 free 상태 전환 | ✅ |
| Customer Center 진입 / Cancel UI / Restore UI | ✅ |

→ INITIAL_PURCHASE / RENEWAL / CANCELLATION / EXPIRATION 4개 lifecycle 이벤트 모두 webhook → Firestore 동기화 정상. iOS 와 동일 코드 path 검증 완료.

#### Production 트랙 교체 (16:42 EDT)

5/18 빌드 OLD 1.0 (versionCode 1) 이 review 중이었는데, 그 빌드는 RC key + UI gating 결함이 있어 production 통과되면 신규 사용자 결제 전부 실패하는 상태. 같은 1.0.2 .aab 를 Production 트랙에 새 release 로 제출 → 새 release 가 in-review OLD 1.0 자동 대체.

- Previous release "Not Included" 로 1 (1.0) 표시 — production 에서 빠짐
- Roll-out 100%, 177개국, 21.1 MB
- 2 warnings (edge-to-edge — 기존 1.0 도 동일) — blocker 아님
- Submit → Google review 큐 진입 (~24-72h)


---

### ✅ 완료 (2026-05-15) — 첫 심사 거부 → 계정 삭제 + 구독 description 보강 → Build 3 재제출 준비

새벽에 Apple App Review 회신 도착. 1.0 (2) **거부**. 두 가지 가이드라인 위반 — 첫 제출에서 흔히 같이 받는 패턴.

| 가이드라인 | 사유 | 처리 |
|---|---|---|
| **5.1.1(v)** Data Collection and Storage | 계정 생성 가능 앱은 **앱 내**에서 계정 삭제 제공 필수. 일시 비활성화·외부 사이트 안내만으론 부족. | 새 빌드 + 코드 |
| **3.1.2(c)** Subscriptions | 구독이 가격에 대해 무엇을 받는지 명확히 기술 안 됨. | ASC 메타데이터만 |

1. **계정 삭제 기능 신규 구현 (Nuclear — Twitter 식)**
   - `functions/account.js` (신규) — `deleteAccount` Cloud Function. 9분 timeout. 삭제 순서:
     1. **Stripe 구독 server-side cancel** (있으면) — 데이터 지우기 전에 결제부터 끊어야 다음 invoice 안 발생. `stripe.subscriptions.cancel(stripeSubscriptionId)`. Apple IAP 는 앱이 못 끔 (UI 에서 사용자 안내).
     2. `designs` (userId == uid) + 서브컬렉션 `chat`/`comments` + Storage 파일 (URL → object path 변환 후 best-effort 삭제)
     3. `users/{uid}/bookmarks` 서브컬렉션
     4. `collections` (모드보드)
     5. `follows` 양방향 (`followerId` + `followedId`)
     6. `blocks` 양방향 (`blockerId` + `blockedId`)
     7. `reports` (`reporterId`)
     8. **collectionGroup `comments` where authorUid == uid** — 남의 디자인에 단 본인 댓글
     9. `profiles/{uid}` + `handles/{handle}` + `referralCodes/{code}` 역색인
     10. Storage `users/{uid}/profile/*` 폴더 prefix delete
     11. `users/{uid}` root doc
     12. **Firebase Auth user — 마지막**. 중간 실패 시 user 가 살아있어 재시도 가능하도록.
   - Firestore batch 400 chunk (500 limit 안전 마진).
   - `src/components/DeleteAccountModal.jsx` (신규) — Cancel + Delete 2-step. archelier 톤에 맞는 muted warm red (`#b8645c`). X 버튼 없음 (Cancel 만, 중복 제거 정책 유지).
   - `src/services/auth-service.js#deleteAccount()` — Bearer token 으로 함수 호출 후 클라이언트 `signOut()` → anonymous 로 재시작.
   - Account.jsx 메뉴 끝에 추가. 메뉴 색 `account-menu-item-danger` 톤다운 (`#c97a72`). Sign Out 은 danger 클래스 제거 (Header 드롭다운 포함 양쪽) — 일반 메뉴 색.

2. **webhook 가드 — deleted user 부활 방지 (★ 흔히 놓치는 부분)**
   - 시나리오: 계정 삭제 후 RC/Stripe 가 trailing webhook (CANCELLATION 등) 보내면 → 기존 `set merge` 가 빈 user doc 새로 만들어 **유령 사용자 부활**.
   - `functions/revenuecat.js`: `userRef.get()` → `!exists` 면 `{ skipped: 'user_deleted' }` 반환 (로그만 남기고 skip).
   - `functions/stripe.js` (`handleSubscriptionChange`): 동일 패턴. `handleInvoicePaid` 는 별도 `billingInvoices` 컬렉션이라 영향 없음.

3. **구독 안내 UI — platform-aware + active 여부 체크 (★ 두 번 다듬음)**
   - 1차: `isIOS()` 만 분기. 문제: free 사용자한테도 항상 박스 표시 + iOS 에서 구독한 사람이 데스크톱 웹으로 삭제하면 Apple 안내가 안 뜸.
   - 2차 수정: `subscription` 데이터의 **결제 marker** 로 판단 (플랫폼 무관).
     - `hasWebSubscription = stripeSubscriptionId && status ∈ {active, trialing, past_due}`
     - `hasAppleSubscription = (iosProductId && active) || (isIOS && isProViaRevenueCat fallback)`
   - 양쪽 다 false 면 박스 자체 안 보임 (free 사용자 혼란 방지).
   - 양쪽 다 true 면 두 메시지 모두.
   - `billing-service.js` 매핑 확장 — `stripeSubscriptionId` / `iosProductId` expose (기존엔 `status`/`stripeCustomerId` 만).
   - 안내 문구는 톤다운 ("자세히 가이드 X, 가서 캔슬하라 정도") — `App Store 구독 설정에서 직접 취소해 주세요` 한 줄.

4. **3.1.2(c) — ASC 구독 description 보강**
   - `store-metadata.md` 에 신규 섹션 추가: **"In-App Purchase / Subscription Descriptions"** — ASC 현지화에 그대로 붙여넣을 ko/ja/en 3개 언어 텍스트. Pro 혜택 6개 불릿 + 가격/체험/취소 경로 명시.
   - paywall 실제 표시(3일)와 일치 — 기존 store-metadata 의 `7-day free trial` (오기) → `3-day free trial` 로 정정 (3개 언어).

5. **Privacy / Terms — 계정 삭제 정책 명시**
   - `Privacy.jsx` §5 (Data Retention and Account Deletion): Settings → Delete Account 직접 명시 + 구독 처리 단락 추가 (Stripe 자동 / Apple 별도).
   - `Privacy.jsx` §6 (Your Rights): 동일 in-app 경로 명시.
   - `Terms.jsx` §9 (Account Termination): 동일 + "환불 권리 없음" 명시 (§7 cross-ref).

6. **i18n** — 13개 신규 키 추가 (en/ko/ja):
   - `deleteAccount` (메뉴)
   - `deleteAccountTitle` / `deleteAccountWarn` / `deleteAccountItem_{designs,profile,social,credits}` (모달)
   - `deleteAccountBilling_web` / `deleteAccountBilling_ios` (조건부 안내)
   - `deleteAccountFinal` / `deleteAccountConfirm` / `deleteAccountSubmitting` / `deleteAccountError`

7. **배포**
   - `./scripts/ship.sh --functions` — web build + functions (3개 신규/수정: `deleteAccount` 신규, `revenueCatWebhook`/`stripeWebhook` 가드) + hosting + iOS cap sync.
   - 모든 모듈 require 검증 통과. Vite 빌드 OK.
   - `deleteAccount` 엔드포인트 live: `https://us-central1-voda-7647c.cloudfunctions.net/deleteAccount`

8. **문서화**
   - `APP_STORE_SUBMISSION.md` — **§8 "거부 → 재제출 walkthrough" 신규**. 알림 확인 / 실제 거부 사례 표 (5.1.1 + 3.1.2c) / 각 가이드라인 해결 가이드 / 재제출 흐름 다이어그램 / Apple 회신 메시지 작성 팁 (screen recording) / 빌드 번호 정책. 재사용 체크리스트에 첫 거부 회피 항목 2개 추가.
   - `store-metadata.md` — 구독 description 섹션 추가 + 3-day 정정.

9. **남은 작업 (사용자 측)**
   - Xcode: build number 2 → 3, archive, TestFlight 업로드.
   - TestFlight 에서 sandbox 계정으로 Delete Account 전체 흐름 화면 녹화 (Apple 5.1.1 회신 첨부용).
   - ASC: 수익화 → 구독 → 현지화에 보강 description 입력. 버전 페이지 빌드 3으로 교체. 거부 메시지에 "심사에 회신" + screen recording + "Resolved in build 1.0 (3)". "심사에 추가" → "심사를 위해 제출".

### ✅ 후속 (2026-05-15) — Build 3 TestFlight 검증 중 발견한 함정 두 개

1. **ASC 구독 description 필드는 45자 — 4000자 아님 (★ 함정)**
   - 처음 `store-metadata.md` 에 paywall 식 long-form 카피 (불릿 6개 + 가격 + 체험 + 취소 경로) 적고 "여기에 붙여넣어" 안내. 실제 ASC 입력 시 막힘 — **설명 필드 45자 제한**.
   - 진짜 3.1.2(c) 거부 회피의 평가 대상은 **paywall 화면** (RC paywall 의 features list / pricing). ASC 짧은 카피는 한 줄 요약.
   - Fix:
     - ASC 입력: `Unlimited AI interior designs, no watermark` (43자, EN) / `무제한 AI 인테리어 디자인, 워터마크 없음` (24자, KO) / `AIインテリアデザイン無制限・透かしなし` (20자, JA)
     - `store-metadata.md` 정정 — 짧은 카피를 "Subscription Description" 으로 교체, 긴 텍스트는 별도 **"Long-form Marketing Copy"** 섹션 (paywall/랜딩/Review 메모 reference) 으로 분리. 글자수 제한 명시.
     - `APP_STORE_SUBMISSION.md` §8-4 정정 — 30자/45자 제한 + paywall 이 실제 평가 대상 강조.

2. **deleteAccount Cloud Function — FAILED_PRECONDITION (Firestore collectionGroup index 누락)**
   - 사용자가 Delete Account 실행 → 클라이언트 "Could not delete" 에러.
   - `firebase functions:log --only deleteAccount` → `9 FAILED_PRECONDITION` (gRPC code 9). 원인: `db.collectionGroup('comments').where('authorUid', '==', uid)` — **collectionGroup query 는 single-field 자동 인덱스가 없어 명시적 fieldOverride 필요** (root collection 과 다른 점).
   - Fix:
     - `firestore.indexes.json` 의 `fieldOverrides` 에 `comments.authorUid` collection-group 인덱스 추가.
     - `functions/account.js` — collectionGroup query 를 try/catch 로 감쌈. 인덱스 빌드 중에도 함수 전체가 fail 하지 않고 그 단계만 skip, 나머지 정리는 진행 → 계정 삭제 자체는 성공.
   - 배포: `firebase deploy --only firestore:indexes,functions:deleteAccount`. index 빌드는 collectionGroup 의 경우 보통 5–20분.
   - **클라이언트 (iOS) 코드는 변경 0** — Build 3 재빌드 / 재업로드 / Apple 회신 메시지 변경 불필요.

3. **5/14 함정 재확인 — 거부 후에도 구독은 "심사 대기 중" 유지**
   - 거부된 건 *앱 버전* 만. 첫 제출 때 attach 됐던 구독은 그대로 `심사 대기 중`.
   - 버전 페이지에 "앱 내 구입 또는 구독" 섹션이 안 보이는 건 **정상** — Ready 상태 구독이 0개라서 (이미 대기 중인 것은 Ready 가 아님).
   - 앱 재제출 시 구독은 동일 submission 에 자동 따라감 → 별도 구독 재제출 불필요.

4. **App Review 정보 메모 — Account Deletion 섹션 영구 추가**
   - ASC → 앱 정보 → App Review 정보 → 메모에 다음 빌드부터 영구 적용. 다음 빌드 5/6/... 에서도 리뷰어가 자동으로 보게 됨 → 매번 5.1.1 질문 안 받게 보호막.
   - 영구 보존 텍스트는 `store-metadata.md` 의 "App Review Information Notes" 섹션 참고.

### ✅ 완료 (2026-05-05) — UX 개선 라운드

TestFlight 가기 전에 사용자 요청으로 같이 처리:

1. **공유 / 커뮤니티 게시 UI 분리** (DesignDetail share panel)
   - 두 개의 카드로: 「🔗 친구에게 공유」 (isPublic + 링크) + 「🌍 커뮤니티에 게시」 (isListed). i18n: `shareWithFriendsTitle/Desc`, `postToCommunityTitle/Desc`. CSS: `.share-section-card`.

2. **이미지 생성 병렬화** (Cloud Function `generateDesign`)
   - `for` 순차 → `Promise.all`. 3장짜리 디자인 ~75s → ~25s.

3. **백그라운드 + Pending Banner**
   - App 루트의 `pendingDesign` state. fetch 시작 시 banner 표시 → 사용자가 다른 페이지 자유 navigate. 60s 예상치 ease-out fake progress. 완료 시 banner 「열기」 → `navigate(/designs/:id)`.
   - HomePage 의 `generateDesign` 함수에 `onGenerationStart/Done/Error` 콜백 prop 추가. HomePage 가 unmount 돼도 fetch promise 는 살아있고 App level callback 으로 완료/실패 신호.
   - i18n: `generationInProgress`, `generationKeepBrowsing`, `generationDone`, `generationTapToOpen`, `generationFailed`, `open`. CSS: `.pending-banner` family.

4. **Gemini 5xx 자동 재시도** (커밋 `f880445`)
   - `functions/index.js` 에 `generateContentWithRetry` 헬퍼. 5xx / fetch / timeout / deadline 키워드 매치 시 1s → 2s → 4s exponential backoff, 최대 3회. 그 외 에러는 즉시 throw.
   - `generateDesign` 의 텍스트 분석 + 병렬 이미지 생성, `editDesignRegion` 의 부분 편집, `chatWithDesign` 모두 적용.
   - 발견 동기: 사용자 한 번의 디자인 시도가 「Image generation failed for this photo」 로 끝남. Cloud Functions 로그에서 `[GoogleGenerativeAI Error] [500 Internal Server Error] Internal error encountered` 확인 — gemini-3-pro-image-preview 의 일시적 장애였고 우리 코드와 무관.

5. **「전체 이미지 실패」 흐름 + 환불 안내** (커밋 `7df835d`)
   - `HomePage.generateDesign`: `result.generatedImages` 가 전부 비면 `saveDesign` 호출 안 하고 `onGenerationError(generationFailedHint)` 만 호출. 이미지 없는 디자인이 저장되거나 「열기」 banner 가 잘못 뜨는 케이스 차단 (서버는 이미 환불 처리).
   - `PendingBanner` error 상태가 「크레딧은 차감되지 않았어요. 다시 시도해 주세요.」 안내. i18n: `generationFailedHint`, `tryAgain`.
   - `HomePage.useEffect([currentStep])`: `currentStep === 'result'` 가 되면 banner 자동 dismiss. ResultStep 화면 + 「열기」 banner 가 동시에 보이던 중복 제거.

6. **PendingBanner 모바일/데스크탑 layout 정리** (커밋 `b2823f6` ~ `0cd491e`)
   - position 을 `left:50%; transform:translateX(-50%); width:calc(100vw - 2rem); max-width:460px` 로. 이전 `left:1rem + right:1rem + max-width` 조합은 모든 브라우저에서 width 가 「자동」 이 아니어서 max-width 가 cap 으로 작동 안 함.
   - keyframe `pendingBannerIn` 의 transform 에 `translateX(-50%)` 보존: animation 이 가운데 정렬을 덮어쓰던 문제.
   - flex-wrap 트릭 대신 명시적 column 구조: `.pending-banner-row` (icon + body + close) + `.pending-banner-btn` (full-width 둘째 줄). flex-wrap 의 row 분배가 부모 width 와 어긋나 button 이 70% 만 차지하던 케이스 해결.
   - `.chat-input` 에 `min-width:0` (placeholder 가 길면 input 이 자기 content 만큼 expand 되어 Send 버튼이 화면 밖으로 잘림). 모바일 ≤ 480px 에서 chat-input-row 가 column (input 위 / Send 버튼 아래 full-width).

### ✅ 완료 (2026-05-06) — Reference Style + Cleanup + Plan 단순화

1. **Reference Style 모드** (`src/App.jsx`, `src/services/ai-service.js`, `functions/index.js`, `storage.rules`)
   - Style 카탈로그 첫 줄: Custom / Reference / Cleanup 3 카드 + 19개 기존 스타일.
   - Reference 카드 = 사용자가 분위기/소재/팔레트 참고용 사진 업로드. AI 가 그 사진의 톤/material 만 추출, 원본 변환 X.
   - Reference 사진은 Firebase Storage `references/{ts}_{rand}.jpg` 로 저장 → design doc `referenceImageUrl` 에 보존. `storage.rules` 에 `match /references/{allPaths=**}` 추가 (read public, write 10MB image).
   - Use-this-style 진입 시 동일 reference 자동 prefill (CORS 이슈로 fetch 단계는 우회 — `gsutil cors set` 한 번 하면 자동 fetch 도 동작).

2. **Cleanup 모드** (`functions/index.js: buildImagePrompt`)
   - 두 sub-option: **Tidy** (잡동사니 정리만) / **Empty** (모든 가구 제거).
   - `generationMode = 'cleanup_tidy' | 'cleanup_empty'` 으로 backend 분기. 스타일/디자인 분석 단계 bypass — pure 픽셀 조작 prompt.
   - 발견: 첫 시도에 Empty 가 그냥 스타일만 바뀌었는데 backend deploy 미반영이 원인. `firebase deploy --only functions:generateDesign` 후 정상.

3. **GenerateStep inline progress** (`src/App.jsx`, `src/styles/main.css`)
   - PendingBanner 의 `in_progress` 분기는 항상 null 반환 — `GenerateStep` success path 자리에서 직접 progress bar + 퍼센티지 표시. 원래 위치라 사용자 mental model 일치.
   - `.generate-progress` 카드 border/배경 제거 (사용자 요청 "회색 테두리 필요 없을 듯").

4. **BeforeAfterSlider edge label 처리** (`src/components/BeforeAfterSlider.jsx`)
   - Slider 가 양 끝에 가면 반대편 라벨 한 개만 남도록 — `percent < 100` / `percent > 0` 조건.

5. **Plan 단순화** (`src/config/billing.js`, `src/locales/*`)
   - Studio 플랜 / 연간 결제 / 크레딧 팩 모두 제거. Free / Pro 두 단계.
   - Pro feature 도 정리: `planFeatUnlimited`, `planFeatNoWatermark` 만. 기존의 1K/4K/Inpaint/Priority feed 는 실제로는 false advertising 이라 삭제.
   - Header credit-badge: Pro 면 숨김 (`plan === 'free' && !credits.loading && credits.credits !== null`).
   - 단 backend 의 Pro = unlimited credit deduction skip 은 RevenueCat 도입 시 같이 (현재 backend 는 여전히 차감).

6. **Account → Settings 리네임 + Profile 인라인 분리** (`src/pages/Account.jsx`, `src/pages/Profile.jsx`)
   - SNS 앱이라 public Profile (`/u/{handle}`) 이 displayName/handle/bio 편집 owner. Settings 는 Profile 미니 요약 + Plan + Credit (Free 만) + Language + 메뉴 (Invite/Support/Privacy/Terms/Sign Out).
   - Language 카드: "Used for design analysis too." 한 줄 hint 추가 (분석 결과도 선택 언어 따라간다는 소소한 정보).

7. **Source banner — use-this-style 진입 표시** (`src/App.jsx: HomePage`, `.source-banner` CSS)
   - 화면 상단에 「"디자인 이름" 디자인을 참고하고 있어요」 옅은 배경 (`text-muted 8%`) + auto_awesome 아이콘 + close X.
   - banner 활성 시 다른 style 카드 disabled (`styleLocked={!!sourceName}`, `.style-card:disabled` opacity 0.35 + pointer-events none) — 사용자가 다른 스타일로 바꾸려면 banner X 부터 닫아야.
   - Banner close → setSourceName(null) → 자동 unlock.
   - **버그 수정**: `DesignDetail.handleReuseStyle` 가 `referenceImageUrl` + `sourceName` 누락이라 prefill / banner 둘 다 안 떴음. 본인 디자인 reuse 흐름이 이쪽이고 ShareView 만 고쳤었음. 둘 다 동일 shape 으로 통일.

8. **photoHint 1/2/3 제거** (`src/locales/*`, `src/App.jsx: UploadStep`)
   - "Add up to 2 more photos of the same room for better results" 류 — 실제로는 결과 개선이 아니라 동시 처리 3장이라 오해 소지. `<p>` 자체 제거 + i18n 키 3개 삭제.

9. **HomePage currentStep → URL search param** (`src/App.jsx`)
   - `?step=style` 로 step 표시 → `navigate(-1)` 가 step 단위 back 처리. 모바일 chrome 의 ← 버튼이 자연스럽게 동작.

### ✅ 완료 (2026-05-07) — Layout 모드 + Replace area brush

1. **Layout 모드** (`src/App.jsx`, `src/services/ai-service.js`, `functions/index.js`)
   - Style 카드 첫 줄: Custom / Reference / Cleanup / **Layout** (4 mode 카드).
   - Sub-option 두 가지 (Cleanup 패턴 재사용): **Flow** (동선 / 통행 우선) / **Spacious** (시야 트임 / 큰 가구 벽쪽).
   - backend `buildImagePrompt` 의 `layout_flow` / `layout_spacious` early-return — "EVERY 가구·재질·시점 동일, 위치만 변경" 강제.
   - styleLocked / use-this-style 잠금 흐름 자동 통합. i18n KO/EN/JA 5 키 추가.
   - 한계: 이미 잘 정돈된 방은 변화 거의 없음 (Cleanup/Tidy 와 같은 특성). 의도된 동작.

2. **Replace area — brush mask 방식** (`src/components/EditRegionModal.jsx`, `functions/index.js`, `src/services/edit-prompt.js`)
   - 기존 텍스트 두 칸 ("바꿀 것" + "바꿔서 넣을 것") → **brush 로 영역 칠하기 + 한 칸 (이걸로 바꿔)**. AI 가 묘사로 영역 추측하던 부정확함 제거.
   - 이미지 위 canvas overlay 로 mouse / touch drag → 빨간 반투명 stroke. Brush / Eraser / Size slider / Clear 도구.
   - **Mask 전달 방식 — overlay 합성**: Gemini 가 binary 흑백 마스크는 안 따라가서, source 위에 SOLID 빨간색 burn 한 합성 이미지 한 장으로 보냄. prompt 가 "image 1 = clean source, image 2 = same with red region marked, replace only the red area with X" — 시각 단서 강력.
   - 두 이미지 다 max 1024px JPEG 으로 축소 (frontend canvas + backend `sharp`) — payload / Gemini 처리 시간 줄임.
   - i18n: `editRegionTarget*` 제거 → `editRegionBrush/Eraser/Size/Clear/BrushHint/MaskRequired` 추가. 제목 "Replace something in this image" → 짧게 "Replace an area" / "일부만 바꾸기" / "一部を差し替える".

3. **Submit 흐름 = 메인 generate 와 동일** (`EditRegionModal`, `App.jsx`, `DesignDetail.jsx`)
   - 이전: 모달 안 spinner 으로 fetch 동안 갇힘.
   - 변경: Submit 클릭 → 모달 즉시 닫힘 + App-level `pendingDesign` 활성 → background promise → 완료 시 PendingBanner "열기" → 클릭 시 `/designs/{newId}`. 사용자가 다른 페이지 자유 이동.
   - PendingBanner 의 `in_progress` 분기: `pathname === '/'` (HomePage) 면 숨김 — GenerateStep inline progress 와 중복 회피. 다른 페이지는 spinner + 메시지 + bar 표시.
   - PendingBanner 모바일 위치: `bottom: 56px + 0.75rem + safe-area` 로 탭바 위에 띄움.
   - Pro 사용자는 EditRegionModal 의 "1 크레딧 차감" 메시지 자동 숨김 (`BillingService.subscribeToSubscription` 사용).

4. **`functions/package.json` + sharp 0.33.5 추가** — backend 이미지 처리용. `editDesignRegion` 의 source download 단계에서 max 1024px JPEG 으로 리사이즈.

### ✅ 완료 (2026-05-07 후속) — Share 통일 + Post to feed 분리

1. **DesignDetail toolbar 의 share 흐름 통일** (`src/pages/DesignDetail.jsx`)
   - 이전: share 아이콘 클릭 → share-panel 펼쳐짐 (share-with-friends 카드 + post-to-community 카드 + download). ShareView / ResultStep 의 native share 와 흐름 달랐음.
   - 변경: **share 클릭 즉시 native share 시트** (URL 복사 / 메시지 / SNS 다 OS 가 처리). isPublic 자동 ON.
   - share-panel 의 두 share-section-card 제거. 다운로드는 별도 toolbar 아이콘 (`file_download`) 토글로.
   - 모더레이션 알림은 toolbar 아래 항상 표시 (panel 진입 안 해도 보이도록).

2. **Post to feed — 별도 toolbar 버튼 + Feed 모달**
   - "Post to community" → "Post to feed" (community 용어 제거 — feed 로 통일).
   - toolbar 별도 아이콘: 비활성 `chat_bubble_outline` (빈 말풍선) / 활성 `chat` (말풍선 + 점 세 개). 색 변화 X — 아이콘 모양만으로 상태 표시.
   - 클릭 시 isListed 토글 + isPublic 자동 ON. 새로 listed 되면 inline modal: **「피드에 올렸어요」** + **[피드 보기]** 버튼 → `/feed` navigate.
   - 다운로드 권한 검증: ShareView / FeedView / 다른 사람 DesignDetail 어디서도 다운로드 X (owner 만). 안전.

3. **i18n / config 톤 정리** (`src/locales/{en,ko,ja}.js`, `src/config/billing.js`)
   - 추가: `postToFeed`, `postedToFeedTitle`, `postedToFeedDesc`, `viewFeed`, `planFeatFeed`.
   - 제거: `shareWithFriends*`, `sharePublic*`, `postToCommunity*`, `listInFeed*`, `planFeatCommunity`, `planFeatFeedPriority` (false advertising 으로 이전 라운드에 이미 backend 제거됨).
   - billing.js free plan featureKey: `planFeatCommunity` → `planFeatFeed`.

### ✅ 완료 (2026-05-07 후속 2) — 프로필 Instagram + 작가 chip

1. **프로필에 Instagram 연결** (`functions/profile.js`, `src/services/profile-service.js`, `src/pages/Profile.jsx`)
   - 새 필드 `instagram` (max 30, `[a-zA-Z0-9._]+`). backend 가 `@` / `https://instagram.com/` / `?#/` 등 입력 normalize.
   - Profile edit form 에 인스타 인풋 (handle 뒤 prefix `@`).
   - Display 모드에서 `photo_camera` 아이콘 + `@username` pill — 클릭 시 `instagram.com/{username}` 새 탭.
   - `ProfileService.updateInstagram(handle)` + `INSTAGRAM_RE` / `INSTAGRAM_MAX` export.
   - i18n KO/EN/JA: `instagramLabel`, `instagramPlaceholder`, `instagramInvalid`.

2. **Feed / ShareView 에 작가 chip + 프로필 navigate**
   - `ProfileService.getProfilesByUids(uids)` batch 메소드 (chunked 30 — Firestore in 캡).
   - CommunityFeed: designs 변경 시 unique userIds → batch fetch → `authorMap` state.
   - FeedCard: `author` prop. 작가 chip = avatar (있을 때만) + 라벨 → 클릭 시 `e.stopPropagation()` + `navigate('/u/{handle}')`. 카드 자체 클릭은 ShareView.
   - ShareView: design.userId → `getByUid` → 디자인 제목 아래 작가 chip.
   - Avatar placeholder 제거 (default user 아이콘이 모든 사용자 동일해서 개성 X + 카드 footer 좁음).

3. **`profileLabel(profile)` 헬퍼** (`src/services/profile-service.js`)
   - displayName 이 default `'archelier user'` 또는 비었으면 → `@handle` 으로 fallback.
   - 사용자가 명시한 displayName 이면 그대로 표시.
   - 이유: 가입자 모두 같은 default name 이라 구분 안 됨. handle 이 unique 라 fallback 의미 있음.

### ✅ 완료 (2026-05-07 후속 3) — 모바일 Google 로그인 (Capacitor + native plugin)

1. **이슈** — iOS Capacitor webview 가 `signInWithPopup` 의 popup 차단. Apple 은 `@capacitor-community/apple-sign-in` plugin 으로 동작 중이었지만 Google 만 깨짐. cross-device (Android 사용자가 iOS 폰에서 자기 Google 계정 로그인 등) 보장 위해 모든 OS 에서 둘 다 노출 필요.

2. **선택: `@capacitor-firebase/authentication` 통합 plugin v7.5** (`package.json`, `Podfile`, `capacitor.config.json`)
   - Apple plugin 은 그대로 유지 (마이그레이션 위험 회피). Google 만 신규 plugin 으로.
   - peer 가 `firebase ^11.2` 라 `firebase` 10 → 11 upgrade 함께. modular API 유지라 break 거의 X (build 통과). `@firebase/rules-unit-testing` 도 v4 으로 같이.
   - Plugin 의 podspec default subspec 이 `Lite` (Google deps 없음) — `patches/@capacitor-firebase+authentication+7.5.0.patch` 으로 `Google` 변경. `package.json` 에 `postinstall: patch-package` 추가해 `npm install` 시 자동 적용.
   - `capacitor.config.json` 의 `plugins.FirebaseAuthentication`: `{ skipNativeAuth: true, providers: ["google.com", "apple.com"] }`. plugin 이 idToken 만 반환 → 우리가 직접 `linkWithCredential` / `signInWithCredential` 으로 anonymous link 흐름 유지.

3. **iOS native config**
   - `ios/App/App/GoogleService-Info.plist` 추가 (Firebase Console 다운로드, Bundle ID `com.voda.app`)
   - `pbxproj` 4 곳 등록 (PBXBuildFile / PBXFileReference / App group / Resources phase) — PrivacyInfo 패턴 그대로
   - `Info.plist` 의 `CFBundleURLTypes` 에 REVERSED_CLIENT_ID URL Scheme 추가
   - `AppDelegate.swift`:
     - `import FirebaseCore` + `FirebaseApp.configure()` (didFinishLaunchingWithOptions)
     - `import GoogleSignIn` + `application(_:open:options:)` 에서 `GIDSignIn.sharedInstance.handle(url)` 우선 처리
   - `Podfile`: `target 'App'` 안에 `pod 'GoogleSignIn', '7.1.0'` 직접 추가 (App target 도 GoogleSignIn import 필요)

4. **`auth-service.js` Google native 분기**
   - `signInWithGoogle` 에서 `isNativeApp()` 시 `_signInWithGoogleNative` 호출
   - dynamic import `@capacitor-firebase/authentication` → `signInWithGoogle({ skipNativeAuth: true })` → idToken 받기 → `GoogleAuthProvider.credential(idToken)` → 기존 anonymous link 흐름 (`linkWithCredential` / `signInWithCredential`) 그대로
   - `auth/credential-already-in-use` 시 beforeSwitch 호출해서 이전 anonymous 디자인 claim 처리도 동일
   - SignInModal: 이전 라운드의 platform 분기 (`isIOS`/`isAndroid`) 제거 — 모든 OS 에서 Google + Apple 둘 다 노출

5. **검증** — iOS simulator 에서 native Google account picker → idToken 정상 반환 → Firebase Auth user 생성 + anonymous → Google link 처리 모두 동작. Apple 은 그대로 작동.

6. **Android 는 Sprint B** — `google-services.json` 등록 + SHA-1 fingerprint Firebase 등록 + cap sync + 검증. plugin / firebase / patches 인프라는 이미 되어 있어 native config 만 추가하면 됨.

### ✅ 완료 (2026-05-07 후속 4) — voda 잔재 정리

1. **신규 가입자 default handle prefix** (`functions/profile.js`)
   - `defaultHandleForUid`: `voda${first8}` → `arch${first8}`. 이전 라운드 (`86d2eeb`) 에서 displayName default 만 archelier 로 바꿨고 handle prefix 는 누락이었음.
   - 신규 가입자만 영향. 기존 가입자 handle / displayName 은 의도적으로 그대로 둠 (legacy 보존).

2. **마이그레이션 함수 deploy** (`functions/backfill.js: migrateLegacyVodaProfiles`)
   - admin-only HTTP endpoint. 호출 시: displayName `'Voda user'` → `'archelier user'`, handle `voda[a-z0-9]{8}` (default 패턴) → `arch...`. handles collection 도 transaction 으로 swap. custom user-set handle 은 손대지 않음.
   - 지금은 호출 안 함 (사용자가 기존 사용자 보존 결정). 필요 시 admin token 으로 호출:
     ```
     curl -X POST -H "Authorization: Bearer $TOKEN" https://us-central1-voda-7647c.cloudfunctions.net/migrateLegacyVodaProfiles
     ```

### ✅ 완료 (2026-05-07 후속 5) — iPhone 노치 chrome + 글로벌 native UX 정리

1. **iPhone 노치 / status bar 보이게** (`src/main.jsx`, `.mobile-header` CSS)
   - 진짜 원인: `StatusBar.setStyle({ style: Style.Dark })` 였음 — Capacitor docs 의 `Style.Dark` = "Light text for dark backgrounds" (즉 흰 글씨). 우리 앱이 흰 배경이라 흰 시간/시그널/배터리가 흰 배경에 묻혀 안 보였음. `Style.Light` (= dark text) 로 변경 → 검정 시간 / 시그널 / 배터리 정상 노출.
   - `body.is-native .mobile-header` 의 `padding-top` 을 `calc(max(env(safe-area-inset-top, 0px), 50px) + 12px)` 으로 — iPhone dynamic island ~50pt cover + 글자 위 12px breathing room. `padding-bottom: 12px` — header content ↔ 본문 사이 여유. 모바일 `border-bottom` 제거 — 노치 + status bar 만으로 chrome 구분 충분.
   - 결과: archelier / Feed / Settings / ← 등이 노치 영역 한참 아래로 내려와 자연스럽게 보임. line 에 걸치던 문제 해결.

2. **redundant 페이지 제목 모바일에서 제거** (페이지 컴포넌트 + CSS)
   - 모바일에선 `MobileHeader` 가 페이지 제목 담당 → 페이지 자체 큰 h1/h2 와 두 번 보이던 문제 정리:
     - `Bookmarks` 의 `<h2>{t('bookmarksTitle')}</h2>` 두 곳 제거
     - `MyDesigns` 의 `<h2 className="my-designs-title">` 제거 + favorite 버튼 우측 정렬
     - `Account` 의 `<h1 className="page-title">` 제거
     - CSS: `.page-title`, `.pricing-title` `@media (max-width: 768px) { display: none }` (Invite / Pricing / 그 외 page-title 사용처 일괄)
     - `.feed-title` 은 이미 모바일 hide 되어 있었음
   - **My 허브 sub-tab 통일**: `MobileHeader.TITLE_BY_ROUTE` 에서 `/designs`, `/bookmarks` 제거 + `/u/{handle}` (profile fallback) 도 비움 → 세 페이지 모두 mobile-header 가 ← 만 표시. 페이지 안 `MyTabs` (My Designs / My Collections / Profile) sub-tab 이 활성 페이지 표시 담당 — 한 패턴으로 통일.

3. **Empty-state 정돈** (`.empty-state` CSS, i18n)
   - `signInToSeeDesc` 짧게: "Your saved designs will appear here." (이전엔 두 줄 wrap 어색했음)
   - `.empty-state` `h2 / p` margin 명시 — h2 ↔ p (8px) / p ↔ button (28px) 균형있게.

4. **iOS long-press context menu 차단** (글로벌 CSS)
   - 메뉴 아이콘 / 탭바 / 카드 등 chrome 을 길게 누르면 iOS 의 native "Copy / Look Up / Translate" 시트가 떠 회색 highlight 까지 됨. 사용자 콘텐츠 아닌 chrome 이 selectable 인 것 부적절.
   - `body` 에 `-webkit-touch-callout: none` + `user-select: none` 글로벌 default. 모바일 / 데스크톱 일관 처리.
   - 사용자 콘텐츠 / 입력만 `user-select: text` override: `input`, `textarea`, `[contenteditable]`, `.md-content` (디자인 분석 결과), `.chat-bubble` (DesignChat), `.comment-text` (Comments), `.profile-bio`.

### ✅ 완료 (2026-05-10 후속 2) — 3-day Free Trial (Stripe + Apple IAP 양쪽)

1. **iOS IAP introductory offer (ASC 셋업)**
   - App Store Connect → archelier_pro_monthly → 신규 구독 특가 → **유형: 무료, 기간: 3일, 시작일: 즉시, 종료일: 비움 (무기한)**.
   - Apple 의 자동 동작: 사용자 구독 button 클릭 → Apple Pay sheet → 카드 등록 → 즉시 trial 시작 ($0) → 3일 후 자동 결제 → 정상 구독 전환. 같은 Apple ID 한 번만 (악용 방지 built-in).

2. **Stripe trial 코드 (functions/stripe.js)**
   - `subscription_data.trial_period_days: 3` 추가. 한 번 코드 박으면 test/live mode 모두 자동 적용 — Dashboard 에서 별도 trial 셋업 불필요.
   - Price 자체의 `Trial period days` 박스는 *Legacy* 표시 (deprecated). 우리 코드 방식이 Stripe 의 현재 권장 패턴.

3. **Stripe webhook 결정적 fix — handleCheckoutCompleted 가 직접 plan 업데이트**
   - 증상: trial 결제 통과했는데 archelier Account 페이지 "FREE" 그대로. 5번 테스트 결제했는데 Firestore plan='free' 유지.
   - 디버깅 흐름:
     - Cloud Functions logs 분석 — `checkout.session.completed` 만 도달, **`customer.subscription.created` 0개 도달**. Stripe Dashboard webhook 등록 이벤트가 부족 (created 빠짐).
     - 코드 분석 — 기존 `handleCheckoutCompleted` 가 *log 만* 찍고 Firestore 안 건드림. 주석에 "subscription.updated 가 담당" 이라 했지만 trial 시작 시엔 created 만 발화 (updated 안 발화).
     - 결과: 어느 이벤트 핸들러도 trial 시작 시 plan='pro' 박지 못함. invoice.payment_succeeded 도 영수증만 기록.
   - **Fix (robust)**: `handleCheckoutCompleted` 가 session.subscription 으로 sub fetch → `handleSubscriptionChange` 직접 실행 → Firestore `users/{uid}.plan='pro' + subscriptionStatus='trialing'` 즉시 박힘. checkout.session.completed 는 항상 도달 + Dashboard 가 listen 하니 가장 안정적인 single source of truth.
   - **추가 안정장치**: `customer.subscription.created` 이벤트도 switch case 추가 (Dashboard 에 등록되어 있다면 그것도 처리).

4. **UI / 카피**
   - `src/config/billing.js`: `trialDays: 7` → `3`.
   - `src/locales/{en,ko,ja}.js`: `trialEndsAt` 키 신규 (`Free trial ends on {date} — auto-converts to $9.99/mo` 식).
   - `src/pages/Account.jsx`: subscription.status === 'trialing' 분기 — `trialEndsAt` 표시 (renew 시점은 기존 `subRenewsAt`, cancel 예약 시 `subEndsAt`).

5. **검증 통과** (test mode):
   - Stripe Checkout 화면: "3일 무료" / "당일 지불 총액: US$0.00" / "평가판 시작" 노출.
   - 결제 완료 후 archelier Account: "Pro 사용 중" Pro 뱃지 + "무료 체험 중이에요" + "2026년 5월 13일에 무료 체험 종료 — 월 $9.99 자동 전환".
   - Firestore `users/{uid}` → `plan: 'pro'`, `subscriptionStatus: 'trialing'`, `subscriptionRenewsAt: 5월 13일`.
   - iOS 측은 ASC introductory offer 셋업만 하면 RC webhook 의 기존 `period_type === 'TRIAL'` 처리 path 그대로 동작. 검증은 sandbox tester + 실기기 결제 단계에 같이.

6. **변경 파일 (오늘 후속 2)**
   - `functions/stripe.js` (trial_period_days + handleCheckoutCompleted plan sync + customer.subscription.created case)
   - `src/config/billing.js` (trialDays 3)
   - `src/locales/{en,ko,ja}.js` (trialEndsAt 키)
   - `src/pages/Account.jsx` (trialing 상태 row)
   - `src/styles/main.css` (`.plan-grid` auto-fit + center — 카드 2개 left-shifted 버그 수정)

### ✅ 완료 (2026-05-10 후속) — SW opaque cache fix + 헤더 정리 + EditRegionModal 카피 다듬기

1. **EditRegionModal 이미지 로드 random fail — Service Worker opaque cache mismatch**
   - 증상: "일부만 바꾸기" 시트 열면 이미지가 깜빡 broken icon 또는 안 뜸. 새로고침해도 같음.
   - 원인: SW 의 Firebase Storage 캐시 정책이 opaque (status 0, no-cors) 응답도 캐싱했음 (`cacheableResponse: { statuses: [0, 200] }`). FeedCard 등은 `<img>` no-cors 로 fetch → SW 가 opaque 캐시. EditRegionModal 이 *같은 URL* 을 `<img crossOrigin="anonymous">` (CORS) 로 요청 → SW 가 cached opaque 응답 반환 → CORS 요청에 incompatible (canvas 사용 불가) → broken.
   - 콘솔 에러: `The FetchEvent ... resulted in a network error response: an "opaque" response was used for a request whose type is not no-cors`
   - **3 layer fix**:
     - `vite.config.js`: `cacheableResponse: { statuses: [200] }` — opaque 응답 캐싱 안 함. 새 cacheName `voda-images-v2` 로 옛 cache 와 분리. `skipWaiting: true` + `clientsClaim: true` — 새 SW 다운로드 즉시 활성화 + 기존 탭 takeover (사용자가 탭 닫고 재오픈 안 해도 적용).
     - `src/main.jsx`: `caches.delete('voda-images')` 호출 — 옛 runtime cache 명시적 정리 (workbox 의 `cleanupOutdatedCaches` 는 precache 만 처리, runtime cache 는 안 건드림).
     - `src/components/EditRegionModal.jsx`: `onError` handler 추가 — 1차 실패 시 cache-bust query (`?cb=1`, `?cb=2`) 로 재시도. 2회 실패 시 사용자에게 명확한 에러. backup safety net.
   - iOS 앱은 SW 미사용 (capacitor:// origin) 이라 위 SW fix 의 영향은 *웹만*. iOS 의 WKWebView NSURLCache 도 비슷한 mismatch 가능 — onError 재시도가 거기서도 backup 으로 동작.

2. **헤더 중복 — Privacy / Terms / Support 페이지**
   - 데스크톱에서 위 3개 legal 페이지가 본인 안에 `<header className="header">archelier 로고</header>` 를 또 렌더 → 글로벌 Header (App.jsx 마운트) 와 합쳐 *두 줄 헤더* 노출.
   - 모바일에선 `.header { display: none }` 이라 글로벌 hide + 페이지 자체 헤더만 보여 발견 못 함.
   - Fix: 세 페이지 모두 inner header 삭제. 글로벌 Header 가 모든 페이지에서 단일 헤더 담당.
   - 전수조사 — `<header className="header">` 또는 `header-logo` 클래스가 글로벌 Header.jsx 외에서 쓰는 곳은 위 셋이 전부였음. 다른 페이지에 같은 패턴 없음.

3. **데스크톱 헤더 — Feed nav 링크 제거**
   - 데스크톱 home (`/`) 의 HomePage 가 이미 CommunityFeed 를 upload 영역 아래 embed 해서 같은 컨텐츠 보임 → `/feed` 로 가는 링크 redundant.
   - 모바일은 하단 탭바 Feed 가 처리 → 글로벌 Header 의 Feed 링크는 모바일 hide.
   - **결과**: 데스크톱 헤더 = `archelier` 워드마크 + `요금` (iOS hide) + 크레딧 뱃지 (Free 만) + 프로필. 깔끔.

4. **EditRegionModal 의 fine-print 카피 다듬기**
   - 이전: `결과는 새 디자인으로 저장됩니다 — 원본은 그대로 유지돼요. 1 크레딧 차감.` (2 줄, info icon 박스 형태로 강조)
   - 모바일 modal 좁은 폭에선 두 줄 — 그리고 사실 *덮어쓰기 아닌 새 디자인으로 저장* 자체가 "원본 유지" 를 함축하니 명시 안 해도 OK.
   - **변경**: `새 디자인으로 저장 · 1 크레딧` (1 줄, icon 제거, 카드 배경 제거). `.modal-meta` CSS 도 작은 회색 텍스트 (`0.75rem`, `--text-muted`) 진짜 "fine print" 느낌으로 재디자인.
   - 3 언어 모두 같은 식 (en: `Saved as new design · 1 credit`, ja: `新規保存 · 1クレジット`).

5. **변경 파일 (오늘 후속)**
   - `vite.config.js` (SW: skipWaiting / clientsClaim / cleanupOutdatedCaches / cacheName v2 / statuses [200])
   - `src/main.jsx` (옛 'voda-images' cache 일회성 delete)
   - `src/components/EditRegionModal.jsx` (img onError 재시도 + meta icon 제거)
   - `src/styles/main.css` (`.modal-meta` 재디자인)
   - `src/components/Header.jsx` (Feed nav 링크 제거)
   - `src/pages/{Privacy,Terms,Support}.jsx` (중복 inner header 제거)
   - `src/locales/{en,ko,ja}.js` (editRegionMeta 짧은 카피)

### ✅ 완료 (2026-05-10) — RevenueCat IAP 통합 + iOS 15 + Apple Sign-In nonce/replay fix

1. **RevenueCat SDK 통합 (Capacitor 7 호환 v11)**
   - 최신 v13 은 Capacitor 8 필수 — 우리 v7 환경에서 가장 최신인 `@revenuecat/purchases-capacitor@11.3.2` + `purchases-capacitor-ui@11.3.2` 설치.
   - `src/services/revenuecat-service.js`: SDK 코어 wrapper (init / login / logout / customerInfo / restore + entitlement check). 웹은 no-op, iOS 만 동작.
   - `src/services/revenuecat-ui.js`: Paywall + Customer Center 헬퍼 (lazy import — 웹 bundle 영향 없음).
   - `src/hooks/useRevenueCatPro.js`: `{ isPro, customerInfo, loading }` React hook.
   - `src/App.jsx`: boot 시 `init()` + auth 변화 시 `login(uid)` / `logout()` 자동 sync.
   - `src/pages/Pricing.jsx`: iOS 진입 시 자동 paywall 노출, 구매 완료 → `/account` 이동.
   - `src/pages/Account.jsx`: iOS Pro 사용자 → Customer Center 버튼, Free 는 paywall 트리거.
   - `functions/revenuecat.js`: RC webhook → Firestore `users/{uid}.plan` 동기화 (Stripe webhook 의 iOS 카운터파트). entitlement events 로 plan/status/cancelAtPeriodEnd 업데이트.

2. **iOS deployment target 14 → 15** (RC UI 플러그인 요구)
   - `ios/App/Podfile`: `platform :ios, '15.0'`
   - `ios/App/App.xcodeproj/project.pbxproj`: 모든 IPHONEOS_DEPLOYMENT_TARGET 15.0 으로 bump
   - 이 변경이 *Apple Sign-In 의 동작 자체* 를 변경 — JWT 에 nonce claim 이 항상 박힘 (이전 iOS 14 SDK 는 nonce 무시).

3. **Apple Sign-In 디버깅 — nonce + replay protection (대형 fix)**
   - 증상: iOS 15 bump 직후 Apple Sign-In 이 `auth/missing-or-invalid-nonce` / "Duplicate credential received" 로 400 reject.
   - **첫 가설 (nonce 형식)**: 우리가 직접 SHA256(rawNonce) 만들어 Apple 에 보내고 raw 를 Firebase 에 보내야 한다. 시도 → 실패. cross-check (`shasum -a 256`) 로 우리 hash 가 *정확하게* JWT.nonce 와 일치 확인 — 형식은 100% 맞았음. 가설 자체가 잘못된 곳을 보고 있었음.
   - **두 번째 가설 (공식 플러그인 path)**: 이미 설치되어 있던 `@capacitor-firebase/authentication` 의 `signInWithApple` + `skipNativeAuth: true` 로 전환. 동일 400.
   - **진짜 원인**: 웹 검색 + GitHub issues (capacitor-firebase #204 / #43, RNFirebase #272, FlutterFire #6432, firebase-ios-sdk #931) 로 확인 — `auth/missing-or-invalid-nonce` 에 *두 가지* 트리거가 있음:
     - (a) 진짜 nonce hash mismatch
     - (b) **같은 Apple identity token 을 두 번 redeem 시도** (Firebase replay protection)
   - 우리 코드의 `linkWithCredential` 실패 → catch 에서 `signInWithCredential` fallback 흐름이 *같은 credential 을 두 번 사용* — Apple token 은 single-use 라 Firebase 가 두 번째 호출 거절. 콘솔에 항상 **400 두 줄** 보였던 정확한 흔적.
   - iOS 14 시절엔 Firebase 가 nonce 검증을 skip 해서 replay 검사도 같이 skip → 두 번 호출도 통과. iOS 15 부터 두 검증이 함께 활성화 → fail.
   - **Fix**: `linkWithCredential` → fallback 패턴 폐기. anonymous 든 아니든 `signInWithCredential` 한 번만 호출.
   - **Trade-off**: anonymous 사용자가 만든 데이터는 그 UID 에 남고 새 UID 생성됨 (이전엔 link 로 같은 UID 유지). 출시 후 진짜 문제 되면 backend Cloud Function 으로 데이터 이전 처리.

4. **디버깅 규율 — 메모리 박음**
   - `feedback_debugging_discipline.md`: 가설 검증 시 반증되면 *그 가설 폐기*, 옆 가설로 점프 X. 보안·암호화 (nonce, hash, signature) 는 공식 SDK path 우선 검토. 데이터가 "이론대로 동작했는데 결과 안 맞음" → 이론 자체를 의심 (더 근본적 가정 검토).
   - 오늘 디버깅 흐름: nonce 형식 가설 4번 점프 (hashed → raw → 다시 hashed → 알파넘) 한 후에야 시스템 전체 (공식 플러그인, Firebase replay protection) 를 봄. 사용자 짜증 유발. 다음부턴 가설 반증 즉시 더 근본적 가정 의심.

5. **Pro plan feature list 확장 (실제 코드 게이트와 일치)**
   - 기존: Unlimited generations / No watermark 두 개만 노출
   - 추가 (실제 코드 검증): Unlimited AI chat per design (Free 3턴 / `DesignChat.jsx` line 10), Unlimited region edits (`EditRegionModal.jsx` line 277)
   - `src/config/billing.js` `featureKeys` 에 4개 추가, `locales/{en,ko,ja}.js` 에 `planFeatUnlimitedChat / planFeatUnlimitedEdit` 키
   - Account 의 Free upsell 카드 + Pricing 페이지 + Paywall 모두 같은 4개 feature 일관 노출
   - 이전에 만들었던 "Priority queue / Higher resolution" 같은 *미구현 feature* 제거 — 거짓 광고 = 출시 후 환불 사유

6. **변경 파일 (오늘)**
   - `package.json` / `package-lock.json` (RC SDK 의존성)
   - `ios/App/Podfile`, `ios/App/App.xcodeproj/project.pbxproj` (iOS 15 target)
   - `ios/App/Podfile.lock` (RC pods)
   - `src/services/revenuecat-service.js` (신규), `src/services/revenuecat-ui.js` (신규)
   - `src/hooks/useRevenueCatPro.js` (신규)
   - `src/services/auth-service.js` (Apple Sign-In: 플러그인 path + replay 회피)
   - `src/App.jsx` (RC init / login / logout)
   - `src/pages/Pricing.jsx`, `src/pages/Account.jsx` (iOS paywall / customer center)
   - `src/config/billing.js` + `src/locales/{en,ko,ja}.js` (Pro 4-feature 확장)
   - `functions/revenuecat.js` (신규), `functions/index.js` (export)

### ✅ 완료 (2026-05-09 후속 6) — 이미지 깜빡임 제거 + 영속 캐시 + long-press swap fix

1. **카드 이미지 깜빡임 (white → image flash) 제거**
   - 증상: Feed/My 탭 진입 시 카드 이미지가 흰 배경에서 갑자기 떠올라 번쩍임. iOS WKWebView 에서 특히 두드러짐.
   - 원인:
     - `.feed-card-image-wrap` 배경이 흰색 (`var(--background)`) → 이미지 도착 전 흰 placeholder
     - `.feed-card-image` 에 fade-in transition 없음 → 데이터 도착 시 즉시 표시 (점프)
   - Fix:
     - 배경 → 약한 회색 (`var(--surface)`) 으로 변경. design-card-thumb 와 동일 패턴.
     - `.feed-card-image` 와 `.design-card-thumb img` 기본 `opacity: 0`, 250ms transition.
     - React: `onLoad` + `ref` 두 군데서 `.is-loaded` 클래스 추가 — 캐시 hit (mount 시점에 이미 complete) 케이스도 즉시 가시화. 캐시 없으면 정상 fade-in.

2. **Feed 캐시: sessionStorage → localStorage (영속)**
   - 콜드 스타트마다 sessionStorage 비어있어 매번 fresh fetch 필요 → splash 끝나기 전 prewarm 끝낼 시간 부족 (Capacitor cold start ~2.5s + 네트워크 ~1-2s).
   - localStorage 24h TTL 로 변경 — 지난 세션의 feed 가 *즉시* 첫 프레임 렌더 (stale-while-revalidate). CommunityFeed 가 mount 시 자동으로 loadFeed(true) 호출 → fresh 데이터 (좋아요 / 댓글 카운트 갱신) 가 200-800ms 안에 덮어씀.
   - Trade-off: 콜드 스타트 직후 1-2초 동안 어제 좋아요 수 보일 수 있음 → fresh fetch 도착 시 자동 갱신. blank/loading/flash 없는 게 압도적으로 부드러움.

3. **앱 마운트 시 prewarm**
   - Feed: 캐시 없으면 `DesignService.getFeedDesigns({ pageSize: 12 })` 백그라운드 호출 → localStorage 저장 + 첫 6 이미지 URL `new Image().src` 으로 prefetch (browser HTTP 캐시 invoke).
   - User Designs: auth 해결 후 (`useEffect([user])`) 자기 designs 첫 페이지 + 이미지 6장 prefetch → QueryCache (in-memory) 저장. /designs 첫 진입 instant.
   - 둘 다 best-effort, 실패 무시.

4. **iOS WKWebView NSURLCache 활용**
   - vite-plugin-pwa SW 는 native 빌드에서 비활성 (origin 충돌 + native 에선 의미 없음). 대신 WKWebView 의 NSURLCache 가 자동으로 동작.
   - 첫 fetch 후 이미지가 시스템 캐시에 보존 → 콜드 스타트 후 같은 URL 다시 요청 시 디스크 캐시에서 즉시 반환.
   - 실효: 첫 설치 후 첫 실행만 1-2초 로딩, 그 이후 모든 실행은 instant.

5. **모바일 long-press swap 다시 동작 — touchmove threshold**
   - 증상: FeedCard 길게 누르면 swap 됐었는데 안 됨.
   - 원인: `handleTouchMove` 가 어떤 미세한 움직임에도 즉시 long-press 취소. iOS WKWebView 의 finger jitter + auto-hide chrome 의 transform 애니메이션이 좌표 계산에 영향 → touchmove 자주 발화 → long-press 350ms 채우기 전 cancel.
   - Fix: touchstart 의 `clientX/Y` 기록 + touchmove 에서 **10px 이상 움직임 (피타고라스 거리)** 일 때만 cancel. 의도적 swipe 는 그대로 cancel, 미세 jitter 는 무시.

6. **변경 파일 (오늘 후속 6)**
   - `src/App.jsx` (feed cache localStorage 전환, prewarm useEffect 2개, QueryCache import)
   - `src/components/FeedCard.jsx` (TOUCH_MOVE_THRESHOLD, ref + onLoad, touch coord 기록)
   - `src/pages/MyDesigns.jsx` (DesignCard 의 ref + onLoad)
   - `src/styles/main.css` (.feed-card-image-wrap bg, .feed-card-image opacity 0/transition, .is-loaded class, design-card-thumb img 같은 패턴)

### ✅ 완료 (2026-05-09 후속 5) — Instagram 식 identity (handle primary) + default name 제거 + selective @ prefix

1. **Identity 정책 — handle 이 primary, displayName 은 부가 정보**
   - 기존엔 displayName 우선 + 빈/default 시 handle fallback. 결과: 'archelier user' default 가 generic 해서 여러 명 구분 불가능 + 신뢰성 낮음.
   - 변경: **handle 이 항상 primary identity** (Instagram·Twitter 컨벤션). displayName 은 사용자가 명시적으로 설정한 경우에만 부가 정보로 옆에 노출.
   - `profileLabel(profile)` 헬퍼 단순화 — 항상 `@handle` 반환 (이전엔 displayName 우선).
   - 적용 위치별 layout:
     - **Profile 페이지 헤더**: bare `handle` (큰 글자) + custom displayName 부제목
     - **FollowListModal 행**: `@handle` (큰 글자) + custom displayName 부제목
     - **Account 자기 카드**: `@handle` + custom displayName 부제목
     - **Header 드롭다운**: `@handle` (handle 없으면 email fallback)
     - **Comments**: `@handle` (단일 슬롯, 텍스트 인라인)
     - **FeedCard / ShareView**: bare `handle` (avatar 옆, 단독)

2. **Selective @ prefix 정책**
   - Instagram 도 일관되지 않음 — 단독 큰 글자 (프로필 헤더, 피드 카드) 는 *bare* handle, 리스트·텍스트 흐름 안 (댓글, follow 행, 드롭다운) 은 `@` 붙임. 동일 적용.
   - bare: FeedCard 작가, ShareView 작가, Profile 페이지 큰 헤더 (`uihyun`)
   - with @: FollowListModal 행, Account 자기 카드, Header 드롭다운, Comments (`@uihyun`)
   - 이유: 단독 컨텍스트는 자명, 리스트/혼합 컨텍스트는 구분자 역할.

3. **Default name 'archelier user' 제거 (server side)**
   - `functions/profile.js` `ensureProfile` + `claimHandle`: 신규 프로필 `displayName: ''` (빈 문자열) — 'archelier user' 더 이상 안 박음.
   - `comment-service.js` `addComment`: 같은 패턴 — 새 댓글 displayName fallback 도 빈 문자열.
   - `DEFAULT_DISPLAY_NAME = 'archelier user'` 상수는 *legacy 데이터 sentinel* 로만 유지 — 옛 데이터 만나면 UI 가 알아서 무시. 백필은 deferred (해도 손실 없음, 안 해도 무방).

4. **Handle 생성 알고리즘 (참고용 메모)**
   - `functions/profile.js:30` `defaultHandleForUid(uid)`: `arch${uid 첫 8자 alphanumeric 소문자}` — e.g. `archxk7z2m9q`.
   - 충돌 시 `arch...2`, `arch...3` 으로 5회 재시도. Profiles + handles 두 collection 트랜잭셔널 swap.

5. **Comments 의 handle 필드 추가 (denorm)**
   - 기존 댓글 doc 은 `displayName` 만 있고 handle 없음 → UI 가 default 만 보여주는 문제.
   - `addComment` 가 profile read 한 번 해서 `handle` + `displayName` 같이 박음 (denorm). 향후 댓글은 자동 fallback 동작.
   - `backfillCommentHandle` Cloud Function 신규 — collectionGroup('comments') 로 모든 기존 댓글 스캔 + handle 채움. Idempotent. 실행 결과: scanned=0 (현재 댓글 doc 없음).

6. **인프라 발견 — Cloud Functions Gen 2 Authorization 헤더 strip**
   - `*.cloudfunctions.net` 프록시 URL 은 Authorization 헤더를 Cloud Run IAM 검증용으로 인식해서 일부 케이스에 strip — 함수 내부 `req.get('Authorization')` 가 빈 값.
   - 우회: 직접 Cloud Run URL (`*.run.app`) 호출. `gcloud run services describe` 로 URL 확인 가능.
   - `backfillCommentHandle` 은 직접 URL 로 호출해서 정상 동작 확인.

7. **My 탭 sub-tab labels: "My" prefix 제거**
   - 하단 탭바의 **My** 가 이미 "내 거" 컨텍스트인데 안에서 또 "My Designs / My Collections" 은 redundancy.
   - `tabDesigns / tabCollections` 새 키 신설 → MyTabs 에서 사용. 기존 `myDesignsTitle` (favorites 툴팁) / `bookmarksTitle` (Header 드롭다운 nav) 은 다른 컨텍스트라 "My" 그대로 유지.
   - 결과: 탭은 `Designs / Collections / Profile` (한: `디자인/컬렉션/프로필`, 일: `デザイン/コレクション/プロフィール`).

8. **변경 파일 (오늘 후속 5)**
   - `src/services/profile-service.js` (`profileLabel` 단순화)
   - `src/components/MyTabs.jsx` (tabDesigns/tabCollections 사용)
   - `src/components/Header.jsx` (드롭다운 @handle primary, profileLabel/DEFAULT_DISPLAY_NAME import 제거)
   - `src/components/FollowListModal.jsx` (행: @handle primary + displayName 부제목 swap)
   - `src/components/FeedCard.jsx` (bare handle, profileLabel import 제거)
   - `src/components/Comments.jsx` (handle primary)
   - `src/services/comment-service.js` (handle 필드 + default 'archelier user' 제거)
   - `src/pages/Profile.jsx` (헤더 bare handle + displayName 부제목)
   - `src/pages/Account.jsx` (자기 카드 @handle primary)
   - `src/pages/ShareView.jsx` (bare handle)
   - `src/locales/{en,ko,ja}.js` (followers/following empty messages, tabDesigns/tabCollections, My Collections 대문자)
   - `functions/profile.js` (default 'archelier user' → '' 제거)
   - `functions/backfill.js` (`backfillCommentHandle` 신규 + OIDC fallback)
   - `functions/index.js` (`backfillCommentHandle` export)

### ✅ 완료 (2026-05-09 후속 4) — Followers/Following 리스트 + 배포 스크립트

1. **Followers / Following 리스트 (Instagram 식)**
   - 기존엔 Profile 페이지에 followerCount / followingCount 숫자만 있고 *누가* 팔로우/팔로잉 인지 볼 방법 없음 → 카운트 클릭하면 모달 노출.
   - `FollowService.listFollowers(uid, { lastDoc, pageSize })` + `listFollowing(...)` 신규 — `createdAt desc` 정렬, 30 per page 페이지네이션 (cursor based).
   - `<FollowListModal>` 신규 — 두 탭 (Followers / Following) 토글, 한쪽 탭 데이터 캐시해서 다시 fetch 안 함, 각 행에 avatar + 이름 + @handle + Follow 버튼. 행 탭 = `/u/{handle}` 이동 + 모달 닫힘. ESC 닫기.
   - **모바일 = bottom sheet 패턴** — `100dvh - 4rem` 까지 차지 (native 는 safe-area-top 보장), 상단 36×4px 회색 핸들바, slide-up 220ms. tab bar 까지 시트가 덮음.
   - **데스크톱 = 가운데 카드** — `width: min(420px, calc(100vw - 2rem))`, `max-height: 80vh`.
   - **X 닫기 버튼 제거** — overlay 탭 / ESC 만으로 충분. 헤더는 제목 가운데 정렬.
   - **스크롤 임계값**: 모바일 ~9-10명, 데스크톱 ~8명 부터 (행당 64px 높이).
   - Profile 의 카운트 `<span>` → `<button class="profile-stats-btn">` 으로 변경. 자기 프로필도 OK (자기 follower 보기 가능).

2. **Default displayName 처리 — Instagram 식 sentinel fallback**
   - 'archelier user' 가 default 값으로 박혀 있어 여러 사용자가 동일 이름 → 인식성 ↓.
   - 결정: 추후 신규 가입 displayName 빈칸 허용 + UI 에서 sentinel ('archelier user' 또는 빈 값) 자동 fallback 으로 `@handle` 만 단일 라인 표시.
   - FollowListModal 1차 적용 — `hasCustomName = displayName && displayName !== 'archelier user'` 분기. 일반 displayName 만 두 줄 (이름 + @handle). 데이터 백필은 deferred.

3. **배포 스크립트 — `scripts/ship.sh` + npm scripts**
   - 매번 `npm run build && firebase deploy --only hosting && npx cap sync ios` 손으로 입력하던 거 한 줄로 묶음.
   - `npm run ship` — 기본: 빌드 + hosting + iOS sync (가장 흔한 케이스)
   - `npm run ship:full` — 위 + Cloud Functions + Firestore rules·indexes
   - `npm run ship:web` — iOS sync 건너뜀 (PWA 만)
   - flags: `--functions / --rules / --skip-ios` 조합 가능. fail-fast (set -e), 출력은 tail -3 로 압축.

4. **Firestore 인덱스 2개 추가**
   - `follows`: followingId ASC + createdAt DESC (listFollowers)
   - `follows`: followerId ASC + createdAt DESC (listFollowing)
   - 배포 후 build 즉시 사용 가능 — 기존 follows doc 적어 빌드 1-2분.

5. **변경 파일 (오늘 후속 4)**
   - `src/components/FollowListModal.jsx` (신규)
   - `src/services/follow-service.js` (listFollowers / listFollowing)
   - `src/pages/Profile.jsx` (카운트 클릭 → 모달)
   - `src/styles/main.css` (.profile-stats-btn, .follow-list-card + bottom sheet 변형)
   - `src/locales/{en,ko,ja}.js` (followersEmpty / followingEmpty2)
   - `firestore.indexes.json` (follows 두 인덱스)
   - `scripts/ship.sh` (신규), `package.json` (ship / ship:full / ship:web)

### ✅ 완료 (2026-05-09 후속 3) — Instagram 식 sticky chrome + 피드 정렬 listedAt + 모달 → 토스트

1. **모바일 chrome scroll-aware 거동 (Instagram 식 auto-hide)**
   - 기존 sticky-always 헤더가 화면 좁아 보인다는 피드백 → 스크롤 다운 시 위로 슥 사라지고, 업 시 부드럽게 다시 내려옴.
   - `src/hooks/useScrollDirection.js` 신규 — RAF throttle, threshold 8px, topOffset 64px. `'down' / 'up' / 'top'` 반환.
   - App.jsx 의 `ScrollDirectionBodyClass` 가 단일 listener 로 `body.scroll-down/up/top` class broadcast — 모든 모바일 sticky bar 가 CSS 로만 반응 (개별 hook 호출 X — listener 한 번).
   - `body.scroll-down .mobile-header { transform: translateY(...) }` 로 sub-page 헤더 자동 hide. 탭 root 의 빈 헤더 (`mobile-header-empty`) 는 status bar safe-area 만 차지하는 spacer 라 auto-hide 안 함 (`transform: none`).

2. **탭 root 빈 헤더 분기 (`mobile-header-empty`)**
   - Feed/Create step1/My/Account 등은 back/제목 둘 다 없음 → 48px 컨텐츠 행 통째로 hide, status bar safe-area padding 만 유지.
   - `MobileHeader` 가 isTabRoot && !showTitle 조건일 때 `<header className="mobile-header mobile-header-empty" aria-hidden />` 만 그림.
   - 결과: 모바일 탭 root 에서 status bar 바로 아래부터 컨텐츠 시작 (이전엔 48px+12px 빈 공간이 있었음).

3. **`/create?step=style` 을 sub-page 로 처리 — Step 1→2 ← 노출**
   - `useSearchParams` 로 step 감지. `/create` + `step=style` 일 때 `isCreateStep2 = true` → tab root 에서 빠짐 → MobileHeader 에 ← 노출.
   - `setSearchParams({ step: 'style' }, { replace: false })` 가 history push 하므로 `navigate(-1)` 이 자동으로 step 1 (upload) 으로 복귀.

4. **Feed/My 의 sticky+auto-hide 필터 묶음 (`.feed-sticky-mobile`)**
   - 사용자가 깊이 스크롤한 상태에서 필터/탭 바꾸려면 매번 위로 올라야 했음 → 필터 wrapper 도 같은 Instagram 패턴 적용.
   - CommunityFeed (`.feed-tabs-row` / `.feed-category-filter` / `.feed-style-filter`) + MyDesigns (`MyTabs` / `.my-designs-filter-row` / `.feed-style-filter`) 를 `.feed-sticky-mobile` wrapper 로 감쌈.
   - CSS: 모바일 한정 `position: sticky; top: env(safe-area-inset-top)` (native: `max(env, 50px)`). `body.scroll-down` 일 때 translate 로 사라짐. 데스크톱은 inline 그대로 (sticky 미적용).
   - **하단 `.mobile-tabbar` 는 절대 고정** — auto-hide 대상 아님. iOS WKWebView 글리치 방지로 `transform: translateZ(0); backface-visibility: hidden` 추가 (자기 GPU layer 강제).

5. **모바일 sticky chrome refinement (사용자 피드백 후)**
   - **My 가 hide 될 때 status bar 영역에 일부 비쳐 보이던 케이스**: translate 거리를 `calc(-100% - safe-area-inset-top - 4px)` 로 강화 — wrapper 의 마지막 행 (filter chips) 까지 *완전히* viewport 위로 밀어냄. native 는 `max(env, 50px)` 보장.
   - **Create 의 Step 1 of 2 가 자연 스크롤로 사라짐**: `.step-progress` 모바일 한정 `position: sticky; top: safe-area-top` 로 항상 고정. auto-hide 도 안 함 (Create 는 스크롤 거리 짧아 항상 보이는 게 맞음).
   - **Feed/My 의 빈 공간 불일치**: `.feed-header` 가 모바일에서 `display: none` 으로 숨겼지만 flex container 의 `margin-bottom: 1rem` 이 그대로 남아 Feed 에만 16px 빈 공간 → `.feed-header { display: none }` 로 완전 제거. Feed/My spacing 동일.

6. **iOS WKWebView fixed-position 글리치 fix**
   - 증상: `.feed-sticky-mobile` 의 transform/transition 이 활성일 때 하단 탭바 (position:fixed) 가 한 프레임 de-anchor 되어 위치 흔들림.
   - 원인: 다른 element 의 transform 페인트가 같은 합성 파이프라인에 영향.
   - Fix: `.mobile-tabbar` 에 `transform: translateZ(0)` + `backface-visibility: hidden` — 자기 GPU composited layer 강제.
   - 추가로 sticky wrapper 의 negative margin (-1rem) 도 horizontal overflow 일으켜 iOS bouncy scroll 가로축 흔들림 → negative margin 빼고 main 의 1rem padding 안쪽으로 배치.

7. **피드 정렬 키 = `listedAt` (공개 시점) — `timestamp` (생성 시점) 그대로 유지**
   - 의도: 디자인을 며칠 묵힌 후 공개해도 Latest 상단에 뜨도록 (Instagram·Pinterest 식). 비공개 → 재공개 시 다시 상단으로.
   - `setListed(true)` 가 `listedAt: serverTimestamp()` 도 함께 업데이트 — `timestamp` (생성 시점) 은 그대로 유지. My Designs / 모든 비-피드 쿼리는 여전히 `timestamp` 정렬.
   - `getFeedDesigns` Latest/Popular 모두 `orderBy('listedAt', 'desc')` 로 변경.
   - Firestore 인덱스 8개 갱신 (isListed + ... 조합의 `timestamp` → `listedAt`). 사용자 쿼리 인덱스는 그대로.
   - `firestore.rules` design 업데이트 허용 키 목록에 `'listedAt'` 추가 (이전엔 클라이언트가 listedAt 함께 쓰면 permission denied).
   - 백필: `functions/backfill.js` 에 `backfillListedAt` 추가. `isListed=true` 인데 `listedAt` 없는 doc 에 `listedAt = timestamp` 채움. Idempotent. Firebase ID token + gcloud Google OIDC token 둘 다 허용 (gcloud 쪽은 `gcloud auth print-identity-token` 으로 admin 계정에서 직접 받을 수 있도록 — modular SDK 라 `firebase.auth().currentUser.getIdToken()` 콘솔 호출 불가).
   - 실행 결과: 126 doc 스캔 / listed 4개 / `listedAt` 4개 모두 백필 완료.

8. **Posted-to-feed 모달 → 토스트로 교체**
   - 기존 modal-overlay (제목 + 설명 + "View feed" 버튼 + close X) 가 흐름 막음.
   - `.toast-snackbar` (알약 모양 검정 배경, 체크 아이콘 + "피드에 올렸어요") 으로 교체. 2.5s 후 자동 사라짐, 탭하면 `/feed` 이동. 모바일은 하단 탭바 위 (`56px + safe-area-bottom + 12px`), 데스크톱은 viewport 하단 가운데.
   - DesignDetail.jsx 의 `showFeedModal` → `feedToast` state 으로 단순화.

9. **메모리 룰 정리**
   - `feedback_mobile_scroll_chrome.md` 신규: Instagram 식 auto-hide 패턴 + `useScrollDirection` body class broadcast 방식 + 빈 헤더 분기 + 하단 탭바는 절대 고정 + sticky wrapper negative margin 금지 + iOS WKWebView 글리치 fix.

10. **변경 파일 (오늘 후속 3)**
    - `src/hooks/useScrollDirection.js` (신규)
    - `src/components/MobileHeader.jsx` (탭 root 빈 헤더 / step 2 sub-page / wordmark 분기)
    - `src/App.jsx` (`ScrollDirectionBodyClass`, CommunityFeed 의 `.feed-sticky-mobile` wrap)
    - `src/pages/MyDesigns.jsx` (`.feed-sticky-mobile` wrap)
    - `src/pages/DesignDetail.jsx` (모달 → 토스트)
    - `src/services/design-service.js` (`setListed` 가 `listedAt` 함께, `getFeedDesigns` 정렬 키)
    - `src/styles/main.css` (`.mobile-header-empty`, `body.scroll-down` rules, `.feed-sticky-mobile`, `.step-progress` sticky, `.toast-snackbar`, `.feed-header { display: none }`)
    - `firestore.rules` (`listedAt` 허용 키 추가)
    - `firestore.indexes.json` (isListed + ... 조합 timestamp → listedAt)
    - `functions/backfill.js` (`backfillListedAt` 추가, OIDC fallback)
    - `functions/index.js` (`backfillListedAt` export)

### ✅ 완료 (2026-05-09 후속 2) — Capacitor 크래시 fix + 모바일 UX 표준화

1. **Capacitor 환경에서 앱 전체 렌더 실패 fix (Firebase Analytics)**
   - 증상: iOS Capacitor WebView 에서 `TypeError: undefined is not an object (evaluating 'n.app.options')` → React render 도중 throw → **컴포넌트들이 마운트 자체 실패**. 결과적으로 Pricing 클릭 / 피드 카드 click / 다른 인터랙션 모두 동작 안 함. 웹 PWA 에서는 동작 (analytics 가 진짜 init 됐기 때문).
   - 원인: `firebase.js` 의 `analytics` proxy 가 native 환경에선 noop 으로 동작했으나, `setUserId(analytics, ...)` 가 useEffect (auth change) 에서 호출되며 Firebase 가 내부적으로 `analytics.app.options` 접근 → noop Proxy 가 `noopFn` 반환 → `.options` undefined → throw.
   - Fix: `firebase.js` 가 안전한 `logEvent` / `setUserId` wrapper export. native 면 silently no-op, 웹이면 try/catch 로 보호. 12개 파일의 import 를 `firebase/analytics` 에서 `./firebase.js` 로 전환.
   - 결과: Capacitor WebView 에서도 모든 인터랙션 정상.

2. **모바일 UX 표준화 — content-first 패턴**
   - **탭 root 4개 (`/feed`, `/create`, `/designs`, `/account`) 일관성**:
     - 하단 탭바 highlight 가 위치 알려주므로 *MobileHeader 의 제목 + back 버튼 모두 hide*. content 가 status bar 바로 아래에서 시작.
     - Instagram·TikTok·Pinterest 식 content-first 패턴.
     - `TAB_ROOT_PATHS` 집합으로 관리 (예외: `/`, `/my`, `/bookmarks` 도 포함).
   - **Sub-page (Pricing / Invite / Terms / Privacy / Support)**: MobileHeader 에 back + 제목 표시.
   - **디테일 페이지 (`/s/{id}`, `/designs/{id}`, `/u/{handle}`, `/c/{id}`)**: MobileHeader 에 back 만 (제목은 페이지 자체에 디자인 이름으로 큰 글자).
   - **Smart back fallback**: deep link 로 진입 시 `window.history.length` 체크 → 1 이면 `/feed` 로 fallback.

3. **모바일·데스크톱 back 버튼 strict 분리**
   - 모바일 (≤ 768px): MobileHeader 의 `<` chevron 만. 페이지 내부의 `← Back` 텍스트 버튼은 `display: none`.
   - 데스크톱 (> 768px): 페이지 내부의 `← Back` 텍스트 버튼만. MobileHeader 는 `display: none`.
   - **CSS 룰 순서 버그 fix**: `@media (max-width: 768px) { .detail-back-btn { display: none } }` 가 base `.detail-back-btn { display: flex }` *뒤에* 위치해야 specificity 충돌 방지.
   - 메모리에 룰 박음 (`feedback_mobile_desktop_separation.md`): UI 작업 시 두 환경 별도 검토 필수.

4. **FeedCard 터치 이슈 다층 fix**
   - **iOS sticky hover**: `.feed-card:hover` 가 iOS WebKit 에서 첫 탭이 hover, 두 번째 탭이 click 으로 처리되는 quirk → `@media (hover: hover)` 안에 hover 효과 wrapping.
   - **Pointer events → 표준 mouse + touch 로 회귀**: pointer events 가 iOS WKWebView 에서 미묘한 차이 있어, `(hover: hover)` 미디어 쿼리 + `onTouchStart`/`onTouchEnd` 분리.
   - **명시적 navigate in touchend**: synthesized click 의존성 제거. 짧은 tap 은 `e.preventDefault()` 후 navigate 직접 호출.
   - **iOS native image long-press 차단**: `.feed-card-image` 에 `-webkit-touch-callout: none`, `-webkit-user-drag: none`, `pointer-events: none` 추가. 드래그 ghost preview + "Save Image" 메뉴 비활성.
   - **Long-press 350ms 로 swap preview**: 데스크톱 hover 와 동일한 효과를 모바일 long-press 로 제공.

5. **ScrollToTop 컴포넌트** — 라우트 변경마다 `window.scrollTo(0, 0)`. 이전 페이지 scroll 위치 잔류로 sticky header 와 content 어긋나던 문제 해소.

6. **ShareView / DesignDetail 정리**
   - ShareView: 상단 "Try archelier" 검정 banner CTA 제거 (브라우징 방해). back 버튼은 글로벌 MobileHeader 가 처리.
   - ShareView SaveButton: `isLoggedIn` gate 제거 → 비로그인 사용자도 클릭 가능 (sign-in 모달 자동). 공개 디자인은 누구나 무드보드에 저장.
   - DesignDetail: 페이지 내부 "← Back" 텍스트 버튼 모바일에서 hide (MobileHeader 가 처리).
   - 두 페이지 모두 `.detail-topbar-row` 가 모바일에서 `flex-end` 로 actions 우측 정렬.

7. **MyDesigns 카테고리 필터 + 즐겨찾기 토글 통합**
   - 즐겨찾기 heart 토글이 단독 row 에서 둥둥 떠있던 문제 → 카테고리 chip 들과 같은 row 로 합쳐서 우측 고정. chip 은 가로 스크롤, heart 는 `flex-shrink: 0`.

8. **카피 / 자산 정리**
   - **Watermark 텍스트**: "Made with archelier" → "archelier" 단독 (signature 톤. `WATERMARK_TEXT` 상수 + i18n 3개).
   - **Reference Photo → Reference**: 다른 한 단어 스타일 (`Modern`, `Industrial` 등) 과 통일. ai-service.js + locales 3개.

9. **변경 파일 (오늘 후속 2)**
   - `src/firebase.js` (logEvent/setUserId wrapper), 12개 파일의 import 변경
   - `src/components/MobileHeader.jsx` (탭 root 처리, smart back, 제목 정리)
   - `src/components/FeedCard.jsx` (터치 핸들링 재작성)
   - `src/components/MobileTabBar.jsx` (Feed | Create | My | Account 순서)
   - `src/pages/MyDesigns.jsx` (필터 row 통합)
   - `src/pages/ShareView.jsx` (Try archelier 제거, 자체 back 제거, SaveButton always)
   - `src/pages/DesignDetail.jsx` (페이지 back 모바일 hide)
   - `src/services/credits-service.js` (useCredits 가 plan 같이 반환)
   - `src/services/watermark.js` (텍스트 "archelier")
   - `src/services/ai-service.js` (Reference 단독)
   - `src/locales/{en,ko,ja}.js` (Reference / Made with archelier 정리, manageBillingWebHint)
   - `src/styles/main.css` (hover 미디어쿼리, mobile back hide, MyDesigns filter row, ScrollToTop 관련 안 됨)
   - `src/App.jsx` (HomeRoute, ScrollToTop, /create 라우트, 분리된 import)
   - `src/config/billing.js` (Pro priceId)
   - `src/components/Header.jsx` (필요 시 plan subscription)

### ✅ 완료 (2026-05-09 후속) — Stripe Phase 1 e2e 검증 + Pro credits 동결 + 모바일 UX 정리

1. **Stripe (Test mode) 결제 e2e 검증 통과**
   - `archelier sandbox` 계정 생성 + Product `archelier Pro` ($9.99/mo Monthly only) + Price ID `price_1TVGpKBZu7X3HW9susdGafnf` + Product metadata (`type=plan`, `plan_id=pro`)
   - Firebase secrets: `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` 등록
   - Webhook endpoint 등록 (4 이벤트), signing secret 인증
   - `cd functions && npm install stripe` (이전 `Cannot find module 'stripe'` 500 에러 원인 — 누락됐던 단계)
   - 실제 결제 e2e: 테스트 카드 `4242 4242 4242 4242` → Stripe Customer + Subscription + Firestore `users/{uid}.plan='pro'` 동기화 모두 통과
   - 정책 단순화: 크레딧 팩 / Studio / Annual 모두 제거 — Free / Pro 단계만
2. **Pro 사용자 credits 완전 동결**
   - `deductCredits` / `refundCredits` (functions/index.js): `plan === 'pro'` 이면 skip → generation 마다 credits 차감 안 함
   - `initializeAndApplyDaily` 매일 로그인 보너스: Pro skip
   - `redeemReferral` invitee + inviter: 각자 plan 체크해서 Pro skip (referredBy 관계는 그대로)
   - `redeemPromo` 프로모 코드: Pro skip (코드는 redeemed 처리)
   - `useCredits` hook 이 plan 도 같이 반환 → 클라이언트 credit gate 도 Pro skip
   - UI hide: Header credit badge / Account credits 섹션 (Pro 시)
   - 결과: Pro 동안 `credits` 필드는 그대로 유지 (가입 시 받은 5 + 보너스 → 그 값에서 멈춤). Pro 해지 시 그 값부터 다시 차감/보너스 정상 동작.
3. **Stripe API 버전 호환 fix**
   - 새 webhook 이 API `2026-04-22.dahlia` 채택 시 `subscription.current_period_end` → `subscription.items[0].current_period_end` 로 이동
   - `handleSubscriptionChange` 에 fallback 추가 (`item?.current_period_end || subscription.current_period_end`)
   - 발견 경로: 사용자 결제 후 Firestore `subscriptionRenewsAt: null` → 원인 추적 → fix 후 metadata 업데이트로 재트리거하여 backfill
4. **iOS Pro 사용자 결제 관리 안내**
   - Account 페이지의 Pro 카드: iOS + `stripeCustomerId` 있으면 (= 웹에서 결제한 사용자) "웹에서 구독하신 경우 archelier.co 에서 관리할 수 있어요" hint 노출
   - 데스크톱은 그대로 "Manage billing" 버튼 (Stripe Billing Portal 열림)
5. **모바일 UX 정리**
   - **첫 페이지 = Feed** — `/` 라우트가 모바일 (`max-width: 768px`) 에서 `/feed` 로 redirect. 데스크톱은 그대로 HomePage. Create flow 는 `/create` 로 분리 (MobileTabBar 의 Create 탭 path 도 갱신).
   - **MobileTabBar 순서 변경**: `Feed | Create | My | Account` (Feed leftmost — Instagram·Twitter·TikTok 컨벤션)
   - **FeedCard 터치 동작 fix**: 모바일에서 카드 탭 시 swap 만 되고 navigate 안 되던 버그 → pointer event type 분기로 해소. 데스크톱 hover 는 그대로, 모바일은 *탭 = navigate*, *길게 누르기 350ms = original/design swap preview*.
6. **deadcode 정리**
   - `functions/stripe.js` 의 `handleCheckoutCompleted` mode==='payment' 분기 (크레딧 팩 처리) 제거
   - `handleInvoicePaid` 의 monthly credits grant 제거 (Pro 무제한이라 의미 없음) — invoice 영수증 기록만 유지
   - `AuthKey_G3Q44RRZ7R.p8` repo 루트에서 이미 삭제됨 (이전 § 4-3 항목)
7. **변경 파일 (오늘 후속)**
   - `functions/stripe.js`, `functions/index.js`, `functions/referral.js`, `functions/promo.js`, `functions/package.json` (stripe 의존성 추가)
   - `src/services/credits-service.js` (useCredits 가 plan 같이 반환)
   - `src/components/FeedCard.jsx`, `src/components/MobileTabBar.jsx`
   - `src/pages/Account.jsx` (iOS hint), `src/App.jsx` (HomeRoute, /create 라우트)
   - `src/locales/{en,ko,ja}.js` (manageBillingWebHint 키)
   - `src/config/billing.js` (Pro priceId / productId 박힘)
   - `SETUP.md` (Stripe 섹션 갱신: 단순화된 Free/Pro 구조 + sandbox 검증 통과 상태 반영)

### ✅ 완료 (2026-05-09) — 브랜드 비주얼 D (Quiet Atelier) 적용 + 자산 파이프라인 확립

1. **아이콘 / 스플래시 / OG 카드 D 디자인으로 통일** — 베이지 limewash 그라데이션 (`#DCD4C4 → #C9C0AF` + `#1F1B16` 5% overlay) + 차콜 'a' 마크 + 테라코타 점 (`#B5654A`). 글로벌 단일 톤. 부티크 호텔 인상의 기존 차콜 placeholder 폐기. (`resources/concepts/` 13개 시안 비교 후 D 확정. `BRAND_ASSETS.md` § 1 참고).
2. **자산 파이프라인 + lock-svg-to-png 도입** — 텍스트 SVG 가 sharp/librsvg vs 브라우저/Preview 에서 폰트 fallback 으로 다르게 렌더되는 문제 → 컨셉 SVG 를 `scripts/lock-svg-to-png.cjs` 로 raster PNG 임베드. 어떤 렌더러도 동일 결과 보장.
3. **Live element 색은 컨셉 PNG 픽셀 sampling** — sharp antialiasing 이 작은 elements 색을 muted 하지만 브라우저 CSS 는 vibrant 하게 렌더 → 같은 hex 라도 perceptual 차이. JsSplash 의 'a' 마크는 `<img src="/mark-D.png">` 로 통일 (icon-only.png 와 픽셀 동일).
4. **반복 실수 방지 — `BRAND_ASSETS.md`** — 컨셉 → production = `cp` only, 텍스트 SVG 재작성 금지. 작업 워크플로우 + 5개 룰 + 체크리스트 명시.
5. **변경 파일 (D 적용)**
   - `resources/{icon-only,icon-foreground,icon-background,splash,splash-dark,og-image}.{svg,png}` — 모두 locked
   - `assets/*` 동기화 (capacitor-assets 입력)
   - `public/{mark-D.png,og-image.png,icons/icon-*.webp}` — runtime 자산
   - `src/components/JsSplash.jsx` — inline SVG → `<img src="/mark-D.png">`, 시퀀스 ~3.2s
   - `src/styles/main.css .js-splash*` — bg = icon 동일 그라데이션 + overlay, 다크 모드 override 폐기
   - `src/services/watermark.js` — 폰트 sans → 세리프 스택
   - `capacitor.config.json` — splash backgroundColor `#C8BFAF`
   - `ios/App/App/Base.lproj/LaunchScreen.storyboard` — bg `#C8BFAF`
   - `ios/.../Assets.xcassets/{AppIcon,Splash}.imageset/*` + `android/.../res/{drawable*,mipmap-*}/*.png` — capacitor-assets 재생성

### ✅ 완료 (2026-05-08) — `archelier.co` 도메인 + brand 정착

1. **archelier.co 도메인 구입 + Firebase Hosting 연결** (Namecheap, $7.98/yr 첫해 — 갱신 $33.98)
   - DNS A record `199.36.158.100` + TXT `hosting-site=voda-7647c` (Namecheap BasicDNS)
   - Firebase Hosting custom domain → SSL 자동 (Let's Encrypt) minting 1-2시간
   - voda-7647c.web.app + archelier.co 둘 다 같은 dist serve

2. **Brand canonical URL 통일** (`publicOrigin()` helper, `index.html`, share/invite 링크)
   - `src/services/platform-service.js` 의 `publicOrigin()` — production 에서 `https://archelier.co` 강제, dev (localhost) 는 origin 그대로
   - share / invite / collection URL 4 곳 적용 (App.jsx ResultStep, DesignDetail, CollectionPage, Invite)
   - `index.html` 의 `og:url`, `og:site_name`, canonical link 추가

3. **Universal Links — `archelier.co` 추가** (`ios/App/App/App.entitlements`)
   - associated-domains 에 `applinks:archelier.co` 추가
   - `voda-7647c.web.app` / `voda-7647c.firebaseapp.com` 도 alias 로 유지
   - AASA 파일 (`/.well-known/apple-app-site-association`) 은 host-agnostic 이라 archelier.co 에서 자동 serve

4. **OAuth 흐름 archelier.co 으로 통일** (`src/firebase.js`, Apple Service ID, Google OAuth client)
   - `firebase.js` 의 `authDomain: 'voda-7647c.firebaseapp.com'` → **`'archelier.co'`** — Apple/Google OAuth callback handler 가 archelier.co/__/auth/handler 로 도달
   - Apple Developer Console: Service ID `com.voda.app.signin` 등록, Web Authentication 의 Domains `archelier.co` + Return URLs `https://archelier.co/__/auth/handler` (firebaseapp.com 은 Google 소유라 등록 거부됨)
   - Google Cloud Console: Web OAuth client 의 Authorized JavaScript origins + redirect URIs 에 archelier.co 추가
   - Firebase Console: Authorized Domains 에 archelier.co 추가
   - 단계적 단계 — 두 OAuth provider 를 archelier.co 로 unify 하면 firebase 의 default firebaseapp.com 의존 제거

5. **`firebase.json` 의 COOP header 완화**
   - `Cross-Origin-Opener-Policy: same-origin-allow-popups` 글로벌 적용
   - 기본 Firebase Hosting 의 `same-origin` COOP 가 OAuth popup 의 `window.close()` / `window.closed` 차단 → 두 번째 popup 시도 차단
   - `same-origin-allow-popups` 으로 popup ↔ parent 통신 허용

6. **Apple/Google credential-already-in-use fallback 개선** (`src/services/auth-service.js`)
   - 이전: `linkWithPopup` 실패 후 `signInWithPopup` (두 번째 popup) — Safari/Chrome 가 거의 항상 차단
   - 변경: `OAuthProvider.credentialFromError(err)` / `GoogleAuthProvider.credentialFromError(err)` 으로 첫 popup 의 credential 추출 → `signInWithCredential` 으로 popup 없이 fallback
   - Apple, Google 둘 다 같은 패턴

### P0 — 잔여 (출시 직전)

- **디자이너 진짜 아이콘 / App Store 스크린샷** (현재 placeholder. 출시 1순위)
- **App Store Connect 메타데이터 입력** (등록은 완료, `store-metadata.md` 의 EN+KO 본문 + 키워드 + 카테고리 + privacy URL 등)
- **TestFlight 업로드 + 실기 USB 테스트**
- **Sprint A 확정 후 → RevenueCat IAP** (P1, RevenueCat 트랙 — Pro 구독 + 백엔드 무제한 차감 skip + Trial 페이지)

### ✅ 완료 (2026-05-06) — 브랜드 결정 + i18n 일본어 + 글로벌 단일 archelier 적용

1. **App Store 표시명 결정 = `archelier`** (소문자, 글로벌 단일).
   - Architect + Atelier 합성어. 발음 아르셸리에. lowercase 워드마크 (airbnb / ebay 식 트렌드).
   - 후보 비교 (Voda·Roomify·Atelio·Atelyr·Studeo·Archeo 탈락 사유) + USPTO Justia / KIPRIS / J-PlatPat / 일반 웹 검색 모두 충돌 0건. archelier.com $2,988 매물, archelier.io / .app 미등록 추정.
   - 단일 출처 문서: `BRANDING.md` (포지셔닝·키워드·태그라인·App Store 첫 문단 포함).
2. **앱 i18n 일본어 추가** — `src/locales/ja.js` 신규 (432 키, です/ます 통일), `useLocale` 등록 + `LANG_LABELS.ja = '日本語'`. Header 언어 스위처 자동 노출. `functions/index.js` chat advisor `langHint` 일본어 분기 추가. `promptLang: 'Japanese'` 자동 전달로 Gemini 응답 언어 자동 선택. (commit 46e199c)
3. **글로벌 단일 archelier (소문자) 일괄 적용** — Spotify·Netflix·Notion 식 글로벌 단일 패턴.
   - 모든 시장 디스플레이명 통일: `Info.plist` `CFBundleDisplayName=archelier`, `en/ko/ja.lproj/InfoPlist.strings` 모두 `archelier`.
   - 앱 내부: 헤더 로고 (i18n `appName`), 카피 자기언급, 워터마크 `Made with archelier`, share text / 다운로드 파일명 `archelier-design-N.jpg`, fallback `archelier user`, Privacy / Terms 영문 본문 모두 archelier.
   - 한·일 ASO 보조 키워드: 한국 "공간담", 일본 "空間師" 은 store-metadata.md 의 description / keywords 필드에만 부분 보존 (정식 디스플레이명 아님).
   - i18n 키 이름도 정돈: `tryVoda` → `tryApp`, `createWithVoda` → `createWithApp`.
   - `manifest.json`, `index.html` (title / og / description) 모두 archelier.
   - 외부 고유명사 (Archelier Studio Facebook 동명 스튜디오) 와 어원 분해 (`**Archi**tect + at**elier**`) 만 원형 보존.
4. 문서 갱신: `BRANDING.md` (결정 표 / 백업 후보 / 액션 체크리스트), `store-metadata.md` (Common 표시명 / 한·일 섹션 이름 / keywords), `IOS_BUILD_GUIDE.md` § 3-1 (Localizations 등록을 옵션으로 톤다운), `PRODUCT_PLAN.md` (BRANDING.md 포인터).
5. **profile displayName 편집 UI 추가** — Account 페이지에 "이름 → 핸들 → 소개" 3단 구조. `functions/profile.js` `updateProfile` Cloud Function 이 `bio` / `displayName` 둘 다 받도록 확장 + Firebase Auth `admin.auth().updateUser` 미러링 (새 댓글 / 활동에 즉시 반영). `ProfileService.updateDisplayName` 신규 (서버 + 클라이언트 Firebase Auth `updateProfile` 동시 호출). `DISPLAY_NAME_MAX = 30`. en/ko/ja `displayName*` 키 5개 추가 (438 키 정합성). 빈칸이면 fallback `archelier user` — "스튜디오 X 디자이너" 처럼 자기 정체성 표현 가능.
6. **App icon / Splash 1차** — `resources/*.svg` 5개 (icon-only / foreground / background / splash / splash-dark) + Node `scripts/build-assets.cjs` (sharp SVG → PNG 변환, density 200/300 자동 조정). 아이콘 = 차콜 배경 + atelier 창문 (arch + 십자 격자) + 골드 underline. 스플래시 = 단색 베이지 (native) → JS Splash 가 letter-by-letter 워드마크 reveal + 골드 라인 draw + fade out (~2.6s).
   - `@capacitor/splash-screen@7.0.5` 설치, `capacitor.config.json` SplashScreen 옵션 (`launchAutoHide: false`, `backgroundColor: #F5EDE0`, `fadeOutDuration: 200`).
   - `JsSplash.jsx` 컴포넌트 + CSS 애니메이션. `App.jsx` 최상위 mount.
   - `LaunchScreen.storyboard` 배경 베이지 (#F5EDE0). 흰 화면 깜빡임 제거 위해.
   - **알려진 호환성 이슈**: `@capacitor/assets@3.0.5` 가 Capacitor 7 의 새 universal/ios platform Contents.json 형식과 호환 안 됨 → iOS PNG 갱신 안 함. `cp resources/*.png ios/.../Assets.xcassets/...` 로 직접 카피 필요. `scripts/build-assets.cjs` 다음 개정에서 iOS 카피 단계 추가 검토.
   - **iOS LaunchScreen 캐시 주의**: storyboard / Assets 변경 후 시뮬레이터·실기에서 앱 삭제 → Xcode Clean Build → 재설치 해야 변경 보임. iOS 가 LaunchScreen 을 캐시함.
   - **`prefers-color-scheme: dark`** — JS Splash 다크 모드 자동 전환. 자산: `resources/splash-dark.svg` (단색 차콜).
   - PWA 자산도 함께 갱신: `public/icons/icon-{48,72,96,128,192,256,512}.webp`, `manifest.json` 갱신, 기존 `public/icon-{192,512}.png` 삭제.

### ✅ 완료 (2026-05-06) — Room AI 참고 3단계: 모바일 chrome (탭바 + 헤더 + 라우트 재구성)

- **`<MobileTabBar />`** 신규 — Room AI 식 하단 4탭 (Create / Feed / My / Account). `@media (max-width: 768px)` 에서만 노출. legal / share view 페이지에선 숨김. 데스크탑은 그대로 .header 사용.
- **`<MobileHeader />`** 신규 — 모바일 전용 좌상단 ← + 가운데 페이지 제목. 라우트별 i18n 제목 매핑 (TITLE_BY_ROUTE). 홈 `/` 에서는 ← 안 보이고 archelier 워드마크. 모바일에서 데스크탑 `.header` 는 CSS `display: none` 으로 숨김.
- **라우트 재구성**:
  - `/feed` 신규 — 기존 HomePage 의 inline `<CommunityFeed />` 분리. Create 페이지 = upload + style flow only.
  - `/my` 신규 — `<Navigate to="/designs" replace />`. 모바일 탭바 My 진입점.
  - 데스크탑 Header 에 Feed 텍스트 링크 추가.
- **`<MyTabs />`** 신규 — MyDesigns / Bookmarks 페이지 상단의 sub-tab nav. Designs / Collections / Profile (handle 있을 때만) 3탭. iOS 표준 tab-in-tab 패턴. CSS `.my-tabs` / `.my-tab.active` (밑줄 강조).
- **CSS 레이어 정리**: 모바일 main / legal-content padding-bottom (탭바 가림 방지). sticky CTA 가 탭바 위에 위치 (`bottom: calc(56px + env(safe-area-inset-bottom))`). `.home-with-sticky-cta` 는 56+64 합산.
- **알려진 미완성**: HomePage 의 Style step 안 Back 버튼은 모바일 좌상단 ← 와 중복. URL search param `?step=style` 마이그레이션 필요 (다음 라운드). 지금은 controls 안 Back 버튼 keep.
- 키 정합성 443 / 443 / 443.

### ✅ 완료 (2026-05-06) — Room AI 참고 2단계: Step bar + Continue sticky + 언어 → Account + Budget chip

- **Step Progress Bar** 상단 표시 (`StepProgress` 컴포넌트). Upload (1) / Style (2) 두 step. i18n `stepLabel: 'Step {current} of {total}'` (en/ko/ja).
- **Continue / Generate sticky 하단** — `.controls-sticky` 클래스, mobile only (`@media (max-width: 768px)`). `position: fixed` + `safe-area-inset-bottom` + `border-top`. 데스크탑은 inline 그대로. `home-with-sticky-cta` 로 main padding-bottom 추가해서 컨텐츠 가림 방지. StyleStep 의 Back 버튼을 좌측에 두고 Generate 우측 (모바일 좌→우 순서).
- **언어 스위처 → Account 안으로** 이동. Header 의 `lang-picker` / `langOpen` / `setLang` 흐름 제거 (~30줄 삭제). `Account.jsx` 에 `account-lang-pill` chip 행 추가 (이름 / 핸들 / 소개 / 언어). i18n `language` 키 추가 (en/ko/ja).
- **Budget chip 압축** — 기존 `.budget-row` (제목 + 부제 + 큰 pill 3개) → `.budget-chip` (작은 inline chip, `Budget · Mid ▼`). 클릭 시 펼침해서 3 옵션 + hint 노출. Style step 시각적 부담 줄임. CSS 정리 (`.budget-pill*` → `.budget-chip*`).
- 키 정합성 439 / 439 / 439.

### ✅ 완료 (2026-05-06) — Room AI 참고 1단계: Empty Room 자동 인식

- Empty Room toggle UI 완전 제거. AI 가 빈 방 / 가구 있는 방 자동 감지 → `detectedMode` 응답 ('staging' | 'redesign') 으로 design 문서에 저장. 결과 화면의 staging tag 는 그대로 유지 (AI 가 staging 으로 감지한 케이스만 노출).
- Room AI 식 단순한 흐름 + 사용자 결정 부담 해소. 부동산 스테이징 / 빈 신축 케이스도 자동 처리.
- `ai-service.js generatePrompt` modeNote 자동 감지 prompt 로 변경, JSON 응답에 `detectedMode` 필드 추가. App.jsx emptyRoomMode state·toggle UI·setter·prefill 모두 제거. en/ko/ja 의 `emptyRoomToggle` / `emptyRoomHint` 키 삭제 (437 키 정합성). main.css `.empty-room-toggle*` 스타일 삭제.

### P1 — TestFlight 까지 가는 길

4. ~~App Store 표시명 결정~~ → 완료 (`archelier`)
5. **App Store Connect 에 앱 등록** (https://appstoreconnect.apple.com/apps → New App)
6. **Validate App → Distribute App → Upload**
7. **TestFlight Internal Testing 그룹 추가** + 본인 iPhone 에서 설치
8. **실기 USB 테스트** 또는 TestFlight 빌드로 native 동작 검증:
   - Sign in with Apple (실 Apple ID)
   - 카메라 / 사진 권한
   - Native share 시트
   - 이미지 사진앱 저장
   - Universal Links (SMS 로 본인에게 https://voda-7647c.web.app/s/... 보내고 탭)

### P2 — 정식 출시 가까이

9. **Sprint A 4단계 — RevenueCat IAP**
   - RevenueCat 계정 + Voda 프로젝트
   - App Store Connect 에 IAP 상품 (Pro 월/연 구독, Studio 월/연, 크레딧 팩)
   - Capacitor SDK 설치 + Firebase uid ↔ RevenueCat appUserID 매핑
   - 서버 웹훅 (`functions/revenuecatWebhook`)
   - iOS 결제 UI un-hide
10. **디자이너 진짜 아이콘 / 스크린샷** 교체
11. ~~Support 페이지 만들기~~ → 완료 (`/support`, hello@uhzlab.com)
12. **App Store Connect 메타데이터 입력** (`store-metadata.md` 의 EN+KO)
13. **App Store 제출** → 심사 1-3 cycle 가능

### P3 — 출시 후

14. **Sprint B — Android 출시** (1-2주)
    - Production keystore 생성 + 안전 보관 (분실 시 앱 업데이트 불가)
    - Google Play Billing via RevenueCat
    - **App Links** — `public/.well-known/assetlinks.json` 신규 생성. 두 도메인 다 등록:
      ```json
      [{
        "relation": ["delegate_permission/common.handle_all_urls"],
        "target": {
          "namespace": "android_app",
          "package_name": "com.voda.app",
          "sha256_cert_fingerprints": ["<production keystore SHA-256>"]
        }
      }]
      ```
      Firebase Hosting 이 `archelier.co` + `voda-7647c.web.app` 둘 다 자동 serve.
      `AndroidManifest.xml` 의 `<intent-filter android:autoVerify="true">` 에 두 host 등록:
      ```xml
      <data android:scheme="https" android:host="archelier.co" />
      <data android:scheme="https" android:host="voda-7647c.web.app" />
      ```
      대상 path: `/s/*`, `/c/*`, `/u/*`, `/designs/*` (iOS AASA 와 동일).
    - Play Console 자산 + 등록
    - **Google Sign-In Android native config** (Sprint A 에서 plugin 만 도입, config 미완)
      1. Firebase Console → Android app 등록 (Package name: `com.voda.app`)
      2. `google-services.json` 다운로드 → `android/app/google-services.json` 위치
      3. SHA-1 fingerprint Firebase 등록 — debug:
         `keytool -keystore ~/.android/debug.keystore -list -v -alias androiddebugkey -storepass android -keypass android`
         release: production keystore SHA-1 도 같이
      4. `npx cap sync` 후 `npx cap run android` 으로 검증
      5. Capacitor 가 google-services plugin gradle 통합 자동 처리 — 안 되면 `android/app/build.gradle` 의 `apply plugin: 'com.google.gms.google-services'` 확인
15. **Sprint C — 푸시 알림** (1주)
    - FCM SW + 네이티브 등록
    - 서버 트리거 (디자인 완료, 좋아요, 주간 다이제스트)
16. **Studio 플랜 / B2B 트랙 — 미래** (수요 검증 후)
    - 진짜 디자이너·부동산·스튜디오 수요가 검증되면 Studio 플랜 다시 추가
    - 차별점: 상업 이용 권한 / API 접근 / 더 많은 크레딧 / 팀 시트
    - 현재 Pro 와 차별이 약해서 출시 시점에는 Free / Pro 두 단계만 (단순화). `config/billing.js` 의 PLANS 에 추가만 하면 UI 자동 반영.

### 🤔 추후 고려 (결정 미정 — 아이디어 보존)

- **디자인 분석 결과의 다국어 번역 캐싱 전략**
   - 현재: 매번 `promptLang` 으로 Gemini 가 새 언어로 분석 생성 → 같은 디자인을 다른 언어로 보면 완전히 다른 텍스트 (각 호출마다 stochastic).
   - 옵션 A: 한 번 분석 후 design 문서에 모든 언어 버전 캐싱. 첫 번역 요청 시 그 언어 번역 → 저장 → 다음 사용 시 재사용. 일관성 ↑, 호출 비용 ↑ (첫 요청은 동일).
   - 옵션 B: 영어로만 default 생성 → KO/JA 사용자도 영어 본 후 번역 버튼. 단순. 단 KO/JA UX 약함.
   - 옵션 C: 영어로 1차 생성 → KO/JA 요청 들어올 때 그 시점에 번역 (Gemini text translation) + 캐싱. 옵션 A 의 lazy 변형.
   - 결정 보류 — Pro 사용자 비율 + 번역 호출 비용 봐야.

- **결과 분석 아래 스튜디오 추천 카드** (출시 후, B2B 트랙)
   - 스튜디오 별 무드보드 / 포트폴리오 썸네일 / 홈페이지 링크 / 소개글 / Instagram 등 SNS 링크.
   - 디자인 결과 화면 하단에 "이 스타일로 실제 시공 가능한 스튜디오" 카드 노출.
   - 스튜디오 입장: 자기 작업 노출 + 잠재 고객 — Pro 보다 Studio 플랜 훨씬 매력 있는 entry. Studio 플랜 부활 트리거.
   - **Instagram 공유 기능도 같이** — 디자인 결과를 IG story 또는 feed 로 공유 (Capacitor share API + IG deeplink 결합).

---

## 7. 빠른 참조 — 자주 쓸 명령

```bash
# 코드 변경 후 시뮬레이터 반영
npm run cap:sync          # build + cap sync 한 번에
npm run cap:open:ios      # Xcode 열기

# 시뮬레이터 캐시 무효화
# (시뮬레이터에서 Voda 앱 길게 눌러 삭제 → Xcode Run)

# AASA 검증
curl -I https://voda-7647c.web.app/.well-known/apple-app-site-association

# Capacitor 8 호환 apple-sign-in 나왔는지 확인
npm view @capacitor-community/apple-sign-in versions --json

# Sandbox 옵션 강제 OFF (cap add ios 다시 했을 때)
sed -i '' 's/ENABLE_USER_SCRIPT_SANDBOXING = YES;/ENABLE_USER_SCRIPT_SANDBOXING = NO;/g' \
  ios/App/App.xcodeproj/project.pbxproj
```

---

작성: 2026-04-29
이 문서는 Sprint A 의 진행 로그이고, 새로 같은 작업을 할 때 따라 할 수 있는 walkthrough 는 `CAPACITOR_SETUP.md` 가 맡음.
