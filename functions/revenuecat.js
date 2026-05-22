// RevenueCat webhook handler — App Store / Play Store IAP 결제·갱신·취소·환불
// 이벤트 받아서 Firestore `users/{uid}.plan` 동기화. Stripe webhook 의 iOS
// 카운터파트.
//
// 설정:
//   1. RevenueCat dashboard → Project settings → Integrations → Webhooks
//   2. URL: https://us-central1-<drape-project-id>.cloudfunctions.net/revenueCatWebhook
//      (또는 *.run.app 직접 URL — gcloud run services describe revenuecatwebhook)
//   3. Authorization header: 임의의 secret (env var 로 보관, 검증)
//
// Event types: https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
//   - INITIAL_PURCHASE / RENEWAL / NON_RENEWING_PURCHASE  → plan='pro'
//   - PRODUCT_CHANGE                                        → plan reflects new
//   - CANCELLATION (user-initiated, will keep until period end) → cancelAtPeriodEnd=true
//   - EXPIRATION (period actually ended)                   → plan='free'
//   - BILLING_ISSUE                                         → plan stays, status flag
//   - SUBSCRIBER_ALIAS                                      → no-op (RC internal)
//
// app_user_id == Firebase UID (RevenueCatService.login(uid) 가 박아둠).

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

const db = admin.firestore();

// RC dashboard 의 Authorization header 와 일치해야 통과.
const REVENUECAT_WEBHOOK_AUTH = defineSecret('REVENUECAT_WEBHOOK_AUTH');

const PRO_EVENT_TYPES = new Set([
    'INITIAL_PURCHASE',
    'RENEWAL',
    'NON_RENEWING_PURCHASE',
    'PRODUCT_CHANGE',
    'UNCANCELLATION',
]);
const FREE_EVENT_TYPES = new Set([
    'EXPIRATION',
]);

exports.revenueCatWebhook = onRequest({
    secrets: [REVENUECAT_WEBHOOK_AUTH],
    timeoutSeconds: 60,
}, async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }

    // Authorization 검증 — RC dashboard 에 박아둔 secret.
    const expected = REVENUECAT_WEBHOOK_AUTH.value();
    const got = req.get('Authorization') || '';
    if (!expected || got !== expected) {
        console.warn('RC webhook auth mismatch');
        res.status(401).json({ error: 'UNAUTHORIZED' });
        return;
    }

    const event = req.body?.event;
    if (!event) { res.status(400).json({ error: 'BAD_REQUEST' }); return; }

    const uid = event.app_user_id;
    const eventType = event.type;
    const productId = event.product_id;
    const expirationMs = event.expiration_at_ms;
    const cancelReason = event.cancel_reason; // present on CANCELLATION
    const isTrialPeriod = event.period_type === 'TRIAL';

    if (!uid) {
        // anonymous customer (logIn 호출 전) — Firestore 사용자 안 잡힘.
        console.info('RC webhook: anonymous app_user_id, skipping', eventType);
        res.json({ ok: true, skipped: 'anonymous' });
        return;
    }

    try {
        const userRef = db.collection('users').doc(uid);
        // Guard: 계정 삭제 후 들어오는 trailing webhook 으로 user doc 부활 방지.
        // set merge 가 새 doc 을 만들면 다시 분석/구독 view 에 유령 사용자 생김.
        const userSnap = await userRef.get();
        if (!userSnap.exists) {
            console.info('RC webhook: user deleted, ignoring', { uid, eventType });
            res.json({ ok: true, skipped: 'user_deleted' });
            return;
        }
        const update = {
            iosLastEventType: eventType,
            iosLastEventAt: admin.firestore.FieldValue.serverTimestamp(),
            iosProductId: productId || null,
        };

        if (eventType === 'CANCELLATION') {
            // 사용자가 취소했지만 period 끝까지 유지 — 만료까지 plan='pro' 유지.
            update.cancelAtPeriodEnd = true;
            if (expirationMs) update.subscriptionRenewsAt = admin.firestore.Timestamp.fromMillis(expirationMs);
        } else if (PRO_EVENT_TYPES.has(eventType)) {
            update.plan = 'pro';
            update.subscriptionStatus = isTrialPeriod ? 'trialing' : 'active';
            update.cancelAtPeriodEnd = false;
            if (expirationMs) update.subscriptionRenewsAt = admin.firestore.Timestamp.fromMillis(expirationMs);
        } else if (FREE_EVENT_TYPES.has(eventType)) {
            // 실제 만료 시점 — Pro 종료 → free 로.
            update.plan = 'free';
            update.subscriptionStatus = 'expired';
            update.cancelAtPeriodEnd = false;
        } else if (eventType === 'BILLING_ISSUE') {
            // plan 은 유지, 상태 표시만.
            update.subscriptionStatus = 'past_due';
        } else {
            // 그 외 (TRANSFER / SUBSCRIBER_ALIAS / 등) 은 audit log 만 남기고 skip.
            console.info('RC webhook: untracked event type', eventType);
            res.json({ ok: true, skipped: eventType });
            return;
        }

        await userRef.set(update, { merge: true });
        console.info('RC webhook applied:', { uid, eventType, plan: update.plan });
        res.json({ ok: true });
    } catch (err) {
        console.error('RC webhook handling failed:', err);
        res.status(500).json({ error: 'WEBHOOK_HANDLING_FAILED' });
    }
});
