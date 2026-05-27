// Locale-aware compact number formatter for follower / count badges.
// 1234 → "1.2K" (en), "1.2천" (ko), "1.2万"…wait, ko collapses to
// "1.2천" / "1.2만" via Intl natively; ja yields "1.2万". Keeps long
// counts from wrecking the header layout once an account grows past a
// few thousand.
export function formatCount(n, lang = 'en') {
  const num = Number(n) || 0;
  try {
    return new Intl.NumberFormat(lang, {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(num);
  } catch {
    return String(num);
  }
}

export default formatCount;
