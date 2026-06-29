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
| ① | Who *retains* better — profile-home vs feed-home starters? | D1/D7/D30 retention split by `home_pref` | Retention report / Audiences comparison by user property | ❌ needs `home_pref` user property |
| ② | Who *activates* — reaches a core action in the first session? | conversion to `item_add` / `ootd_log` / `tryon_start` | Events / Funnels | ❌ needs those action events |
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
- `setUserId(uid)` on login — events are tied to the account.
- `notification_open` on a push tap (with the target route).
- Existing custom events: `follow_added` / `follow_removed` /
  `follow_list_opened` / `comment_posted` / `comment_deleted` /
  `report_submitted` (now fire on native too, since `logEvent` routes through the
  plugin).
- Firebase auto-collected: `first_open`, `session_start`, `user_engagement`
  (engagement time), retention cohorts.

## Gaps / TODO to make decision #1 robust

1. **`home_pref` user property** (`'feed' | 'profile'`) — set alongside
   `setUserId`, so retention/activation can be split by landing. *Smallest, most
   important — without it ① can't be answered.*
2. **Core action events**: `item_add`, `ootd_log`, `tryon_start` (and optionally
   `like`, `save`, `outfit_create`) — for activation (②) + funnels.
3. **BigQuery export** (free tier) — per-user journeys, feed→profile path (④),
   push→action attribution (⑤). One-time link in Firebase settings.

Until 1+2 are added we can see *where people spend time* (③) and overall
retention, but not *which starting screen makes people stay/do more* — the actual
decision. Decide whether to add them before relying on the comparison.

---

## How we'll work this
Check the console periodically; log findings + the eventual decisions below so the
reasoning is preserved.

- _(2026-06-28)_ Decision deferred to data; instrumentation gap noted above.
