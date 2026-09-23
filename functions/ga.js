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
  // kind: 'screens' (default) = per-screen engagement; 'daily' = per-day app
  // active users + engagement; 'funnel' = landing visitors → installs → app
  // users, daily + range totals (batched GA queries, merged server-side);
  // 'channels' = acquisition sources (first-touch) + session sources.
  const kind = ['daily', 'funnel', 'channels', 'features'].includes(request.data?.kind) ? request.data.kind : 'screens';
  const key = `${kind}_${from}_${to}`;
  const hit = reportCache.get(key);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return { rows: hit.rows, cached: true };

  const token = await gaToken();

  // Feature funnel: did the new surfaces actually get used? One query,
  // event counts + reach, so Trends/stylist/import stop being unmeasured.
  if (kind === 'features') {
    const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/${PROPERTY}:runReport`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        dateRanges: [{ startDate: from, endDate: to }],
        dimensions: [{ name: 'eventName' }],
        metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
        dimensionFilter: {
          filter: {
            fieldName: 'eventName',
            inListFilter: {
              values: [
                'trends_view', 'trends_click',
                'stylist_recommend', 'stylist_tryon', 'stylist_feedback', 'stylist_look_saved',
                'import_shared', 'import_image_ready', 'import_item_saved', 'import_product_fastpath',
                'tryon_feedback', 'out_of_fits',
              ],
            },
          },
        },
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
        limit: 30,
      }),
    });
    const json = await res.json();
    if (json.error) throw new HttpsError('internal', 'GA_QUERY_FAILED', json.error.message);
    const rows = (json.rows || []).map((r) => ({
      event: r.dimensionValues[0].value,
      count: +r.metricValues[0].value,
      users: +r.metricValues[1].value,
    }));
    reportCache.set(key, { at: Date.now(), rows });
    return { rows, cached: false };
  }

  if (kind === 'channels') {
    const range = [{ startDate: from, endDate: to }];
    const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/${PROPERTY}:batchRunReports`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        requests: [
          // Who did we ACQUIRE (first-touch — the channel that brought the user in)
          {
            dateRanges: range,
            dimensions: [{ name: 'firstUserSource' }, { name: 'firstUserMedium' }],
            metrics: [{ name: 'newUsers' }, { name: 'activeUsers' }],
            orderBys: [{ metric: { metricName: 'newUsers' }, desc: true }],
            limit: 15,
          },
          // What's driving SESSIONS in range, split by platform (web vs app)
          {
            dateRanges: range,
            dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }, { name: 'platform' }],
            metrics: [{ name: 'sessions' }, { name: 'newUsers' }],
            orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
            limit: 15,
          },
        ],
      }),
    });
    const json = await res.json();
    if (json.error) throw new HttpsError('internal', 'GA_QUERY_FAILED', json.error.message);
    const [rFirst, rSess] = json.reports || [];
    const acquisition = (rFirst?.rows || []).map((r) => ({
      source: r.dimensionValues[0].value,
      medium: r.dimensionValues[1].value,
      newUsers: +r.metricValues[0].value,
      activeUsers: +r.metricValues[1].value,
    }));
    const traffic = (rSess?.rows || []).map((r) => ({
      source: r.dimensionValues[0].value,
      medium: r.dimensionValues[1].value,
      platform: r.dimensionValues[2].value,
      sessions: +r.metricValues[0].value,
      newUsers: +r.metricValues[1].value,
    }));
    reportCache.set(key, { at: Date.now(), rows: { acquisition, traffic } });
    return { rows: { acquisition, traffic }, cached: false };
  }

  if (kind === 'funnel') {
    const range = [{ startDate: from, endDate: to }];
    const web = { filter: { fieldName: 'platform', stringFilter: { value: 'web' } } };
    const app = { filter: { fieldName: 'platform', inListFilter: { values: ['iOS', 'Android'] } } };
    const firstOpen = { filter: { fieldName: 'eventName', stringFilter: { value: 'first_open' } } };
    const mk = (extra) => ({ dateRanges: range, dimensions: [{ name: 'date' }], orderBys: [{ dimension: { dimensionName: 'date' } }], limit: 400, ...extra });
    const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/${PROPERTY}:batchRunReports`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        requests: [
          mk({ metrics: [{ name: 'activeUsers' }], dimensionFilter: web }),
          mk({ metrics: [{ name: 'eventCount' }], dimensionFilter: firstOpen }),
          mk({ metrics: [{ name: 'activeUsers' }, { name: 'userEngagementDuration' }], dimensionFilter: app }),
          // range totals (no date dim) — daily uniques don't sum to range uniques
          { dateRanges: range, metrics: [{ name: 'activeUsers' }], dimensionFilter: web },
          { dateRanges: range, metrics: [{ name: 'activeUsers' }], dimensionFilter: app },
        ],
      }),
    });
    const json = await res.json();
    if (json.error) throw new HttpsError('internal', 'GA_QUERY_FAILED', json.error.message);
    const [rWeb, rOpen, rApp, tWeb, tApp] = json.reports || [];

    // batchRunReports takes at most FIVE requests — the five above are the
    // funnel itself and must not be crowded out. The per-store split and the
    // country breakdown go in a second call, and a failure there degrades to
    // empty rather than blanking the whole panel.
    let rIos, rAnd, rGeo;
    try {
      const res2 = await fetch(`https://analyticsdata.googleapis.com/v1beta/${PROPERTY}:batchRunReports`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          requests: [
            mk({ metrics: [{ name: 'activeUsers' }], dimensionFilter: { filter: { fieldName: 'platform', stringFilter: { value: 'iOS' } } } }),
            mk({ metrics: [{ name: 'activeUsers' }], dimensionFilter: { filter: { fieldName: 'platform', stringFilter: { value: 'Android' } } } }),
            // The only download signal GA has. The store consoles are the
            // authority; this is the one readable without leaving the page.
            {
              dateRanges: range,
              dimensions: [{ name: 'country' }, { name: 'platform' }],
              metrics: [{ name: 'eventCount' }],
              dimensionFilter: firstOpen,
              orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
              limit: 40,
            },
          ],
        }),
      });
      const json2 = await res2.json();
      if (json2.error) console.warn('GA split/geo report failed:', json2.error.message);
      else [rIos, rAnd, rGeo] = json2.reports || [];
    } catch (e) {
      console.warn('GA split/geo report failed:', e?.message);
    }
    const day = (v) => v.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
    const map = {};
    const put = (rep, fn) => (rep?.rows || []).forEach((r) => {
      const d = day(r.dimensionValues[0].value);
      map[d] = map[d] || { day: d, landing: 0, installs: 0, appUsers: 0, appEngagementSec: 0, ios: 0, android: 0 };
      fn(map[d], r.metricValues);
    });
    put(rWeb, (o, m) => { o.landing = +m[0].value; });
    put(rOpen, (o, m) => { o.installs = +m[0].value; });
    put(rApp, (o, m) => { o.appUsers = +m[0].value; o.appEngagementSec = Math.round(+m[1].value); });
    put(rIos, (o, m) => { o.ios = +m[0].value; });
    put(rAnd, (o, m) => { o.android = +m[0].value; });
    const daily = Object.values(map).sort((a, b) => a.day.localeCompare(b.day));

    // Installs per country, folded across platforms with the split kept so a
    // market that is Android-only (or iOS-only) is visible rather than averaged
    // away. Ordered by total, biggest first.
    const geoMap = {};
    (rGeo?.rows || []).forEach((r) => {
      const c = r.dimensionValues[0].value || '(unknown)';
      const plat = r.dimensionValues[1].value;
      const n = +r.metricValues[0].value;
      const g = (geoMap[c] ||= { country: c, installs: 0, ios: 0, android: 0 });
      g.installs += n;
      if (plat === 'iOS') g.ios += n;
      else if (plat === 'Android') g.android += n;
    });
    const geo = Object.values(geoMap).sort((a, b) => b.installs - a.installs).slice(0, 12);
    const totals = {
      landing: +(tWeb?.rows?.[0]?.metricValues?.[0]?.value || 0),
      installs: daily.reduce((s, r) => s + r.installs, 0),
      appUsers: +(tApp?.rows?.[0]?.metricValues?.[0]?.value || 0),
    };
    reportCache.set(key, { at: Date.now(), rows: { daily, totals, geo } });
    return { rows: { daily, totals, geo }, cached: false };
  }

  const body = kind === 'daily'
    ? {
        dateRanges: [{ startDate: from, endDate: to }],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'activeUsers' }, { name: 'userEngagementDuration' }],
        // App users only — the web platform is dominated by landing-page
        // visitors who never touch the product, which would drown the DAU
        // series (and the actions-per-user ratio) in marketing traffic.
        dimensionFilter: { filter: { fieldName: 'platform', inListFilter: { values: ['iOS', 'Android'] } } },
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
