# Android 배포 — Sprint B 통합 walkthrough

archelier 의 Android (Capacitor + Play Store) 출시 절차 + 결제 (Google Play Billing via RevenueCat) + 모든 토큰·키 통합 가이드. **다음 앱에 같은 작업할 때 이 문서 따라가면 됨**.

연관 문서:
- **`SPRINT_A_LOG.md`** — 시간순 작업 로그 + 함정 카탈로그 (특히 Sprint B 1·2·3차 섹션)
- **`REVENUECAT_SETUP.md`** §11 — RC + Play Billing 세부 walkthrough
- **`CAPACITOR_SETUP.md`** — Capacitor scaffold + 의존성 (Capacitor 7)
- **`CREDENTIALS.md`** — 모든 secret 의 인벤토리·위치·만료/회전 절차

---

## 0. 사전 조건

이 문서는 **iOS 가 이미 출시된 상태** 가정. iOS 작업이 깔린 위에 Android 를 얹는 흐름. 미리 갖춰져야 할 것:
- Capacitor 7 + iOS App Store 출시 (1.0+)
- Firebase 프로젝트 (`voda-7647c`) + iOS app 등록
- RevenueCat 프로젝트 + iOS App Store config + entitlement `archelier Pro` + offering `default`
- ASC In-App Purchase key (P8) + ASC API key (P8) — RC 에 업로드됨
- Stripe (web 결제) — Android 에선 정책상 사용 안 함, 단지 webhook 코드 공유

iOS-only 작업은 `IOS_BUILD_GUIDE.md`, `APP_STORE_SUBMISSION.md`, `REVENUECAT_SETUP.md` §1~10 참고.

---

## 1. Firebase Console — Android 앱 등록

https://console.firebase.google.com/project/voda-7647c/settings/general

1. **Add app → Android**
2. Package name: `com.voda.app`
3. App nickname: `archelier (Android)`
4. **Debug signing certificate SHA-1** — 첫 등록 시:
   ```bash
   keytool -keystore ~/.android/debug.keystore -list -v \
     -alias androiddebugkey -storepass android -keypass android | grep SHA1
   ```
   하나 박아두고 → release / Play App Signing SHA-1 은 keystore 만든 후 / Play 앱 등록 후 추가.
5. **Download google-services.json** → `android/app/google-services.json`.

★ 함정: 처음 SHA-1 없이 google-services.json 받으면 OAuth Android client (`client_type:1`) 누락 — Google Sign-In 작동 안 함. **SHA-1 등록 후 재다운로드** 필수.

최종적으로 google-services.json 에 **4개 SHA-1** 다 들어가야 함:
- debug (현재 머신의 `~/.android/debug.keystore`)
- (옵션) debug 백업 (다른 머신 / 옛 keystore)
- **release upload key** (`archelier-upload.keystore`)
- **Play App Signing key** (Play Console 에서 Google 이 관리하는 키)

(상세 → §3, §6)

---

## 2. Production keystore 생성

Play 출시 전에 release 빌드용 keystore 발급. **분실 시 앱 업데이트 영구 불가** — 백업 필수.

```bash
keytool -genkeypair -v \
  -keystore ~/Desktop/idea/voda/keys/archelier-upload.keystore \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias archelier-upload
```

입력 정보 (실제 등록한 값):
- **CN**: `Uihyun Kim`
- **O**: `uhz LLC`
- **L**: `New York`, **ST**: `NY`, **C**: `US`

생성 후 SHA-1 추출:
```bash
keytool -keystore ~/Desktop/idea/voda/keys/archelier-upload.keystore \
  -list -v -alias archelier-upload | grep SHA1
```

→ Firebase Console 에 release SHA-1 추가 → google-services.json 재다운로드.

### 백업 3-tier (분실 시 복구 불가)
- 외장 SSD
- 1Password (또는 동등 password manager)
- 다른 클라우드 (iCloud Drive / Google Drive — 단 본인 외에 접근 불가한 폴더)

### gradle.properties 설정
keystore 비밀번호 / alias 정보는 repo 밖 `~/.gradle/gradle.properties` 에:
```properties
ARCHELIER_UPLOAD_STORE_FILE=/Users/uihyun/Desktop/idea/voda/keys/archelier-upload.keystore
ARCHELIER_UPLOAD_STORE_PASSWORD=********
ARCHELIER_UPLOAD_KEY_ALIAS=archelier-upload
ARCHELIER_UPLOAD_KEY_PASSWORD=********
```

`android/app/build.gradle` 의 `signingConfigs.release` 가 이 값들을 자동으로 읽음 (commit `c68fef6` 의 패턴).

---

## 3. Play Console — 앱 등록 + Play App Signing

### 3-1. 앱 생성
1. Play Console → **All apps → Create app**
2. App name: `archelier`
3. Default language: English (United States)
4. App or game: App
5. Free or paid: Free (구독은 인앱 결제로)
6. Declarations: 모두 정직히 체크
7. **Create app**

### 3-2. Play App Signing 활성화
새 앱은 자동 enroll 됨. Google 이 final signing key 보관 → 우리는 upload key 만 관리. upload key 분실 시 Google 통해 재발급 가능.

확인 위치: **Test and release → Setup → App integrity** 또는 **Protected with Play → Play Store distribution → Go to Play app signing**.

거기 두 가지 SHA-1 표시:
| 종류 | 누구의 키 | 용도 |
|---|---|---|
| **App signing key certificate** | Google 관리 (Play App Signing) | Play Store 에서 배포될 때 사용 — 디바이스에 도달하는 SHA-1 |
| **Upload key certificate** | 우리 archelier-upload.keystore | Play Console 에 .aab 업로드할 때 검증 |

**둘 다 Firebase Console 에 등록**해야 Google Sign-In 이 sideload debug, Play Store internal, Play Store production 모두에서 동작.

★ 함정: upload key SHA-1 만 등록하고 끝내면 → sideload 에선 동작하는데 Play Store install 본에선 `NoCredentialException`. (Sprint B 3차 4번째 함정)

### 3-3. App Content (Setup → App content)
12개 task 통과 필요. 핵심:
- **App access**: anonymous flow 지원이라 reviewer 가 즉시 검증 가능. 단 "No other information required" 체크 + 더미 계정 (`uhzdev@gmail.com`) 정보 제공 권장
- **Privacy policy**: `https://archelier.co/privacy` 같은 공개 URL
- **Ads / Financial / Health / Government / COVID**: 모두 No
- **Content rating** (IARC questionnaire): UGC 피드 있어 Brazil ClassInd 14+ 자동 적용. 다른 region 은 Everyone (4+)
- **Target audience**: 18+ 단일 선택 (성인 대상)
- **Data safety**: 모든 SDK / Firebase / RC / Stripe 가 수집하는 데이터 정직 신고

### 3-4. Store listing (3개 언어)
en/ko/ja. 텍스트 출처 → `store-metadata.md`.

자산:
- App icon 512×512
- Feature graphic 1024×500 — `scripts/build-play-feature-graphic.cjs` 출력 (`resources/app-store/play-feature-graphic.png`)
- Phone screenshots 6.7" — App Store 의 `screenshots-6.7-en-marketing-b/` 재사용 (Play 가 6.9" 도 받음)

### 3-5. 카테고리
- Primary: **House & Home**
- Tags: Interior design / House & home / Lifestyle / Social / Photo editor

---

## 4. Android 앱 코드 — Sprint B 1차 변경사항

이미 커밋 `81fcde5` 에 들어 있는 변경. 다음 앱 setup 시 동일 패턴:

### 4-1. minSdk 23 → 24 (`android/variables.gradle`)
RC 의 `purchases-hybrid-common-ui:17.25.0` 가 minSdk 24 요구.

### 4-2. 앱 이름 (`android/app/src/main/res/values/strings.xml`)
```xml
<string name="app_name">archelier</string>
<string name="title_activity_main">archelier</string>
```

### 4-3. Splash 통일
Android 12+ system splash 강제. 두 톤 (system splash → Capacitor splash) 안 보이게 통일:
- `values/ic_launcher_background.xml`: `#FFFFFF` → `#C8BFAF` (베이지)
- `mipmap-anydpi-v26/ic_launcher.xml` + `ic_launcher_round.xml`: background `@mipmap/...` → `@color/ic_launcher_background`
- `values/styles.xml` 의 `AppTheme.NoActionBarLaunch` 에 Android 12+ splash attributes
- `drawable/splash_transparent.xml` (신규) — system splash icon 자리 빈 shape
- `capacitor.config.json`: SplashScreen `launchShowDuration 2000`, `launchAutoHide true`

### 4-4. Google Sign-In 옵션
`src/services/auth-service.js`:
```js
await FirebaseAuthentication.signInWithGoogle({
  skipNativeAuth: true,
  mode: 'select_account'  // emulator NoCredentialException 회피 + 계정 chooser
});
```

### 4-5. Apple Sign-In Android 에서 숨김 (`src/App.jsx`)
Apple 정책 4.8 은 iOS 한정. Android 에선 `isAndroid()` 분기로 hide.

### 4-6. RevenueCat platform 분기 (`src/services/revenuecat-service.js`)
```js
const IOS_API_KEY = import.meta.env.VITE_REVENUECAT_PUBLIC_KEY_IOS;
const ANDROID_API_KEY = import.meta.env.VITE_REVENUECAT_PUBLIC_KEY_ANDROID;

function getApiKey() {
  const platform = Capacitor.getPlatform();
  if (platform === 'ios') return IOS_API_KEY;
  if (platform === 'android') return ANDROID_API_KEY;
  return null;
}
```

### 4-7. UI gating 도 native 분기 (Sprint B 3차 commit `435e54b`)
`src/pages/Pricing.jsx` + `src/pages/Account.jsx`: `isIOS()` → `isNativeApp()`. 안 그러면 Android 에서 "Upgrade to Pro" 가 web Stripe 로 빠짐 (Play 정책 위반).

---

## 5. RevenueCat + Google Play Billing — 결제 연결

전체 절차는 `REVENUECAT_SETUP.md` §11 참고. 핵심 단계 요약:

1. **Play Console — Subscription 생성** (Monetize → Subscriptions)
   - Product ID: `archelier_pro_monthly`
   - Base plan: monthly, $9.99 USD, auto-renewing
   - Benefits (en/ko/ja) localized
   - 174개국 activate

2. **Google Cloud Console — Service Account** (RC 가 Play Developer API 호출용)
   - Cloud Console → IAM & Admin → Service Accounts → CREATE
   - Name: `archelier-revenuecat`
   - Keys → ADD KEY → JSON → 다운로드 → `~/Desktop/idea/voda/keys/playstore_rc/`
   - **Cloud Pub/Sub API enable** (Real-time notifications 용)
   - IAM → service account 에 **Pub/Sub Admin** role 추가

3. **Play Console — Users and permissions** (계정 레벨)
   - service account 이메일 초대
   - archelier 앱 권한 4개: View app info / **View financial data** / **Manage orders and subscriptions** / View store performance

4. **RC dashboard — Play Store config 추가**
   - Apps & providers → + New → Google Play
   - Package: `com.voda.app`
   - Service Account JSON 업로드 → ✅ Valid credentials
   - Google developer notifications → Topic: `Play-Store-Notifications` (RC 자동 생성)
   - Public SDK API key 복사 → `.env*` 의 `VITE_REVENUECAT_PUBLIC_KEY_ANDROID`

5. **Play Console — Real-time developer notifications** (Monetization setup)
   - Enable + Topic name (위 단계의 토픽)
   - Notification content: Subscriptions and voided purchases only

6. **RC — Product / Entitlement / Offering 연결**
   - Products → Import Products (Play Console 에서 자동 fetch)
   - Entitlement `archelier Pro` → Attach Android product `archelier_pro_monthly:monthly`
   - Offering `default` → Monthly package 에 Android product 추가

---

## 6. 출시 직전 — 최종 google-services.json 점검

다음 4개 SHA-1 모두 등록되어 있어야 함. 확인 명령:
```bash
grep certificate_hash android/app/google-services.json
```
출력 예시 (실제 값):
- `0f4ee600...` (옛 debug — 다른 머신 호환)
- `5485876c...` (현재 debug)
- **`4f27ae05...` (release upload key)**
- **`e665bf71...` (Play App Signing key)**

빠진 거 있으면 Firebase Console 에서 추가 + 재다운로드.

---

## 7. 빌드 + 업로드

### 7-1. Release .aab 빌드
```bash
npm run build
npx cap sync android
cd android
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
  ./gradlew bundleRelease
```

산출물: `android/app/build/outputs/bundle/release/app-release.aab`

### 7-2. .aab 검증 (선택)
```bash
unzip -p android/app/build/outputs/bundle/release/app-release.aab \
  base/assets/public/assets/index-*.js | grep -o "goog_[a-zA-Z0-9]*\|appl_[a-zA-Z0-9]*"
```
두 키 다 있어야 정상.

### 7-3. Internal Testing 트랙 업로드 (테스트용)
Play Console → archelier → Testing → Internal testing → **Create new release** → .aab 드래그.

Testers 탭에서 email list 추가 → Save → **Copy link** (opt-in URL).

### 7-4. License testers 등록 (sandbox 결제)
Play Console → Settings → **License testing** (계정 레벨, archelier 앱 안 아님)
- Tester accounts: 본인 Gmail + 더미 계정
- License response: `RESPOND_NORMALLY`

### 7-5. Production 트랙 (실제 출시)
Play Console → archelier → Production → **Create new release**
- .aab 업로드 (Internal Testing 에 올린 것과 동일 파일 OK — "Add from library")
- Release notes 3개 언어
- Country availability: 177 countries (default targeted)
- Roll-out: 100%
- Save → Review release → **Start rollout to Production**

review 24-72시간 소요.

---

## 8. Sandbox 결제 검증

### 8-1. emulator 또는 실기 준비
- Google Play 포함 emulator (Pixel 8 Pro + API 34+ Play Store 이미지) **또는** 실기 Android
- 디바이스에 license tester Gmail 로 로그인

### 8-2. Internal Testing opt-in
- emulator/실기 안 브라우저 또는 Gmail 에서 opt-in URL 열기
- **Become a tester** → **Download it on Google Play**
- Play Store 페이지에서 Install
  - ⚠️ 기존 sideload archelier 있으면 먼저 uninstall (서명 충돌)

### 8-3. 결제 흐름
1. 앱 실행 → Google Sign-In
2. Settings → Upgrade to Pro
3. RC paywall sheet 표시 ("Design without limits")
4. Subscribe → Google Play 결제 sheet
5. **"Test card, always approves"** 표시 → license tester 인식 ✅
6. Subscribe 누르면 즉시 결제 완료 + Pro 활성화
7. RC webhook → Firestore `users/{uid}.plan='pro'` 동기화

### 8-4. Sandbox 가속 cycle
| 실제 주기 | sandbox 가속 |
|---|---|
| Weekly | 3 분 |
| **Monthly** | **5 분** |
| Yearly | 30 분 |

→ 5분 후 RENEWAL webhook 자동 발사. ~6 cycle 후 sandbox 한계 도달 → 자동 cancel + EXPIRATION → `plan='free'`. lifecycle 전체 자동 검증 가능.

검증 명령:
```bash
firebase functions:log --project voda-7647c --only revenueCatWebhook | tail -30
```

`INITIAL_PURCHASE` → `RENEWAL` × N → `CANCELLATION` → `EXPIRATION` 순서 확인.

---

## 9. 출시 후 운영

### 9-1. RC dashboard
- **Customers** — uid 검색 → subscription history, refund, grant entitlement
- **Charts → Revenue / Subscriptions / Trial conversion** — KPI 모니터링
- **Webhooks** → Recent deliveries 에서 우리 Cloud Function 응답 확인

### 9-2. Play Console
- **Statistics** — install / uninstall / crash rate
- **Monitor and improve → Pre-launch report** — 자동 device matrix 테스트
- **Vitals** — ANR / crash 등

### 9-3. 실제 cancel / refund 처리
- 사용자 self-service: Play Store → 자기 계정 → Subscriptions → archelier → Cancel
- 운영자 처리: RC dashboard → Customer 검색 → ⋯ → Cancel / Refund
- 둘 다 webhook → Firestore 동기화

---

## 10. 다음 라운드 — Sprint C (참고)
- FCM 푸시 알림 (디자인 완료 / 좋아요 / 주간 다이제스트)
- Service Worker 웹 푸시 (현재 PWA precache 만 활성)

자세한 건 `SPRINT_A_LOG.md` §6.

---

## 11. 트러블슈팅 빠른 참조

전체 카탈로그는 `REVENUECAT_SETUP.md` §11-9 + `SPRINT_A_LOG.md` Sprint B 1·2·3차 함정 섹션. 자주 만나는 것만:

| 증상 | 해결 위치 |
|---|---|
| 결제 안 됨 (`Invalid API Key`) | RC SDK key 회전 확인 — RC dashboard → Project settings → API keys |
| Google Sign-In `NoCredentialException` (sideload) | debug SHA-1 미등록 — `~/.android/debug.keystore` 의 현재 SHA-1 Firebase 에 추가 |
| Google Sign-In `NoCredentialException` (Play Store install) | Play App Signing SHA-1 미등록 — Play Console → App integrity 에서 복사 → Firebase 에 추가 |
| Upgrade 가 Chrome 으로 빠짐 (Android) | UI gating 이 `isIOS()` — `isNativeApp()` 으로 교체 |
| `ITEM_UNAVAILABLE` 결제 거부 | sideload APK 로 결제 시도 — Play Store internal track 로 install 해야 |
| RC `Permissions to call subscriptions API ❌` | Play Console 권한 — `View financial data` + `Manage orders and subscriptions` 둘 다 필수 |

---

작성: 2026-05-21. archelier `1.0.2` 출시 시점 기준. RC API key 회전 / Play App Signing 함정 / UI gating 함정 모두 포함.
