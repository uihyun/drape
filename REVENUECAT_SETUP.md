# RevenueCat IAP 셋업 — 전체 walkthrough

iOS In-App Purchase (구독) 를 RevenueCat 으로 붙이는 전 과정. **다음 앱에서도 그대로 따라 할 수 있는** 형태로 정리. 이 프로젝트(`archelier`) 의 실제 값/경로를 예시로 쓰되, 재사용 시 바꿔야 할 곳은 명시.

연관 문서:
- `CAPACITOR_SETUP.md` — Capacitor 래퍼 전체 (이 문서는 그 §8-1 의 실제 구현)
- `IOS_BUILD_GUIDE.md` — Xcode → TestFlight 빠른 참조
- `SPRINT_A_LOG.md` — 시간순 작업 로그 + 트러블슈팅

---

## 0. 아키텍처 — source of truth 모델

가장 먼저 이해해야 할 것. 구독 상태가 **세 군데**에 존재하고, 각자 역할이 다르다.

| 위치 | 역할 | 신뢰도 |
|------|------|--------|
| **Apple (App Store)** | 진짜 결제 원장. 청구·갱신·환불의 최종 권위 | 절대 진실 |
| **RevenueCat** | Apple 영수증을 정규화해서 `entitlement` 로 표현. SDK + webhook 의 출처 | Apple 의 미러 (거의 실시간) |
| **Firestore `users/{uid}`** | 우리 앱이 읽는 곳. RC webhook 이 갱신 | RC 의 미러 (webhook 도착 후) |

데이터 흐름:
```
사용자 결제
  → Apple
  → RevenueCat (SDK 가 device 에서 즉시 인지 + 서버가 Apple S2S 알림 수신)
  → webhook → 우리 Cloud Function → Firestore users/{uid}
  → 앱 UI (Firestore 구독 listener)
```

**핵심 원칙:**
- 앱 UI 는 **Firestore 를 단일 소스**로 읽는다 (web Stripe / iOS RC 양쪽 동일 경로).
- iOS 에서 `isPro` 즉시 판정만 RC SDK (`customerInfo.entitlements.active`) 를 fallback 으로 쓴다 — webhook latency 동안의 공백 메꿈.
- "iOS 일 땐 status/날짜도 RC SDK 에서 직접 읽자" 는 유혹이 있는데 **하지 마라**. webhook 이 정상 동작하면 Firestore 가 일관된 단일 소스다. UI 이중 경로는 불필요한 복잡도. (이 프로젝트에서 실제로 한 번 구현했다가 revert 함.)

---

## 1. 사전 준비 (사용자 액션)

- [ ] **Apple Developer Program** 가입
- [ ] **Paid Applications Agreement** 활성화 — ASC → 비즈니스 → 계약. **이게 활성 안 되면 IAP 가 RC Error 23 (CONFIGURATION_ERROR) 으로 죽는다.** W-9 (미국) / 세금 양식 + 은행 정보 입력 필요. 법인이면 W-9 의 LLC 분류 (single-member LLC = disregarded entity = pass-through).
- [ ] **RevenueCat 계정** (https://app.revenuecat.com) + 프로젝트 생성

---

## 2. App Store Connect — IAP 상품 등록

ASC → 해당 앱 → 수익화 → 구독.

1. **구독 그룹** 생성 (예: `archelier Pro`). 같은 그룹 안의 상품끼리는 사용자가 upgrade/downgrade 가능.
2. **구독 상품** 추가:
   - Product ID: `archelier_pro_monthly` (한 번 정하면 못 바꿈. reverse-domain 안 써도 되지만 일관되게)
   - 기간: 1 개월
   - 가격: $9.99 (Apple 이 다른 통화 자동 환산)
3. **Introductory Offer (무료 체험)** — 구독 상품 안에서 따로 설정:
   - "무료 평가판" 3 일
   - 적용 국가: 전체 (175 개) 또는 출시 국가만
   - ⚠️ **Subscription Period (1 month) 와 Introductory Offer (3 days) 는 별개다.** paywall 에 "3 days" 띄우려면 intro offer 변수를 써야 함 (§5 참고).
4. 각 상품에 **현지화** (표시 이름/설명) + **심사용 스크린샷** 1 장 첨부.
5. 상품 상태: **"제출 준비 완료"** 까지. **첫 IAP 는 앱 1.0 과 같이 심사**된다 — 앱 제출 시 IAP 를 묶어서 보내야 함.

---

## 3. RevenueCat 대시보드 설정

### 3-1. 앱 연결
- Project → Apps → **App Store** 앱 추가. Bundle ID + (선택) ASC API 키 (§7).

### 3-2. Products
- Products → **Import** 또는 수동 추가 → ASC 의 `archelier_pro_monthly` 연결.

### 3-3. Entitlements
- Entitlements → 생성 (예: `archelier Pro`). 이 **entitlement identifier 가 코드의 `ENTITLEMENT_ID` 와 정확히 일치**해야 함.
- `archelier_pro_monthly` 상품을 이 entitlement 에 attach.

### 3-4. Offerings
- Offerings → `default` offering → package 에 상품 추가. SDK 의 `getOfferings()` 가 이걸 읽음.

### 3-5. Paywall (RC Paywall Builder)
- Paywalls → `default` offering 에 paywall 디자인.
- ⚠️ **트라이얼 기간 표기 함정**: `{{ product.period_with_unit }}` 는 *갱신 주기* (= 1 month) 다. 무료 체험 기간이 아님.
  - intro offer 변수 (`offer_period_with_unit` 등) 가 dropdown 에 없을 수 있음.
  - **Custom variable 도 쓰지 마라** — `purchases-capacitor` SDK 가 custom variable 미지원. 실기기에서 빈 값/기본값으로 깨짐.
  - **해결: 템플릿에 "3 days" 를 그냥 하드코딩.** Localizations 탭에서 언어별로 (`3 days` / `3일` / `3日間`). intro offer 기간을 자주 바꿀 일은 없으니 OK.

---

## 4. 클라이언트 SDK 통합

### 4-1. 의존성 (Capacitor 7 기준)
```bash
npm i @revenuecat/purchases-capacitor@11 @revenuecat/purchases-capacitor-ui@11
```
⚠️ 최신 v13 은 **Capacitor 8 필수**. Capacitor 7 환경이면 v11 이 최신. (`apple-sign-in` 플러그인 때문에 Cap 7 에 묶여 있으면 RC 도 v11.)

### 4-2. 파일 구조 (이 프로젝트)
| 파일 | 역할 |
|------|------|
| `src/services/revenuecat-service.js` | SDK 코어 wrapper — `init / login(uid) / logout / getCustomerInfo / restorePurchases` + `isProActive(customerInfo)` 순수 헬퍼. **웹은 no-op, iOS 만 동작.** `ENTITLEMENT_ID` 상수 여기. |
| `src/services/revenuecat-ui.js` | Paywall + Customer Center 헬퍼 (`presentPaywall`, `presentCustomerCenter`). lazy import — 웹 번들에 영향 없음. |
| `src/hooks/useRevenueCatPro.js` | `{ isPro, customerInfo, loading }` React hook. `addCustomerInfoUpdateListener` 로 구매/갱신/만료 시 실시간 갱신. |
| `src/App.jsx` | boot 시 `init()`, auth 변화 시 `login(uid)` / `logout()`. |
| `src/pages/Pricing.jsx` | iOS 진입 시 자동 paywall. |
| `src/pages/Account.jsx` | iOS Pro → Customer Center 버튼, Free → paywall 트리거. |

### 4-3. app_user_id = Firebase UID
`RevenueCatService.login(uid)` 가 RC 의 `app_user_id` 를 Firebase UID 로 박는다. **이게 webhook 이 `event.app_user_id` 로 우리 유저를 찾는 근거.** anonymous (로그인 전) 상태에서 결제하면 webhook 이 유저를 못 찾아 skip 됨 — 결제 흐름은 로그인 후로 게이트.

### 4-4. API 키
- `VITE_REVENUECAT_PUBLIC_KEY_IOS` (`appl_...`) + `VITE_REVENUECAT_PUBLIC_KEY_ANDROID` (`goog_...`) — RC 의 **public** SDK 키들. `.env` / `.env.production` 양쪽에. `VITE_REVENUECAT_PUBLIC_KEY` (legacy) 는 iOS fallback. 빌드 번들에 진짜 platform 키 들어갔는지 확인 (`test_...` 면 안 됨).
- RC SDK 는 platform 자동 감지 안 함. `Capacitor.getPlatform()` 으로 분기해서 올바른 키 넘기지 않으면 `"API Key is not recognized"`. 자세한 코드는 §11-7.

---

## 5. Webhook 설정 — RC → Firestore (★ 빠지기 쉬운 단계)

이 단계를 빼면 **결제는 되는데 Firestore 가 영영 갱신 안 되고**, 앱은 stale 데이터를 보여준다. 증상: "구매 성공 + Pro 배지" 인데 Account 화면은 옛날 상태.

### 5-1. Cloud Function
`functions/revenuecat.js` — `revenueCatWebhook` (onRequest):
- `Authorization` 헤더를 `REVENUECAT_WEBHOOK_AUTH` 시크릿과 `===` 비교 (불일치 → 401).
- `event.app_user_id` (= Firebase UID) 로 `users/{uid}` 찾음.
- 이벤트 타입 매핑:
  - `INITIAL_PURCHASE / RENEWAL / NON_RENEWING_PURCHASE / PRODUCT_CHANGE / UNCANCELLATION` → `plan='pro'`, `subscriptionStatus` (`trialing` if `period_type==='TRIAL'` else `active`), `cancelAtPeriodEnd=false`, `subscriptionRenewsAt=expiration_at_ms`
  - `CANCELLATION` → `cancelAtPeriodEnd=true` (만료까지 plan 유지)
  - `EXPIRATION` → `plan='free'`, `subscriptionStatus='expired'`
  - `BILLING_ISSUE` → `subscriptionStatus='past_due'`
  - 그 외 (`TEST` 포함) → audit 만 남기고 200 skip
- `functions/index.js` 에서 `exports.revenueCatWebhook` 등록.

### 5-2. 시크릿 설정
```bash
# 랜덤 시크릿 생성
openssl rand -hex 32
# Firebase 시크릿에 등록
echo -n "<생성된 값>" | firebase functions:secrets:set REVENUECAT_WEBHOOK_AUTH --data-file=-
# 함수 재배포 (시크릿 새 버전 반영)
firebase deploy --only functions:revenueCatWebhook
```
⚠️ 시크릿을 placeholder 로 만들어 두고 "나중에 설정" 하면 까먹는다. **만들 때 바로 진짜 값으로.**

### 5-3. RC 대시보드에 webhook 등록
RC Dashboard → **Integrations → Webhooks → Add**:
| 필드 | 값 |
|------|-----|
| Webhook URL | `https://us-central1-<project>.cloudfunctions.net/revenueCatWebhook` |
| Authorization header value | §5-2 의 시크릿 값 — **`Bearer ` 접두어 없이 raw.** 우리 함수가 헤더 전체를 `===` 비교하므로. |
| Environment | Both Production and Sandbox |
| Events filter | All apps / All events |

### 5-4. 검증
- RC 가 주는 **"Send test event"** 클릭.
- `firebase functions:log --only revenueCatWebhook` 에 `untracked event type TEST` 가 찍히면 = 연결 + 인증 OK. (TEST 는 우리가 핸들 안 하는 타입이라 skip 하는 게 정상.)
- 401 / auth mismatch 면 시크릿 불일치 — §5-2 와 §5-3 값 재확인.

### 5-5. Firestore 필드 ↔ 앱 매핑
webhook 이 쓰는 필드 (`users/{uid}`) ↔ `src/services/billing-service.js` 의 `subscribeToSubscription` 매핑 ↔ Stripe webhook 도 같은 필드 공유:
| Firestore 필드 | 앱에서 읽는 이름 | 비고 |
|---|---|---|
| `plan` | `plan` | `'pro'` / `'free'` |
| `subscriptionStatus` | `status` | `trialing` / `active` / `expired` / `past_due` |
| `subscriptionRenewsAt` | `currentPeriodEnd` | Apple 의 정확한 만료 timestamp |
| `cancelAtPeriodEnd` | `cancelAtPeriodEnd` | |
| `stripeCustomerId` | `stripeCustomerId` | web Stripe 전용. iOS 엔 없음 |

---

## 6. iOS 빌드 — IAP 관련 체크

- **Export Compliance**: `ios/App/App/Info.plist` 에 `ITSAppUsesNonExemptEncryption = false` — HTTPS/TLS 만 쓰면 exempt. 이거 없으면 빌드 업로드 때마다 ASC 가 암호화 다이얼로그를 물어봄 (그때 "해당 없음" 선택해도 되지만 plist 에 박아두면 자동).
- **Build 번호**: IAP 추가 후 재아카이브 시 `CURRENT_PROJECT_VERSION` bump.

---

## 7. (권장) ASC API 키 → RevenueCat

§5 는 **RC → 우리** 방향. 이건 **Apple → RC** 방향 — RevenueCat 이 App Store Connect API 키를 갖고 있으면:
- Apple 의 App Store Server Notifications 를 RC 가 안정적으로 수신 (환불·취소·갱신 감지 신뢰도 ↑)
- 상품/가격 메타데이터 자동 동기화
- server-to-server 영수증 검증 (device StoreKit 의존 X)

"(선택)" 으로 분류되지만 **정식 출시 전 권장**. 순서:
1. ASC → 사용자 및 액세스 → 통합 (Integrations) → App Store Connect API → 키 생성 (In-App Purchase 권한).
2. `.p8` 키 + Key ID + Issuer ID 를 RC Dashboard → Project → Apps → (해당 앱) → App Store Connect API 에 등록.

---

## 8. Sandbox 테스트

### 8-1. Sandbox 테스터 생성
ASC → 사용자 및 액세스 → **샌드박스** 탭 → 테스터 추가:
- 이메일: **실제로 존재하지 않는 가짜 주소도 OK** (예: `appname-sbx1@example.com`)
- 비밀번호 + 지역 설정.

### 8-2. iPhone 에서 sandbox 계정 로그인
iOS 버전에 따라 위치가 다름:
- 최신 iOS: **설정 → 개발자 (Developer) → Sandbox Apple Account → Sign In**
- 이전 iOS: **설정 → App Store → 맨 아래 SANDBOX ACCOUNT**
- 여기에 §8-1 의 테스터로 로그인. (실제 Apple ID 와 별개 — 진짜 청구 안 됨.)

### 8-3. 결제 흐름 테스트
TestFlight 빌드 설치 → 앱에서 Subscribe → sandbox 확인창 ("[Environment: Sandbox]") → 비번 → "구매 성공".
- 검증: paywall 트라이얼 표기 정확? Pro 활성 (배지/워터마크/제한 해제)? Settings 의 만료일이 Apple Customer Center 와 일치?
- Sandbox 는 시간 압축됨 (월 구독이 몇 분마다 갱신, 6 회 후 자동 만료).

### 8-4. ★ Sandbox 계정 오염 주의
**테스트 계정은 한 번 쓰면 상태가 쌓인다.** 같은 Firebase 유저로 Stripe 테스트 + RC 테스트 + 수동 DB 편집까지 겹치면 꼬인다 (이 프로젝트에서 실제로 겪음).
- **깨끗한 검증은 fresh sandbox 테스터 + fresh Firebase 유저로.**
- 이미 오염됐으면 `users/{uid}` 의 구독 필드 전부 삭제 → free 상태로 리셋 → 깨끗한 결제 1 번으로 webhook 이 정확히 채우게 (`scripts/fix-sandbox-sub.cjs` 패턴 참고).

---

## 9. 트러블슈팅 카탈로그

| 증상 | 원인 | 해결 |
|------|------|------|
| RC **Error 23** (CONFIGURATION_ERROR), offerings fetch 실패 | Paid Applications Agreement 미활성 | ASC → 비즈니스 → 계약. 세금 양식 + 은행 정보 입력. 활성까지 대기. |
| 결제는 성공·Pro 배지 정상인데 Account 화면이 옛날 상태 | RC 대시보드에 webhook 미등록 → Firestore 갱신 안 됨 | §5-3. `functions:log` 에 호출 0 건이면 미등록 확정. |
| webhook 401 / auth mismatch | 시크릿 불일치 | §5-2 의 Firebase 시크릿 값 = §5-3 의 RC 대시보드 Authorization 값. `Bearer ` 접두어 붙였는지 확인. |
| paywall 이 "1 month 무료" 라고 표시 | `period_with_unit` (갱신주기) 를 트라이얼 기간으로 오용 | §3-5. "3 days" 하드코딩. |
| paywall 변수 자리가 빈 값/깨짐 | `purchases-capacitor` 가 custom variable 미지원 | custom variable 쓰지 말 것. 하드코딩. |
| 앱이 "웹에서 관리하세요" 힌트를 잘못 표시 | 그 유저 doc 에 옛 `stripeCustomerId` 잔재 | 오염된 테스트 계정 — 구독 필드 정리 (§8-4). |
| 앱·Apple Customer Center 만료일 1 일 차이 | 수동으로 박은 근사 날짜 (UTC 자정 등) 가 타임존 때문에 어긋남 | 수동값 쓰지 말 것. 진짜 webhook 이벤트가 `expiration_at_ms` 로 정확히 덮어쓰게. |
| ASC 좌상단 앱 아이콘이 비어있음 (와이어프레임) | 빌드가 배포 탭의 버전에 attach 되기 전 | cosmetic. 배포 → 버전 → 빌드 선택하면 채워짐. |

---

## 10. 재사용 체크리스트 (다음 앱)

새 앱에 IAP 붙일 때 순서:
1. [ ] Paid Applications Agreement 활성 (§1) — **가장 먼저. 활성에 시간 걸림.**
2. [ ] ASC 에 구독 그룹 + 상품 + intro offer (§2)
3. [ ] RC 프로젝트 + entitlement + offering + paywall (§3)
4. [ ] SDK 통합 — 4-2 의 5 개 파일 패턴 복사, `ENTITLEMENT_ID` / product ID 만 교체 (§4)
5. [ ] `VITE_REVENUECAT_PUBLIC_KEY_IOS` env (§4-4)
6. [ ] webhook function 배포 + 시크릿 + RC 대시보드 등록 + test event 검증 (§5)
7. [ ] ASC API 키 → RC (§7) + In-app purchase 키 → RC (§7)
8. [ ] Info.plist export compliance (§6)
9. [ ] sandbox 테스터로 결제 e2e 검증 — webhook 로그 + Firestore 확인 (§8)
10. [ ] 앱 1.0 + 첫 IAP 묶어서 심사 제출
11. [ ] **Android — §11 전체 진행** (Cloud Console service account → Play Console 권한 → RC Play Store config)

---

## 11. Android (Play Billing) 추가 설정

iOS 가 정착된 후 Android 를 동일 entitlement 에 묶어 cross-platform 으로 만든다. iOS 와 다른 핵심:
- iOS 의 ASC API 키 = "한 번 만들고 끝" 이지만, Play 는 **Google Cloud service account** 로 별도 인증. RC 가 Play Developer API 호출해서 검증.
- iOS 의 App Store Server Notifications 자동 연결과 달리, Play 는 **Cloud Pub/Sub** 토픽을 통해 RC 가 real-time event 받음 → Pub/Sub API 활성 + 권한 필요.
- 한 앱 (`archelier_pro_monthly`) 에 여러 **base plan** 이 붙는 구조 → RC product identifier 는 `<subscription_id>:<base_plan_id>` 합성.

### 11-1. Play Console — 구독 상품 등록
1. Play Console → archelier → Monetization → **Subscriptions** → Create subscription.
2. Product ID `archelier_pro_monthly` (iOS 와 동일 이름 유지 — RC 가 동일 entitlement 묶기 쉬움).
3. Benefits — iOS 와 동일 4개 (Unlimited design generations / Watermark-free saves / Unlimited region edits / Unlimited AI chat per design), en/ko/ja.
4. Base plan: monthly auto-renewing, $9.99 USD, Grace period 3 days, Account hold auto, Resubscribe allow.
5. Base plan ID (예: `monthly`) — **이 값이 RC 의 product identifier 의 `:` 뒷부분이 됨**.
6. 활성화 — 174개국 (iOS 와 동일 매트릭스).

### 11-2. Service Account 생성 (Google Cloud Console)
**Play Console 의 API access 페이지는 2024 이후 제거**. 새 흐름은 Cloud Console 에서 직접 생성:

1. https://console.cloud.google.com/iam-admin/serviceaccounts → Firebase 와 동일 project 선택.
2. **+ CREATE SERVICE ACCOUNT** → Name `<app>-revenuecat` → role 부여 skip → DONE.
3. 생성된 행 클릭 → **KEYS** 탭 → ADD KEY → Create new key → **JSON** → 다운로드. `keys/playstore_rc/<project>-<keyid>.json`. ★ 비밀번호급 — repo 밖 보관, `*.json` 없으면 `.gitignore` 추가.
4. Cloud Console → APIs & Services → Library → **Cloud Pub/Sub API** → ENABLE (real-time notifications 용).
5. Cloud Console → IAM & Admin → IAM → **+ GRANT ACCESS** → 위 service account 이메일 → role **Pub/Sub Admin** → SAVE.
   - ★ 함정: Pub/Sub API enable 전에 role 검색하면 `Pub/Sub Lite` (다른 서비스) 만 나옴. API enable 후 검색해야 `Pub/Sub Admin` 보임.

### 11-3. Play Console — service account 초대
1. Play Console → 좌측 하단 **Users and permissions** → **Invite new users**.
2. Email: `<app>-revenuecat@<project>.iam.gserviceaccount.com`.
3. App permissions → archelier 앱 선택 → 다음 4개:
   - ✅ View app information and download bulk reports
   - ✅ **View financial data, orders, and cancellation survey responses**
   - ✅ **Manage orders and subscriptions**
   - ✅ View store performance
4. Apply → Save changes.
   - ★ subscriptions API 호출에는 위 가운데 두 권한이 **둘 다** 필수. RC 의 "Credentials need attention → View details" 가 정확히 짚어줌.
   - 권한 전파 1-5분, 가끔 10-30분.

### 11-4. RC dashboard — Play Store config
1. RC → Apps & providers → **+ New** → Google Play.
2. App name: `<App> Play Store`, Package name: `com.<app>.<id>` (= `applicationId`).
3. Service Account Credentials JSON: 11-2 의 .json 업로드 → ✅ Valid credentials.
4. Google developer notifications → Topic ID: **"Play-Store-Notifications" — Will be generated by RevenueCat** 선택 (RC 가 자동 생성). 토픽 이름 `projects/<project>/topics/Play-Store-Notifications` 복사.
5. **Connect to Google** → Save.

### 11-5. Play Console — Real-time developer notifications
1. Play Console → archelier → **Monetization setup** → Real-time developer notifications.
2. Enable real-time notifications.
3. Topic name = 11-4 의 RC 가 만든 토픽 (`projects/<project>/topics/Play-Store-Notifications`).
4. Notification content: **Subscriptions and voided purchases only**.
5. **Send test notification** 으로 검증 → 200 응답 받으면 성공.

### 11-6. RC product / entitlement / offering
1. RC → Products → archelier Play Store row → **Import Products** (Play Console 에서 자동 fetch 권장).
   - 수동: `+ New` → Product ID `archelier_pro_monthly`, Type Subscription, Base plan Id `monthly`, Backwards compatible ✅.
2. RC → Entitlements → `archelier Pro` → Attach → 위에서 만든 Android product (`archelier_pro_monthly:monthly`).
3. RC → Offerings → `default` → Monthly package 에 Android product attach (iOS 와 같은 package). 한 package 에 두 platform product 묶이면 SDK 가 platform 별로 자동 선택.

### 11-7. 코드 — platform 별 API key + UI gating
RC SDK 가 platform 자동 감지 안 함. 잘못된 key 면 `"API Key is not recognized"` 에러.

```js
// src/services/revenuecat-service.js
const IOS_API_KEY = import.meta.env.VITE_REVENUECAT_PUBLIC_KEY_IOS;
const ANDROID_API_KEY = import.meta.env.VITE_REVENUECAT_PUBLIC_KEY_ANDROID;

function getApiKey() {
  const platform = Capacitor.getPlatform();
  if (platform === 'ios') return IOS_API_KEY;
  if (platform === 'android') return ANDROID_API_KEY;
  return null;
}
```

`.env` + `.env.production` 둘 다:
```
VITE_REVENUECAT_PUBLIC_KEY_IOS=appl_...
VITE_REVENUECAT_PUBLIC_KEY_ANDROID=goog_...
```

RC dashboard → **Project settings → API keys** 에서 platform 별로 따로 복사. ⚠️ Apps & providers 의 archelier App/Play Store config 페이지에도 "Public API Key" 라벨이 있는데 동일 키 — 단 RC dashboard 에서 그 config 를 재생성/교체하면 SDK key 도 같이 회전. 키 회전 후 구버전 key 로 SDK configure 하면 `InvalidCredentialsError` (Error 11) 발생. 진단은 `curl -H 'Authorization: Bearer <key>' https://api.revenuecat.com/v1/subscribers/test/offerings` 로 401 확인.

#### UI gating — service 분기만으로는 부족
service 단에서 platform key 분기해도, **UI 의 결제 진입점들이 `isIOS()` 로만 분기되어 있으면 Android 에서 결제 흐름이 통째로 web (Stripe) 으로 빠진다**. Play 정책상 외부 결제 promote 는 거부 사유. 화면 두 곳 점검:

| 파일 | 위치 | 잘못된 패턴 | 올바른 패턴 |
|---|---|---|---|
| `src/pages/Pricing.jsx` | useEffect 진입 paywall + 웹 카드 hide | `if (!isIOS()) return;` / `if (isIOS()) return null;` | `if (!isNativeApp()) return;` / `if (isNativeApp()) return null;` |
| `src/pages/Account.jsx` | Upgrade CTA, Customer Center 버튼, Stripe portal 버튼, effectivePlanId fallback, hasNativeIAPSubscription 판단, Stripe migration hint | `isIOS() ? ...` / `!isIOS() && ...` | `isNativeApp() ? ...` / `!isNativeApp() && ...` |

(예외: 진짜 iOS 만의 정책 — 예: ASC 외부 링크 금지 — 은 `isIOS()` 유지. 우리 코드에는 현재 없음.)

### 11-8. Sandbox 테스트 — License testers
1. Play Console → 좌측 하단 **Settings → License testing** (계정 레벨, archelier 앱 안 아님).
2. **Add testers** → 본인 Gmail + 더미 계정 — License response `RESPOND_NORMALLY`.
3. 해당 계정으로 로그인된 디바이스에서 Internal Testing track 옵트인 → Play Store 에서 설치 → 결제 시도 시 "Test card. always approves" 표시되고 실제 청구 안 됨.

### 11-9. 트러블슈팅
| 증상 | 원인 / 처리 |
|------|------|
| RC: "Permissions to call subscriptions API ❌" | Play Console invite 에서 `View financial data` 또는 `Manage orders and subscriptions` 빠짐 |
| RC: "Cloud Pub/Sub API permissions" 에러 | Pub/Sub API 미활성 또는 service account 에 `Pub/Sub Admin` role 누락 |
| RC: "Credentials need attention" 캐시된 채 안 풀림 | "Replace?" 클릭 → 같은 JSON 재업로드 → Save → 강제 재검증 |
| IAM 검색에 `Pub/Sub Lite` 만 나옴 | 일반 Pub/Sub API enable 전. API 활성 후 재검색 |
| 앱 실행 시 `"API Key is not recognized"` | platform key 잘못 매핑 (iOS 가 `goog_` 로 가거나 그 반대) — `.env` 키 확인 |
| 앱 실행 시 `"no Play Store products registered"` | Play Console 의 subscription 비활성 / RC 에 product 미등록. RC Import Products 실행 |
| Paywall 시트가 떴는데 즉시 `Error 11: credentials issue` / logcat 의 `Unable to start a network connection due to a network configuration issue` | **RC SDK API key 회전됨** (Apps & providers config 재생성 시 함께 회전). host 에서 `curl -H 'Authorization: Bearer <key>' https://api.revenuecat.com/v1/subscribers/test/offerings` → 401 면 키 자체 무효. Project settings → API keys 에서 정확한 값 다시 복사 → `.env*` 갱신 → rebuild |
| Android Google Sign-In `NoCredentialException: No credentials available` (계정 시스템에 추가했는데도) | debug.keystore 재생성됨 (Android Studio 가 머신 이동·업데이트 시 자동). 현재 SHA-1 (`keytool -keystore ~/.android/debug.keystore -list -v -alias androiddebugkey -storepass android -keypass android`) 이 Firebase Console 에 미등록. SHA-1 추가 → google-services.json 재다운로드 → 덮어쓰기 → Sync Gradle |
| Android Google Sign-In **Play Store install 본에서** `NoCredentialException` (sideload debug 에선 OK) | Play App Signing key SHA-1 미등록. Play Console → **Protected with Play → Play Store distribution → Go to Play app signing** → **App signing key certificate** 의 SHA-1 복사 → Firebase Console Add fingerprint → google-services.json 재다운로드 → versionCode bump → 재빌드 → Internal Testing 재업로드. upload SHA-1 만으론 부족 — Play 가 재서명하므로 Play App Signing key 의 SHA-1 도 등록 필수 |
| Android 에서 "Upgrade to Pro" 누르면 Chrome 외부 브라우저 (Stripe checkout) 로 빠짐 | UI gating 이 `isIOS()` 만 사용 — service 단은 native 분기 됐어도 Pricing/Account 화면이 web flow 로 라우팅. §11-7 의 UI gating 표 참조해서 `isNativeApp()` 로 교체 |
| Paywall 정상 표시 + Subscribe 누르니 `"The item you were attempting to purchase could not be found"` (ITEM_UNAVAILABLE) | sideload 한 debug APK (Android Studio Run 으로 emulator 에 직접 push) 에서는 Play Billing 동작 안 함. 정책상 **Play Store 로 설치한 앱**만 IAP 호출 가능. Internal Testing 트랙에 .aab 업로드 → tester opt-in 링크로 Play Store 통해 설치 → 그 빌드에서 시도. License tester (Settings → License testing) 등록되어 있어야 "Test card. always approves" 노출 |

### 11-10. 재사용 체크리스트 (다음 앱)
1. [ ] Play Console — 구독 상품 + base plan (§11-1)
2. [ ] Cloud Console — service account + JSON + Pub/Sub API + Pub/Sub Admin role (§11-2)
3. [ ] Play Console — service account 4개 권한 (§11-3)
4. [ ] RC Play Store config + Real-time notifications topic (§11-4, 5)
5. [ ] RC product → entitlement → offering attach (§11-6)
6. [ ] `VITE_REVENUECAT_PUBLIC_KEY_ANDROID` env + platform 분기 코드 (§11-7)
7. [ ] License testers 등록 + Internal Testing 디바이스 검증 (§11-8)

---

작성: 2026-05-14 (archelier `1.0.0` IAP 작업 기준). §11 Android 추가: 2026-05-20.
