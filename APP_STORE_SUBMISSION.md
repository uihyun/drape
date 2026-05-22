# App Store 정식 제출 walkthrough

iOS 앱 1.0 + 첫 IAP(구독) 를 App Store Connect 에 제출하는 전 과정. **다음 앱에서 실수 없이 따라 할 수 있게** 정리. archelier `1.0.0` 제출 (2026-05-14) 기준 — 실제 겪은 함정 포함.

연관 문서:
- `IOS_BUILD_GUIDE.md` — 이 문서 이전 단계 (Xcode Archive → TestFlight 업로드)
- `REVENUECAT_SETUP.md` — IAP / webhook / sandbox 테스트
- `store-metadata.md` — ASC 입력용 텍스트 (설명/키워드 등)
- `SPRINT_A_LOG.md` — 시간순 작업 로그

전제: TestFlight 에 빌드가 올라가 있고, sandbox 결제 검증까지 끝난 상태 (`IOS_BUILD_GUIDE.md` + `REVENUECAT_SETUP.md` §8 완료).

---

## 0. 큰 그림 — 제출은 "submission" 단위

App Store Connect 의 제출은 **submission(제출)** 이라는 컨테이너 단위로 동작:
- submission 에 **앱 버전**이 들어감
- **첫 IAP/구독**은 별도 항목이 아니라 **앱 버전 페이지에 attach** 되어 버전과 함께 심사됨
- 한 앱에 활성 submission 은 1개만 — 잘못 만들면 `제출 취소` 후 다시

```
TestFlight 빌드 + sandbox 검증 완료
  → ASC: 앱 정보 / 개인정보 / 메타데이터 / 스크린샷 채우기
  → 버전 페이지: 빌드 선택 + 구독 attach
  → 심사에 추가 → submission 생성
  → 심사를 위해 제출
  → 심사 대기 중 → 심사 중 → 승인/거부
  → (수동 출시면) 직접 "출시" 클릭
```

---

## 1. ASC 앱 단위 설정 (버전과 무관, 한 번만)

좌측 사이드바 기준:

### 1-1. 앱 정보 (일반 정보 → 앱 정보)
- 카테고리 (기본/보조)
- 콘텐츠 권한 (광고 식별자 사용 여부 등)
- 연령 등급 — 설문 응답

### 1-2. 가격 및 사용 가능 여부 (수익화)
- 앱 자체 가격 (무료 앱이면 무료)
- 사용 가능 국가/지역

### 1-3. 앱이 수집하는 개인정보 (신뢰 및 안전 → App Privacy)
- 수집 데이터 타입 설문 — Privacy Policy 와 일치하게.

---

## 2. 버전 페이지 메타데이터 (배포 → iOS 앱 버전 X.X)

| 항목 | 비고 |
|------|------|
| 미리보기 및 스크린샷 | iPhone 6.9" (구 6.7", 1290×2796) 슬롯에 올리면 작은 크기 자동 상속. 6.5" 슬롯에 6.7" 올리면 크기 에러 — 슬롯 주의. 최소 1장, 최대 10장. |
| 프로모션 텍스트 | 출시 후에도 수정 가능 (심사 없이). 170자. |
| 설명 | 4000자. |
| 키워드 | 100자, 쉼표 구분. |
| 지원 URL / 마케팅 URL | 필수 (지원), 선택 (마케팅). |
| 빌드 | **"빌드" 섹션에서 TestFlight 빌드 선택.** 없으면 + 로 추가. export compliance 답한 빌드여야 함. |
| 저작권 | `© 2026 <법인/이름>` |
| App Review 정보 | §4 참고 |
| App Store 버전 출시 | 수동 / 자동 / 날짜 지정. **수동 권장** — 승인 후 원하는 타이밍에 직접 공개. |

---

## 3. 첫 구독을 버전과 함께 제출 (★ 함정 집중 구역)

### 3-1. 규칙
**첫 IAP/구독은 반드시 새 앱 버전과 함께 제출**해야 한다. 첫 승인 이후엔 구독 섹션에서 단독 제출 가능.

### 3-2. ★★ 함정 1 — 구독 "그룹" 현지화 누락
**증상**: 개별 구독이 아무리 완벽해도 상태가 `메타데이터 누락됨` 에서 안 풀림.
**원인**: 구독 **그룹** 자체에 현지화된 표시 이름이 최소 1개 있어야 함. 경고는 *개별 구독*에 뜨지만 정작 빠진 건 *그룹* 쪽 — Apple 문서/포럼에서 확인된 흔한 혼동 포인트.
**해결**:
1. 수익화 → 구독 → **그룹 이름 클릭** (개별 구독 아님)
2. "현지화" 섹션 → "생성"
3. 언어 선택 + **구독 그룹 표시 이름** 입력 (브랜드명이면 번역 불필요 — 1개 언어만 해도 OK)
4. 저장 → 개별 구독 상태가 `메타데이터 누락됨` → `제출 준비 완료` 로 바뀜

### 3-3. 개별 구독 필수 항목 (`제출 준비 완료` 조건)
- 식별 정보 (reference name) / 제품 ID / 구독 기간
- 사용 가능 여부 — **최소 1개 국가** 선택 (없으면 "Remove from Sale" 로 심사만)
- 구독 가격 — 기준 통화 1개 (Apple 이 나머지 자동 환산)
- 소개 혜택 (무료 체험) — 쓰는 경우. 모든 국가 적용 가능
- 현지화 — 표시 이름 + 설명 (출시 언어 수만큼)
- 심사 정보 — **스크린샷 1장** (paywall 캡처) + 심사 메모

### 3-4. 상태 용어 (헷갈리지 말 것)
- `메타데이터 누락됨` (Missing Metadata) — **진짜 뭔가 빠짐.** 보통 §3-2 그룹 현지화.
- `제출 준비 중` (Prepare for Submission) — 채워졌고 ready. **정상.** 문제 아님.
- `제출 준비 완료` (Ready to Submit) — 제출 가능. **이게 초록불.**

### 3-5. 버전에 attach
구독이 `제출 준비 완료` 가 되면 — **버전 페이지에 "앱 내 구입 또는 구독" 섹션이 나타남** (Ready 구독이 0개면 섹션 자체가 안 보임):
1. 버전 페이지 → "앱 내 구입 또는 구독" 섹션 → "Select In-App Purchases or Subscriptions"
2. 구독 선택 → Done
3. 섹션에 구독이 표시되면 attach 완료

> 참고: 구독 페이지의 파란 안내 박스("버전 페이지의 앱 내 구입 섹션에서 선택") 텍스트는 맞지만, 그 섹션은 **구독이 Ready 상태일 때만** 나타난다. 안 보이면 구독 상태부터 확인.

---

## 4. App Review 정보

- **연락처 정보** — 이름/전화/이메일. 필수.
- **로그인 정보** — 앱이 로그인 필수면 데모 계정 제공. **단, Sign in with Apple 만 쓰는 앱은 데모 계정 불필요** (리뷰어가 자기 Apple ID 로 로그인 가능). "로그인 필요" 체크 해제 + 메모에 명시.
- **메모** — 리뷰어 안내. 권장 내용:
  - 인증 방식 (Apple 로그인 / 익명 둘러보기 가능 등)
  - IAP 도달 경로 ("Account → Upgrade to Pro" 식 단계)
  - UGC 모더레이션 (Guideline 1.2) — 신고/차단 기능 위치
  - Privacy / Terms URL

---

## 5. Export Compliance (암호화)

- `ios/App/App/Info.plist` 에 `ITSAppUsesNonExemptEncryption = false` 박아두면 빌드마다 안 물어봄. (HTTPS/TLS 만 쓰면 exempt.)
- 안 박았으면 빌드 업로드 / submission 시 다이얼로그 → "위에 언급된 알고리즘에 모두 해당하지 않음" 선택.

---

## 6. 제출

1. 버전 페이지 우상단 **"심사에 추가"** → submission 초안 생성 (즉시 제출 아님)
2. **"제출 초안" 패널** 확인:
   - "iOS 앱 X.X" 1개만 보임 → **정상.** 구독은 별도 줄로 안 뜸 — 버전에 attach 되어 함께 심사됨 (Apple 설계).
3. **"심사를 위해 제출"** 클릭
4. submission 상태 = `심사 대기 중`

### 검증 — 구독이 같이 들어갔는지
수익화 → 구독 → 해당 구독 상태가 `제출 준비 완료` → `심사 대기 중` 으로 바뀌어 있으면 = 버전과 함께 심사 진입 확정.

---

## 7. 트러블슈팅 카탈로그

| 증상 | 원인 / 해결 |
|------|------|
| 구독이 `메타데이터 누락됨` 에서 안 풀림 | **구독 그룹 현지화 누락** (§3-2). 가장 흔함. |
| 버전 페이지에 "앱 내 구입 또는 구독" 섹션이 없음 | Ready 상태 구독이 0개. 구독을 `제출 준비 완료` 로 먼저 만들면 섹션이 나타남. |
| "제출 초안" 패널에 구독이 안 보임 | 정상. 구독은 별도 항목이 아니라 버전에 attach 되는 방식. |
| 스크린샷 크기 에러 | 6.5" 슬롯에 6.7"/6.9" 이미지 업로드. 슬롯 맞춰서. |
| 빌드 선택 시 빌드가 안 보임 | TestFlight 처리 미완 또는 export compliance 미답. |
| 앱만 단독으로 `심사 대기 중` 됨 (구독 누락) | submission `제출 취소` → 버전에 구독 attach 확인 → 다시 "심사에 추가" → 제출. |
| 거부됨 (IAP 동작 안 함) | 첫 구독을 앱과 함께 안 보냈거나, 구독이 심사에 안 들어감. §3-5 + §6 검증. |

---

## 8. 거부 (Reject) → 재제출 walkthrough

심사에서 한 번에 통과하지 못해도 정상. Apple 은 거부 메시지에 위반 가이드라인 + 재현 단계를 적어줌. 침착하게 대응.

### 8-1. 거부 알림 확인
- 이메일 + ASC 상단 빨간 배너 ("앱 심사에서 문제가 발견됨").
- ASC → 앱 심사 → iOS 제출 → 메시지 패널에서 Apple 의 원문 메시지 확인. 보통:
  - Submission ID
  - Review date
  - Review Device (어떤 디바이스에서 테스트 — iPad / iPhone 등)
  - Version reviewed (예: `1.0 (2)`)
  - Guideline 번호 + Issue Description + Next Steps + Resources 링크

### 8-2. archelier 1.0 (2) 실제 거부 사례 (2026-05-15)
첫 제출에서 흔하게 함께 나오는 두 사유 — 다음 앱에서도 이 패턴 그대로 받을 수 있음:

| 가이드라인 | 사유 | 코드 변경 필요? |
|---|---|---|
| **5.1.1(v)** Data Collection and Storage | 계정 생성이 가능한 앱은 **앱 내**에서 계정 삭제도 제공해야 함. 일시 비활성화·웹사이트 안내만으로는 부족. | ✅ 신규 빌드 |
| **3.1.2(c)** Subscriptions | 구독이 가격에 대해 사용자가 무엇을 받는지 **명확히** 기술되지 않음. ASC 구독 description 보강으로 해결. | ❌ ASC 메타데이터만 |

### 8-3. 가이드라인 5.1.1(v) — Account Deletion 요구사항
- 메뉴 위치: Settings / Account 화면 안에 "Delete Account" — 깊지 않게.
- 동작: Firebase Auth user + 모든 Firestore 데이터 + Storage 파일 삭제. anonymous 임시 비활성화는 불충분.
- 확인 단계는 OK (실수 방지). 단 전화·이메일 강요는 X (highly-regulated industry 가 아니면).
- 만약 외부 페이지로 보낸다면 **삭제 페이지 직링크** 필수 (홈으로 보내고 "여기서 찾아가세요" X).
- 구현 — archelier 의 경우 `functions/account.js` (Cloud Function `deleteAccount`) + `src/components/DeleteAccountModal.jsx` + `src/services/auth-service.js#deleteAccount` 참고.

### 8-4. 가이드라인 3.1.2(c) — Subscription clarity

#### ASC 필드 글자수 제한 (★ 함정)
- **표시 이름 (Display Name)**: 30자 — `archelier Pro` 같은 짧은 라벨
- **설명 (Description)**: **45자** — 한 줄 카피만 가능. 절대 긴 마케팅 카피 못 넣음.

처음에 4000자 필드인 줄 알고 paywall-스타일 long-form 카피 적었다가 ASC 화면에서 막히는 케이스가 흔함 (archelier 2026-05-15 실제 경험). 다음 앱에서 또 헷갈리지 말 것.

#### 어디를 진짜 손봐야 거부 회피되나
Apple 리뷰어가 실제로 보는 건 **paywall 화면 자체**. ASC 의 45자 description 만으로는 정보 부족이라 paywall 의 features list / pricing 표시가 진짜 평가 대상.

해야 할 작업:
1. **ASC 구독 현지화** (Pro Monthly → 현지화) — 표시 이름 + 45자 한 줄 카피, ko/ja/en 3개.
   - 예: `Unlimited AI interior designs, no watermark` (43자)
2. **Paywall** — RevenueCat paywall 의 features list / pricing 영역에 Pro 혜택을 명확히 (불릿 5-7개, 가격, 체험, 갱신·취소 경로). 이게 핵심.
3. **App Review 메모** — Pro 혜택 long-form 설명 첨부 (리뷰어 컨텍스트). archelier 의 경우 `store-metadata.md` 의 "Long-form Marketing Copy" 섹션 참고.

#### 톤 일관성
ASC 한 줄 카피 + paywall 표시 + 마케팅 long-form 셋이 모순되면 안 됨. paywall 에 "Unlimited generations, 4K downloads" 라고 적었으면 ASC 한 줄도 같은 표현 유지.

### 8-5. 재제출 흐름
```
ASC 알림 받음
  → 메시지 내용 정독 (Guideline + Issue Description + Next Steps)
  → 사유별 분류: 메타데이터만 vs 코드 변경 필요
  → 코드 변경 시:
       - 수정 + 로컬 검증
       - build number ↑ (예: 2 → 3) — Xcode > Targets > General > Build
       - Archive → Distribute → TestFlight 업로드
       - export compliance 답변
       - 빌드 처리 대기 (~15분) → "테스트 정보" 통과
  → 메타데이터만 수정 시: ASC 에서 바로 편집 후 저장
  → 버전 페이지 → 빌드를 새 번호로 교체 (코드 변경 시)
  → "심사에 회신" → Apple 메시지에 답장 + 재현 단계 / screen recording 첨부
       (특히 5.1.1 account deletion: 디바이스 화면 녹화 필수 — 가입/로그인 → Settings → Delete Account → 최종 확인까지)
  → "심사에 추가" → "심사를 위해 제출"
  → submission 상태 다시 `심사 대기 중`
```

### 8-6. 재제출 메시지 (Apple 회신) 작성 팁
- 회신은 Apple 의 원문 언어로. 메시지 패널의 "심사에 회신" 클릭.
- 구조:
  1. 어떤 가이드라인을 어떻게 해결했는지 한 줄
  2. 변경된 위치 (Settings → Delete Account 같은 정확한 경로)
  3. screen recording 링크 또는 첨부 (5.1.1 의 경우 거의 필수)
  4. 빌드 번호 명시 ("Resolved in build 1.0 (3)")
- screen recording 은 **실제 iOS 디바이스**에서 녹화 (시뮬레이터 X). iOS 화면 녹화 + Photos 에서 트림 → 클라우드 링크 또는 ASC App Review 메모에 description 으로 안내.
- 향후 제출을 위해 같은 녹화 링크를 ASC → 앱 정보 → **App Review 정보 → 메모** 에 영구적으로 적어두면 다음 빌드에서 재요청 안 받음.

### 8-7. 재제출 시 빌드 번호 + 버전 정책
- **버전 (1.0.0)** 은 그대로. 거부는 *version* 이 아니라 *submission* 이 거부된 것.
- **빌드 번호 (2 → 3)** 만 올림. 코드/메타데이터 변경이 있으면.
- 새 빌드 archive 시 Info.plist 의 `CFBundleVersion` 만 올려도 충분 (`CFBundleShortVersionString` 은 그대로).

---

## 9. 재사용 체크리스트 (다음 앱)

1. [ ] TestFlight 빌드 업로드 + sandbox 결제 검증 완료 (`IOS_BUILD_GUIDE.md`, `REVENUECAT_SETUP.md`)
2. [ ] ASC 앱 정보 — 카테고리 / 연령 등급 / 가용 국가 (§1)
3. [ ] App Privacy 설문 (§1-3)
4. [ ] 버전 메타데이터 — 스크린샷 / 설명 / 키워드 / URL (§2)
5. [ ] 버전 페이지에서 빌드 선택 (§2)
6. [ ] **구독 그룹 현지화 생성** (§3-2) — ★ 잊지 말 것
7. [ ] 개별 구독 필수 항목 전부 → `제출 준비 완료` 확인 (§3-3)
8. [ ] 버전 페이지 "앱 내 구입 또는 구독" 에서 구독 attach (§3-5)
9. [ ] App Review 메모 작성 (§4)
10. [ ] Export compliance 처리 (§5)
11. [ ] "심사에 추가" → "심사를 위해 제출" (§6)
12. [ ] 구독 상태가 `심사 대기 중` 으로 바뀌었는지 검증 (§6)
13. [ ] **계정 삭제 (Account Deletion) 기능 구현 완료** — Settings 안에 메뉴 + 실제 데이터 삭제 (§8-3). Apple 5.1.1 첫 거부 회피.
14. [ ] **구독 description 에 Pro 혜택 명확히 기술** (§8-4). Apple 3.1.2(c) 첫 거부 회피.

---

작성: 2026-05-14 (archelier `1.0.0` + 첫 IAP `archelier_pro_monthly` 제출 기준)
업데이트: 2026-05-15 (첫 거부 → 재제출 walkthrough §8 추가, archelier 1.0 (2) → 1.0 (3))
