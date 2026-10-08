import { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2, LocateFixed } from 'lucide-react';
import { WeatherService } from '../services/weather-service.js';
import { useLocale } from '../hooks/useLocale.jsx';

// Where weather comes from: the device's location (preferred — the app asks
// once on its own the first time weather is needed), or any city in the
// world by search for anyone who declined. Used inline wherever weather would
// show (calendar, stylist) and in Settings to change it.
//
// `wx` is the object from useWeatherPlace: { place, locating, denied, locate }.
export function WeatherPlacePicker({ wx, showWhy = false, onDone }) {
  const { t, lang } = useLocale();
  const { place, locating, denied, locate } = wx;
  const [editing, setEditing] = useState(!place);
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const timer = useRef(null);

  useEffect(() => { if (place) setEditing(false); }, [place]);

  useEffect(() => {
    clearTimeout(timer.current);
    if (!q.trim()) { setResults([]); return undefined; }
    timer.current = setTimeout(async () => {
      setBusy(true);
      try { setResults(await WeatherService.searchPlaces(q, lang)); }
      finally { setBusy(false); }
    }, 450);
    return () => clearTimeout(timer.current);
  }, [q, lang]);

  const choose = async (p) => {
    setSaving(true);
    try {
      await WeatherService.savePlace({ lat: p.lat, lon: p.lon, label: p.label, country: p.country, tz: p.tz });
      setQ('');
      setResults([]);
      onDone?.();
    } catch (e) {
      console.warn('weather place save failed:', e?.message);
    } finally { setSaving(false); }
  };

  if (place && !editing) {
    return (
      <div className="wxpick-current">
        <MapPin size={14} strokeWidth={1.8} />
        <span>{place.label}</span>
        <button type="button" className="wxpick-change" onClick={() => setEditing(true)}>{t('wxChange')}</button>
      </div>
    );
  }

  return (
    <div className="wxpick">
      {showWhy && <p className="wxpick-why">{t('wxWhy')}</p>}
      <button type="button" className="wxpick-locate" onClick={async () => { await locate(); onDone?.(); }} disabled={locating}>
        {locating ? <Loader2 size={15} className="spin" /> : <LocateFixed size={15} strokeWidth={1.8} />}
        {t('wxUseLocation')}
      </button>
      {denied && <p className="wxpick-denied">{t('wxDenied')}</p>}
      <div className="wxpick-search">
        <input
          type="search"
          className="page-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('wxSearchPlaceholder')}
          autoComplete="off"
          disabled={saving}
        />
        {(busy || saving) && <Loader2 size={14} className="spin wxpick-spin" />}
      </div>
      {results.length > 0 && (
        <ul className="wxpick-results">
          {results.map((r) => (
            <li key={`${r.lat},${r.lon}`}>
              <button type="button" onClick={() => choose(r)} disabled={saving}>
                <span className="wxpick-name">{r.label}</span>
                <span className="wxpick-sub">{r.sub}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {place && (
        <button type="button" className="wxpick-cancel" onClick={() => { setEditing(false); setQ(''); }}>{t('cancel')}</button>
      )}
    </div>
  );
}

export default WeatherPlacePicker;
