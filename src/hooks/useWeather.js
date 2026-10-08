import { useCallback, useEffect, useState } from 'react';
import { WeatherService } from '../services/weather-service.js';
import { useLocale } from './useLocale.jsx';

// One automatic location request per account per device — the first time a
// weather surface (calendar, stylist) opens. After that the user asks again
// themselves ("Use my location"), so a decline is never re-prompted on load.
const askedKey = (uid) => `drape:wx:asked:${uid}`;
function askedBefore(uid) {
  try { return localStorage.getItem(askedKey(uid)) === '1'; } catch { return true; }
}
function markAsked(uid) {
  try { localStorage.setItem(askedKey(uid), '1'); } catch { /* ignore */ }
}
// Several weather surfaces can mount at once; only one should ask.
let inFlight = null;

// → { place, locating, denied, locate }
//   place: undefined while loading, null when none is set (then show the
//   picker — no weather is better than a wrong city's), else the place.
export function useWeatherPlace(user, { autoLocate = false } = {}) {
  const { lang } = useLocale();
  const uid = user && !user.isAnonymous ? user.uid : null;
  const [place, setPlace] = useState(undefined);
  const [locating, setLocating] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => WeatherService.subscribePlace(uid, setPlace), [uid]);

  const locate = useCallback(async () => {
    if (!uid) return;
    setLocating(true);
    setDenied(false);
    try {
      inFlight = inFlight || WeatherService.locate(lang);
      const r = await inFlight;
      if (r === 'denied') setDenied(true);
    } finally {
      inFlight = null;
      setLocating(false);
    }
  }, [uid, lang]);

  useEffect(() => {
    if (!autoLocate || !uid || place !== null || askedBefore(uid)) return;
    markAsked(uid);
    locate();
  }, [autoLocate, uid, place, locate]);

  return { place, locating, denied, locate };
}

// { 'YYYY-MM-DD': {code, meanC, maxC, minC} } for the range; {} until loaded.
export function useDailyWeather(place, start, end) {
  const [days, setDays] = useState({});
  const key = place ? `${place.lat},${place.lon}:${start}:${end}` : null;
  useEffect(() => {
    if (!place || !start || !end) { setDays({}); return undefined; }
    let alive = true;
    WeatherService.getDaily(place, start, end).then((d) => { if (alive) setDays(d); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return days;
}
