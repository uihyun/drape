import { useCallback, useEffect, useState } from 'react';
import { WeatherService } from '../services/weather-service.js';
import { ProfileService } from '../services/profile-service.js';
import { useLocale } from './useLocale.jsx';

// Location is requested wherever weather is needed (calendar, stylist) and
// when the user turns weather on in Settings (owner, 2026-10-08). A decline
// turns weather OFF on the profile, so nothing nags afterwards; turning it
// back on asks again and, if the phone still blocks it, says where to fix it.
// One automatic attempt per account per app session (a timeout just retries
// next session).
const triedThisSession = new Set();
let inFlight = null;

// → { place, locating, denied, locate }
//   place: undefined while loading, null when none is set, else the place.
//   locate() resolves 'ok' | 'denied' | 'failed'.
export function useWeatherPlace(user, { autoLocate = false, enabled = true } = {}) {
  const { lang } = useLocale();
  const uid = user && !user.isAnonymous ? user.uid : null;
  const [place, setPlace] = useState(undefined);
  const [locating, setLocating] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => WeatherService.subscribePlace(uid, setPlace), [uid]);

  const locate = useCallback(async () => {
    if (!uid) return 'failed';
    setLocating(true);
    setDenied(false);
    try {
      inFlight = inFlight || WeatherService.locate(lang);
      const r = await inFlight;
      if (r === 'denied') setDenied(true);
      return r;
    } finally {
      inFlight = null;
      setLocating(false);
    }
  }, [uid, lang]);

  useEffect(() => {
    if (!autoLocate || !enabled || !uid || place !== null || triedThisSession.has(uid)) return;
    triedThisSession.add(uid);
    locate().then((r) => {
      if (r === 'denied') ProfileService.updateWeatherOn(false).catch(() => {});
    });
  }, [autoLocate, enabled, uid, place, locate]);

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
