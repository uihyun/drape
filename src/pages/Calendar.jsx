import { useEffect, useMemo, useState } from 'react';
import { OotdService } from '../services/ootd-service.js';
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

export function Calendar({ user, onSignIn }) {
  const { t } = useLocale();
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [byDate, setByDate] = useState({});

  const year = cursor.getFullYear();
  const month0 = cursor.getMonth();
  const days = monthDays(year, month0);
  const monthStart = `${year}-${String(month0 + 1).padStart(2, '0')}-01`;
  const monthEnd = `${year}-${String(month0 + 1).padStart(2, '0')}-${String(days).padStart(2, '0')}`;

  useEffect(() => {
    if (!user || user.isAnonymous) return;
    OotdService.listMonth({ uid: user.uid, monthStart, monthEnd })
      .then(setByDate)
      .catch(() => setByDate({}));
  }, [user, monthStart, monthEnd]);

  if (!user || user.isAnonymous) {
    return (
      <div className="empty-state">
        <i className="material-icons">calendar_month</i>
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
    <div className="calendar">
      <div className="calendar-header">
        <button className="btn btn-secondary" onClick={() => setCursor(new Date(year, month0 - 1, 1))}>
          <i className="material-icons">chevron_left</i>
        </button>
        <h2>{monthLabel}</h2>
        <button className="btn btn-secondary" onClick={() => setCursor(new Date(year, month0 + 1, 1))}>
          <i className="material-icons">chevron_right</i>
        </button>
      </div>

      <div className="calendar-weekdays">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} className="calendar-weekday">{t(`weekdays.${d.toLowerCase()}`)}</div>
        ))}
      </div>

      <div className="calendar-grid">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} className="calendar-cell empty" />;
          const dateStr = ymd(new Date(year, month0, d));
          const entry = byDate[dateStr];
          const isToday = ymd(today) === dateStr;
          return (
            <div key={i} className={`calendar-cell ${isToday ? 'today' : ''}`}>
              <span className="calendar-day-num">{d}</span>
              {entry?.photoUrl && (
                <img src={entry.photoUrl} alt="" className="calendar-thumb" loading="lazy" />
              )}
              {entry?.outfitId && !entry.photoUrl && (
                <span className="calendar-pill">OOTD</span>
              )}
            </div>
          );
        })}
      </div>

      <p className="muted" style={{ marginTop: '1rem' }}>
        {t('calendarHint')}
      </p>
    </div>
  );
}
