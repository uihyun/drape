// Server-editable copy — t() string overrides + onboarding step layout, read
// once per session from Firestore `config/copy` (public read, console/Admin-SDK
// write only — same contract as config/app). Lets us fix any user-facing
// string or rearrange the onboarding WITHOUT shipping a new native build:
// the store binaries bake the bundled locales in, so before this layer every
// copy tweak meant a release.
//
// Doc shape:
//   strings         { en: {key: str}, ko: {…}, ja: {…} } — flat t() keys
//   onboardingSteps [ { icon, title, body, cta?, route?, skip? } ]
//                   title/body/cta/skip are locale KEYS (resolvable through
//                   `strings` above), never inline text — one override
//                   mechanism, not two. `route` makes the primary CTA close
//                   the overlay and navigate.
//
// SAFETY (deliberate, mirrors appConfig.js): a missing doc, a denied/offline
// read, or a malformed value falls back to the bundled locale / baked-in
// steps. Overrides are consulted per key at t() time, so a partial or garbage
// doc can never blank out the UI — the worst case is "bundled copy".

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase.js';

const LANGS = ['en', 'ko', 'ja'];

let strings = {};           // validated { lang: { key: string } }
let onboardingSteps = null; // validated array, or null = use baked-in steps
let notice = null;          // validated announcement, or null = nothing to show
let started = false;
const listeners = new Set();

function saneStrings(v) {
  if (!v || typeof v !== 'object') return {};
  const out = {};
  for (const lang of LANGS) {
    if (!v[lang] || typeof v[lang] !== 'object') continue;
    out[lang] = {};
    for (const [k, s] of Object.entries(v[lang])) {
      if (typeof s === 'string') out[lang][k] = s;
    }
  }
  return out;
}

// All-or-nothing: one malformed step rejects the whole array (a partial flow
// with a missing action step would be worse than the baked-in default).
function saneSteps(v) {
  if (!Array.isArray(v) || v.length === 0 || v.length > 8) return null;
  const ok = v.every((s) =>
    s && typeof s === 'object' &&
    typeof s.icon === 'string' &&
    typeof s.title === 'string' &&
    typeof s.body === 'string' &&
    (s.route === undefined || (typeof s.route === 'string' && s.route.startsWith('/'))));
  return ok ? v : null;
}

// Announcement banner: { id, enabled, text: {en?,ko?,ja?}, link?, linkLabel? }.
// The id keys the per-user dismissal, so re-announcing means a NEW id.
// Disabled/malformed → null (no banner) — same never-break contract.
function saneNotice(v) {
  if (!v || typeof v !== 'object') return null;
  if (v.enabled !== true) return null;
  if (typeof v.id !== 'string' || !v.id.trim()) return null;
  const text = {};
  for (const lang of LANGS) {
    if (typeof v.text?.[lang] === 'string' && v.text[lang].trim()) text[lang] = v.text[lang];
  }
  if (!Object.keys(text).length) return null;
  const out = { id: v.id.trim(), text };
  if (typeof v.link === 'string' && (v.link.startsWith('/') || v.link.startsWith('http'))) {
    out.link = v.link;
    const labels = {};
    for (const lang of LANGS) {
      if (typeof v.linkLabel?.[lang] === 'string' && v.linkLabel[lang].trim()) labels[lang] = v.linkLabel[lang];
    }
    if (Object.keys(labels).length) out.linkLabel = labels;
  }
  return out;
}

// Fire-and-forget; safe to call more than once (only the first runs). Never
// throws — failure just leaves the bundled copy in place.
export async function initRemoteCopy() {
  if (started) return;
  started = true;
  try {
    const snap = await getDoc(doc(db, 'config', 'copy'));
    if (snap.exists()) {
      const d = snap.data() || {};
      strings = saneStrings(d.strings);
      onboardingSteps = saneSteps(d.onboardingSteps);
      notice = saneNotice(d.notice);
      if (Object.keys(strings).length || onboardingSteps || notice) {
        listeners.forEach((fn) => fn());
      }
    }
  } catch (e) {
    console.warn('remote copy skipped (using bundled):', e?.message);
  }
}

export function getCopyOverride(lang, key) {
  return strings[lang]?.[key];
}

export function getRemoteOnboardingSteps() {
  return onboardingSteps;
}

export function getRemoteNotice() {
  return notice;
}

// The LocaleProvider re-renders its subtree when the overrides land.
export function onRemoteCopy(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
