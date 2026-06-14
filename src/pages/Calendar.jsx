import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X, Plus, Check } from 'lucide-react';
import { OutfitService } from '../services/outfit-service.js';
import { loadFilters, saveFilters } from '../services/filterStore.js';
import { calendarWarm } from '../services/uiCache.js';
import { getPref, onPrefChange, PREF_CALENDAR_BG } from '../services/prefs.js';
import { buildSwipeState } from '../services/swipeNav.js';
import { OotdSheet } from '../components/OotdSheet.jsx';
import { useSheetDrag } from '../hooks/useSheetDrag.js';
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
  const navigate = useNavigate();
  const today = new Date();
  // Remember the month the user was viewing (30-min TTL, same store as the
  // tag filters) so leaving and coming back doesn't snap back to this month.
  const ckey = `calendar:${user?.uid || 'anon'}`;
  const [cursor, setCursor] = useState(() => {
    const saved = loadFilters(ckey, null);
    return (saved && Number.isInteger(saved.y) && Number.isInteger(saved.m))
      ? new Date(saved.y, saved.m, 1)
      : new Date(today.getFullYear(), today.getMonth(), 1);
  });
  useEffect(() => {
    saveFilters(ckey, { y: cursor.getFullYear(), m: cursor.getMonth() });
  }, [ckey, cursor]);
  // byDate is now { [date]: ootd[] } — multi-OOTD per day. Calendar
  // cell renders entries[0] (most recent) as the representative. Seeded from
  // the splash warm-up so the current month paints without a flash.
  const [byDate, setByDate] = useState(() => {
    if (!user || user.isAnonymous) return {};
    const mk = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    return calendarWarm.get(`${user.uid}|${mk}`) || {};
  });
  const [sheetDate, setSheetDate] = useState(null); // 'YYYY-MM-DD' or null
  const [sheetExisting, setSheetExisting] = useState(null); // ootd doc or null = create new
  const [pickerDate, setPickerDate] = useState(null); // day with N>1 entries
  const [search, setSearch] = useSearchParams();
  // Day-cell look: cutout (default) vs the full OOTD photo with its background.
  // Device-local pref; react live so toggling in Settings updates here too.
  const [showBg, setShowBg] = useState(() => getPref(PREF_CALENDAR_BG, false));
  useEffect(() => onPrefChange(PREF_CALENDAR_BG, setShowBg), []);

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
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setSheetDate(date);
      // Snap the visible month to the deep-linked date so the calendar
      // behind the sheet matches (it may have restored a different month).
      // Parse parts directly — `new Date('YYYY-MM-DD')` is UTC and can land
      // on the previous month at boundaries.
      const [yy, mm] = date.split('-').map(Number);
      setCursor(new Date(yy, mm - 1, 1));
    }
    const next = new URLSearchParams(search);
    next.delete('ootd');
    setSearch(next, { replace: true });
  }, [search]);

  const year = cursor.getFullYear();
  const month0 = cursor.getMonth();
  const days = monthDays(year, month0);
  const monthStart = `${year}-${String(month0 + 1).padStart(2, '0')}-01`;
  const monthEnd = `${year}-${String(month0 + 1).padStart(2, '0')}-${String(days).padStart(2, '0')}`;

  // Live month subscription so a cutout finishing server-side swaps in by
  // itself — no manual refresh, no bg→cutout flash. (refetch() is kept as a
  // no-op for the save/delete callbacks; the live stream already updates.)
  const refetch = () => {};
  useEffect(() => {
    if (!user || user.isAnonymous) { setByDate({}); return; }
    const mk = `${year}-${String(month0 + 1).padStart(2, '0')}`;
    return OutfitService.subscribeMonth({ uid: user.uid, monthStart, monthEnd }, (map) => {
      setByDate(map);
      calendarWarm.set(`${user.uid}|${mk}`, map); // keep the warm cache fresh
    });
  }, [user, monthStart, monthEnd]);

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
          // showBg → prefer the full photo (cover-fill, no cutout look);
          // else cutout first, photo as fallback. is-cut drives the
          // float-on-card styling, so only set it when actually showing one.
          const usingCut = !showBg && !!rep?.photoCutUrl;
          const thumbSrc = showBg
            ? (rep?.photoUrl || rep?.photoCutUrl)
            : (rep?.photoCutUrl || rep?.photoUrl);
          // Only wait on the cutout when we actually want it.
          const waitingCut = !showBg && rep && !rep.photoCutUrl && rep.photoCutStatus === 'processing';
          const openCell = () => {
            // No entries yet → straight to the log sheet. Any existing
            // entries (even just one) → the day picker, so the user can
            // see what's there and choose edit vs. add-another. Tapping
            // the single card from the picker still opens the editor.
            if (entries.length === 0) {
              setSheetExisting(null);
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
              {/* While the cutout is still being made, show a spinner instead
                  of the with-background photo, so the cell lands on its final
                  look (cutout OR original) in one step, not bg→cutout. */}
              {waitingCut ? (
                <span className="calendar-thumb-loading"><span className="spinner spinner-sm" /></span>
              ) : thumbSrc ? (
                <img
                  src={thumbSrc}
                  alt=""
                  className={`calendar-thumb${usingCut ? ' is-cut' : ''}`}
                  loading="lazy"
                />
              ) : null}
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
        onSaved={() => {
          // Linking items is now optional — no forced detour to /link.
          // Auto-tagging matches the worn pieces; users who want to fix or
          // attach more open "Link items" from the outfit detail.
          refetch();
        }}
      />

      {pickerDate && (
        <DayPicker
          date={pickerDate}
          entries={byDate[pickerDate] || []}
          onClose={() => setPickerDate(null)}
          onPick={(entry) => {
            // Tapping an existing look opens its full detail page (not the
            // edit sheet) — photo change / linking lives on the detail.
            // Hand over the day's entries so the detail can swipe between them.
            const ids = (byDate[pickerDate] || []).map(e => e.id);
            setPickerDate(null);
            navigate(`/o/${entry.id}`, { state: buildSwipeState(ids, ids.indexOf(entry.id), 'outfit') });
          }}
          onAddNew={() => {
            setSheetExisting(null);
            setSheetDate(pickerDate);
            setPickerDate(null);
          }}
          onSetRep={async (entry) => {
            try {
              await OutfitService.setCalendarRepresentative({
                uid: user.uid,
                date: pickerDate,
                id: entry.id,
              });
              refetch();
            } catch (err) {
              console.warn('setCalendarRepresentative failed:', err.message);
            }
          }}
          showBg={showBg}
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
function DayPicker({ date, entries, onClose, onPick, onAddNew, onSetRep, showBg = false, t }) {
  // First entry from listMonth's sort is the current rep — either the
  // explicit isCalendarRep flag or fallback to most-recent.
  const repId = entries.find(e => e.isCalendarRep)?.id || entries[0]?.id;
  // The cover/check affordance only matters with 2+ entries — a single
  // OOTD is trivially the cover, so we skip the hint + check there.
  const multi = entries.length > 1;
  const { sheetStyle, handleProps } = useSheetDrag(onClose);
  return (
    <div className="create-sheet-overlay" onClick={onClose}>
      <div className="create-sheet day-picker" style={sheetStyle} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="create-sheet-handle" {...handleProps} style={{ cursor: 'grab' }} />
        <button type="button" className="create-sheet-close" onClick={onClose} aria-label={t('close')}>
          <X size={18} />
        </button>
        <h3 className="create-sheet-title">{date}</h3>
        {multi
          ? <p className="day-picker-hint">{t('ootdRepHint')}</p>
          : <p className="day-picker-hint">{t('ootdDayHint')}</p>}
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
                    {(() => {
                      const src = showBg
                        ? (e.photoUrl || e.photoCutUrl)
                        : (e.photoCutUrl || e.photoUrl);
                      return src ? <img src={src} alt="" /> : <div className="item-card-skeleton" />;
                    })()}
                  </div>
                </button>
                {multi && (
                  <button
                    type="button"
                    className={`day-picker-rep${isRep ? ' active' : ''}`}
                    onClick={(ev) => { ev.stopPropagation(); if (!isRep) onSetRep(e); }}
                    aria-label={isRep ? t('ootdRepActive') : t('ootdSetRep')}
                    aria-pressed={isRep}
                    title={isRep ? t('ootdRepActive') : t('ootdSetRep')}
                  >
                    <Check size={14} strokeWidth={2.2} />
                  </button>
                )}
                {(e.name || e.note) && <span className="day-picker-note">{e.name || e.note}</span>}
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
