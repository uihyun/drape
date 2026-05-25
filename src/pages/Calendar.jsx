import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { OotdService } from '../services/ootd-service.js';
import { OotdSheet } from '../components/OotdSheet.jsx';
import { useLocale } from '../hooks/useLocale.jsx';

function monthDays(year, month0) {
  return new Date(year, month0 + 1, 0).getDate();
}
function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

export function Calendar({ user, onSignIn, embedded = false }) {
  const { t } = useLocale();
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [byDate, setByDate] = useState({});
  const [sheetDate, setSheetDate] = useState(null); // 'YYYY-MM-DD' or null
  const [search, setSearch] = useSearchParams();

  // Deep-link entry: /profile/calendar?ootd=today (or ?ootd=YYYY-MM-DD)
  // opens the OOTD sheet for that date on mount. Used by the create
  // sheet's "Log OOTD" so the user doesn't have to first navigate to
  // calendar and then tap today's cell. We strip the param after read
  // so a back-navigation doesn't reopen it.
  useEffect(() => {
    const o = search.get('ootd');
    if (!o) return;
    const date = o === 'today' ? ymd(new Date()) : o;
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) setSheetDate(date);
    const next = new URLSearchParams(search);
    next.delete('ootd');
    setSearch(next, { replace: true });
  }, []);

  const year = cursor.getFullYear();
  const month0 = cursor.getMonth();
  const days = monthDays(year, month0);
  const monthStart = `${year}-${String(month0 + 1).padStart(2, '0')}-01`;
  const monthEnd = `${year}-${String(month0 + 1).padStart(2, '0')}-${String(days).padStart(2, '0')}`;

  const refetch = () => {
    if (!user || user.isAnonymous) return;
    OotdService.listMonth({ uid: user.uid, monthStart, monthEnd })
      .then(setByDate)
      .catch(() => setByDate({}));
  };

  useEffect(() => { refetch(); }, [user, monthStart, monthEnd]);

  if (!user || user.isAnonymous) {
    return (
      <div className="empty-state">
        <h2>{t('calendarSignInTitle')}</h2>
        <button className="btn btn-primary" onClick={onSignIn}>{t('signInGoogle')}</button>
      </div>
    );
  }

  // Grid: pad leading blanks so the first cell aligns to the right weekday.
  const firstWeekday = new Date(year, month0, 1).getDay(); // 0..6 (Sun)
  const cells = useMemo(() => {
    const arr = [];
    for (let i = 0; i < firstWeekday; i++) arr.push(null);
    for (let d = 1; d <= days; d++) arr.push(d);
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [firstWeekday, days]);

  const monthLabel = cursor.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });

  return (
    <div className={`calendar${embedded ? ' calendar-embedded' : ''}`}>
      <div className="calendar-header">
        <button type="button" className="btn" aria-label="Previous month" onClick={() => setCursor(new Date(year, month0 - 1, 1))}>
          <ChevronLeft size={20} strokeWidth={1.6} />
        </button>
        <h2>{monthLabel}</h2>
        <button type="button" className="btn" aria-label="Next month" onClick={() => setCursor(new Date(year, month0 + 1, 1))}>
          <ChevronRight size={20} strokeWidth={1.6} />
        </button>
      </div>

      <div className="calendar-weekdays">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} className="calendar-weekday">{t(`weekdaysShort.${d.toLowerCase()}`)}</div>
        ))}
      </div>

      <div className="calendar-grid">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} className="calendar-cell empty" />;
          const dateStr = ymd(new Date(year, month0, d));
          const entry = byDate[dateStr];
          const isToday = ymd(today) === dateStr;
          return (
            <button
              type="button"
              key={i}
              className={`calendar-cell ${isToday ? 'today' : ''}`}
              onClick={() => setSheetDate(dateStr)}
              aria-label={`${dateStr}${entry ? ' (logged)' : ''}`}
            >
              <span className="calendar-day-num">{d}</span>
              {entry?.photoUrl && (
                <img src={entry.photoUrl} alt="" className="calendar-thumb" loading="lazy" />
              )}
              {entry?.outfitId && !entry.photoUrl && (
                <span className="calendar-pill">OOTD</span>
              )}
            </button>
          );
        })}
      </div>

      <OotdSheet
        open={!!sheetDate}
        date={sheetDate}
        user={user}
        existing={sheetDate ? byDate[sheetDate] : null}
        onClose={() => setSheetDate(null)}
        onSaved={refetch}
      />
    </div>
  );
}
