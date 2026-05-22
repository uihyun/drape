# 🚀 Voda 프로젝트 설정 완료 상태

## ✅ 완성된 항목

### 1. **프로젝트 구조** ✅
- Modern React 18 + Vite 설정
- Firebase SDK v10 (모듈러) 사용
- TypeScript 지원 준비
- PWA 설정 완료

### 2. **Firebase 설정** ✅
- Hosting (정적 파일)
- Functions v2 (서버리스 백엔드)
- Firestore (데이터베이스)
- Storage (파일 저장)
- 보안 규칙 설정

### 3. **AI 통합** ✅
- Google Gemini 2.5 Flash API 연동 (분석)
- Google Gemini 3 Pro Image 연동 (이미지 생성)
- 이미지 분석 및 인테리어 제안 로직
- 레이트 리미팅 (분당 20회)
- 에러 핸들링 (네트워크/타임아웃/AI 오류 분기)

### 4. **UI/UX** ✅
- 12가지 인테리어 스타일 + 커스텀 선택
- 최대 3장 다중 사진 업로드 / 카메라 촬영
- 이미지 압축 및 최적화
- 모바일 최적화
- 반응형 디자인

### 5. **크레딧 시스템** ✅
- 게스트 2회 체험 (localStorage)
- 로그인 시 +3 가입 보너스, 일일 로그인 +1 (최대 10)
- Authorization: Bearer ID token 검증 (`initializeUser`, `generateDesign`)
- Firestore 트랜잭션 기반 원자적 차감, 실패 시 자동 환불
- Firestore 규칙으로 credit 필드 서버 전용 쓰기 강제

### 6. **친구 초대 & 프로모 코드** ✅
- 모든 유저가 가입 시 `VODA-XXXX` 형식의 `referralCode` 자동 발급 (`referralCodes/{code}` reverse-index)
- `/invite` 페이지에서 초대 링크 공유 (`?ref=VODA-XXXX`)
- 초대자 +5 / 피초대자 +3 크레딧 원자적 지급 (`redeemReferral`)
- 프로모 코드는 어드민이 Firestore에 수동 생성 (아래 "프로모 코드 발급" 섹션)

### 7. **개발 환경** ✅
- Vite 개발 서버 (포트 3000)
- Firebase 에뮬레이터 지원
- 핫 리로드
- 빌드 시스템

## ⚠️ 설정 필요 항목

### 1. **Gemini API 키** 🔑
```bash
firebase functions:secrets:set GEMINI_API_KEY
# Google AI Studio에서 발급받은 키 입력
```

### 2. **Firebase 프로젝트 연결** 🔗
- `src/firebase.js`에 프로젝트 설정 확인
- 이미 `voda-7647c` 프로젝트로 설정됨

### 3. **Stripe 결제** 💳

> **현재 상태 (2026-05-09 갱신)**: Stripe Test mode 로 e2e 결제 + webhook 동기화 검증 완료. Live 전환은 출시 직전.

**정책 (단순화):**
- **Free**: 가입 시 5 credits, 매일 로그인 +1 (cap 10), 워터마크 포함, 피드 공유 가능
- **Pro $9.99/월** (Monthly only — Annual 미사용): 무제한 generation, 워터마크 없음, credits 필드 동결
- 크레딧 팩 / Studio 플랜 모두 제거 (Free / Pro 두 단계만)

**적용 범위:**
- 웹 (모바일 / 데스크톱 브라우저): Stripe Checkout 활성
- iOS 네이티브 앱 (Capacitor): App Store 정책상 `/pricing` 진입 차단 (`isIOS()` redirect). 이미 웹에서 Pro 가입한 사용자는 앱에서 Pro 인식 + Account 페이지에 "웹에서 구독한 경우 archelier.co 에서 관리" 안내 노출
- Android: 향후 Sprint B 에서 Play Billing (RevenueCat 경유)

#### (a) 라이브러리 설치
```bash
cd functions && npm install stripe
```

#### (b) Stripe 대시보드에서 Product / Price 생성

| Product | Price | Product metadata |
|---------|-------|------------------|
| archelier Pro | $9.99 / month (Recurring) | `type=plan`, `plan_id=pro` |

> Pro 가 무제한 정책이라 `credits` metadata 는 넣지 마세요 — 들어가면 webhook 의 `handleInvoicePaid` 가 idempotent 영수증 기록만 하지 credit 부여는 안 함 (정책에서 Pro 무제한). `type` / `plan_id` 두 개만 필수.

#### (c) Price ID 를 클라이언트에 반영

`src/config/billing.js` 의 Pro 플랜 항목에 Price ID 두 개 (`stripePriceIdMonthly`, `stripeProductId`) 채움. 현재 sandbox 값은 박혀 있고, Live 전환 시 Live 모드에서 새로 만든 ID 로 교체.

#### (d) Firebase Secrets 설정
```bash
echo "sk_test_..." | firebase functions:secrets:set STRIPE_SECRET_KEY --data-file=-
echo "whsec_..."   | firebase functions:secrets:set STRIPE_WEBHOOK_SECRET --data-file=-
```

#### (e) 배포
```bash
firebase deploy --only functions:createCheckoutSession,functions:createBillingPortalSession,functions:stripeWebhook
```

#### (f) Stripe 웹훅 등록

Stripe Dashboard → **Developers → Webhooks (Event destinations)** → Add endpoint:
- **URL**: `https://stripewebhook-buugiqdxuq-uc.a.run.app` (또는 `https://us-central1-voda-7647c.cloudfunctions.net/stripeWebhook` 도 동일 — Cloud Functions Gen 2 가 두 도메인 다 serve)
- **Events** (4개):
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`

등록 후 Signing secret (`whsec_...`) 발급 → 위 (d) 에서 등록 → (e) 재배포.

#### (g) 테스트

**CLI 트리거 (webhook 핸들러 빠른 검증):**
```bash
brew install stripe/stripe-cli/stripe
stripe trigger checkout.session.completed --api-key sk_test_...
firebase functions:log --only stripeWebhook --lines 10
# expect: "checkout.session.completed: no firebaseUid ..." (CLI test event 라 firebaseUid 없음 — silently skip 이 정상)
```

**E2E (실제 Firebase 사용자):**
1. archelier.co/pricing → Subscribe → 테스트 카드 `4242 4242 4242 4242` / `12/34` / `123`
2. 결제 후 redirect 확인
3. Firestore `users/{uid}` 에 다음 필드 박혔는지 확인:
   - `plan: 'pro'`, `subscriptionStatus: 'active'`, `subscriptionRenewsAt: <timestamp>`, `cancelAtPeriodEnd: false`, `stripeSubscriptionId`, `stripeCustomerId`

**Pro credits 동결 검증:**
- Pro 사용자 generation → `credits` 필드 변동 없어야 함 (`deductCredits` 가 plan === 'pro' 면 skip)
- Pro 사용자 매일 로그인 → daily bonus 안 받음
- Pro 사용자 referral / promo redeem → credits 안 받음
- Pro 해지 → free 복귀 시 그 시점 credits 값에서 정상 차감/보너스 재개

> `STRIPE_SECRET_KEY` 값이 `sk_test_` / `sk_live_` 로 시작하지 않으면 endpoint 가 `503 NOT_CONFIGURED` 반환 — 미설정 환경에서 안전.

#### (h) 알려진 Stripe API 버전 호환

webhook event destination 의 API version 을 `2026-04-22.dahlia` 이상으로 등록하면 `subscription.current_period_end` 가 `subscription.items[0].current_period_end` 로 이동. `functions/stripe.js` 의 `handleSubscriptionChange` 는 양쪽 모두 fallback 처리.

### 4. **프로모 코드 발급 (Phase 8-3)** 🎁

프로모 코드는 Firebase Console의 Firestore에서 직접 생성합니다. `promoCodes` 컬렉션에 아래 형태로 문서를 추가하면 즉시 활성화:

```
promoCodes/LAUNCH2026
  credits: 10                    // number  — 지급 크레딧
  maxUses: 1000                  // number? — 전체 사용 한도 (생략 시 무제한)
  usedCount: 0                   // number  — 서버가 트랜잭션으로 갱신 (초기값 0)
  expiresAt: 2026-12-31T23:59:59Z // Timestamp? — 만료일 (선택)
  perUserLimit: 1                // number  — 유저당 사용 횟수 (보통 1)
  note: "Launch giveaway"        // string? — 내부 메모
```

문서 ID(`LAUNCH2026`)가 사용자가 입력할 코드입니다. 사용자는 `/invite` 페이지의 프로모 코드 입력란에서 리딤합니다.

> 친구 초대는 별도 설정이 필요하지 않습니다. 모든 신규 유저가 `initializeUser` 호출 시점에 `VODA-XXXX` 형식의 `referralCode`를 자동 발급받고, `/invite` 페이지에서 링크를 공유할 수 있습니다.

### 5. **콘텐츠 모더레이션 운영 (Phase 8-4)** 🛡️

자동 필터(커스텀 커맨드 blocklist, 피드 공개 시 SFW 판정, 신고 3건 누적 시 자동 unlist)는 추가 설정 없이 동작합니다. 어드민 UI 는 아직 없으므로 운영은 Firebase Console 로 직접:

- **신고 확인**: Firestore `reports/{uid}_{designId}` 문서들. 필드: `designId`, `reporterId`, `reason` (`spam`/`nsfw`/`copyright`/`other`), `note?`, `createdAt`.
- **자동 unlist 된 디자인 확인**: `designs` 컬렉션에서 `moderationFlag` 값이 `auto_sfw` (SFW 자동 판정) 또는 `auto_reports` (3건 이상 신고) 인 문서.
- **강제 조치**: 문서 편집으로 `isListed=false`, `isPublic=false` 를 직접 설정. 삭제는 Storage 파일도 같이 지워야 하므로 가능하면 클라이언트의 소유자 삭제 UX를 유도하거나, `deleteDesign` 로직(`DesignService`)을 참고해 Storage 정리.
- **블록리스트 수정**: `functions/moderation.js` 의 `BLOCKLIST` 배열 편집 → `npm run deploy:functions`. (원격 관리형 blocklist 는 후속 작업.)

## 🧪 테스트 방법

### 1. 프론트엔드 개발 서버
```bash
npm run dev
# http://localhost:3000 접속
```

### 2. Firebase 에뮬레이터
```bash
firebase emulators:start
# Functions: http://localhost:5001
# Firestore: http://localhost:8080
# Hosting: http://localhost:5000
```

### 3. 빌드 테스트
```bash
npm run build
firebase serve
```

### 4. Firestore 규칙 단위 테스트
```bash
# Firestore 에뮬레이터 + vitest 실행
npm run test:rules
```

## 📱 주요 기능 테스트 시나리오

1. **이미지 업로드**: 파일 선택 또는 드래그&드롭 (최대 3장)
2. **카메라 촬영**: 모바일에서 카메라 버튼 클릭
3. **스타일 선택**: 12가지 스타일 + 커스텀 중 선택
4. **AI 분석**: "디자인 생성" 버튼으로 AI 호출
5. **결과 확인**: Before/After 비교, 컬러 팔레트, 가구 추천, 조명 계획 등 확인
6. **저장 및 공유**: 로그인 후 My Designs 저장, 공유 링크 생성, 커뮤니티 피드 공개

## 🔧 다음 단계 개발 계획

향후 로드맵(크레딧/결제, 앱 스토어 출시, Object Replace, 쇼핑 링크, 커뮤니티 고도화 등)은 [`PRODUCT_PLAN.md`](./PRODUCT_PLAN.md) Phase 8~10 참고.

## 🐛 알려진 이슈

1. **빌드 크기**: React 번들이 500KB+ (code splitting 고려)
2. **Node.js 버전**: Functions 엔진이 Node 20이지만 현재 22.14 사용 중
3. **에뮬레이터 포트**: Hosting이 기본 포트 5000 대신 5002 사용

## 📞 지원

- Firebase Console: https://console.firebase.google.com/project/voda-7647c
- Google AI Studio: https://aistudio.google.com/
- 프로젝트 저장소: https://github.com/uihyun/voda