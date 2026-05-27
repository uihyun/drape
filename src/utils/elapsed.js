// Days since a YYYY-MM-DD date string, floor — null if missing.
// Uses local-day boundaries so "yesterday" lands at 1, not 0.999.
export function daysSince(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = String(dateStr).split('-').map(Number);
  if (!y || !m || !d) return null;
  const then = new Date(y, m - 1, d).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.max(0, Math.floor((today - then) / 86400000));
}

// Localized "n days ago" / "3 months ago" / "Not worn yet" string.
// Pass the same t() the caller uses so the strings stay in the active locale.
export function elapsedLabel(dateStr, t) {
  const days = daysSince(dateStr);
  if (days == null) return t('elapsedNever');
  if (days < 7) return t('elapsedDaysAgo', { n: days });
  if (days < 30) return t('elapsedWeeksAgo', { n: Math.floor(days / 7) });
  if (days < 365) return t('elapsedMonthsAgo', { n: Math.floor(days / 30) });
  return t('elapsedYearsAgo', { n: Math.floor(days / 365) });
}

// Usage bucket key + sort order. Lower order = shown first in the Usage view.
//   week (<=7d), month (<=30d), quarter (<=90d), half (<=180d),
//   dormant (>180d), never (no wearLog)
export function usageBucket(dateStr) {
  const days = daysSince(dateStr);
  if (days == null) return { key: 'never', order: 6 };
  if (days <= 7) return { key: 'week', order: 1 };
  if (days <= 30) return { key: 'month', order: 2 };
  if (days <= 90) return { key: 'quarter', order: 3 };
  if (days <= 180) return { key: 'half', order: 4 };
  return { key: 'dormant', order: 5 };
}
