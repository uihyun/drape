// Periodic friendly reminder push. Runs hourly; for each user it fires only at
// their LOCAL evening (so no 3am buzz), at most once every ~2–3 days, rotating
// through the localized copy in reminders-copy.js. Native-only in effect (web
// users have no fcmTokens). Opt-out via profiles/{uid}.remindersOptOut.
//
// Targeting data lives on profiles/{uid}: timezone (IANA), lang, lastReminderAt,
// reminderIdx — captured at login (App.jsx → updateProfile).

const admin = require('firebase-admin');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { sendToUser } = require('./push-send.js');
const { pickReminder } = require('./reminders-copy.js');

// Evening send window (local hours, inclusive): 6pm–9pm. The cron runs hourly,
// so a user enters the window at their local 6pm; MIN_GAP_MS then blocks the
// later hours, so they still get at most ONE reminder per ~2.5 days.
const SEND_HOUR_START = 18;
const SEND_HOUR_END = 21;
const MIN_GAP_MS = 2.5 * 24 * 60 * 60 * 1000;  // ≈ every 2–3 days
const ACTIVE_SKIP_MS = 20 * 60 * 60 * 1000;    // opened in last ~20h → don't nag
const BACKOFF_MS = 45 * 24 * 60 * 60 * 1000;   // dormant 45d+ → stop pestering

// User's local hour (0–23) for an IANA timezone, or null if the tz is bad.
function localHour(timezone) {
  try {
    const s = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hour12: false }).format(new Date());
    const h = parseInt(s, 10);
    return Number.isInteger(h) ? (h % 24) : null;
  } catch {
    return null;
  }
}

exports.sendReminders = onSchedule('0 * * * *', async () => {
  const db = admin.firestore();
  const now = Date.now();
  let checked = 0, sent = 0;

  let snap;
  try {
    snap = await db.collection('profiles').get();
  } catch (err) {
    console.warn('sendReminders: profiles read failed:', err.message);
    return;
  }

  for (const doc of snap.docs) {
    const p = doc.data() || {};
    if (p.remindersOptOut === true) continue;
    // No timezone captured yet → default to New York local time rather than
    // skipping, so users who never synced a tz still get an evening reminder.
    const tz = p.timezone || 'America/New_York';
    const h = localHour(tz);
    if (h < SEND_HOUR_START || h > SEND_HOUR_END) continue;
    // Activity gate: skip people currently using the app (no need to nag), and
    // back off from the long-dormant (pestering churned users only annoys).
    const activeMs = p.lastActiveAt && typeof p.lastActiveAt.toMillis === 'function'
      ? p.lastActiveAt.toMillis() : 0;
    if (!activeMs) continue;                          // no activity signal yet
    const idleFor = now - activeMs;
    if (idleFor < ACTIVE_SKIP_MS) continue;          // opened recently → engaged
    if (idleFor > BACKOFF_MS) continue;              // dormant too long → back off
    const lastMs = p.lastReminderAt && typeof p.lastReminderAt.toMillis === 'function'
      ? p.lastReminderAt.toMillis() : 0;
    if (lastMs && (now - lastMs) < MIN_GAP_MS) continue;

    checked++;
    const idx = Number.isInteger(p.reminderIdx) ? p.reminderIdx : 0;
    const msg = pickReminder(idx, p.lang || 'en');
    const r = await sendToUser(doc.id, {
      title: msg.title,
      body: msg.body,
      data: { type: 'reminder' },
      collapseKey: 'reminder',
    });
    // Only "spend" the slot when a device actually got it — otherwise a user
    // who hasn't registered for push yet keeps their place for when they do.
    if (r.ok && r.sent > 0) {
      sent++;
      await doc.ref.set({
        lastReminderAt: admin.firestore.FieldValue.serverTimestamp(),
        reminderIdx: idx + 1,
      }, { merge: true }).catch(err => console.warn('reminder bump failed:', doc.id, err.message));
    }
  }
  console.log(`sendReminders: ${sent} sent / ${checked} eligible (of ${snap.size} profiles)`);
});
