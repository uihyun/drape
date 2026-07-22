// === GA4 screen engagement for /admin ==================================
// The admin dashboard's "where do users spend time" view. Data lives in the
// GA4 property (screen_view events logged by src/firebase.js logScreen); this
// callable proxies a runReport so the dashboard never needs GA credentials.
//
// Auth chain: the Functions runtime SA (gen2 default = compute SA,
// 284753548556-compute@developer.gserviceaccount.com) impersonates ga-reader@…,
// which is a Viewer on GA property 538664894. Requires the compute SA to hold
// roles/iam.serviceAccountTokenCreator on ga-reader (granted 2026-07-22).

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { GoogleAuth } = require('google-auth-library');
const { assertAdmin } = require('./admin.js');

const PROPERTY = 'properties/538664894';
const GA_SA = 'ga-reader@drape-9e532.iam.gserviceaccount.com';

// GA tokens last 1h; cache both the token and per-range reports briefly so
// spamming the date presets doesn't burn GA API quota.
let tokCache = { token: null, exp: 0 };
const reportCache = new Map(); // key → { at, rows }

async function gaToken() {
  if (tokCache.token && Date.now() < tokCache.exp) return tokCache.token;
  const auth = new GoogleAuth();
  const t = await auth.getAccessToken();
  const res = await fetch(`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${GA_SA}:generateAccessToken`, {
    method: 'POST',
    headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' },
    body: JSON.stringify({ scope: ['https://www.googleapis.com/auth/analytics.readonly'] }),
  });
  const json = await res.json();
  if (!json.accessToken) throw new HttpsError('internal', 'GA_IMPERSONATION_FAILED', json.error?.message);
  tokCache = { token: json.accessToken, exp: Date.now() + 45 * 60 * 1000 };
  return json.accessToken;
}

exports.adminScreenEngagement = onCall({ cors: true, timeoutSeconds: 60, memory: '256MiB' }, async (request) => {
  assertAdmin(request);
  const { from, to } = request.data || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from || '') || !/^\d{4}-\d{2}-\d{2}$/.test(to || '')) {
    throw new HttpsError('invalid-argument', 'FROM_TO_REQUIRED');
  }
  // kind: 'screens' (default) = per-screen engagement; 'daily' = per-day
  // active users + engagement (the DAU series the Firestore trends can't give).
  const kind = request.data?.kind === 'daily' ? 'daily' : 'screens';
  const key = `${kind}_${from}_${to}`;
  const hit = reportCache.get(key);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return { rows: hit.rows, cached: true };

  const token = await gaToken();
  const body = kind === 'daily'
    ? {
        dateRanges: [{ startDate: from, endDate: to }],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'activeUsers' }, { name: 'userEngagementDuration' }],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
        limit: 400,
      }
    : {
        dateRanges: [{ startDate: from, endDate: to }],
        dimensions: [{ name: 'unifiedScreenName' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'userEngagementDuration' }, { name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'userEngagementDuration' }, desc: true }],
        limit: 30,
      };
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/${PROPERTY}:runReport`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (json.error) throw new HttpsError('internal', 'GA_QUERY_FAILED', json.error.message);
  const rows = (json.rows || []).map((r) => (kind === 'daily'
    ? {
        day: r.dimensionValues[0].value.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'),
        users: +r.metricValues[0].value,
        engagementSec: Math.round(+r.metricValues[1].value),
      }
    : {
        screen: r.dimensionValues[0].value,
        views: +r.metricValues[0].value,
        engagementSec: Math.round(+r.metricValues[1].value),
        users: +r.metricValues[2].value,
      }));
  reportCache.set(key, { at: Date.now(), rows });
  return { rows, cached: false };
});
