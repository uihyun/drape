# iOS Build → TestFlight Guide

Sprint A 8단계. 첫 TestFlight 빌드 (IAP 없는 무료 체험 한정 버전) 띄우는 절차.

---

## 사전 점검

- [ ] Apple Developer Program 가입 + Account Holder 권한 (확인됨, Team ID `WG75TG59NJ`)
- [ ] App ID `com.voda.app` 에 다음 capability 활성화 (https://developer.apple.com/account/resources/identifiers/list):
  - [x] Sign In with Apple
  - [ ] **Associated Domains** ← 6단계 완료 시 켜놓으세요. 안 켜져 있으면 Universal Links 검증 실패
- [ ] App Store Connect 에서 앱 생성 (https://appstoreconnect.apple.com/apps):
  - **+** → **New App**
  - Platform: iOS
  - Name: `Voda` (또는 「Voda — AI Interior Design」)
  - Primary Language: English (or Korean)
  - Bundle ID: `com.voda.app` (드롭다운에 나옴)
  - SKU: `voda-ios-1` (내부 식별용, 임의 문자열)
  - User Access: Full Access
  - Create

---

## 1) Xcode 열기

터미널에서:

```bash
npm run cap:open:ios
```

→ Xcode 가 `ios/App/App.xcworkspace` 를 열어요.

### 처음 열 때 — 「Update to recommended settings」

Capacitor 가 만든 프로젝트가 Xcode 8 compatibility 형식이라, 첫 오픈 시 자동으로 다이얼로그가 떠:

> Asset Catalog / Build Settings / Localization / Project Settings 등 체크박스 + **Perform Changes** 버튼

체크된 항목 그대로 두고 **Perform Changes** 클릭. 우상단 ⚠️ 1 경고가 사라짐.

⚠️ **그 직후 한 가지 더**: 「Perform Changes」 가 켠 **User Script Sandboxing** 이 CocoaPods 와 충돌해 Archive 시 「Sandbox: bash deny ... Pods-App-frameworks.sh」 에러 발생. Build Settings > User Script Sandboxing **NO** 로 (Debug+Release 둘 다) 또는:

```bash
sed -i '' 's/ENABLE_USER_SCRIPT_SANDBOXING = YES;/ENABLE_USER_SCRIPT_SANDBOXING = NO;/g' ios/App/App.xcodeproj/project.pbxproj
```

자세한 배경은 `CAPACITOR_SETUP.md` §2-3.

---

## 2) Signing & Capabilities

좌측 Project Navigator 의 **App** (가장 위 파란 아이콘) 클릭 → 가운데 **TARGETS > App** 선택 → 상단 탭에서 **Signing & Capabilities**:

- ☑ **Automatically manage signing**
- **Team**: `Uihyun Kim (WG75TG59NJ)` 선택
- **Bundle Identifier**: `com.voda.app` (이미 박혀있음)
- 아래 capability 목록에 다음이 보여야 해요 (entitlement 파일에서 자동 인식):
  - **Sign In with Apple**
  - **Associated Domains** — `applinks:voda-7647c.web.app` + `applinks:voda-7647c.firebaseapp.com`

→ 빨간 에러 (provisioning profile 없음) 가 뜨면 Xcode 가 자동 생성하면서 사라질 때까지 기다리세요. 안 되면 **Try Again** 클릭.

---

## 3) Build Number / Version 확인

같은 화면 위쪽 **General** 탭:

- **Version**: `1.0`
- **Build**: `1` (TestFlight 에 새 빌드 올릴 때마다 +1 해야 함 — 같은 번호로 두 번 못 올림)
- **Display Name**: `archelier` (Info.plist 에서 갱신됨, 영문 폴백)
- **Minimum Deployments → iOS 15.0** (이미 설정됨)

---

## 3-1) Localizations 등록 (옵션)

> 2026-05-06 정책 변경: **글로벌 단일 브랜드 `archelier`** 채택. 모든 시장 디스플레이명 단일. 따라서 디스플레이명 분리를 위한 Localizations 등록은 **필수가 아님**. 아래 작업은 미래에 다른 `Info.plist` 키 (예: 권한 안내 문구) 를 locale별 번역하고 싶을 때 한 번 해두면 됩니다.

좌측 Project Navigator 의 **App** (파란 아이콘) 클릭 → 가운데 **PROJECT > App** (TARGETS 가 아니라 그 위 PROJECT 쪽) 선택 → 상단 **Info** 탭 → 하단 **Localizations** 섹션:

1. **+** 버튼 → **Korean (ko)** 추가. "Choose files and reference language" 다이얼로그에서 그대로 **Finish** (이미 `App/ko.lproj/InfoPlist.strings` 가 디스크에 있어 자동 인식됨).
2. **+** 버튼 → **Japanese (ja)** 추가. 마찬가지로 **Finish**.
3. 좌측 Project Navigator 에서 `App > InfoPlist.strings` 가 variant group (▶ 펴면 en/ko/ja 3개) 으로 묶여 보이면 등록 완료.

> 등록이 끝나면 Xcode 가 `project.pbxproj` 에 자동으로 PBXVariantGroup, PBXFileReference, PBXBuildFile, Resources phase 항목을 추가합니다. 한 번 등록되면 그 뒤로는 `*.lproj/InfoPlist.strings` 내용만 편집해도 빌드에 자동 반영됩니다.

지금은 ko / ja 의 `InfoPlist.strings` 가 모두 `CFBundleDisplayName = "archelier"` 로 영문 폴백과 동일해 등록해도 표면적으로 변화가 보이지 않습니다. 등록 안 하면 단순히 Info.plist 의 단일 `CFBundleDisplayName = "archelier"` 로 동작.

---

## 4) 디바이스 / 시뮬레이터 빠른 확인 (선택)

상단 툴바에서 시뮬레이터 (예: `iPhone 16 Pro`) 선택 → **▶ (Run)** 클릭. 시뮬레이터에 앱이 뜨면 다음 동작 확인:

- [ ] 앱 시작 → 베이지 splash → letter-by-letter "archelier" reveal → 골드 라인 draw → fade out → 홈 (~2.6s)
- [ ] Sign In 모달 → Apple 버튼 → Sign in with Apple 시트
- [ ] 디자인 생성 (게스트 크레딧 사용)
- [ ] 결과 화면 → 공유 버튼 → iOS share 시트
- [ ] 다운로드 → share 시트 「이미지 저장」 → 사진 앱에 저장 (시뮬레이터의 Photos 앱 확인)
- [ ] Header 에 「Pricing」 메뉴 **안 보임** (iOS 정책)
- [ ] `/pricing` 직접 접근해도 홈으로 리디렉트 (iOS 정책)

⚠️ 시뮬레이터의 Sign in with Apple 은 가끔 안 됨 — 실기 또는 TestFlight 단계에서 다시 확인.

---

## 4-2) App Store Connect 에 앱 등록 (한 번만, Archive 전에 필수)

⚠️ **Archive 업로드 전에 반드시 App Store Connect 에 앱이 등록되어 있어야 함**. Bundle ID 매칭 실패 시 업로드가 reject 됨.

1. https://appstoreconnect.apple.com/apps 접속 → 좌상단 **+** → **New App**
2. 다이얼로그 입력:
   - **Platforms**: ☑ iOS (macOS / tvOS 체크 X)
   - **Name**: `archelier` (App Store 디스플레이명 — 30자, 모든 시장 동일)
   - **Primary Language**: English (U.S.)
   - **Bundle ID**: `com.voda.app` (드롭다운에서 선택. 안 보이면 https://developer.apple.com/account/resources/identifiers 에서 먼저 등록 필요)
   - **SKU**: `archelier-ios` (자유 — 본인 식별용, 한 번 정하면 변경 불가)
   - **User Access**: Full Access (default)
3. **Create** 클릭
4. 생성된 앱 페이지의 좌측 메뉴 **App Information** :
   - **Subtitle**: `Your architect's atelier.` (선택, 30자)
   - **Categories**: Primary `Lifestyle` / Secondary `Graphics & Design`
   - **Content Rights**: ☑ "본인이 권리 보유" 또는 라이센스 확인
   - **Localizable Information** 의 `Name` 은 모든 locale 에서 `archelier` 단일로 유지 (글로벌 단일 브랜드 정책)
5. (선택) 좌측 **Pricing and Availability**:
   - Price: Free
   - Availability: All countries (또는 한·일·미 우선)

> 출시용 메타데이터 (스크린샷, Description, Keywords) 는 지금 다 채울 필요 없음. Build 업로드 후 TestFlight 처리하면서 천천히 채워도 됨. `store-metadata.md` 의 EN / KO / JA 텍스트 그대로 복사·붙여넣기.

---

## 5) Archive (제출용 빌드)

상단 툴바에서 **「Any iOS Device (arm64)」** 선택 (시뮬레이터 X).

상단 메뉴 → **Product** → **Archive**

빌드 5-10분. 끝나면 자동으로 **Organizer** 창이 뜸.

⚠️ 빌드 실패 시 자주 보이는 원인:
- Provisioning profile 충돌 → Signing & Capabilities 의 「Try Again」
- Capability mismatch → Apple Developer Console 의 App ID capability 가 entitlement 파일과 맞는지 확인

---

## 6) Distribute App → App Store Connect 업로드

Organizer 창에서 방금 만든 archive 선택 → 우측 **Distribute App** 클릭

1. Distribution method: **App Store Connect** ☑ → Next
2. Destination: **Upload** ☑ → Next
3. Distribution options:
   - ☑ **Strip Swift symbols** (default — 바이너리 사이즈 줄임)
   - ☑ **Upload your app's symbols** (default — Crash report 가독성 위해)
   - ☐ **Manage Version and Build Number** (끄기 — Xcode `General` 탭에 직접 설정한 1.0 / 1 그대로 사용. 켜면 Apple 이 자동 증가)
   - Next
4. Re-sign options: **Automatically manage signing** ☑ → Next (provisioning profile 자동 생성·갱신)
5. Review 화면 — Bundle ID / Version / Build / 사이즈 확인
6. **Upload** 클릭

업로드 1-5분. 「Upload Successful」 뜨면 Done. (이때 archive 의 Status 가 「Uploaded」 로 바뀜.)

⚠️ 흔한 실패:
- **Invalid Bundle ID** — App Store Connect 에 같은 Bundle ID 앱이 등록 안 됐음 → § 4-2 다시 확인
- **Provisioning profile 충돌** — Re-sign options 에서 Manual 로 바꿨다가 다시 Automatic 으로
- **App Store Connect 인증 실패** — Xcode → Settings → Accounts 에서 Apple ID 다시 로그인

---

## 7) App Store Connect 에서 TestFlight 처리

https://appstoreconnect.apple.com/apps → archelier → 상단 **TestFlight** 탭

- 방금 올린 빌드가 「Processing」 상태로 약 10-30분 후 「Ready to Submit」 으로 변경됨
- 빌드 행 클릭 → **Compliance** 질문에 답:
  - Encryption: 「No」 (HTTPS 만 쓴다면 일반적으로 No, 다만 「Standard encryption that's exempt」 옵션도 안전)
  - 또는 Info.plist 에 `ITSAppUsesNonExemptEncryption = false` 추가하면 매번 안 물음

- 좌측 **Internal Testing** → **+** → 「App Store Connect Users」 그룹 추가:
  - 본인 (Account Holder) 자동 포함
  - 추가로 테스터 추가 가능 (App Store Connect User 권한 필요, 별도 무료)
  - 빌드 선택 → 활성화

- 본인 iPhone 의 **TestFlight 앱** (없으면 App Store 에서 설치) 으로 같은 Apple ID 로 로그인 → archelier 빌드 발견 → **Install**

---

## 8) 실기 테스트 체크리스트

본인 iPhone 에서 TestFlight 로 설치한 archelier 로 다음 확인:

- [ ] 홈 화면 앱 라벨 = **archelier**
- [ ] 앱 cold start → 베이지 splash → letter-by-letter "archelier" reveal → 골드 라인 → 홈 (~2.6s)
- [ ] **Sign in with Apple** — 본인 Apple ID 로 로그인 → 홈 복귀
- [ ] 사진 업로드 (사진 앱 권한 허용 다이얼로그 — 문구가 "archelier uses…" 로 나와야 함)
- [ ] 디자인 생성 → 결과 화면
- [ ] **공유 버튼** → 카톡 / 메시지 / AirDrop 시트
- [ ] **이미지 다운로드** → share 시트 「이미지 저장」 → 사진 앱에 저장 확인 + 우측 하단 "Made with archelier" 워터마크
- [ ] **Universal Links** — Safari 에서 https://voda-7647c.web.app/s/<디자인id> 입력 → 「archelier 로 열기」 배너가 떠야 함
- [ ] Header / 어디에도 **Pricing 버튼 없음** (iOS 정책)
- [ ] 크레딧 0 상태에서 Insufficient credits 메시지에 「Come back tomorrow」 만 노출 (외부 결제 안내 X)
- [ ] 언어 스위처 (Header) → English / 한국어 / 日本語 3개 노출, 전환 시 UI 즉시 바뀜
- [ ] **Account 페이지** → 이름 / 핸들 / 소개 3단 편집 가능. 이름 저장 후 새 댓글 작성자에 반영
- [ ] Account 페이지 하단 → **Support** 링크 → mailto hello@uhzlab.com 페이지

---

## 9) 다음 단계

- **IAP 통합** — `REVENUECAT_SETUP.md` (SDK / webhook / sandbox 테스트)
- **App Store 정식 제출** — `APP_STORE_SUBMISSION.md` (버전 메타데이터 / 첫 구독 attach / 심사 제출. 구독 그룹 현지화 같은 함정 포함)

---

## 트러블슈팅

| 증상 | 원인 / 조치 |
|------|------|
| Archive 메뉴가 회색 | 빌드 타겟이 시뮬레이터로 되어있음 → 「Any iOS Device」 선택 |
| Apple ID 로그인 실패 | Service ID `com.voda.app.signin` 의 Domain / Return URL 이 정확한지 Apple Developer 에서 재확인 |
| Universal Links 가 Safari 로 열림 (앱으로 안 옴) | 1) AASA `curl https://voda-7647c.web.app/.well-known/apple-app-site-association` 가 application/json 인지 확인. 2) 앱 첫 설치 후 5-10분 정도 OS 가 AASA 다운로드해서 캐시. 즉시 동작 안 할 수 있음. 3) Settings > Notes 의 다른 앱 링크 테스트하듯 SMS 로 본인에게 링크 보내고 탭해보기 |
| TestFlight 에서 빌드가 「Missing Compliance」 | 빌드 행에서 Encryption 질문 답 (위 7번) |
| TestFlight 빌드가 30분 넘어도 Processing | App Store Connect 의 「Activity」 탭에서 invalidation 메일 확인. 보통 entitlement 미스매치 또는 Privacy Manifest 누락 |
