// Weather for the calendar, outfit dates and the stylist's day card.
//
// Source: Open-Meteo (free, no key, CORS-enabled). Same two-API split as the
// server copy in functions/weather.js: the forecast API covers about the last
// six weeks through 16 days ahead, the archive API everything older.
//
// Place: users/{uid}/private/weatherPlace — PRIVATE, because profiles/{uid}
// is world-readable. Set the first time weather is needed by asking for the
// device's location (owner, 2026-10-08: a timezone guess would show LA weather
// to someone in Seattle). Declined → the user can search for their city; if
// they don't, no weather is shown rather than a wrong one. Coordinates are
// reverse-geocoded to the city and rounded to ~1km on the server.
//
// The UI shows one number (the day's mean) and an icon; the stylist gets the
// full min/max/rain line server-side.

import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Geolocation } from '@capacitor/geolocation';
import { db, functions } from '../firebase.js';
import { ProfileService } from './profile-service.js';

const FORECAST = 'https://api.open-meteo.com/v1/forecast';
const ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive';
const ARCHIVE_LAG_DAYS = 6;
const FORECAST_PAST_DAYS = 45;
const FORECAST_AHEAD_DAYS = 15;
const DAILY = 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum';

function ymdOffset(days) {
  const n = new Date();
  const d = new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate() + days));
  return d.toISOString().slice(0, 10);
}

// ── Daily data ───────────────────────────────────────────────────────

const memo = new Map(); // `${lat},${lon}:${start}:${end}` → Promise<map>

async function fetchRange(url, place, start, end) {
  const qs = new URLSearchParams({
    latitude: String(place.lat), longitude: String(place.lon),
    daily: DAILY, timezone: place.tz || 'auto', start_date: start, end_date: end,
  });
  const res = await fetch(`${url}?${qs}`);
  if (!res.ok) throw new Error(`open-meteo ${res.status}`);
  const d = (await res.json()).daily || {};
  const out = {};
  (d.time || []).forEach((t, i) => {
    const max = d.temperature_2m_max?.[i];
    const min = d.temperature_2m_min?.[i];
    if (max == null || min == null) return;
    out[t] = { code: d.weather_code?.[i] ?? null, meanC: (max + min) / 2, maxC: max, minC: min };
  });
  return out;
}

// { 'YYYY-MM-DD': {code, meanC, maxC, minC} } for start..end (inclusive).
// Days outside what Open-Meteo has (too far ahead) are simply absent.
export function getDaily(place, start, end) {
  if (!place) return Promise.resolve({});
  const key = `${place.lat},${place.lon}:${start}:${end}`;
  if (memo.has(key)) return memo.get(key);
  const archiveEnd = ymdOffset(-ARCHIVE_LAG_DAYS);
  const forecastStart = ymdOffset(-FORECAST_PAST_DAYS);
  const forecastEnd = ymdOffset(FORECAST_AHEAD_DAYS);
  const jobs = [];
  if (start < forecastStart && start <= archiveEnd) {
    jobs.push(fetchRange(ARCHIVE, place, start, end < archiveEnd ? end : archiveEnd));
  }
  const fStart = start > forecastStart ? start : forecastStart;
  const fEnd = end < forecastEnd ? end : forecastEnd;
  if (fStart <= fEnd) jobs.push(fetchRange(FORECAST, place, fStart, fEnd));
  const p = Promise.all(jobs)
    .then((parts) => Object.assign({}, ...parts))
    .catch((e) => { memo.delete(key); console.warn('weather fetch failed:', e?.message); return {}; });
  memo.set(key, p);
  return p;
}

// ── Display ──────────────────────────────────────────────────────────

// °F for US places, °C everywhere else — decided by where the weather is,
// the same way marketplace currency follows the item, not the viewer.
export function tempUnit(place) {
  return place?.country === 'US' ? 'F' : 'C';
}

export function formatTemp(c, unit) {
  if (c == null) return '';
  return `${Math.round(unit === 'F' ? c * 9 / 5 + 32 : c)}°`;
}

// WMO weather code → one of a few icon names (see WeatherIcon).
export function skyOf(code) {
  if (code == null) return 'cloud';
  if (code <= 1) return 'sun';
  if (code === 2) return 'partly';
  if (code === 3) return 'cloud';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  return 'cloud';
}

// ── Place ────────────────────────────────────────────────────────────

export function subscribePlace(uid, cb) {
  if (!uid) { cb(null); return () => {}; }
  return onSnapshot(
    doc(db, 'users', uid, 'private', 'weatherPlace'),
    (snap) => cb(snap.exists() ? snap.data() : null),
    () => cb(null),
  );
}

export async function savePlace(place) {
  return ProfileService.updateWeatherPlace(place);
}

// City search, worldwide and in every app language. Runs on the server,
// which merges two geocoders (Open-Meteo misses native-script names like
// "춘천"; Nominatim has them but is rate-limited) — see functions/weather.js.
export async function searchPlaces(query, lang = 'en') {
  const q = query.trim();
  if (!q) return [];
  try {
    const res = await httpsCallable(functions, 'weatherSearch')({ q, lang });
    return res.data?.results || [];
  } catch (e) {
    console.warn('weather search failed:', e?.message);
    return [];
  }
}

// Ask for the device's (approximate) location and save it as the weather
// place. Resolves to 'ok' | 'denied' | 'failed'. The OS permission dialog
// carries the why (Info.plist NSLocationWhenInUseUsageDescription).
export async function locate(lang = 'en') {
  try {
    const perm = await Geolocation.checkPermissions().catch(() => null);
    if (perm && perm.location === 'denied' && perm.coarseLocation !== 'granted') return 'denied';
    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 15000, maximumAge: 3600000 });
    // Rounded on the device, before anything is sent: city-level (~1km) is
    // all weather needs, and it keeps what we collect "approximate location"
    // for the store privacy labels.
    const round = (v) => Math.round(v * 100) / 100;
    await httpsCallable(functions, 'weatherLocate')({ lat: round(pos.coords.latitude), lon: round(pos.coords.longitude), lang });
    return 'ok';
  } catch (e) {
    const msg = String(e?.message || e || '').toLowerCase();
    return /denied|permission|not authorized/.test(msg) ? 'denied' : 'failed';
  }
}

export const WeatherService = { getDaily, tempUnit, formatTemp, skyOf, subscribePlace, savePlace, searchPlaces, locate };
export default WeatherService;
