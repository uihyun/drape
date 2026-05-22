# App Store 출시 후 운영 가이드

archelier 1.0 출시 (2026-05-15) 이후의 운영서. 무엇을 어디서 어떻게 바꾸는지 + 자주 받는 거부 사유 카탈로그. 다음 앱에서도 그대로 참고.

연관 문서:
- `APP_STORE_SUBMISSION.md` — 처음 제출 / 거부 → 재제출 walkthrough
- `IOS_BUILD_GUIDE.md` — Xcode 빌드 / TestFlight 업로드
- `REVENUECAT_SETUP.md` — IAP / 구독 / sandbox 테스트
- `store-metadata.md` — ASC 입력용 텍스트 + App Review 메모 본문

---

## 1. 변경 가능 항목 매트릭스

App Store 출시 후 항목별로 **무엇이 가능한지** + **얼마나 빨리 반영되는지**:

### 1-1. 심사 없이 즉시 반영 (✅ 가장 자유로움)

ASC 에서 수정 + 저장만 → 곧바로 노출 (보통 5분~몇 시간).

| 항목 | 위치 |
|---|---|
| **프로모션 텍스트** (170자) | 버전 페이지 → 프로모션 텍스트 |
| **가격** (구독 / 앱 자체) | 수익화 → 구독 → 가격 / 가격 및 사용 가능 여부 |
| **판매 국가 / 지역** | 가격 및 사용 가능 여부 |
| **사용 가능 여부** (출시 중단 / 일부 지역 제외) | 위 동일 |
| 검색 가시성 | App Privacy / 카테고리 |

### 1-2. 메타데이터 심사 (보통 30분~24시간, 빌드 ❌)

새 빌드 없이 ASC 텍스트만 바꾸고 "심사를 위해 제출". 빠름.

| 항목 | 글자수 |
|---|---|
| **앱 설명** (Description) | 4000자 |
| **앱 이름** (Name) | 30자 |
| **부제목** (Subtitle) | 30자 |
| **키워드** (Keywords) | 100자 (쉼표 구분) |
| **스크린샷** (각 디바이스 크기) | 최소 1장, 최대 10장 |
| **App Preview 비디오** | 최대 3개 (디바이스별) |
| **지원 URL / 마케팅 URL / Privacy Policy URL** | — |
| **구독 표시 이름** (수익화 → 구독 → 현지화) | 30자 |
| **구독 설명** (Description) | **45자** ★ |
| **App Privacy 답변** | — |
| **App Review 정보 메모** | 4000자 |

> ★ 구독 description 은 45자 — 4000자 아님. 자세한 카피는 paywall (RC 템플릿) 에 . 자세한 이력은 `APP_STORE_SUBMISSION.md` §8-4.

### 1-3. 새 빌드 + 심사 필요 (~24-48시간)

코드 변경 들어가는 모든 것:

| 항목 |
|---|
| 앱 기능 추가 / 변경 / 버그 수정 |
| 새 IAP / 구독 추가 (첫 구독은 첫 앱과 함께만 attach 가능 — `APP_STORE_SUBMISSION.md` §3) |
| 새 entitlement (Push, HealthKit, Sign in with Apple 등) |
| 메이저 디자인 변경 |
| Paywall 표시 텍스트 (코드 안에 있는 경우) |
| Privacy / Terms 페이지 본문 변경 (in-app 표시) |

---

## 2. 버전 번호 + 빌드 번호 정책

### 2-1. 두 번호의 차이

- **Marketing Version** (예: `1.0`, `1.0.1`, `1.1`, `2.0`)
  - **의미적**. 사용자가 App Store 에서 보는 버전.
  - SemVer 비슷한 룰: 메이저.마이너.패치
  - 위치: Xcode → App target → General → **Version**
  - 또는 `ios/App/App.xcodeproj/project.pbxproj` 의 `MARKETING_VERSION`

- **Build Number** (예: `1`, `2`, `3`, …)
  - **단조 증가** 필수. ASC 에 같은 빌드 번호 두 번 못 올림.
  - 의미 없음 — 그냥 "몇 번째 archive 인가" 카운터.
  - 위치: Xcode → App target → General → **Build**
  - 또는 `ios/App/App.xcodeproj/project.pbxproj` 의 `CURRENT_PROJECT_VERSION`

### 2-2. 언제 어떻게 올리나

| 변경 유형 | Marketing Version | Build Number |
|---|---|---|
| 버그 수정 / 작은 텍스트 변경 | `1.0` → `1.0.1` | 증가 (예: `3` → `4`) |
| 작은 기능 추가 (UI 다듬기 등) | `1.0` → `1.1` | 증가 |
| 큰 기능 추가 / 메이저 변경 | `1.0` → `2.0` | 증가 |
| 같은 버전 재제출 (거부 회복) | **그대로** (예: `1.0`) | **증가** (예: `2` → `3`) |
| 메타데이터만 변경 | 그대로 | 그대로 (새 빌드 불필요) |

**거부 회복 시점**: Marketing Version 은 그대로 두고 Build Number 만 올림. archelier 의 경우 1.0 (2) 거부 → 1.0 (3) 으로 재제출.

### 2-3. project.pbxproj 직접 수정

Xcode UI 가 가끔 저장 안 되니, 직접 sed 로 바꾸는 게 안전:

```bash
# build number 만 증가 (예: 3 → 4)
sed -i '' 's/CURRENT_PROJECT_VERSION = 3;/CURRENT_PROJECT_VERSION = 4;/g' \
  ios/App/App.xcodeproj/project.pbxproj

# marketing version 변경 (예: 1.0 → 1.0.1)
sed -i '' 's/MARKETING_VERSION = 1.0;/MARKETING_VERSION = 1.0.1;/g' \
  ios/App/App.xcodeproj/project.pbxproj
```

수정 후 Xcode 가 열려있으면 **닫고 다시 열기** (Xcode 파일 캐시 invalidate).

---

## 3. 자주 바꾸는 항목 + 절차

### 3-1. 프로모션 텍스트 (가장 자주, 즉시 반영)

이벤트 / 신규 기능 / 시즌 메시지에 사용. 170자.

1. ASC → archelier → **배포** → 해당 버전 → **프로모션 텍스트** 필드
2. 수정 → 저장
3. 보통 5분~1시간 안에 App Store 페이지에 반영

### 3-2. 스크린샷 갱신 (월~분기 한 번)

UI 메이저 변경 또는 새 기능 강조 시. 메타데이터 심사 (~24시간).

1. 새 스크린샷 준비 (디바이스 크기별: iPhone 6.9", 6.5", iPad 등)
2. ASC → 배포 → 해당 버전 → 스크린샷 슬롯
3. 6.9" 슬롯에 1290×2796 올리면 작은 사이즈 자동 상속. 6.5" 슬롯에 6.9" 올리면 에러.
4. 저장 → "심사를 위해 제출"

### 3-3. 설명 (Description) 변경 (분기 한 번)

새 기능 반영 / ASO 튜닝. 메타데이터 심사.

1. 원본은 `store-metadata.md` 에 유지 — git 으로 변경 이력 추적
2. ASC → 배포 → 설명 필드에 붙여넣기
3. 3개 언어 모두 (ko / ja / en) 일관성 있게 갱신

### 3-4. 키워드 (ASO) 튜닝

App Store 검색 가시성 개선. 100자 / 쉼표 구분. 메타데이터 심사.

- 단어 단수 / 복수 ASC 가 자동 처리 — 둘 다 적을 필요 없음
- 카테고리 이름 적을 필요 없음 (이미 카테고리로 잡힘)
- 경쟁 앱 이름 (트레이드마크 침해) 금지
- archelier 의 경우 도구: ASO 도구 (App Store Analytics 의 검색 인기 키워드)

### 3-5. 가격 변경

수익화 → 구독 → 가격 (또는 앱 자체 가격은 가격 및 사용 가능 여부). 즉시 반영.

- **올릴 때**: 기존 구독자 영향 → "기존 구독자에게 새 가격 적용" 옵션 선택 시 Apple 이 사용자 동의 받음 (안 받으면 가격 묶임).
- **내릴 때**: 즉시 모든 사용자 적용.
- 가격 인상은 **분기에 한 번** 정도가 자연스러움. 너무 잦으면 churn.

### 3-6. 출시 중단 / 일부 지역 제외

- **임시 출시 중단**: 가격 및 사용 가능 여부 → 모든 국가 / 지역 해제
- **버그 수정 전 긴급 중단**: 동일. 보통 1시간 안에 반영.
- **재출시**: 다시 체크 → 저장

---

## 4. 거부 사유 카탈로그 (Apple Review Guidelines)

archelier 가 실제 받은 거 + 흔히 받는 것 예방용. 각 사유별 → 무엇을 요구하나 / 어떻게 대응 / archelier 가 적용한 패턴.

### 4-1. ✅ Guideline 5.1.1(v) — Data Collection and Storage (Account Deletion)

**경험**: 1.0 (2) 거부 (2026-05-15)

**Apple 요구**:
- 계정 생성 가능한 앱은 **앱 내**에서 계정 삭제 제공 필수
- 일시 비활성화 / 외부 사이트 안내만으론 불충분
- 외부 사이트 보낸다면 **삭제 페이지 직링크** 필수 (홈으로 보내고 "여기서 찾으세요" X)
- 확인 단계는 OK (실수 방지). 단 전화 / 이메일 강요는 X (highly-regulated industry 가 아니면)

**archelier 적용 패턴** — Nuclear (Twitter 식, 모든 데이터 영구 삭제):
- 위치: Settings → "Delete Account" (메뉴 끝에)
- 흐름: 확인 모달 (삭제 항목 4개 + active 구독 시 platform-aware 안내) → 즉시 삭제 + signOut
- 백엔드: Cloud Function `deleteAccount` — Firestore (designs / profile / handles / collections / follows / blocks / reports / comments collectionGroup / referralCodes) + Storage (profile + design URLs) + Stripe subscription cancel + Firebase Auth user
- 구현: `functions/account.js` + `src/components/DeleteAccountModal.jsx` + `src/services/auth-service.js#deleteAccount`

**Apple 회신 시 필수**:
- 실 디바이스에서 화면 녹화 (sign in → Settings → Delete Account → 완료)
- App Review 메모에 `ACCOUNT DELETION` 섹션 영구 추가 (`store-metadata.md` 의 본문) → 다음 빌드 5/6/… 에서도 자동 보호막

### 4-2. ✅ Guideline 3.1.2(c) — Subscription Clarity

**경험**: 1.0 (2) 거부 (2026-05-15)

**Apple 요구**:
- 구독이 가격에 대해 **무엇을 받는지** 명확히 기술

**진짜 평가 대상**: **paywall 화면 자체** (RC paywall 의 features list / pricing). ASC 의 45자 description 만으로는 부족.

**archelier 적용 패턴**:
1. **paywall** (RC 템플릿) — Pro 혜택 불릿 + 가격 + 3일 체험 + 취소 경로 명시
2. **ASC 구독 현지화** (45자, ko / ja / en):
   - EN: `Unlimited AI interior designs, no watermark`
   - KO: `무제한 AI 인테리어 디자인, 워터마크 없음`
   - JA: `AIインテリアデザイン無制限・透かしなし`
3. **App Review 메모**의 IN-APP PURCHASE 섹션에 paywall 도달 경로 명시

자세한 내용 `store-metadata.md` 의 "App Review Information Notes" + `APP_STORE_SUBMISSION.md` §8-4.

### 4-3. ⚠️ Guideline 1.2 — Safety / User-Generated Content (예방)

**거의 100% 묻는 가이드라인** (UGC 있는 앱). 사전 대응 필수.

**Apple 요구**:
- 자동 콘텐츠 필터링 (NSFW / 폭력 등)
- 사용자가 **신고** 가능
- 사용자가 다른 사용자를 **차단** 가능
- 신고된 콘텐츠 **24시간 안에** 처리 + 위반 사용자 정지
- 명시적 EULA / Community Guidelines

**archelier 적용 패턴**:
- 자동 필터: Google Gemini safety filters (생성 시점) + `functions/moderation.js` (커스텀 prompt blocklist)
- 신고: 각 디자인 `...` 메뉴 → Report
- 차단: 사용자 프로필 `...` → Block. 차단 사용자 콘텐츠 hide. 관리는 Account → Blocked users
- 24시간 약속: Terms §5 에 명시
- App Review 메모의 USER-GENERATED CONTENT 섹션에 위 내용 정리

### 4-4. ⚠️ Guideline 2.1 — App Completeness (예방)

**자주 받는 거부**. 빌드 자체 안정성.

**흔한 사유**:
- 크래시 / 무한 로딩 / 빈 화면
- TestFlight 디바이스에서 미동작 (Apple 리뷰어 iPad 등)
- 부족한 콘텐츠 (디자인 1~2개만 있는 텅 빈 feed 등)

**예방 패턴**:
- 제출 전 **실 디바이스 + 시뮬레이터 둘 다** 핫리부트 후 cold start 테스트
- 리뷰어가 iPad 사용할 수도 — universal binary 면 iPad 화면 가로 모드까지 확인 (archelier 의 1.0 (2) 거부는 iPad 11-inch M3 에서 검토됨)
- 출시 직전 데모 콘텐츠 / 시드 데이터 미리 채워두기 (텅 빈 feed 거부 회피)

### 4-5. ⚠️ Guideline 4.0 — Design / Minimum Functionality

**흔한 사유**:
- 단순 웹 wrapper (PWA 만으론 거부)
- 기능 부재 / 외부 사이트 링크만 모음
- iOS 디자인 표준 무시 (back button 없음 / native 컴포넌트 아닌 자체 UI 등)

**archelier 위치**: Capacitor wrapper 지만 native API 적극 사용 (Apple Sign-In / Storage / Push 등) → 거부 안 받음. 다만 dev 모드 / 빈 화면 / 미완성 기능 안 보이게 출시 직전 점검.

### 4-6. ⚠️ Guideline 5.1.5 — Location Services

**해당 안 함** (archelier 위치 정보 사용 안 함). 다음 앱에서 위치 쓰면:
- `NSLocationWhenInUseUsageDescription` Info.plist 명시 + 구체적인 이유 ("나만 보기 / 추천을 위해서" 같은 모호한 표현 거부됨)
- Background location 은 더 엄격 — 정말 필요한 경우만

### 4-7. ⚠️ Guideline 4.8 — Sign in with Apple

**규칙**: 다른 third-party sign-in (Google / Facebook 등) 을 제공하면 **Sign in with Apple 도 동등하게 제공 필수**.

**archelier 적용**: Apple Sign-In + Google Sign-In 둘 다 있음. 동일 위치 / 동일 위계.

### 4-8. ⚠️ Guideline 3.1.1 — Payments (다른 결제 수단)

**규칙**: 디지털 상품 / 구독은 **Apple IAP 만**. Stripe / PayPal / 카드 직결제 등 금지.

**archelier 적용**:
- iOS 앱 안에서는 **Apple IAP (RevenueCat 경유) 만**
- 웹 (브라우저) 결제는 Stripe — Apple 정책과 무관 (앱 외부)
- 동일 entitlement 가 cross-platform 으로 인식됨 (RC 가 통합)

---

## 5. 출시 후 자주 묻는 시나리오

### 5-1. "버그 발견 → 핫픽스" 흐름
1. 코드 수정 + 로컬 검증
2. Build number 증가 (예: 1.0 (3) → 1.0 (4))
3. Marketing Version 도 같이 올림 (예: 1.0 → 1.0.1) — 사용자에게 "업데이트 있음" 표시되어 자연스러움
4. Archive → TestFlight → 검증 → 버전 페이지 빌드 교체 → "심사를 위해 제출"
5. 일반적인 24시간 심사 (긴급 시 "긴급 심사 요청" 가능 — 1년 5회 정도 한도)

### 5-2. "급한 메시지 추가" 흐름
새 빌드 안 만들고:
1. ASC → 프로모션 텍스트 변경 → 저장 → 즉시
2. 더 자세한 거면 → 설명 / 키워드 변경 → 메타데이터 심사

### 5-3. "구독 가격 변경" 흐름
1. ASC → 수익화 → 구독 → 가격 변경
2. "기존 구독자에게도 적용" 옵션 선택 시 Apple 이 사용자 동의 받음
3. 즉시 새 사용자에게 적용

### 5-4. "출시 중단 후 다시 출시"
1. 가격 및 사용 가능 여부 → 모든 국가 해제 → 저장 (1시간 안에 App Store 에서 사라짐)
2. 재출시 시 다시 체크 → 저장

### 5-5. "리뷰어 데모 요청 받았을 때"
- App Review 정보 메모 (`store-metadata.md` 의 본문) 가 충분하면 보통 OK
- 부족하다 답장 받으면 — 회신 (`APP_STORE_SUBMISSION.md` §8 흐름) + screen recording / 데모 계정 정보

---

## 6. 재사용 체크리스트 (다음 앱 출시 후 1주일 내)

1. [ ] **App Review 정보 메모** 영구 채우기 (`store-metadata.md` 의 App Review Information Notes 본문 구조)
2. [ ] **출시 후 1주 모니터링** — Crash / 부정적 리뷰 / 결제 실패율 / 첫 사용자 funnel 이탈
3. [ ] **첫 메타데이터 업데이트 예정** — 1주 후 사용자 데이터 보고 스크린샷 / 키워드 1차 튜닝
4. [ ] **부정적 리뷰 응답 정책** — 24시간 안에 응답 (Apple 이 가시성 보상)
5. [ ] **App Analytics 자주 보기** — 첫 install 후 7일 / 30일 retention

---

작성: 2026-05-15 (archelier 1.0 출시 직후)
업데이트 정책: 새로운 거부 사유 / 새로운 ASC UI 변화 / 정책 변경 시 §4 / §1 갱신.
