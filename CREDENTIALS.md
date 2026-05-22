# Credentials / Secrets — 인벤토리

drape (`com.uihyun.drape`, Firebase `drape-9e532`) 운영에 필요한 키 / 토큰 / 서비스 계정의 위치 + 용도 + 회전 절차.

⚠️ **이 문서 자체는 secret 을 포함하지 않음** — 위치와 메타데이터만. 실제 값은 1Password, `.env`, `keys/` 폴더 등 별도 저장소.

> 아래 1~12 섹션은 voda(archelier) 시절 인벤토리 — drape 으로 마이그레이션 진행 중. drape 으로 새로 잡힌 항목은 §D-* 로 prefix.

---

## D-1. drape — Apple Sign-In Key (B)

iOS / 웹 "Sign in with Apple" 토큰 검증을 Firebase Auth 서버가 수행할 때 사용.

| 항목 | 값 |
|---|---|
| 파일명 | `AuthKey_6B39T365UT.p8` |
| 로컬 경로 | `~/Desktop/idea/drape/keys/apple_singin/AuthKey_6B39T365UT.p8` (repo 밖) |
| Key ID | `6B39T365UT` |
| App ID | `com.uihyun.drape` |
| Apple Team ID | `WG75TG59NJ` (Uihyun Kim — voda 와 동일 team) |
| Service ID (웹) | `com.uihyun.drape.signin` |
| 업로드 위치 | Firebase Console → drape-9e532 → Authentication → Sign-in method → Apple |

### Firebase Console 설정 (한 번만)
1. Authentication → Sign-in method → Apple → Enable
2. **Services ID**: 위 Service ID 입력
3. **Apple team ID**: 위 Team ID
4. **Key ID**: `6B39T365UT`
5. **Private key**: `.p8` 파일 내용 통째로 paste (또는 업로드)
6. Save

### Apple Developer Console 설정 (한 번만)
1. **App ID** `com.uihyun.drape` → Edit → "Sign in with Apple" capability 체크 → Save
2. **Identifiers → + → Services IDs** → `com.uihyun.drape.signin` 같은 식으로 생성 → "Sign in with Apple" 체크 → Configure:
   - **Primary App ID**: `com.uihyun.drape`
   - **Domains**: `drape-9e532.firebaseapp.com`
   - **Return URLs**: `https://drape-9e532.firebaseapp.com/__/auth/handler`
3. Save

### Xcode (iOS 네이티브)
- `ios/App/App.xcodeproj` 열기 → App target → Signing & Capabilities → **+ Capability → Sign in with Apple**
- Team 을 본인 Apple Developer team 으로 설정

### 회전
1. Apple Developer → Keys → 새 Key 생성 ("Sign in with Apple" 체크) → 다운로드
2. Firebase Console 의 Apple provider 에서 Private key 교체 + Key ID 업데이트
3. 옛 Key 는 Apple Developer 에서 revoke

→ 코드 변경 불필요. `@capacitor-firebase/authentication` + `@capacitor-community/apple-sign-in` 플러그인이 이미 wired (capacitor.config.json `providers: ['google.com', 'apple.com']`).

---

## 0. 보관 정책

| 민감도 | 보관 위치 | 예시 |
|---|---|---|
| **A — 분실 시 영구 손실** | 외장 SSD + 1Password + 다른 클라우드 (3-tier) | production keystore (.keystore) |
| **B — 재발급 가능하지만 회전 시 영향 큼** | 1Password + 로컬 keys 폴더 (repo 밖) | Apple .p8 키, Google service account JSON |
| **C — 코드 실행에 필요한 public 식별자** | `.env` / `.env.production` (gitignore), 코드 안 const | RC public API keys, Stripe publishable key |
| **D — 서버 사이드만** | Firebase Functions secret manager | RC webhook auth, Stripe secret key |

---

## 1. Android — Production Keystore (A)

archelier 의 release 빌드 서명에 사용. **분실 시 앱 업데이트 영구 불가** (Play App Signing 으로 우회 가능하긴 함).

| 항목 | 값 |
|---|---|
| 파일명 | `archelier-upload.keystore` |
| 로컬 경로 | `~/Desktop/idea/voda/keys/playstore_rc/archelier-upload.keystore` (repo 밖) |
| Alias | `archelier-upload` |
| CN / O | Uihyun Kim / uhz LLC |
| SHA-1 | `4F:27:AE:05:8D:7D:5C:0D:53:20:B3:EE:D1:69:1B:AD:2F:44:F5:DE` |
| 유효기간 | 2056-05-11 (~30년) |
| 백업 1 | 외장 SSD |
| 백업 2 | 1Password (파일 첨부) |
| 백업 3 | 다른 클라우드 (본인 외 접근 불가 폴더) |
| 비밀번호 | 1Password 항목 "archelier-upload.keystore" |

### Gradle 연결
`~/.gradle/gradle.properties` (repo 밖, user-global):
```properties
ARCHELIER_UPLOAD_STORE_FILE=/Users/uihyun/Desktop/idea/voda/keys/playstore_rc/archelier-upload.keystore
ARCHELIER_UPLOAD_STORE_PASSWORD=********
ARCHELIER_UPLOAD_KEY_ALIAS=archelier-upload
ARCHELIER_UPLOAD_KEY_PASSWORD=********
```

`android/app/build.gradle` 의 `signingConfigs.release` 가 이 properties 를 자동 읽음.

### 회전 절차
upload key 는 회전 가능 (Play App Signing 가입 상태). Play Console → App integrity → "Upload a new upload key" 통해 신청 → 새 .keystore 만들고 Google 에 인증서 제출 → Google 승인 (1-2일) → 새 keystore 로 재서명.

---

## 2. Android — Debug Keystore (B)

로컬 빌드 (Android Studio Run) 용. 분실해도 다시 만들 수 있지만, Firebase Console 의 SHA-1 등록을 또 해야 함.

| 항목 | 값 |
|---|---|
| 경로 | `~/.android/debug.keystore` |
| Alias | `androiddebugkey` |
| 비밀번호 | `android` (Android Studio 표준) |
| 현재 SHA-1 | `54:85:87:6C:29:E5:F8:82:75:1F:21:64:0F:EF:79:9B:BE:09:F7:D6` |
| 옛 SHA-1 (이전 머신) | `0F:4E:E6:00:5A:8C:86:B1:8E:99:3B:B6:F8:B5:63:5E:51:58:B8:29` |

### 회전 후 작업
1. SHA-1 추출 — `keytool -keystore ~/.android/debug.keystore -list -v -alias androiddebugkey -storepass android -keypass android | grep SHA1`
2. Firebase Console → archelier Android 앱 → Add fingerprint
3. google-services.json 재다운로드 → `android/app/google-services.json` 덮어쓰기
4. .aab / .apk 재빌드 → 다시 install

★ 함정: Android Studio 가 머신 이동/업데이트 시 debug.keystore 자동 재생성. SHA-1 바뀌면 즉시 NoCredentialException — 위 절차 다시.

---

## 3. Android — Play App Signing Key (A, Google 관리)

Play Store 가 디바이스에 배포할 때 사용하는 실제 서명 키. **Google 이 관리** — 우리는 SHA-1 만 알면 됨.

| 항목 | 값 |
|---|---|
| SHA-1 | `E6:65:BF:71:B1:3D:35:DB:71:F9:70:54:8F:CF:6F:BF:AA:57:CA:95` |
| 위치 (확인용) | Play Console → archelier → Test and release → App integrity → App signing key certificate |

### 사용처
- Firebase Console 의 archelier Android 앱에 SHA-1 등록 (Google Sign-In 동작)
- google-services.json 의 `certificate_hash` 에 포함 (`e665bf71...`)

### 회전 절차
권장 안 됨 — Play Console 통해 신청 가능하지만 Google 검토 + 1-2일 + 모든 기존 사용자 영향. 대신 upload key 회전 (§1) 으로 해결.

---

## 4. Firebase — google-services.json (B)

Android 앱이 Firebase services (Auth, Firestore, Storage, Analytics, Messaging) 접근하는 데 사용.

| 항목 | 값 |
|---|---|
| 경로 | `android/app/google-services.json` (commit 됨) |
| 다운로드 | https://console.firebase.google.com/project/voda-7647c/settings/general |
| 포함 SHA-1 | 4개 — 옛 debug / 현재 debug / release upload / Play App Signing |
| 포함된 OAuth client | Android (`client_type:1`) × N + Web (`client_type:3`) |

### 왜 commit 했나
google-services.json 의 모든 값은 **Firebase Console 에서 공개 조회 가능한 식별자**. secret 이 아니라 client-side config. iOS 의 GoogleService-Info.plist 와 동일 정책.

### 회전 시점
- 새 SHA-1 추가 시 (debug keystore 재생성, release keystore 생성, Play App Signing 활성, 팀원 추가)
- 새 OAuth client 추가 시 (다른 platform)
- 새 Firebase service enable 시 (FCM, AppCheck 등)

### iOS 측 대응 파일
`ios/App/App/GoogleService-Info.plist` (commit 됨, 같은 정책).

---

## 5. RevenueCat — SDK Public API Keys (C)

클라이언트 SDK 가 RC 서버에 요청 보낼 때 사용. **public** (브라우저/앱 번들에 노출되어도 OK).

| Platform | 키 | 위치 |
|---|---|---|
| iOS | `appl_fOINOQNHcWWZxmgWdkGmGnMCIUB` | `.env*` 의 `VITE_REVENUECAT_PUBLIC_KEY_IOS` |
| Android | `goog_msjftThipbxhWWLnkALnYaKmZID` | `.env*` 의 `VITE_REVENUECAT_PUBLIC_KEY_ANDROID` |
| Web (test) | `test_taHlCUlwUIMdXbMnkNkmMRxHDPG` | fallback (사용 안 함) |

### 회전 시점
- RC dashboard 에서 **Apps & providers** 의 App Store / Play Store config 를 **재생성** 하면 동반 회전됨
- 의도적 보안 회전 (드물게)

### 회전 후 작업
1. RC dashboard → Project settings → API keys 에서 새 값 복사
2. `.env` + `.env.production` 의 `VITE_REVENUECAT_PUBLIC_KEY_<PLATFORM>` 갱신
3. 클라이언트 재빌드 (.aab / iOS archive)
4. 출시 (Production 트랙 + App Store)

★ Sprint B 3차 함정: Play Store config 재설정 중에 키가 회전됐는데 `.env` 안 갱신해서 `Invalid API Key` 에러. 

---

## 6. RevenueCat — Webhook Auth Secret (D)

RC → 우리 Firebase Function (`revenueCatWebhook`) 호출 시 인증 헤더. random secret.

| 항목 | 값 |
|---|---|
| 저장 위치 (서버) | Firebase Functions secret: `REVENUECAT_WEBHOOK_AUTH` |
| 등록 명령 | `firebase functions:secrets:set REVENUECAT_WEBHOOK_AUTH --project voda-7647c` |
| RC 측 등록 | RC dashboard → Project → Integrations → Webhooks → Authorization header value |
| 인증 방식 | Function 이 `Authorization` 헤더를 secret 과 `===` 비교, 불일치 → 401 |

### 회전 절차
1. 새 random string 생성 (e.g., `openssl rand -hex 32`)
2. Firebase: `firebase functions:secrets:set REVENUECAT_WEBHOOK_AUTH`
3. Functions 재배포: `firebase deploy --only functions:revenueCatWebhook`
4. RC dashboard → Webhook config → Authorization 값 갱신
5. RC dashboard → Webhooks → Send test event → 200 OK 확인

→ 회전 중 down time 1-2분 (재배포 시간) — 결제 webhook 일시 실패 가능 (RC 가 자동 재시도하니 실제 손실 없음).

---

## 7. Stripe — Web 결제 (D)

Web 환경의 결제 (모바일은 RC 통해 IAP). archelier 출시 1.0 시점에 web 결제 노출 안 함 → Stripe 키는 코드에 남아있지만 비활성.

| 항목 | 값 |
|---|---|
| Publishable key (public, C) | `.env*` 의 `VITE_STRIPE_PUBLISHABLE_KEY` |
| Secret key (D) | Firebase Functions secret: `STRIPE_SECRET_KEY` |
| Webhook signing secret (D) | Firebase Functions secret: `STRIPE_WEBHOOK_SECRET` |

### 회전
Stripe dashboard → Developers → API keys 에서 회전. 회전 후 Firebase secrets + .env 갱신 + Functions 재배포.

---

## 8. Apple — In-App Purchase P8 Key (B)

iOS 결제 (StoreKit 2) 와 RC 의 product 검증에 사용. ASC → 사용자 및 액세스 → 통합 → 앱 내 구입 에서 발급.

| 항목 | 값 |
|---|---|
| 파일명 | `SubscriptionKey_D5U4FUVTFT.p8` |
| 로컬 경로 | `~/Desktop/idea/voda/keys/appstore_rc/SubscriptionKey_D5U4FUVTFT.p8` |
| Key ID | `D5U4FUVTFT` |
| Issuer ID | `69a6de89-cba1-47e3-e053-5b8c7c11a4d1` |
| 업로드 위치 | RC dashboard → Apps & providers → archelier App Store → In-App Purchase Key Configuration |
| 만료 | 만료 없음 (revoke 만 가능) |

### 회전
ASC 에서 새 key 발급 → P8 다운로드 (1회만 가능) → 안전 보관 → RC 에 업로드 (기존 key 자동 교체) → 옛 key revoke.

---

## 9. Apple — App Store Connect API P8 Key (B)

RC 가 ASC 의 product / price / availability metadata 조회하는 데 사용. ASC → 사용자 및 액세스 → 통합 → App Store Connect API.

| 항목 | 값 |
|---|---|
| 파일명 | `AuthKey_<KEYID>.p8` |
| 로컬 경로 | `~/Desktop/idea/voda/keys/appstore_rc_asc_api/AuthKey_*.p8` |
| Key ID | (Apple 에서 발급 시 표시) |
| Issuer ID | (ASC 의 Integration 페이지에 표시) |
| 업로드 위치 | RC dashboard → Apps & providers → archelier App Store → App Store Connect API |
| Role | Developer 또는 App Manager (read-only 면 충분) |

### 회전
ASC 에서 새 key 생성 → 다운로드 → RC 업로드 → 옛 key revoke.

---

## 10. Apple — Push Notification P8 (참고, 미사용)

iOS push 용. Sprint C 에서 활성.

| 항목 | 값 |
|---|---|
| 파일명 | `AuthKey_G3Q44RRZ7R.p8` (이전 작업) |
| 로컬 경로 | `~/Desktop/idea/voda/keys/apple_signin/` |
| 사용처 | Firebase Console → Cloud Messaging → APNs Authentication Key |

→ 현재 미사용. Sprint C 에서 활성화.

---

## 11. Google Cloud — RevenueCat Service Account (B)

RC 가 Google Play Developer API 호출 (구독 검증, 환불, cancel) 에 사용.

| 항목 | 값 |
|---|---|
| 이메일 | `archelier-revenuecat@voda-7647c.iam.gserviceaccount.com` |
| Cloud Console | https://console.cloud.google.com/iam-admin/serviceaccounts?project=voda-7647c |
| JSON 키 파일 | `voda-7647c-b76fe1bda6d3.json` |
| 로컬 경로 | `~/Desktop/idea/voda/keys/playstore_rc/voda-7647c-*.json` |
| Key ID | `b76fe1bda6d3ccc3a3e00d8caf...` |
| 업로드 위치 | RC dashboard → Apps & providers → archelier Play Store → Service Account Credentials JSON |
| Cloud IAM role | `Pub/Sub Admin` (real-time notifications 용) |
| Play Console 권한 | View app information / View financial data / Manage orders and subscriptions / View store performance |

### 회전
1. Cloud Console → service account → KEYS → ADD KEY → JSON → 다운로드
2. RC dashboard 에서 새 JSON 으로 Replace + Save
3. 옛 KEY → Cloud Console 에서 disable / delete (선택)

→ Play Console 권한 / Cloud IAM role 은 그대로. 키만 회전.

---

## 12. Firebase — Functions Secrets 전체 목록

서버 사이드 시크릿 (Cloud Functions 가 사용). Firebase Functions Secret Manager 에 저장.

| Secret 이름 | 용도 | 등록 명령 |
|---|---|---|
| `REVENUECAT_WEBHOOK_AUTH` | RC webhook 인증 (§6) | `firebase functions:secrets:set REVENUECAT_WEBHOOK_AUTH` |
| `STRIPE_SECRET_KEY` | Stripe API 호출 (§7) | `firebase functions:secrets:set STRIPE_SECRET_KEY` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook 검증 (§7) | `firebase functions:secrets:set STRIPE_WEBHOOK_SECRET` |
| `GEMINI_API_KEY` (있다면) | Gemini API 호출 | `firebase functions:secrets:set GEMINI_API_KEY` |

목록 확인: `firebase functions:secrets:access --project voda-7647c`

---

## 13. 환경변수 — .env\* 파일들

| 파일 | git 추적 | 용도 |
|---|---|---|
| `.env` | gitignore | 로컬 개발 (`vite dev`) |
| `.env.production` | gitignore | 빌드 (`npm run build`) — production 출시 .aab / iOS archive |
| `.env.local` | gitignore | 개인용 override (있으면) |
| `.env.development` | gitignore | (사용 안 함) |

각 파일에 들어가는 값 (위 섹션 cross-reference):
- `VITE_REVENUECAT_PUBLIC_KEY_IOS` — §5
- `VITE_REVENUECAT_PUBLIC_KEY_ANDROID` — §5
- `VITE_STRIPE_PUBLISHABLE_KEY` — §7
- `VITE_FIREBASE_API_KEY` 등 Firebase web config — public, gitignore 안 해도 무방하지만 관행상 .env 에

---

## 14. 새 머신 셋업 시 체크리스트

새 노트북 / 새 팀원 합류 시 받아야 할 것:

### 필수 (없으면 빌드 불가)
- [ ] `archelier-upload.keystore` + 비밀번호 (1Password → 새 머신 1Password)
- [ ] `~/.gradle/gradle.properties` 의 4개 ARCHELIER_UPLOAD_* properties
- [ ] `.env` + `.env.production` 파일 (1Password Secure Note 또는 secure transfer)
- [ ] Google Cloud service account JSON (`voda-7647c-*.json`) → `keys/playstore_rc/`
- [ ] Apple P8 키 두 개 (`SubscriptionKey_*.p8`, `AuthKey_*.p8`) → `keys/appstore_rc*/`

### 권한 (계정 단위)
- [ ] Apple Developer Program 멤버 (uhz LLC team)
- [ ] App Store Connect 사용자 추가 (developer / app manager role)
- [ ] Google Play Console 사용자 추가 (developer / admin role)
- [ ] Firebase Console IAM 추가 (`uihyunkei@gmail.com` 이 owner)
- [ ] Google Cloud IAM 추가 (위와 동일)
- [ ] RevenueCat dashboard 사용자 초대
- [ ] Stripe dashboard 사용자 초대

### Setup
- [ ] Xcode + Capacitor 의존성 (`CAPACITOR_SETUP.md`)
- [ ] Android Studio + JDK + SDK
- [ ] Firebase CLI (`npm i -g firebase-tools`) + `firebase login`
- [ ] `~/.android/debug.keystore` 의 SHA-1 Firebase Console 에 추가

---

## 15. 분실 / 노출 대응

### 분실
| 항목 | 영향 | 대응 |
|---|---|---|
| Production keystore | 앱 업데이트 불가 (Play App Signing 가입 시 Google 통해 재발급) | Play Console → App integrity → Upload key reset 신청 (1-2일) |
| Debug keystore | 로컬 개발 일시 중단 | 새로 만들고 SHA-1 Firebase 에 추가 |
| Google Cloud service account JSON | RC ↔ Play Billing 검증 일시 중단 | Cloud Console 에서 키 회전 (§11) |
| Apple P8 키 | iOS 결제 검증 일시 중단 | ASC 에서 재발급 (§8) |
| Firebase Functions secret | 해당 기능 동작 안 함 | secret 재설정 + Functions 재배포 (§6) |

### 노출 (git commit, Slack, 외부 유출 등)
**즉시 회전 + 옛 키 revoke**. 위 §의 회전 절차 참조. git 노출의 경우:
1. 옛 키 즉시 revoke (외부 attacker 가 사용 못 하게)
2. 새 키로 회전
3. `.env*` 의 gitignore 재확인 (혹시 빠진 게 있나)
4. `git filter-repo` 로 commit 히스토리에서 삭제 (선택, public repo 면 필수)

---

작성: 2026-05-21. archelier 1.0.2 출시 시점 기준 모든 secret 인벤토리. 회전 / 분실 시 이 문서 다시 보면서 절차 따라가면 됨.
