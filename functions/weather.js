// Daily weather from Open-Meteo (free, no key). Used server-side for the
// stylist's context and the weather snapshot written onto an OOTD. The client
// has its own copy of the fetch logic (src/services/weather-service.js) for the
// calendar — same endpoints, same split between the two APIs.
//
// Open-Meteo has two daily APIs: the forecast API covers about the last six
// weeks through 16 days ahead; anything older comes from the archive API,
// which lags real time by a few days. A range is split across them.

const FORECAST = 'https://api.open-meteo.com/v1/forecast';
const ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive';
const ARCHIVE_LAG_DAYS = 6;
const FORECAST_PAST_DAYS = 45;  // the forecast API returned nulls past ~52 days back (measured 2026-10-08)
const FORECAST_AHEAD_DAYS = 15;
const DAILY = 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum';

// Validate a place coming from the client. Coordinates are rounded to two
// decimals (~1km) — a city is all the weather needs, and less is stored.
function cleanPlace(p) {
  if (!p || typeof p !== 'object') return null;
  const lat = Number(p.lat);
  const lon = Number(p.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const label = typeof p.label === 'string' ? p.label.trim().slice(0, 80) : '';
  if (!label) return null;
  const country = typeof p.country === 'string' && /^[A-Za-z]{2}$/.test(p.country) ? p.country.toUpperCase() : null;
  const tz = typeof p.tz === 'string' ? p.tz.slice(0, 64) : null;
  const cityId = typeof p.cityId === 'string' ? p.cityId.slice(0, 60) : null;
  return {
    lat: Math.round(lat * 100) / 100,
    lon: Math.round(lon * 100) / 100,
    label, country, tz, cityId,
  };
}

function ymdOffset(days, base = new Date()) {
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + days));
  return d.toISOString().slice(0, 10);
}

async function fetchRange(url, place, start, end) {
  const qs = new URLSearchParams({
    latitude: String(place.lat), longitude: String(place.lon),
    daily: DAILY, timezone: place.tz || 'auto', start_date: start, end_date: end,
  });
  const res = await fetch(`${url}?${qs}`, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`open-meteo ${res.status}`);
  const j = await res.json();
  const d = j.daily || {};
  const out = {};
  (d.time || []).forEach((t, i) => {
    const max = d.temperature_2m_max?.[i];
    const min = d.temperature_2m_min?.[i];
    if (max == null || min == null) return;
    out[t] = {
      code: d.weather_code?.[i] ?? null,
      maxC: max, minC: min,
      meanC: Math.round(((max + min) / 2) * 10) / 10,
      precipMm: d.precipitation_sum?.[i] ?? null,
    };
  });
  return out;
}

// { 'YYYY-MM-DD': {code, maxC, minC, meanC, precipMm} } for start..end.
async function fetchDaily(place, start, end) {
  const archiveEnd = ymdOffset(-ARCHIVE_LAG_DAYS);
  const forecastStart = ymdOffset(-FORECAST_PAST_DAYS);
  const forecastEnd = ymdOffset(FORECAST_AHEAD_DAYS);
  const jobs = [];
  if (start <= archiveEnd && start < forecastStart) {
    jobs.push(fetchRange(ARCHIVE, place, start, end < archiveEnd ? end : archiveEnd));
  }
  const fStart = start > forecastStart ? start : forecastStart;
  const fEnd = end < forecastEnd ? end : forecastEnd;
  if (fStart <= fEnd) jobs.push(fetchRange(FORECAST, place, fStart, fEnd));
  const parts = await Promise.all(jobs);
  return Object.assign({}, ...parts);
}

async function fetchDay(place, ymd) {
  const all = await fetchDaily(place, ymd, ymd);
  return all[ymd] || null;
}

async function getPlace(db, uid) {
  const snap = await db.collection('users').doc(uid).collection('private').doc('weatherPlace').get();
  return snap.exists ? snap.data() : null;
}

// One line the stylist can reason with. Includes min/max and rain — the user
// sees only the mean, but the model needs the spread to layer properly.
const WMO = {
  0: 'clear', 1: 'mostly clear', 2: 'partly cloudy', 3: 'overcast', 45: 'fog', 48: 'fog',
  51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle', 56: 'freezing drizzle', 57: 'freezing drizzle',
  61: 'light rain', 63: 'rain', 65: 'heavy rain', 66: 'freezing rain', 67: 'freezing rain',
  71: 'light snow', 73: 'snow', 75: 'heavy snow', 77: 'snow grains',
  80: 'rain showers', 81: 'rain showers', 82: 'violent rain showers', 85: 'snow showers', 86: 'snow showers',
  95: 'thunderstorm', 96: 'thunderstorm with hail', 99: 'thunderstorm with hail',
};
function weatherLine(day, place) {
  if (!day) return '';
  const sky = WMO[day.code] || 'unknown sky';
  const rain = day.precipMm != null && day.precipMm >= 0.5 ? `, ${Math.round(day.precipMm)}mm precipitation` : ', dry';
  return `TODAY'S WEATHER in ${place.label}: ${sky}, ${Math.round(day.minC)}–${Math.round(day.maxC)}°C (avg ${Math.round(day.meanC)}°C)${rain}. Dress for it: layers for a wide spread, nothing that suffers in rain (suede, light canvas) when wet.`;
}

module.exports = { cleanPlace, fetchDaily, fetchDay, getPlace, weatherLine, WMO };

// ── Weather snapshot on dated outfits (OOTDs) ───────────────────────
// When an outfit gets a date (or its date changes), record that day's weather
// on it once. The snapshot is what other people see on a public OOTD (the
// owner's place is private), and what the style profile reads to learn how
// someone dresses for cold or rain. Future-dated outfits are skipped — a
// forecast would go stale; the owner's own view fetches it live instead.
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

const onOutfitWeather = onDocumentWritten('outfits/{outfitId}', async (event) => {
  const after = event.data?.after?.data();
  if (!after || !after.userId) return;
  const date = typeof after.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(after.date) ? after.date : null;
  if (!date) return;
  if (after.weather && after.weather.date === date) return; // already recorded — also stops self-retrigger
  if (date > ymdOffset(0)) return;
  try {
    const db = admin.firestore();
    const place = await getPlace(db, after.userId);
    if (!place) return;
    const day = await fetchDay(place, date);
    if (!day) return;
    await event.data.after.ref.update({
      weather: { date, code: day.code, meanC: day.meanC, minC: day.minC, maxC: day.maxC, precipMm: day.precipMm, country: place.country || null },
    });
  } catch (e) {
    console.warn('onOutfitWeather skipped:', e?.message);
  }
});

module.exports.onOutfitWeather = onOutfitWeather;

// ── City search (for anyone whose city isn't on our list) ───────────
// Two geocoders, because neither covers every user alone (measured
// 2026-10-08):
//  - Open-Meteo: great for Latin-script names (incl. accents, Spanish/French
//    exonyms), returns population + timezone — but returns NOTHING for
//    Hangul/Kana/Kanji input ("춘천", "東京" → 0 results).
//  - Nominatim (OpenStreetMap): matches native-script names, but only the
//    official form — "춘천" misses, "춘천시" hits — and it's rate-limited
//    (1 req/s, identifying User-Agent required), so it's called from here,
//    not from every phone, and only for non-Latin queries.
// Results are merged, de-duplicated by distance, cached per query.
const OM_GEOCODE = 'https://geocoding-api.open-meteo.com/v1/search';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_UA = 'drape-app (hello@uhzlab.com)';
const searchCache = new Map();
let nominatimNext = 0;

// Never offered as a weather place (owner, 2026-10-08).
const EXCLUDED_COUNTRIES = new Set(['KP']);

const NON_LATIN = /[^\u0000-ɏḀ-ỿ\s'’.,-]/;
const HANGUL = /[가-힯]/;
const CJK = /[぀-ヿ一-鿿]/;

async function openMeteoSearch(q, lang) {
  const qs = new URLSearchParams({ name: q, count: '8', language: lang, format: 'json' });
  const res = await fetch(`${OM_GEOCODE}?${qs}`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) return [];
  return ((await res.json()).results || []).map((r) => ({
    lat: r.latitude, lon: r.longitude,
    label: [r.name, r.admin1 && r.admin1 !== r.name ? r.admin1 : null].filter(Boolean).join(', '),
    sub: r.country || '',
    country: r.country_code || null,
    tz: r.timezone || null,
    rank: Math.log10((r.population || 0) + 10),
  }));
}

async function nominatimSearch(q, lang) {
  // Serialise to stay under 1 req/s per the usage policy.
  const wait = nominatimNext - Date.now();
  nominatimNext = Math.max(Date.now(), nominatimNext) + 1100;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  const qs = new URLSearchParams({
    q, format: 'jsonv2', addressdetails: '1', limit: '6', 'accept-language': lang, featureType: 'settlement',
  });
  const res = await fetch(`${NOMINATIM}?${qs}`, { headers: { 'User-Agent': NOMINATIM_UA }, signal: AbortSignal.timeout(6000) });
  if (!res.ok) return [];
  const keep = new Set(['city', 'town', 'municipality', 'village', 'borough', 'suburb']);
  return (await res.json())
    .filter((r) => keep.has(r.addresstype))
    .map((r) => {
      const a = r.address || {};
      const region = a.state || a.province || a.region || '';
      return {
        lat: Number(r.lat), lon: Number(r.lon),
        label: [r.name, region && region !== r.name ? region : null].filter(Boolean).join(', '),
        sub: a.country || '',
        country: a.country_code ? a.country_code.toUpperCase() : null,
        tz: null, // Open-Meteo resolves `timezone=auto` from coordinates
        rank: (r.importance || 0) * 7 + (r.addresstype === 'city' ? 1 : 0),
      };
    });
}

async function searchPlaces(query, lang = 'en') {
  const q = String(query || '').trim().slice(0, 60);
  if (q.length < 2 && !CJK.test(q) && !HANGUL.test(q)) return [];
  const key = `${lang}:${q.toLowerCase()}`;
  if (searchCache.has(key)) return searchCache.get(key);
  const jobs = [openMeteoSearch(q, lang).catch(() => [])];
  if (NON_LATIN.test(q)) {
    jobs.push(nominatimSearch(q, lang).catch(() => []));
    // Official names carry the administrative suffix ("춘천시", "川越市");
    // people type the bare name.
    if (HANGUL.test(q) && !/[시군구]$/.test(q)) jobs.push(nominatimSearch(`${q}시`, lang).catch(() => []));
    else if (CJK.test(q) && !/[市町村区]$/.test(q)) jobs.push(nominatimSearch(`${q}市`, lang).catch(() => []));
  }
  const all = (await Promise.all(jobs)).flat()
    .filter((r) => !EXCLUDED_COUNTRIES.has(r.country))
    .sort((a, b) => b.rank - a.rank);
  const out = [];
  for (const r of all) {
    if (out.some((o) => Math.abs(o.lat - r.lat) < 0.15 && Math.abs(o.lon - r.lon) < 0.15)) continue;
    const { rank, ...rest } = r;
    out.push(rest);
    if (out.length >= 8) break;
  }
  if (searchCache.size > 500) searchCache.clear();
  searchCache.set(key, out);
  return out;
}

module.exports.searchPlaces = searchPlaces;

// Coordinates from the device → a labelled place. Reverse-geocoded to the
// city (Nominatim zoom 10) so what's stored and shown is "Seattle", not a
// street; coordinates are rounded by cleanPlace before saving.
async function reverseLabel(lat, lon, lang) {
  const wait = nominatimNext - Date.now();
  nominatimNext = Math.max(Date.now(), nominatimNext) + 1100;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  const qs = new URLSearchParams({ lat: String(lat), lon: String(lon), format: 'jsonv2', zoom: '10', addressdetails: '1', 'accept-language': lang });
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${qs}`, { headers: { 'User-Agent': NOMINATIM_UA }, signal: AbortSignal.timeout(6000) });
  if (!res.ok) return null;
  const j = await res.json();
  const a = j.address || {};
  const city = a.city || a.town || a.municipality || a.village || a.county || j.name || '';
  return { label: city, country: a.country_code ? a.country_code.toUpperCase() : null };
}

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const LANGS = ['en', 'ko', 'ja', 'es', 'fr'];

const weatherSearch = onCall({ cors: true, timeoutSeconds: 20 }, async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'AUTH_REQUIRED');
  const lang = LANGS.includes(request.data?.lang) ? request.data.lang : 'en';
  return { results: await searchPlaces(request.data?.q, lang) };
});

const weatherLocate = onCall({ cors: true, timeoutSeconds: 20 }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'AUTH_REQUIRED');
  const lat = Number(request.data?.lat);
  const lon = Number(request.data?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new HttpsError('invalid-argument', 'BAD_COORDS');
  const lang = LANGS.includes(request.data?.lang) ? request.data.lang : 'en';
  const rev = await reverseLabel(lat, lon, lang).catch(() => null);
  if (rev && EXCLUDED_COUNTRIES.has(rev.country)) throw new HttpsError('failed-precondition', 'UNSUPPORTED_PLACE');
  const place = cleanPlace({ lat, lon, label: rev?.label || `${lat.toFixed(1)}, ${lon.toFixed(1)}`, country: rev?.country, tz: null });
  if (!place) throw new HttpsError('invalid-argument', 'BAD_COORDS');
  await admin.firestore().collection('users').doc(uid).collection('private').doc('weatherPlace')
    .set({ ...place, source: 'device', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  return { place };
});

module.exports.weatherSearch = weatherSearch;
module.exports.weatherLocate = weatherLocate;
