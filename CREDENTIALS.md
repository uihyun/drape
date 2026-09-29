# Credentials / Secrets — 인벤토리

drape (`com.uihyun.drape`, Firebase `drape-9e532`) 운영에 필요한 키 / 토큰 / 서비스 계정의 위치 + 용도 + 회전 절차.

⚠️ **이 문서 자체는 secret 을 포함하지 않음** — 위치와 메타데이터만. 실제 값은 1Password, `.env`, `~/Desktop/idea/drape/keys/` 등 repo 밖 저장소.

결제 (IAP / RevenueCat / Stripe) 는 drape 에 없음 — 그래서 관련 키도 없음. 붙이게 되면 여기에 섹션 추가.

---

## 0. 보관 정책

| 민감도 | 보관 위치 | 예시 |
|---|---|---|
| **A — 분실 시 영구 손실** | 외장 SSD + 1Password + 다른 클라우드 (3-tier) | Android upload keystore |
| **B — 재발급 가능하지만 회전 시 영향 큼** | 1Password + `~/Desktop/idea/drape/keys/` (repo 밖) | Apple .p8 키 |
| **C — 코드 실행에 필요한 public 식별자** | `.env` / `.env.production` (gitignore), 코드 안 const | Firebase web config |
| **D — 서버 사이드만** | Firebase Functions secret manager | `GEMINI_API_KEY` |

---

## 1. Apple — Sign in with Apple Key (B)

iOS / 웹 "Sign in with Apple" 토큰 검증을 Firebase Auth 서버가 수행할 때 사용.

| 항목 | 값 |
|---|---|
| 파일명 | `AuthKey_6B39T365UT.p8` |
| 로컬 경로 | `~/Desktop/idea/drape/keys/apple_singin/AuthKey_6B39T365UT.p8` (repo 밖) |
| Key ID | `6B39T365UT` |
| App ID | `com.uihyun.drape` |
| Apple Team ID | `WG75TG59NJ` |
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
2. **Identifiers → + → Services IDs** → `com.uihyun.drape.signin` 생성 → "Sign in with Apple" 체크 → Configure:
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

## 2. Apple — Push Notification (APNs) Key (B)

iOS 푸시 (DM / 알림 fan-out, `functions/messages.js` → FCM → APNs) 에 사용.

| 항목 | 값 |
|---|---|
| 파일명 | `AuthKey_L2JVATZ6W2.p8` |
| 로컬 경로 | `~/Desktop/idea/drape/keys/apple_push/AuthKey_L2JVATZ6W2.p8` (repo 밖) |
| Key ID | `L2JVATZ6W2` |
| Team ID | `WG75TG59NJ` |
| 업로드 위치 | Firebase Console → drape-9e532 → Project settings → Cloud Messaging → iOS app configuration → APNs Authentication Key |

### 푸시가 실제로 날아가려면 (전부 완료 상태 — 새로 세팅할 때 체크리스트)
- Firebase Console → Project settings → Cloud Messaging → **Cloud Messaging API (V1)** enabled
- APNs 키 (위) 를 Firebase 에 업로드
- Xcode → App target → Signing & Capabilities → **Push Notifications** + **Background Modes → Remote notifications**
- Android: `android/app/google-services.json` (§5) + `com.google.gms.google-services` Gradle plugin 적용
- `npx cap sync ios && npx cap sync android` → **실기기**에서 확인 (시뮬레이터는 푸시 수신 불가): 권한 허용 → 다른 계정에서 DM → 잠금화면 도착 → 탭하면 `/messages/{tid}` 로 딥링크

### 회전
Apple Developer → Keys → 새 APNs 키 생성 → Firebase Cloud Messaging 에 업로드 (기존 교체) → 옛 키 revoke. 코드 변경 불필요.

---

## 3. Android — Upload Keystore (A)

release `.aab` 서명에 사용. **분실 시 같은 upload identity 로 업데이트 불가** (Play App Signing 가입 상태라 Google 통해 upload key reset 은 가능).

| 항목 | 값 |
|---|---|
| 파일명 | `drape-upload.keystore` |
| 로컬 경로 | `~/.android-keystores/drape-upload.keystore` (repo 밖) |
| Alias | 내부 alias 는 옛 이름 `archelier-upload` 그대로 (키 자체가 baseline 에서 이어받은 것 — `.aab` 서명 블록이 `ARCHELIE.RSA` 로 보이는 게 정상) |
| CN / O | Uihyun Kim / uhz LLC |
| SHA-1 | `4F:27:AE:05:8D:7D:5C:0D:53:20:B3:EE:D1:69:1B:AD:2F:44:F5:DE` |
| 유효기간 | 2056-05-11 |
| 백업 | 외장 SSD + 1Password (파일 첨부) + 다른 클라우드 — 옛 `archelier-upload.keystore` 로 백업된 것과 **같은 키** (byte-identical) |

drape 의 모든 Android 릴리스가 이 키로 나갔음. 2026-07-08 에 파일명 / Gradle property 이름만 `ARCHELIER_UPLOAD` → `DRAPE_UPLOAD` 로 변경, 키는 그대로.

### Gradle 연결
`~/.gradle/gradle.properties` (repo 밖, user-global):
```properties
DRAPE_UPLOAD_STORE_FILE=/Users/uihyun/.android-keystores/drape-upload.keystore
DRAPE_UPLOAD_STORE_PASSWORD=********
DRAPE_UPLOAD_KEY_ALIAS=********
DRAPE_UPLOAD_KEY_PASSWORD=********
```

`android/app/build.gradle` 의 `signingConfigs.release` 가 이 properties 를 읽음. 없으면 서명 없이 빌드 (graceful skip).

빌드: `cd android && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew bundleRelease` (shell PATH 에 java 없음 — Android Studio 의 JBR 사용). 결과물: `android/app/build/outputs/bundle/release/app-release.aab`.

### 회전 절차
Play Console → App integrity → "Upload a new upload key" 신청 → 새 .keystore 만들고 인증서 제출 → Google 승인 (1-2일) → 새 keystore 로 서명 + 새 SHA-1 을 Firebase 에 추가 (§5).

---

## 4. Android — Debug Keystore (B)

로컬 빌드 (Android Studio Run) 용. 분실해도 다시 만들 수 있지만 Google Sign-In 을 로컬 빌드에서 쓰려면 SHA-1 을 Firebase 에 등록해야 함.

| 항목 | 값 |
|---|---|
| 경로 | `~/.android/debug.keystore` |
| Alias | `androiddebugkey` |
| 비밀번호 | `android` (Android Studio 표준) |
| 현재 SHA-1 | `54:85:87:6C:29:E5:F8:82:75:1F:21:64:0F:EF:79:9B:BE:09:F7:D6` |

### SHA-1 등록 / 재생성 후 작업
1. SHA-1 추출 — `keytool -keystore ~/.android/debug.keystore -list -v -alias androiddebugkey -storepass android -keypass android | grep SHA1`
2. Firebase Console → drape-9e532 → Android 앱 (`com.uihyun.drape`) → Add fingerprint
3. google-services.json 재다운로드 → `android/app/google-services.json` 덮어쓰기 → `npx cap sync android`
4. 재빌드 → 다시 install

★ 함정: Android Studio 가 머신 이동 / 업데이트 시 debug.keystore 를 자동 재생성. SHA-1 바뀌면 Google 로그인이 즉시 `NoCredentialException` — 위 절차 다시.

---

## 5. Android — Play App Signing Key (A, Google 관리)

Play Store 가 디바이스에 배포할 때 쓰는 실제 서명 키. **Google 이 관리** — 우리는 SHA-1 만 알면 됨.

| 항목 | 값 |
|---|---|
| SHA-1 | `66:60:B1:5D:C0:95:01:DE:C4:CB:F5:76:F7:7E:F4:48:28:E3:9F:D1` (google-services.json 의 두 번째 `certificate_hash`) |
| 확인 위치 | Play Console → drape → Test and release → App integrity → App signing key certificate |

### 사용처
Firebase Android 앱에 SHA-1 등록 — 없으면 Play 로 설치한 production 빌드에서 Google Sign-In 실패 (upload key SHA-1 만으로는 부족: Play 가 자기 키로 재서명함).

### 회전
권장 안 됨 — 모든 기존 사용자 영향. 대신 upload key 회전 (§3) 으로 해결.

---

## 6. Firebase — google-services.json / GoogleService-Info.plist (C)

네이티브 앱이 Firebase (Auth, Firestore, Storage, Analytics, Messaging) 에 붙는 설정.

| 항목 | 값 |
|---|---|
| Android | `android/app/google-services.json` (commit 됨) |
| iOS | `ios/App/App/GoogleService-Info.plist` (commit 됨) |
| 다운로드 | https://console.firebase.google.com/project/drape-9e532/settings/general |
| 등록된 SHA-1 (Android) | upload key (§3) + Play App Signing (§5) |

### 왜 commit 했나
모든 값이 **Firebase Console 에서 공개 조회 가능한 client-side 식별자**. secret 아님.

### 재다운로드 시점
- 새 SHA-1 추가 (debug keystore 재생성, upload key 회전)
- 새 OAuth client / 새 Firebase service enable

---

## 7. Firebase — Functions Secrets

| Secret 이름 | 용도 | 등록 명령 |
|---|---|---|
| `GEMINI_API_KEY` | Gemini API 호출 (`functions/items.js`, `tryon.js`, `stylist.js`) | `firebase functions:secrets:set GEMINI_API_KEY --project drape-9e532` |

Cloud Vision (moderation / face-blur) 과 GA 조회는 API 키 없이 함수의 service account (ADC / impersonation) 로 인증 — secret 없음.

로컬 dev 값은 `.env` (gitignore). 목록 확인: `firebase functions:secrets:access GEMINI_API_KEY --project drape-9e532`

### 회전
Google AI Studio 에서 새 키 발급 → `firebase functions:secrets:set GEMINI_API_KEY` → Functions 재배포 → 옛 키 삭제.

---

## 8. 환경변수 — .env\* 파일들

| 파일 | git 추적 | 용도 |
|---|---|---|
| `.env` | gitignore | 로컬 개발 (`vite dev`) + dev Gemini 키 |
| `.env.production` | gitignore | 빌드 (`npm run build`) — 출시 .aab / iOS archive |

클라이언트가 읽는 값: `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_REGION` 등 Firebase web config — public 이지만 관행상 .env 에.

---

## 9. 새 머신 셋업 시 체크리스트

### 필수 (없으면 빌드 불가)
- [ ] `drape-upload.keystore` → `~/.android-keystores/` + 비밀번호 (1Password)
- [ ] `~/.gradle/gradle.properties` 의 4개 `DRAPE_UPLOAD_*` properties
- [ ] `.env` + `.env.production` (1Password Secure Note 또는 secure transfer)
- [ ] Apple .p8 키 두 개 (§1, §2) → `~/Desktop/idea/drape/keys/`

### 권한 (계정 단위)
- [ ] Apple Developer Program 멤버 (uhz LLC team) + App Store Connect 사용자
- [ ] Google Play Console 사용자
- [ ] Firebase / Google Cloud IAM (`drape-9e532`)

### Setup
- [ ] Xcode + CocoaPods / SPM, Android Studio (JBR 21 포함)
- [ ] Firebase CLI (`npm i -g firebase-tools`) + `firebase login`
- [ ] `~/.android/debug.keystore` SHA-1 을 Firebase 에 추가 (§4, 로컬 빌드에서 Google 로그인 필요할 때만)

---

## 10. 분실 / 노출 대응

### 분실
| 항목 | 영향 | 대응 |
|---|---|---|
| Upload keystore | 새 버전 업로드 불가 | Play Console → App integrity → upload key reset 신청 (1-2일) |
| Debug keystore | 로컬 Google 로그인 불가 | 새로 만들고 SHA-1 Firebase 에 추가 (§4) |
| Apple .p8 키 | 해당 기능 일시 중단 | Apple Developer 에서 재발급 → Firebase 에 재업로드 (§1, §2) |
| `GEMINI_API_KEY` | AI 기능 (태깅 / try-on / stylist) 중단 | 새 키 → secret 재설정 + Functions 재배포 (§7) |

### 노출 (git commit, 외부 유출 등)
**즉시 회전 + 옛 키 revoke**. 위 각 섹션의 회전 절차 참조. git 노출이면:
1. 옛 키 즉시 revoke
2. 새 키로 회전
3. `.env*` 의 gitignore 재확인
4. `git filter-repo` 로 commit 히스토리에서 삭제 (선택, public repo 면 필수)
