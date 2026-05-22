// One-off: sandbox 테스트 계정의 오염된 subscription 데이터를 싹 비운다.
// 이 계정 (QAXV9mGsX3auq8MbgJCiXsoR2u22 / @vodaqaxv9mgs) 은
//   1) 예전 Stripe 웹 결제 테스트 → stripeCustomerId / stripeSubscriptionId 잔재
//   2) RC sandbox 결제 테스트
//   3) DB 수동 편집
// 셋이 겹쳐 꼬임. 모든 구독 필드를 삭제해 "한 번도 구독 안 한 free 유저" 로 리셋.
// 이후 깨끗한 sandbox 결제 1번 → webhook (INITIAL_PURCHASE) 이 정확한 값으로 채움.
//
// 실행: node scripts/fix-sandbox-sub.cjs
// 사전: gcloud auth application-default login (1회)

const admin = require('../functions/node_modules/firebase-admin');

admin.initializeApp({ projectId: 'voda-7647c' });
const db = admin.firestore();

const HANDLE = 'vodaqaxv9mgs';

// users/{uid} 에서 지울 구독 관련 필드 — Stripe webhook (functions/stripe.js) +
// RC webhook (functions/revenuecat.js) 이 쓰는 것 전부.
const SUB_FIELDS = [
  'plan',
  'subscriptionStatus',
  'subscriptionRenewsAt',
  'cancelAtPeriodEnd',
  'stripeCustomerId',
  'stripeSubscriptionId',
  'iosLastEventType',
  'iosLastEventAt',
  'iosProductId',
];

(async () => {
  const handleSnap = await db.collection('handles').doc(HANDLE).get();
  if (!handleSnap.exists) {
    console.error(`handles/${HANDLE} 없음`);
    process.exit(1);
  }
  const uid = handleSnap.data().uid;
  console.log(`uid: ${uid}`);

  const userRef = db.collection('users').doc(uid);
  const before = (await userRef.get()).data() || {};
  console.log('현재 구독 관련 필드:');
  for (const f of SUB_FIELDS) {
    if (f in before) {
      const v = before[f];
      console.log(`  ${f}: ${v?.toDate?.()?.toISOString?.() ?? v}`);
    }
  }

  const update = {};
  for (const f of SUB_FIELDS) {
    update[f] = admin.firestore.FieldValue.delete();
  }
  await userRef.set(update, { merge: true });
  console.log(`\n삭제 완료 — ${SUB_FIELDS.length}개 필드 제거. 이제 free 유저 상태.`);
  process.exit(0);
})().catch((err) => {
  console.error('실패:', err.message);
  process.exit(1);
});
