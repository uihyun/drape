# Analytics & data-driven decisions

A living doc for deciding product questions from data instead of guessing. Pair
with the Firebase console:
https://console.firebase.google.com/project/drape-9e532/analytics

**Caveats up front**
- Native analytics only flows once **1.2.0 / build 9** (which bundles
  `@capacitor-firebase/analytics`) is installed on devices. Before that the only
  data is **web** traffic. (App-version panel shows "no data" for android/ios.)
- Standard reports lag **up to ~24h**. Realtime/DebugView are live (DebugView
  needs the device in debug mode: iOS scheme arg `-FIRDebugEnabled`).
- Firebase console is **aggregate** — no per-individual-user view. For per-user
  journeys/funnels, link **BigQuery** (raw events keyed by the uid we set).
- Pre-launch: samples are tiny right now; treat early numbers as directional.

---

## Open decision #1 — default home screen (feed vs profile)

We ship a *selectable* home (feed ↔ profile) + onboarding choice + first-run
nudge; we have **not** hard-set a universal default. Decide it from data, not a
hunch, and **don't disrupt existing users** — at most change the default for new
installs.

**What to look at (in priority order):**

| # | Question | Metric | Where | Instrumented? |
|---|----------|--------|-------|----------------|
| ① | Who *retains* better — profile-home vs feed-home starters? | D1/D7/D30 retention split by `home_pref` | Retention report / Audiences comparison by user property | ✅ `home_pref` user property (set on login) |
| ② | Who *activates* — reaches a core action in the first session? | conversion to `item_add` / `ootd_log` / `tryon_start` | Events / Funnels | ✅ action events logged |
| ③ | Where do people actually spend time? | views + avg engagement time per screen (feed vs profile/closet/calendar) | Engagement → Screens and screen classes | ✅ `screen_view` per route |
| ④ | Do feed-starters quickly head to their own closet? (your hypothesis) | time/▸rate from feed → profile/closet in first session | BigQuery path/sequence (clunky in console) | ◑ inferable from `screen_view` order |
| ⑤ | Do reminders/social push actually bring people back? | `notification_open` rate → subsequent actions / retention | Events + cohort | ◑ `notification_open` logged; tie-to-retention needs cohort/BigQuery |

**Decision rule:** prefer the landing with higher **D7 retention** AND higher
first-session **activation**, given a meaningful sample. Time-on-screen (③) is
supporting only — long dwell can mean "engaged" OR "lost," so never decide on it
alone. If ④ shows feed-starters jump to profile fast, that argues for
profile-first.

---

## Currently instrumented (as of 2026-06-28, build 9)

- `screen_view` on every route change (App.jsx `logScreen`; native via plugin,
  web via SDK) — drives the Screens report + time-on-screen.
- `setUserId(uid)` + **`home_pref` user property** (`feed`/`profile`) on login —
  events tied to the account, and retention/activation can be split by landing.
- **Core action events**: `item_add` (source: manual/detected/existing_photo),
  `ootd_log` (has_photo/is_new), `tryon_start` (mode: items/outfit_ref/custom_photo),
  `outfit_create` (item_count).
- `notification_open` on a push tap (with the target route).
- Existing custom events: `follow_added` / `follow_removed` /
  `follow_list_opened` / `comment_posted` / `comment_deleted` /
  `report_submitted` (now fire on native too, since `logEvent` routes through the
  plugin).
- Firebase auto-collected: `first_open`, `session_start`, `user_engagement`
  (engagement time), retention cohorts.

## Instrumentation status

- ✅ `home_pref` user property (set on login).
- ✅ Core action events (`item_add`/`ootd_log`/`tryon_start`/`outfit_create`).
- ◻︎ Optional later: `like` / `save` events.

① (retention by landing) and ② (activation) are answerable from the **console**
once build 9 data accrues. ④/⑤ (per-user funnels) use **BigQuery** below.

---

## Deep analysis — BigQuery (one-time console setup, then SQL)

**Enable (Firebase Console):** Project settings → **Integrations → BigQuery →
Link**. Pick the dataset region, enable **daily** export (streaming optional),
include the app + web data streams. Data starts landing the next day in dataset
`analytics_<GA4_PROPERTY_ID>`, table `events_YYYYMMDD` (+ `events_intraday_*` if
streaming). Open it at console.cloud.google.com/bigquery (project drape-9e532).

GA4 event rows have: `user_id` (our uid via setUserId), `user_pseudo_id`,
`event_name`, `event_timestamp`, repeated `event_params`, repeated
`user_properties` (incl. `home_pref`). Replace `analytics_XXXXXX` with the real
dataset name below.

**① Activation by landing — % of new users who do a core action, split by home_pref**
```sql
WITH u AS (
  SELECT user_pseudo_id,
    (SELECT value.string_value FROM UNNEST(user_properties) WHERE key='home_pref') AS home_pref,
    COUNTIF(event_name IN ('item_add','ootd_log','tryon_start')) AS core_actions
  FROM `drape-9e532.analytics_XXXXXX.events_*`
  WHERE _TABLE_SUFFIX >= FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 28 DAY))
  GROUP BY 1,2)
SELECT home_pref,
  COUNT(*) AS users,
  ROUND(100*COUNTIF(core_actions>0)/COUNT(*),1) AS activated_pct
FROM u WHERE home_pref IS NOT NULL GROUP BY 1;
```

**② D7 retention by landing — returned ~7 days after first seen, split by home_pref**
```sql
WITH first_seen AS (
  SELECT user_pseudo_id,
    MIN(DATE(TIMESTAMP_MICROS(event_timestamp))) AS d0,
    ANY_VALUE((SELECT value.string_value FROM UNNEST(user_properties) WHERE key='home_pref')) AS home_pref
  FROM `drape-9e532.analytics_XXXXXX.events_*` GROUP BY 1),
days AS (
  SELECT user_pseudo_id, DATE(TIMESTAMP_MICROS(event_timestamp)) AS d
  FROM `drape-9e532.analytics_XXXXXX.events_*` GROUP BY 1,2)
SELECT f.home_pref,
  COUNT(DISTINCT f.user_pseudo_id) AS cohort,
  ROUND(100*COUNT(DISTINCT IF(d.d=DATE_ADD(f.d0, INTERVAL 7 DAY), f.user_pseudo_id, NULL))
        /COUNT(DISTINCT f.user_pseudo_id),1) AS d7_pct
FROM first_seen f JOIN days d USING (user_pseudo_id)
WHERE f.home_pref IS NOT NULL GROUP BY 1;
```

**④ Feed-starters who reach their closet/profile in the first session**
```sql
SELECT
  COUNTIF(EXISTS(SELECT 1 FROM UNNEST(event_params) WHERE key='firebase_screen' AND value.string_value IN ('profile','closet','profile_closet'))) AS reached_profile,
  COUNT(DISTINCT user_pseudo_id) AS users
FROM `drape-9e532.analytics_XXXXXX.events_*`
WHERE event_name='screen_view'
  AND _TABLE_SUFFIX >= FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 28 DAY));
```

**⑤ Push → action: actions within 1h after a notification_open**
```sql
WITH opens AS (
  SELECT user_pseudo_id, event_timestamp AS t
  FROM `drape-9e532.analytics_XXXXXX.events_*` WHERE event_name='notification_open'),
acts AS (
  SELECT user_pseudo_id, event_timestamp AS t
  FROM `drape-9e532.analytics_XXXXXX.events_*`
  WHERE event_name IN ('item_add','ootd_log','tryon_start','outfit_create'))
SELECT COUNT(DISTINCT o.user_pseudo_id) AS users_acted_after_push
FROM opens o JOIN acts a USING (user_pseudo_id)
WHERE a.t BETWEEN o.t AND o.t + 3600*1000000;
```

(These are starting points — refine windows/screen names as needed. Note GA4
export lags ~a day; needs build 9 live on devices for app data.)

---

## How we'll work this
Check the console periodically; log findings + the eventual decisions below so the
reasoning is preserved.

- _(2026-06-28)_ Decision deferred to data; instrumentation gap noted above.
