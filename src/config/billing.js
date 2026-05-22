// Billing catalog — single source of truth for plans and credit packs.
//
// When Stripe is wired up later:
//   1. Create Products + Prices in Stripe Dashboard (or via the
//      "Run Payments with Stripe" Firebase Extension, which writes to
//      /products/{id}/prices/{id} in Firestore).
//   2. Fill in the `stripePriceId` / `stripeProductId` fields below with
//      the LIVE or TEST ids depending on environment.
//   3. Mirror the same prices into RevenueCat offerings for IAP — use the
//      same `id` as the RevenueCat entitlement identifier.
//
// Any entry with `stripePriceId: null` is treated as "not yet configured"
// and its CTA renders as "Coming soon" instead of opening checkout.

export const PLAN_IDS = {
  FREE: 'free',
  PRO: 'pro',
};

// Studio (B2B / API / 상업) 는 미래 트랙 — 진짜 B2B 수요가 검증되면 다시 추가.
// 그 전엔 Free / Pro 두 단계만 — Pro 무제한 + Free 는 일일 로그인 / 친구 초대로
// 크레딧 충당.

export const PLANS = [
  {
    id: PLAN_IDS.FREE,
    nameKey: 'planFreeName',
    taglineKey: 'planFreeTagline',
    priceMonthlyUsd: 0,
    creditsPerMonth: 5,
    featureKeys: ['planFeatWatermark', 'planFeatFeed'],
    stripePriceIdMonthly: null,
    stripeProductId: null,
    highlight: false,
  },
  {
    id: PLAN_IDS.PRO,
    nameKey: 'planProName',
    taglineKey: 'planProTagline',
    priceMonthlyUsd: 9.99,
    creditsPerMonth: 100,
    featureKeys: [
      'planFeatUnlimited',
      'planFeatNoWatermark',
      'planFeatUnlimitedChat',
      'planFeatUnlimitedEdit',
    ],
    trialDays: 3,
    stripePriceIdMonthly: 'price_1TVGpKBZu7X3HW9susdGafnf',
    stripeProductId: 'prod_UUFJu67Nmgntgm',
    highlight: true,
  },
];

// 크레딧 팩 제거 — Free / Pro 단순화 정책. 가끔 사용자는 Free 의 일일 로그인
// + 친구 초대로 크레딧 충당. 진짜 더 필요하면 Pro 짧은 기간 구독.
export const CREDIT_PACKS = [];

export function isPlanPurchasable(plan) {
  if (plan.id === PLAN_IDS.FREE) return true;
  return Boolean(plan.stripePriceIdMonthly);
}

export function isPackPurchasable(pack) {
  return Boolean(pack && pack.stripePriceId);
}
