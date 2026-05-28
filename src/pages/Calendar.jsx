import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X, Plus, Star } from 'lucide-react';
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
  // byDate is now { [date]: ootd[] } — multi-OOTD per day. Calendar
  // cell renders entries[0] (most recent) as the representative.
  const [byDate, setByDate] = useState({});
  const [sheetDate, setSheetDate] = useState(null); // 'YYYY-MM-DD' or null
  const [sheetExisting, setSheetExisting] = useState(null); // ootd doc or null = create new
  const [pickerDate, setPickerDate] = useState(null); // day with N>1 entries
  const [search, setSearch] = useSearchParams();

  // Deep-link entry: /profile/calendar?ootd=today (or ?ootd=YYYY-MM-DD)
  // opens the OOTD sheet for that date. Used by the create sheet's
  // "New OOTD" so the user doesn't have to navigate to calendar and
  // then tap today's cell. Depends on `search` (not []) so the effect
  // re-fires when the user lands here via a same-route URL change —
  // e.g. they're already on /profile/calendar and tap "New OOTD".
  // The setSearch below strips the param and causes one extra no-op
  // run that early-returns on `if (!o)`.
  useEffect(() => {
    const o = search.get('ootd');
    if (!o) return;
    const date = o === 'today' ? ymd(new Date()) : o;
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) setSheetDate(date);
    const next = new URLSearchParams(search);
    next.delete('ootd');
    setSearch(next, { replace: true });
  }, [search]);

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
        <button className="btn btn-primary" onClick={onSignIn}>{t('signIn')}</button>
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
          const entries = byDate[dateStr] || [];
          const rep = entries[0]; // most-recent = the calendar representative
          const isToday = ymd(today) === dateStr;
          const openCell = () => {
            if (entries.length === 0) {
              setSheetExisting(null);
              setSheetDate(dateStr);
            } else if (entries.length === 1) {
              setSheetExisting(entries[0]);
              setSheetDate(dateStr);
            } else {
              setPickerDate(dateStr);
            }
          };
          return (
            <button
              type="button"
              key={i}
              className={`calendar-cell ${isToday ? 'today' : ''}`}
              onClick={openCell}
              aria-label={`${dateStr}${entries.length ? ' (logged)' : ''}`}
            >
              <span className="calendar-day-num">{d}</span>
              {(rep?.photoCutUrl || rep?.photoUrl) && (
                <img
                  src={rep.photoCutUrl || rep.photoUrl}
                  alt=""
                  className={`calendar-thumb${rep.photoCutUrl ? ' is-cut' : ''}`}
                  loading="lazy"
                />
              )}
              {rep?.outfitId && !rep.photoUrl && (
                <span className="calendar-pill">OOTD</span>
              )}
              {entries.length > 1 && (
                <span className="calendar-multi-badge">+{entries.length - 1}</span>
              )}
            </button>
          );
        })}
      </div>

      <OotdSheet
        open={!!sheetDate}
        date={sheetDate}
        user={user}
        existing={sheetExisting}
        onClose={() => { setSheetDate(null); setSheetExisting(null); }}
        onSaved={refetch}
      />

      {pickerDate && (
        <DayPicker
          date={pickerDate}
          entries={byDate[pickerDate] || []}
          onClose={() => setPickerDate(null)}
          onPick={(entry) => {
            setSheetExisting(entry);
            setSheetDate(pickerDate);
            setPickerDate(null);
          }}
          onAddNew={() => {
            setSheetExisting(null);
            setSheetDate(pickerDate);
            setPickerDate(null);
          }}
          onSetRep={async (entry) => {
            try {
              await OotdService.setCalendarRepresentative({
                uid: user.uid,
                date: pickerDate,
                id: entry.id,
              });
              refetch();
            } catch (err) {
              console.warn('setCalendarRepresentative failed:', err.message);
            }
          }}
          t={t}
        />
      )}
    </div>
  );
}

// Small sheet shown when a day has 2+ OOTDs — choose which to edit or
// add a brand-new one. Star button on each card sets that OOTD as the
// calendar cell's representative (cover). Tapping the card body opens
// the OotdSheet in edit mode for that specific OOTD.
function DayPicker({ date, entries, onClose, onPick, onAddNew, onSetRep, t }) {
  // First entry from listMonth's sort is the current rep — either the
  // explicit isCalendarRep flag or fallback to most-recent.
  const repId = entries.find(e => e.isCalendarRep)?.id || entries[0]?.id;
  return (
    <div className="create-sheet-overlay" onClick={onClose}>
      <div className="create-sheet day-picker" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="create-sheet-handle" />
        <button type="button" className="create-sheet-close" onClick={onClose} aria-label={t('close')}>
          <X size={18} />
        </button>
        <h3 className="create-sheet-title">{date}</h3>
        <p className="day-picker-hint">{t('ootdRepHint')}</p>
        <div className="day-picker-grid">
          {entries.map(e => {
            const isRep = e.id === repId;
            return (
              <div key={e.id} className="day-picker-card">
                <button
                  type="button"
                  className="day-picker-thumb-btn"
                  onClick={() => onPick(e)}
                >
                  <div className="day-picker-thumb">
                    {(e.photoCutUrl || e.photoUrl)
                      ? <img src={e.photoCutUrl || e.photoUrl} alt="" />
                      : <div className="item-card-skeleton" />}
                  </div>
                </button>
                <button
                  type="button"
                  className={`day-picker-rep${isRep ? ' active' : ''}`}
                  onClick={(ev) => { ev.stopPropagation(); if (!isRep) onSetRep(e); }}
                  aria-label={isRep ? t('ootdRepActive') : t('ootdSetRep')}
                  aria-pressed={isRep}
                  title={isRep ? t('ootdRepActive') : t('ootdSetRep')}
                >
                  <Star size={14} strokeWidth={1.7} fill={isRep ? 'currentColor' : 'none'} />
                </button>
                {e.note && <span className="day-picker-note">{e.note}</span>}
              </div>
            );
          })}
          <button type="button" className="day-picker-card day-picker-add" onClick={onAddNew}>
            <div className="day-picker-thumb day-picker-add-thumb">
              <Plus size={24} strokeWidth={1.5} />
            </div>
            <span className="day-picker-note">{t('ootdAddNew')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
