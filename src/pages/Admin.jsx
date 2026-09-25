// === Admin dashboard ===================================================
// Internal analytics surface at /admin — owner-only (route guard in App.jsx,
// real enforcement in functions/admin.js). English-only by design; this is
// never user-facing, so the locale-parity rule doesn't apply.
//
// All data arrives through AdminService callables. Charts are hand-rolled
// inline SVG so we add no charting dependency.

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, RefreshCw, ArrowLeft, TrendingUp, Users, Sparkles, AlertTriangle, Megaphone, SlidersHorizontal, Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { AdminService } from '../services/admin-service.js';
import { BAKED_STEPS } from '../components/Onboarding.jsx';
import { en as L_EN } from '../locales/en.js';
import { ko as L_KO } from '../locales/ko.js';
import { ja as L_JA } from '../locales/ja.js';
import { es as L_ES } from '../locales/es.js';
import { fr as L_FR } from '../locales/fr.js';
import { MarketingTab } from './AdminMarketing.jsx';
import { cityDisplay, cityCountry } from '../data/cities.js';

const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString());
const pct = (x) => `${Math.round((x || 0) * 100)}%`;

// ── Inline SVG line chart with axes ─────────────────────────────────────
const mmdd = (day) => { const p = (day || '').split('-'); return p.length === 3 ? `${+p[1]}/${+p[2]}` : day; };

// The legend has to be the line, not a coloured square: two lines that differ
// by dash pattern are unreadable from a swatch that has no dashes.
function LineSwatch({ color, dashed }) {
  return (
    <svg width="18" height="8" aria-hidden="true" style={{ verticalAlign: 'middle' }}>
      <line x1="0" y1="4" x2="18" y2="4" stroke={color} strokeWidth="2" strokeDasharray={dashed ? '4 3' : undefined} />
    </svg>
  );
}

function AxisChart({ title, series, series2, label, label2, hint, color = 'var(--accent)', color2 = '#B4763C' }) {
  const data = series || [];
  const data2 = series2 || [];
  const total = data.reduce((s, d) => s + d.count, 0);
  // Geometry in a fixed viewBox; scales responsively (meet) so axis text stays legible.
  const W = 560; const H = 200; const PL = 38; const PR = 10; const PT = 14; const PB = 24;
  const plotW = W - PL - PR; const plotH = H - PT - PB;
  // One scale for both lines or the comparison lies.
  const max = Math.max(1, ...data.map((d) => d.count), ...data2.map((d) => d.count));
  const niceMax = max <= 4 ? max : Math.ceil(max / 5) * 5;
  const x = (i) => PL + (data.length > 1 ? (i / (data.length - 1)) * plotW : plotW / 2);
  const y = (c) => PT + plotH - (c / niceMax) * plotH;
  const pts = data.map((d, i) => `${x(i).toFixed(1)},${y(d.count).toFixed(1)}`).join(' ');
  const pts2 = data2.map((d, i) => `${x(i).toFixed(1)},${y(d.count).toFixed(1)}`).join(' ');
  const yticks = [0, niceMax / 2, niceMax];
  const xidx = data.length <= 1 ? [0] : [0, Math.floor((data.length - 1) / 2), data.length - 1];

  return (
    <div className="adm-card">
      <div className="adm-card-head">
        <span className={hint ? 'adm-hinted' : undefined} data-hint={hint} tabIndex={hint ? 0 : undefined}>{title}</span>
        {data2.length > 0 ? (
          <span className="adm-legend">
            <span><LineSwatch color={color} /> {label} {fmt(total)}</span>
            <span><LineSwatch color={color2} dashed /> {label2} {fmt(data2.reduce((s, d) => s + d.count, 0))}</span>
          </span>
        ) : (
          <span className="adm-muted">{fmt(total)} total</span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="adm-chart" role="img" preserveAspectRatio="xMidYMid meet">
        {yticks.map((t, i) => (
          <g key={i}>
            <line x1={PL} y1={y(t)} x2={W - PR} y2={y(t)} stroke="var(--border)" strokeWidth="1" />
            <text x={PL - 6} y={y(t) + 3} textAnchor="end" className="adm-axis">{fmt(Math.round(t))}</text>
          </g>
        ))}
        {data.length > 1 && data2.length === 0 && <polygon points={`${PL},${PT + plotH} ${pts} ${W - PR},${PT + plotH}`} fill={color} opacity="0.08" />}
        {data.length > 1
          ? <polyline points={pts} fill="none" stroke={color} strokeWidth="2" />
          : data.length === 1 && <circle cx={x(0)} cy={y(data[0].count)} r="3" fill={color} />}
        {data2.length > 1 && <polyline points={pts2} fill="none" stroke={color2} strokeWidth="2" strokeDasharray="4 3" />}
        {xidx.map((i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'} className="adm-axis">{mmdd(data[i]?.day)}</text>
        ))}
      </svg>
    </div>
  );
}

function Tile({ label, value, sub }) {
  return (
    <div className="adm-tile">
      <div className="adm-tile-val">{value}</div>
      <div className="adm-tile-label">{label}</div>
      {sub != null && <div className="adm-tile-sub adm-muted">{sub}</div>}
    </div>
  );
}

function BucketRow({ label, b }) {
  if (!b) return null;
  return (
    <tr>
      <td>{label}</td>
      <td>{fmt(b.accounts)}</td>
      <td>{fmt(b.active)}</td>
      <td>{fmt(b.items?.total)}</td>
      <td>{fmt(b.ootd?.total)}</td>
      <td>{fmt(b.board?.total)}</td>
      <td>{fmt(b.tryon?.total)}</td>
    </tr>
  );
}

// ── Date presets ────────────────────────────────────────────────────────
const PRESETS = [['7d', 7], ['30d', 30], ['90d', 90], ['all', 0]];
// Calendar presets (local time, weeks start Monday). Returns {from,to} YYYY-MM-DD.
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function presetRange(name) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monday = (d) => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  switch (name) {
    case 'thisWeek': return { from: iso(monday(today)), to: iso(today) };
    case 'lastWeek': {
      const m = monday(today); const from = new Date(m); from.setDate(from.getDate() - 7);
      const to = new Date(m); to.setDate(to.getDate() - 1);
      return { from: iso(from), to: iso(to) };
    }
    case 'thisMonth': return { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to: iso(today) };
    case 'lastMonth': return {
      from: iso(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
      to: iso(new Date(today.getFullYear(), today.getMonth(), 0)),
    };
    default: return { from: iso(today), to: iso(today) };
  }
}
const CAL_PRESETS = [['this week', 'thisWeek'], ['last week', 'lastWeek'], ['this month', 'thisMonth'], ['last month', 'lastMonth']];

// ── GA screen engagement (where users spend time) ──────────────────────
const fmtDur = (s) => (s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m` : s >= 60 ? `${Math.round(s / 60)}m` : `${s}s`);

// Did the 2.1 surfaces get used? Raw GA event counts for the range, grouped
// so a funnel reads top-to-bottom (viewed → acted → converted).
const FEATURE_GROUPS = [
  ['Trends', ['trends_view', 'trends_click']],
  ['Stylist', ['stylist_recommend', 'stylist_tryon', 'stylist_look_saved', 'stylist_feedback']],
  ['Import', ['import_shared', 'import_image_ready', 'import_item_saved', 'import_product_fastpath']],
  ['Try-on signals', ['tryon_feedback', 'out_of_fits']],
];

function FeaturesCard({ from, to }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!from || !to) return;
    setErr('');
    AdminService.gaFeatures({ from, to }).then(setRows).catch((e) => setErr(e.message || 'GA query failed'));
  }, [from, to]);
  const byEvent = Object.fromEntries((rows || []).map((r) => [r.event, r]));
  return (
    <>
      <h3 className="adm-h3"><span className="adm-hinted" tabIndex={0} data-hint="GA event counts for the features worth watching. Events, not users — one person can fire the same event many times.">Feature adoption</span> <span className="adm-muted">(GA events, {from} → {to})</span></h3>
      {err && <div className="adm-err">{err}</div>}
      {rows && (
        <div className="adm-tablewrap" style={{ marginBottom: 16 }}>
          <table className="adm-table">
            <thead><tr><th>surface</th><th>event</th><th>count</th><th>users</th></tr></thead>
            <tbody>
              {FEATURE_GROUPS.map(([label, events]) => events.map((ev, i) => (
                <tr key={ev}>
                  <td>{i === 0 ? label : ''}</td>
                  <td className="adm-muted">{ev}</td>
                  <td>{fmt(byEvent[ev]?.count ?? 0)}</td>
                  <td>{fmt(byEvent[ev]?.users ?? 0)}</td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function ScreensCard({ from, to }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!from || !to) return;
    setBusy(true); setErr('');
    AdminService.screenEngagement({ from, to })
      .then(setRows)
      .catch((e) => setErr(e.message || 'GA query failed'))
      .finally(() => setBusy(false));
  }, [from, to]);

  const total = (rows || []).reduce((s, r) => s + r.engagementSec, 0);
  const shown = (rows || []).filter((r) => r.engagementSec > 0 || r.views > 5).slice(0, 14);

  return (
    <>
      <h3 className="adm-h3"><span className="adm-hinted" tabIndex={0} data-hint="GA screen engagement. Ranked by total time, which is what says a screen earns its place, rather than by views.">Where users spend time</span> <span className="adm-muted">(GA screen engagement, {from} → {to}){busy && <Loader2 size={13} className="spin" style={{ marginLeft: 6 }} />}</span></h3>
      {err && <div className="adm-err">{err}</div>}
      {rows && !err && (
        <div className="adm-tablewrap">
          <table className="adm-table">
            <thead><tr><th>screen</th><th>time</th><th>share</th><th>views</th><th>users</th><th>avg/user</th></tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.screen}>
                  <td>{r.screen}</td>
                  <td>{fmtDur(r.engagementSec)}</td>
                  <td>
                    <div className="adm-bar" style={{ minWidth: 90 }}>
                      <span style={{ width: `${total ? Math.round((r.engagementSec / total) * 100) : 0}%` }} />
                    </div>
                  </td>
                  <td>{fmt(r.views)}</td>
                  <td>{fmt(r.users)}</td>
                  <td>{r.users ? fmtDur(Math.round(r.engagementSec / r.users)) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
const sumRange = (series, from, to) => (series || []).filter((d) => d.day >= from && d.day <= to).reduce((s, d) => s + d.count, 0);
const slice = (series, from, to) => (series || []).filter((d) => d.day >= from && d.day <= to);

function Overview() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [days, setDays] = useState(30); // server-side window; 800 = all
  const [range, setRange] = useState(null); // { from, to }
  const [gaFunnel, setGaFunnel] = useState(null); // { daily, totals }

  const [gaChannels, setGaChannels] = useState(null); // { acquisition, traffic }
  useEffect(() => {
    if (!range) return;
    AdminService.gaFunnel(range).then(setGaFunnel).catch(() => setGaFunnel({ daily: [], totals: null }));
    AdminService.gaChannels(range).then(setGaChannels).catch(() => setGaChannels(null));
  }, [range?.from, range?.to]);   // eslint-disable-line react-hooks/exhaustive-deps

  const gaDaily = gaFunnel?.daily || [];
  const gaTotals = gaFunnel?.totals;
  // "How much does an app user actually do per day" — Firestore action
  // counts over GA's app DAU. GA can't see our action docs; Firestore can't see DAU.
  const perUser = gaDaily.map((r) => {
    const acts = ['items', 'tryons', 'ootds', 'boards'].reduce(
      (s, k) => s + ((data?.trends?.[k] || []).find((p) => p.day === r.day)?.count || 0), 0);
    return { day: r.day, count: r.appUsers ? Math.round((acts / r.appUsers) * 10) / 10 : 0 };
  });

  const load = () => {
    setBusy(true); setErr('');
    AdminService.overview(days).then((d) => {
      setData(d);
      const axis = d.trends.signups.map((p) => p.day);
      // Empty corpus → no dated docs → empty axis; still set a range so the
      // tab renders (empty charts) instead of spinning forever.
      const today = new Date().toISOString().slice(0, 10);
      setRange(axis.length ? { from: axis[0], to: axis[axis.length - 1] } : { from: today, to: today });
    }).catch((e) => setErr(e.message || 'failed')).finally(() => setBusy(false));
  };
  useEffect(load, [days]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (err) return <div className="adm-err">{err}</div>;
  if (!data || !range) return <div className="adm-loading"><Loader2 className="spin" /> {days >= 800 ? 'crunching the whole corpus…' : `loading last ${days} days…`}</div>;

  const t = data.totals;
  const axis = data.trends.signups.map((p) => p.day);
  const firstDay = axis[0] || range.from; const lastDay = axis[axis.length - 1] || range.to;
  const applyPreset = (preset) => {
    // Preset wider than the loaded server window → re-request; else slice.
    const need = preset === 0 ? 800 : preset;
    if (need > days) return setDays(need);
    if (!preset) return setRange({ from: firstDay, to: lastDay });
    const d = new Date(lastDay + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - preset + 1);
    const from = d.toISOString().slice(0, 10);
    setRange({ from: from < firstDay ? firstDay : from, to: lastDay });
  };
  const win = (k) => sumRange(data.trends[k], range.from, range.to);

  return (
    <>
      <div className="adm-toolbar">
        <span className="adm-muted">generated {new Date(data.generatedAt).toLocaleString()}</span>
        <button className="adm-btn" onClick={load} disabled={busy}>
          {busy ? <Loader2 className="spin" size={14} /> : <RefreshCw size={14} />} refresh
        </button>
      </div>

      <h3 className="adm-h3"><span className="adm-hinted" tabIndex={0} data-hint="All-time counts across every collection. A nightly snapshot, so it can lag the live number by up to a day.">Totals</span> <span className="adm-muted">(all time{data.totalsAsOf ? ` · snapshot ${data.totalsAsOf}` : ''})</span></h3>
      <div className="adm-tiles">
        <Tile label="real users" value={fmt(t.users)} sub={`${fmt(t.active7)} active 7d · ${fmt(t.active30)} 30d`} />
        <Tile label="items" value={fmt(t.items)} />
        <Tile label="outfits" value={fmt(t.outfits)} sub={`${fmt(t.ootds)} OOTDs`} />
        <Tile label="boards" value={fmt(t.boards)} />
        <Tile label="try-ons" value={fmt(t.tryons)} sub={`${pct(data.tryon.successRate)} success`} />
        <Tile label="listings" value={fmt(t.listings)} sub={Object.entries(data.marketplace.byCurrency).map(([c, n]) => `${c} ${n}`).join(' · ')} />
      </div>

      {data.activation && (
        <>
          <h3 className="adm-h3"><span className="adm-hinted" tabIndex={0} data-hint="Of the real users who ever signed up, how many did each thing at least once. Ever, not in the range - GA cannot answer this because it has no notion of our account buckets.">Activation funnel</span> <span className="adm-muted">(real users, ever — the split GA can't do)</span></h3>
          <div className="adm-tiles">
            <Tile label="signed up" value={fmt(data.activation.signed)} />
            <Tile label="added an item" value={fmt(data.activation.item)} sub={pct(data.activation.item / (data.activation.signed || 1))} />
            <Tile label="ran a try-on" value={fmt(data.activation.tryon)} sub={pct(data.activation.tryon / (data.activation.signed || 1))} />
            <Tile label="logged an OOTD" value={fmt(data.activation.ootd)} sub={pct(data.activation.ootd / (data.activation.signed || 1))} />
            <Tile label="made an outfit" value={fmt(data.activation.outfit)} sub={pct(data.activation.outfit / (data.activation.signed || 1))} />
          </div>
        </>
      )}

      {data.depth && (() => {
        const D = data.depth;
        const LABEL = {
          items: 'closet items', tryonReady: 'try-ons (ready)', ootd: 'OOTDs',
          savedLooks: 'saved looks (undated)', board: 'boards', days: 'active days*',
        };
        const cols = D.rows[0]?.steps.length || 0;
        return (
          <>
            <h3 className="adm-h3"><span className="adm-hinted" tabIndex={0} data-hint="Of the real users (seed personas and dev accounts excluded), how many reached each count. The activation funnel stops at 'at least once'; this is what a threshold such as the review-prompt gate has to be sized against.">Usage depth</span> <span className="adm-muted">(real users, ever — {fmt(D.users)} accounts{data.totalsAsOf ? ` · snapshot ${data.totalsAsOf}` : ''})</span></h3>
            <div className="adm-tablewrap">
              <table className="adm-table">
                <thead><tr><th></th><th colSpan={cols}>users who reached at least…</th></tr></thead>
                <tbody>
                  {D.rows.map((r) => (
                    <tr key={r.key}>
                      <td>{LABEL[r.key] || r.key}</td>
                      {r.steps.map((s) => (
                        <td key={s.n}>
                          <span className="adm-muted">≥{s.n}</span> <b>{fmt(s.users)}</b>
                          <div className="adm-muted">{pct(D.users ? s.users / D.users : 0)}</div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="adm-note adm-muted">
              * Days on which the user created something (item, try-on, outfit, board) — a floor on
              the days they opened the app, since a browse-only day leaves nothing behind.
            </p>
          </>
        );
      })()}

      {data.linking && (() => {
        const L = data.linking; const M = data.marketplace;
        const share = (n, d) => pct(d ? n / d : 0);
        return (
          <>
            <h3 className="adm-h3">
              Selling funnel{' '}
              <span className="adm-muted">
                (real users only — seed outfits never link items and would swamp the ratio)
              </span>
            </h3>
            <div className="adm-tiles">
              <Tile label="listings" value={fmt(M.listings)} sub={`${fmt(M.sellers)} seller${M.sellers === 1 ? '' : 's'}`} />
              {/* The one that decides whether any of this works: a listing not
                  linked to a public outfit has no surface a buyer can reach. */}
              <Tile label="reachable" value={fmt(M.reachable)} sub={`${share(M.reachable, M.listings)} of listings`} />
              <Tile label="public outfits" value={fmt(L.publicOutfits)} />
              <Tile label="…with items" value={fmt(L.withItems)} sub={`${share(L.withItems, L.publicOutfits)} · ${fmt(L.itemRefs)} refs`} />
              <Tile label="…with a listing" value={fmt(L.withListing)} sub={share(L.withListing, L.publicOutfits)} />
              <Tile label="buyer threads" value={fmt(M.threads)} sub={`${fmt(M.threadsWithReply)} answered`} />
            </div>
            {L.publicOutfits > 0 && L.withItems / L.publicOutfits < 0.1 && (
              <p className="adm-note">
                Item linking is the gate: {share(L.withItems, L.publicOutfits)} of public outfits have
                any items attached, so price badges, per-piece try-on and buying have nothing to render
                on the rest. Watch <code>link_items_prompt</code> in GA.
              </p>
            )}
          </>
        );
      })()}

      {data.tryon?.entry?.length > 0 && (() => {
        const rows = data.tryon.entry;
        const total = rows.reduce((n, r) => n + r.total, 0);
        // Human names for the `from` tags stamped in tryon.js. An unmapped
        // tag renders raw rather than disappearing.
        const DOOR = {
          item: 'item page (own)',
          item_borrowed: "item page (someone else's)",
          outfit_look: 'outfit — recreate the look',
          outfit_items: 'outfit — its items',
          stylist: 'stylist rec',
          board: 'board — selection',
          board_item: 'board — one item',
          create_sheet: 'create sheet (+)',
          nav: 'top nav',
          history: 'try-on tab header',
          history_empty: 'try-on tab (empty state)',
          direct: 'direct / back',
          unknown: 'before tracking shipped',
        };
        const max = Math.max(1, ...rows.map((r) => r.total));
        return (
          <>
            <h3 className="adm-h3">
              Try-on entry paths{' '}
              <span className="adm-muted">
                (real users only — where a try-on was actually started from)
              </span>
            </h3>
            <div className="adm-tablewrap">
              <table className="adm-table">
                <thead><tr><th>from</th><th>started</th><th></th><th>share</th><th>ready</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.from}>
                      <td>{DOOR[r.from] || r.from}</td>
                      <td>{fmt(r.total)}</td>
                      <td style={{ width: '38%' }}>
                        <div className="adm-bar" style={{ minWidth: 70 }}>
                          <span style={{ width: `${Math.round((r.total / max) * 100)}%` }} />
                        </div>
                      </td>
                      <td>{pct(total ? r.total / total : 0)}</td>
                      <td>{pct(r.total ? r.ready / r.total : 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="adm-note adm-muted">
              Counts completed starts. The open-but-never-generated half of the funnel is
              <code> tryon_enter</code> vs <code>tryon_start</code> in GA, keyed on the same
              <code> from</code>.
            </p>
          </>
        );
      })()}

      {data.stylist && (() => {
        const S = data.stylist;
        return (
          <>
            <h3 className="adm-h3">
              Stylist quota{' '}
              <span className="adm-muted">(today — these are the numbers that say whether 3/day and 10/day are right)</span>
            </h3>
            <div className="adm-tiles">
              <Tile label="used Style me" value={fmt(S.recUsers)} sub={`${fmt(S.recAtCap)} hit the 3/day cap`} />
              <Tile label="topped up recs" value={fmt(S.recTopped)} sub={`${fmt(S.recExtraHeld)} held`} />
              <Tile label="used verdicts" value={fmt(S.verdictUsers)} sub={`${fmt(S.verdictAtCap)} hit the 10/day cap`} />
              <Tile label="topped up verdicts" value={fmt(S.verdictTopped)} sub={`${fmt(S.verdictExtraHeld)} held`} />
            </div>
            <p className="adm-note adm-muted">
              Daily counters reset at the user\'s local midnight, so &quot;used&quot; is today only;
              top-up balances carry over and are cumulative.
            </p>
          </>
        );
      })()}

      {data.personaSunset && (() => {
        const ps = data.personaSunset;
        const phaseLabel = { seeding: 'SEEDING', taper: 'TAPER', sunset: 'SUNSET' }[ps.phase];
        const cur = ps.weeks.find((w) => w.current) || { realPublic: 0, seed: 0 };
        const maxW = Math.max(1, ...ps.weeks.map((w) => Math.max(w.realPublic, w.seed)));
        return (
          <>
            <h3 className="adm-h3"><span className="adm-hinted" tabIndex={0} data-hint="When the seeded personas can be retired, measured in real public outfits per week.">Persona sunset</span> <span className="adm-muted">(real public outfits/week decide when the bots retire)</span></h3>
            <div className="adm-tiles">
              <Tile label="phase" value={phaseLabel}
                sub={ps.phase === 'sunset' ? 'turn the extras bots OFF' : ps.phase === 'taper' ? 'halve bot posting probability' : 'bots carry the feed'} />
              <Tile label="this week (live)" value={fmt(cur.realPublic)} sub={`real public · ${fmt(cur.seed)} seed`} />
              <Tile label="taper streak" value={`${ps.taperStreak}/${ps.rules.taperWeeks}`} sub={`weeks ≥${ps.rules.taperAt} real public`} />
              <Tile label="sunset streak" value={`${ps.sunsetStreak}/${ps.rules.sunsetWeeks}`} sub={`weeks ≥${ps.rules.sunsetAt} real public`} />
            </div>
            <div className="adm-tablewrap">
              <table className="adm-table">
                <thead><tr><th>week of</th><th>real public</th><th></th><th>seed</th><th></th></tr></thead>
                <tbody>
                  {ps.weeks.map((w) => (
                    <tr key={w.week}>
                      <td>{w.week}{w.current ? ' ·' : ''}</td>
                      <td>{fmt(w.realPublic)}</td>
                      <td><div className="adm-bar" style={{ minWidth: 70 }}><span style={{ width: `${Math.round((w.realPublic / maxW) * 100)}%` }} /></div></td>
                      <td>{fmt(w.seed)}</td>
                      <td><div className="adm-bar" style={{ minWidth: 70 }}><span style={{ width: `${Math.round((w.seed / maxW) * 100)}%`, opacity: 0.4 }} /></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        );
      })()}

      {/* One range control for everything below — GA screens card + all charts. */}
      <h3 className="adm-h3">Date range</h3>
      <div className="adm-daterow">
        <label>from <input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></label>
        <label>to <input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></label>
        <div className="adm-seg">{PRESETS.map(([l, d]) => (
          <button key={l} onClick={() => applyPreset(d)}>{l}</button>
        ))}</div>
        <div className="adm-seg">{CAL_PRESETS.map(([l, name]) => (
          <button key={name} onClick={() => setRange(presetRange(name))}>{l}</button>
        ))}</div>
      </div>

      {gaTotals && (
        <>
          <h3 className="adm-h3"><span className="adm-hinted" tabIndex={0} data-hint="Landing visitors to installs to app users to signups, for the picked range. Each step is a different GA population, so read the drops as direction, not as exact conversion.">Acquisition funnel</span> <span className="adm-muted">(GA, {range.from} → {range.to})</span></h3>
          <div className="adm-tiles">
            <Tile label="landing visitors" value={fmt(gaTotals.landing)} sub="web (marketing traffic)" />
            <Tile label="app installs" value={fmt(gaTotals.installs)} sub={`first_open · ${gaTotals.landing ? pct(gaTotals.installs / gaTotals.landing) : '—'} of visitors`} />
            <Tile label="app users" value={fmt(gaTotals.appUsers)} sub="opened the app in range (iOS+Android)" />
            <Tile label="real signups" value={fmt(win('signups'))} sub="accounts created in range" />
          </div>
        </>
      )}

      {gaFunnel?.geo?.length > 0 && (() => {
        const geo = gaFunnel.geo;
        const max = Math.max(1, ...geo.map((r) => r.installs));
        return (
          <>
            <h3 className="adm-h3">
              <span className="adm-hinted" tabIndex={0} data-hint="first_open events by country, split by store. GA's install signal, not the store consoles' — close enough to see which markets are moving, and the only one readable from here.">
                Where installs come from
              </span>{' '}
              <span className="adm-muted">(GA, {range.from} → {range.to})</span>
            </h3>
            <div className="adm-tablewrap" style={{ marginBottom: 14 }}>
              <table className="adm-table">
                <thead><tr><th>country</th><th>installs</th><th></th><th>iOS</th><th>Android</th></tr></thead>
                <tbody>
                  {geo.map((r) => (
                    <tr key={r.country}>
                      <td>{r.country}</td>
                      <td>{fmt(r.installs)}</td>
                      <td style={{ width: '38%' }}>
                        <div className="adm-bar" style={{ minWidth: 70 }}>
                          <span style={{ width: `${Math.round((r.installs / max) * 100)}%` }} />
                        </div>
                      </td>
                      <td>{fmt(r.ios)}</td>
                      <td className="adm-muted">{fmt(r.android)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        );
      })()}

      {gaChannels?.acquisition?.length > 0 && (
        <>
          <h3 className="adm-h3"><span className="adm-hinted" tabIndex={0} data-hint="First touch: what brought each new user in the first place, not what they clicked most recently.">Acquisition channels</span> <span className="adm-muted">(first touch — what brought each new user, {range.from} → {range.to})</span></h3>
          <div className="adm-tablewrap" style={{ marginBottom: 14 }}>
            <table className="adm-table">
              <thead><tr><th>source</th><th>medium</th><th>new users</th><th></th><th>active</th></tr></thead>
              <tbody>
                {(() => {
                  const max = Math.max(1, ...gaChannels.acquisition.map((r) => r.newUsers));
                  return gaChannels.acquisition.map((r, i) => (
                    <tr key={i}>
                      <td>{r.source}</td>
                      <td className="adm-muted">{r.medium}</td>
                      <td>{fmt(r.newUsers)}</td>
                      <td><div className="adm-bar" style={{ minWidth: 90 }}><span style={{ width: `${Math.round((r.newUsers / max) * 100)}%` }} /></div></td>
                      <td>{fmt(r.activeUsers)}</td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
          {gaChannels.traffic?.length > 0 && (
            <div className="adm-tablewrap" style={{ marginBottom: 18 }}>
              <table className="adm-table">
                <thead><tr><th>session source</th><th>medium</th><th>platform</th><th>sessions</th><th>new</th></tr></thead>
                <tbody>
                  {gaChannels.traffic.map((r, i) => (
                    <tr key={i}>
                      <td>{r.source}</td>
                      <td className="adm-muted">{r.medium}</td>
                      <td>{r.platform}</td>
                      <td>{fmt(r.sessions)}</td>
                      <td>{fmt(r.newUsers)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <FeaturesCard from={range.from} to={range.to} />

      <ScreensCard from={range.from} to={range.to} />

      <h3 className="adm-h3"><span className="adm-hinted" tabIndex={0} data-hint="Daily series on one shared date axis, so every chart below lines up and can be compared directly.">Activity over time</span> <span className="adm-muted">({range.from} → {range.to})</span></h3>
      <div className="adm-tiles">
        <Tile label="signups" value={fmt(win('signups'))} sub="in range" />
        <Tile label="items added" value={fmt(win('items'))} sub="in range" />
        <Tile label="try-ons" value={fmt(win('tryons'))} sub="in range" />
        <Tile label="OOTDs" value={fmt(win('ootds'))} sub="in range" />
        <Tile label="boards" value={fmt(win('boards'))} sub="in range" />
      </div>
      <div className="adm-grid">
        <AxisChart title="Signups" hint="New real-user profiles created that day. Seed and dev accounts excluded." series={slice(data.trends.signups, range.from, range.to)} />
        <AxisChart title="Items added" hint="Closet items created that day, by real users." series={slice(data.trends.items, range.from, range.to)} />
        <AxisChart title="Try-ons" hint="Try-on generations started that day, including the ones that failed." series={slice(data.trends.tryons, range.from, range.to)} />
        <AxisChart title="OOTDs" hint="Outfits logged against a calendar date." series={slice(data.trends.ootds, range.from, range.to)} />
        {/* Undated outfits (builder / photo analysis). Separate from OOTDs —
            same collection, different act. */}
        <AxisChart title="Outfits" hint="Outfits with no date - built in the outfit builder or analysed from a photo." series={slice(data.trends.outfits, range.from, range.to)} />
        <AxisChart title="Boards" hint="Mood boards created that day." series={slice(data.trends.boards, range.from, range.to)} />
        <AxisChart title="Stylist recs" hint="Style me requests. One per call, whether it was free or paid for with a fit." series={slice(data.trends.stylistRecs, range.from, range.to)} />
        <AxisChart title="Stylist verdicts" hint="A stylist judging whether a look on someone ELSE would suit you - the question try-on cannot answer. Asked from an outfit page. Cached per outfit + persona + language, so repeats do not count twice." series={slice(data.trends.verdicts, range.from, range.to)} />
        {/* By listedAt: when a piece went up for sale, not when it was added. */}
        <AxisChart title="Items listed for sale" hint="Counted by listedAt - when a piece went up for sale, not when it was added to the closet." series={slice(data.trends.listings, range.from, range.to)} />
        <AxisChart title="Landing visitors / day (web)" hint="GA4 active users on the web platform. Mostly drape.nyc traffic, not people using the product." series={gaDaily.map((r) => ({ day: r.day, count: r.landing }))} color="var(--accent-strong, #7a5c3e)" />
        <AxisChart title="App installs / day (first_open)" hint="GA4 first_open events. The nearest thing to a download count without opening either store console." series={gaDaily.map((r) => ({ day: r.day, count: r.installs }))} color="var(--accent-strong, #7a5c3e)" />
        <AxisChart title="App active users / day"
          hint="GA4 daily active users, split by store. Daily uniques do not add up to the range total - the same person on two days counts once in the range."
          label="iOS" label2="Android"
          series={gaDaily.map((r) => ({ day: r.day, count: r.ios || 0 }))}
          series2={gaDaily.map((r) => ({ day: r.day, count: r.android || 0 }))} />
        <AxisChart title="Actions per app user / day" hint="App events divided by app active users. A rough engagement depth: how much the people who opened it actually did." series={perUser} color="var(--accent-strong, #7a5c3e)" />
        <AxisChart title="App engagement min / day" hint="GA4 userEngagementDuration for iOS + Android, in minutes. Time in the foreground, not time with the app installed." series={gaDaily.map((r) => ({ day: r.day, count: Math.round(r.appEngagementSec / 60) }))} color="var(--accent-strong, #7a5c3e)" />
      </div>

      <h3 className="adm-h3"><span className="adm-hinted" tabIndex={0} data-hint="Whether the generation pipeline is working: how many finished, how many failed, and how many variants came back per variant asked for.">Try-on health</span> <span className="adm-muted">(all time)</span></h3>
      <div className="adm-tiles">
        <Tile label="ready" value={fmt(data.tryon.ready)} />
        <Tile label="failed" value={fmt(data.tryon.failed)} />
        <Tile label="pending" value={fmt(data.tryon.pending)} sub="started, unfinished (stuck if old)" />
        <Tile label="variant yield" value={pct(data.tryon.avgVariantYield)} sub="returned / requested" />
      </div>

      <h3 className="adm-h3"><span className="adm-hinted" tabIndex={0} data-hint="Every account sorted into real users, seeded personas and our own dev accounts. Most numbers on this page are real-only; this is where you check that split is right.">Buckets (real / seed / dev)</span></h3>
      <div className="adm-tablewrap">
        <table className="adm-table">
          <thead><tr><th>bucket</th><th>accounts</th><th>active</th><th>items</th><th>OOTDs</th><th>boards</th><th>try-ons</th></tr></thead>
          <tbody>
            <BucketRow label="real" b={data.summary.real} />
            <BucketRow label="seed" b={data.summary.seed} />
            <BucketRow label="dev" b={data.summary.dev} />
          </tbody>
        </table>
      </div>
    </>
  );
}

function TopTryons() {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    AdminService.topTryons(40).then(setItems).catch((e) => setErr(e.message || 'failed'));
  }, []);
  if (err) return <div className="adm-err">{err}</div>;
  if (!items) return <div className="adm-loading"><Loader2 className="spin" /> loading…</div>;
  if (!items.length) return <div className="adm-muted">No try-ons yet.</div>;
  const max = items[0]?.count || 1;
  return (
    <div className="adm-toplist">
      {items.map((it, i) => (
        <Link key={it.itemId} to={`/i/${it.itemId}`} className="adm-toprow">
          <span className="adm-rank">{i + 1}</span>
          {it.croppedUrl
            ? <img src={it.croppedUrl} alt="" className="adm-thumb" loading="lazy" />
            : <span className="adm-thumb adm-thumb-empty" />}
          <span className="adm-topname">
            <strong>{it.name || '(unnamed)'}</strong>
            <span className="adm-muted">{it.category || '—'}</span>
          </span>
          <span className="adm-bar"><span style={{ width: `${(it.count / max) * 100}%` }} /></span>
          <span className="adm-count">{fmt(it.count)}</span>
        </Link>
      ))}
    </div>
  );
}

const SORTS = [['recent', 'newest'], ['activity', 'most active'], ['followers', 'followers'], ['following', 'following'], ['active', 'last active']];
const BUCKETS = ['real', 'seed', 'dev'];

function UsersTab({ onPick }) {
  const [bucket, setBucket] = useState('real');
  const [sort, setSort] = useState('recent');
  const [country, setCountry] = useState(null); // region filter (ISO country code)
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    setRes(null); setErr(''); setCountry(null);
    AdminService.users({ bucket, sort, limit: 500 }).then(setRes).catch((e) => setErr(e.message || 'failed'));
  }, [bucket, sort]);

  // Region rollup — group users by their location's country (client maps the
  // city id → country via cities.js; the server only stores the raw id).
  const regions = useMemo(() => {
    if (!res) return [];
    const m = {};
    res.users.forEach((u) => { const c = cityCountry(u.location) || '—'; m[c] = (m[c] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [res]);

  const rows = res ? res.users.filter((u) => !country || (cityCountry(u.location) || '—') === country) : [];

  return (
    <>
      <div className="adm-filters">
        <div className="adm-seg">{BUCKETS.map((b) => (
          <button key={b} className={b === bucket ? 'on' : ''} onClick={() => setBucket(b)}>{b}</button>
        ))}</div>
        <div className="adm-seg">{SORTS.map(([k, l]) => (
          <button key={k} className={k === sort ? 'on' : ''} onClick={() => setSort(k)}>{l}</button>
        ))}</div>
        {res && <span className="adm-muted">{fmt(country ? rows.length : res.total)}{country ? ` in ${country}` : ` in ${bucket}`}</span>}
      </div>

      {res && regions.length > 0 && (
        <div className="adm-regions">
          <button className={!country ? 'on' : ''} onClick={() => setCountry(null)}>all</button>
          {regions.map(([c, n]) => (
            <button key={c} className={country === c ? 'on' : ''} onClick={() => setCountry(country === c ? null : c)}>
              {c} <b>{n}</b>
            </button>
          ))}
        </div>
      )}

      {err && <div className="adm-err">{err}</div>}
      {!res && !err && <div className="adm-loading"><Loader2 className="spin" /> loading…</div>}
      {res && (
        <div className="adm-tablewrap">
          <table className="adm-table adm-users">
            <thead><tr><th>user</th><th>location</th><th>joined</th><th>last active</th><th>prov</th><th>items</th><th>outfits</th><th>OOTD</th><th>boards</th><th>try-ons</th><th>followers</th><th>following</th></tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.uid} className="adm-clickable" onClick={() => onPick(u.uid)}>
                  <td>
                    <strong>{u.handle ? `@${u.handle}` : '(no handle)'}</strong>
                    {u.displayName && <div className="adm-muted">{u.displayName}</div>}
                  </td>
                  <td className="adm-muted">{u.location ? cityDisplay(u.location, 'en') : '—'}</td>
                  <td className="adm-muted">{u.createdAt || '—'}</td>
                  <td className="adm-muted">{u.lastActiveAt || '—'}</td>
                  <td className="adm-muted">{u.provider}</td>
                  <td>{fmt(u.counts.items)}</td>
                  <td>{fmt(u.counts.outfits)}</td>
                  <td>{fmt(u.counts.ootd)}</td>
                  <td>{fmt(u.counts.board)}</td>
                  <td>{fmt(u.counts.tryon)}</td>
                  <td>{fmt(u.followerCount)}</td>
                  <td>{fmt(u.followingCount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function UserDetail({ uid, onBack }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    setD(null); setErr('');
    AdminService.userDetail(uid).then(setD).catch((e) => setErr(e.message || 'failed'));
  }, [uid]);

  return (
    <>
      <button className="adm-btn" onClick={onBack}><ArrowLeft size={14} /> back to users</button>
      {err && <div className="adm-err">{err}</div>}
      {!d && !err && <div className="adm-loading"><Loader2 className="spin" /> loading…</div>}
      {d && (
        <>
          <div className="adm-userhead">
            {d.profile.photoURL ? <img src={d.profile.photoURL} alt="" className="adm-avatar" /> : <span className="adm-avatar adm-thumb-empty" />}
            <div>
              <h2>{d.profile.handle ? `@${d.profile.handle}` : d.profile.displayName || uid}</h2>
              <div className="adm-muted">{d.profile.displayName} · {d.auth.provider} · joined {d.profile.createdAt || '—'}{d.profile.location ? ` · ${cityDisplay(d.profile.location, 'en')}` : ''}</div>
              {d.profile.bio && <div className="adm-bio">{d.profile.bio}</div>}
              <div className="adm-muted">{fmt(d.profile.followerCount)} followers · {fmt(d.profile.followingCount)} following · last active {d.profile.lastActiveAt || '—'}</div>
            </div>
          </div>

          <div className="adm-tiles">
            <Tile label="items" value={fmt(d.counts.items)} sub={`${fmt(d.counts.forSale)} for sale`} />
            <Tile label="outfits" value={fmt(d.counts.outfits)} />
            <Tile label="OOTDs" value={fmt(d.counts.ootd)} sub={`${fmt(d.counts.ootdPublic)} public`} />
            <Tile label="boards" value={fmt(d.counts.boards)} />
            <Tile label="try-ons" value={fmt(d.counts.tryons)} sub={`${pct(d.tryon.successRate)} success · ${fmt(d.tryon.regenerated)} regen`} />
          </div>

          <div className="adm-grid2">
            <div className="adm-card">
              <div className="adm-card-head"><span>Top categories</span></div>
              {d.categories.length ? d.categories.map((c) => (
                <div key={c.key} className="adm-kv"><span>{c.key}</span><span>{fmt(c.count)}</span></div>
              )) : <div className="adm-muted">no items</div>}
            </div>
            <div className="adm-card">
              <div className="adm-card-head"><span>Top colors</span></div>
              {d.colors.length ? d.colors.map((c) => (
                <div key={c.key} className="adm-kv"><span>{c.key}</span><span>{fmt(c.count)}</span></div>
              )) : <div className="adm-muted">no colors</div>}
            </div>
          </div>

          <PublicGallery title="Public outfits" items={d.publicContent.outfits} to={(x) => `/o/${x.id}`} />
          <PublicGallery title="For sale" items={d.publicContent.forSale} to={(x) => `/i/${x.id}`} />
          <PublicGallery title="Public boards" items={d.publicContent.boards} to={(x) => `/boards/${x.id}`} />
          <p className="adm-note adm-muted">Private OOTD/closet photos, identity references, and DMs are intentionally excluded.</p>
        </>
      )}
    </>
  );
}

function ErrorsTab() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const load = (query = '') => {
    setRows(null); setErr('');
    AdminService.errors({ limit: 200, q: query }).then(setRows).catch((e) => setErr(e.message || 'failed'));
  };
  useEffect(() => { load(); }, []);
  return (
    <>
      <div className="adm-daterow">
        <input className="adm-search" placeholder="filter by message / url…" value={q}
          onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') load(q); }} />
        <button className="adm-btn" onClick={() => load(q)}>search</button>
        {rows && <span className="adm-muted">{fmt(rows.length)} shown (newest first)</span>}
      </div>
      {err && <div className="adm-err">{err}</div>}
      {!rows && !err && <div className="adm-loading"><Loader2 className="spin" /> loading…</div>}
      {rows && !rows.length && <div className="adm-muted">No error logs.</div>}
      {rows && rows.map((r) => (
        <div key={r.id} className="adm-errrow" onClick={() => setOpen(open === r.id ? null : r.id)}>
          <div className="adm-errhead">
            <strong>{r.message || '(no message)'}</strong>
            <span className="adm-muted">{r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}</span>
          </div>
          <div className="adm-muted adm-errmeta">{r.appVersion ? `v${r.appVersion} · ` : ''}{r.url || ''} {r.userId ? `· uid ${r.userId.slice(0, 8)}` : ''}</div>
          {open === r.id && (
            <pre className="adm-errstack">{r.stack || '(no stack)'}{r.context ? `\n\ncontext: ${JSON.stringify(r.context, null, 2)}` : ''}{r.userAgent ? `\n\nUA: ${r.userAgent}` : ''}</pre>
          )}
        </div>
      ))}
    </>
  );
}

function PublicGallery({ title, items, to }) {
  if (!items?.length) return null;
  return (
    <>
      <h3 className="adm-h3">{title} <span className="adm-muted">({items.length})</span></h3>
      <div className="adm-gallery">
        {items.map((x) => (
          <Link key={x.id} to={to(x)} className="adm-gcell">
            <img src={x.url} alt="" loading="lazy" />
          </Link>
        ))}
      </div>
    </>
  );
}

// ── Config tab — announcement banner + onboarding flow (config/copy) ────
// Edits land through adminSetConfig; deployed clients pick them up on next
// session start (remote-copy.js reads once per session). Steps are stored
// with generated locale keys (onbA{i}…) + matching strings overrides, so the
// client's one override mechanism serves both.
const CFG_LANGS = [['en', L_EN], ['ko', L_KO], ['ja', L_JA], ['es', L_ES], ['fr', L_FR]];
const emptyLangs = () => ({ en: '', ko: '', ja: '' });

// AI model ids — editable without a functions deploy (config/models,
// read by functions/model-config.js with a 5-min cache + strict validation).
function ModelsCard() {
  const [vals, setVals] = useState(null);
  const [defs, setDefs] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = () => AdminService.getConfig()
    .then(({ models, modelDefaults }) => { setVals(models || {}); setDefs(modelDefaults || {}); })
    .catch((e) => setErr(e.message || 'failed'));
  useEffect(() => { load(); }, []);

  const save = (payload, note) => {
    setBusy(true); setErr(''); setMsg('');
    AdminService.setConfig({ models: payload })
      .then(() => { setMsg(note); load(); })
      .catch((e) => setErr(e.message || 'failed'))
      .finally(() => setBusy(false));
  };

  if (!vals) return null;
  const FIELDS = [
    ['vision', 'text/vision (tagging, OOTD, stylist, translate)'],
    ['imageCrop', 'item cutout'],
    ['imageTryon', 'try-on render'],
  ];
  const SIZES = [['imageCropSize', 'cutout size'], ['imageTryonSize', 'try-on size']];
  return (
    <>
      <h3 className="adm-h3"><span className="adm-hinted" tabIndex={0} data-hint="The live model ids. Editable here and picked up within five minutes without a functions deploy; blank falls back to the built-in default.">AI models</span> <span className="adm-muted">(live in ≤5 min, no deploy — blank = built-in default)</span></h3>
      {err && <div className="adm-err">{err}</div>}
      {msg && <div className="adm-muted" style={{ marginBottom: 8 }}>✓ {msg}</div>}
      <div className="adm-cfgcard">
        {FIELDS.map(([k, label]) => (
          <div className="adm-cfgrow" key={k}>
            <span className="adm-cfglang" style={{ width: 'auto', minWidth: 210 }}>{label}</span>
            <input
              value={vals[k] ?? ''}
              placeholder={defs[k] || ''}
              onChange={(e) => setVals({ ...vals, [k]: e.target.value })}
              style={{ flex: 1, minWidth: 220 }}
            />
          </div>
        ))}
        {SIZES.map(([k, label]) => (
          <div className="adm-cfgrow" key={k}>
            <span className="adm-cfglang" style={{ width: 'auto', minWidth: 210 }}>{label}</span>
            {['1K', '2K', '4K'].map((sz) => (
              <button
                key={sz}
                className={`adm-btn${(vals[k] || defs[k]) === sz ? ' on' : ''}`}
                onClick={() => setVals({ ...vals, [k]: sz })}
              >{sz}</button>
            ))}
          </div>
        ))}
        <div className="adm-cfgrow">
          <button className="adm-btn" disabled={busy} onClick={() => save(vals, 'models saved')}>save models</button>
          <button className="adm-btn" disabled={busy} onClick={() => save(null, 'reverted to built-in defaults')}>reset to defaults</button>
        </div>
      </div>
    </>
  );
}

// Trends curation — the human hand on what /trends shows: hide bad picks
// (they never return on recompute), pin the cover. Pool = picksAll from the
// public trends doc (already-public looks only, so nothing sensitive here).
function TrendsCuration() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  const load = async () => {
    try {
      const { getDoc, doc } = await import('firebase/firestore');
      const { db } = await import('../firebase.js');
      const s = await getDoc(doc(db, 'trends', 'current'));
      setData(s.exists() ? s.data() : null);
    } catch (e) { setErr(e.message || 'failed'); }
  };
  useEffect(() => { load(); }, []);

  const act = async (payload, key) => {
    setBusy(key); setErr('');
    try { await AdminService.curateTrends(payload); await load(); }
    catch (e) { setErr(e.message || 'failed'); }
    finally { setBusy(''); }
  };

  if (!data) return null;
  const pool = data.looksPool || [];
  return (
    <>
      <h3 className="adm-h3"><span className="adm-hinted" tabIndex={0} data-hint="This week&apos;s Trends issue. Overrides apply to the current week only - next Monday it re-picks itself.">Trends curation</span> <span className="adm-muted">(auto-rotates every Monday from this week's public looks. Feature/cover/hide overrides THIS week only; next issue re-picks itself.)</span></h3>
      {err && <div className="adm-err">{err}</div>}
      <div className="adm-gallery">
        {pool.map((p) => {
          const isCover = data.coverId === p.id;
          return (
            <div key={p.id} className={`adm-gcell adm-trendpick${p.hidden ? ' is-hidden' : ''}${p.featured ? ' is-featured' : ''}`}>
              <img src={p.img} alt="" loading="lazy" />
              {p.seed && <span className="adm-trendpick-seed">seed</span>}
              <div className="adm-trendpick-acts">
                {!p.hidden && (
                  <button
                    className="adm-btn"
                    disabled={busy === p.id}
                    onClick={() => act(p.featured ? { unfeature: p.id } : { feature: p.id }, p.id)}
                  >
                    {p.featured ? 'featured ✓' : 'feature'}
                  </button>
                )}
                {!p.hidden && (
                  <button
                    className="adm-btn"
                    disabled={busy === p.id || isCover}
                    onClick={() => act({ coverId: p.id }, p.id)}
                  >
                    {isCover ? 'cover ✓' : 'cover'}
                  </button>
                )}
                <button
                  className="adm-btn"
                  disabled={busy === p.id}
                  onClick={() => act(p.hidden ? { unhide: p.id } : { hide: p.id }, p.id)}
                >
                  {p.hidden ? 'unhide' : 'hide'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="adm-cfgrow" style={{ margin: '10px 0 18px' }}>
        <button className="adm-btn" disabled={busy === 'recompute'} onClick={() => act({}, 'recompute')}>
          refresh stats now
        </button>
        <button className="adm-btn" disabled={busy === 'reshuffle'} onClick={() => act({ reshuffle: true }, 'reshuffle')}>
          new issue (re-pick looks)
        </button>
        {data.coverId && (
          <button className="adm-btn" disabled={!!busy} onClick={() => act({ coverId: null }, 'cover-clear')}>
            clear cover pin
          </button>
        )}
      </div>
    </>
  );
}

function ConfigTab() {
  const [copyDoc, setCopyDoc] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [notice, setNotice] = useState(null);
  const [steps, setSteps] = useState(null);
  const [stepsRemote, setStepsRemote] = useState(false);

  const resolveKey = (doc, lang, bundled, key) =>
    doc?.strings?.[lang]?.[key] ?? bundled[key] ?? '';

  const load = () => {
    setErr(''); setMsg('');
    AdminService.getConfig().then(({ copy }) => {
      setCopyDoc(copy || {});
      const n = copy?.notice;
      setNotice({
        id: n?.id || `n-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
        enabled: n?.enabled === true,
        text: { ...emptyLangs(), ...(n?.text || {}) },
        link: n?.link || '',
        linkLabel: { ...emptyLangs(), ...(n?.linkLabel || {}) },
      });
      const src = Array.isArray(copy?.onboardingSteps) && copy.onboardingSteps.length ? copy.onboardingSteps : BAKED_STEPS;
      setStepsRemote(src !== BAKED_STEPS);
      setSteps(src.map((s) => ({
        icon: s.icon || 'info',
        route: s.route || '',
        title: Object.fromEntries(CFG_LANGS.map(([l, b]) => [l, resolveKey(copy, l, b, s.title)])),
        body: Object.fromEntries(CFG_LANGS.map(([l, b]) => [l, resolveKey(copy, l, b, s.body)])),
        cta: Object.fromEntries(CFG_LANGS.map(([l, b]) => [l, s.cta ? resolveKey(copy, l, b, s.cta) : ''])),
      })));
    }).catch((e) => setErr(e.message || 'failed'));
  };
  useEffect(load, []);

  const saveNotice = (remove) => {
    setBusy(true); setErr(''); setMsg('');
    const payload = remove ? null : {
      id: notice.id,
      enabled: notice.enabled,
      text: Object.fromEntries(Object.entries(notice.text).filter(([, v]) => v.trim())),
      ...(notice.link.trim() ? {
        link: notice.link.trim(),
        linkLabel: Object.fromEntries(Object.entries(notice.linkLabel).filter(([, v]) => v.trim())),
      } : {}),
    };
    AdminService.setConfig({ copy: { notice: payload } })
      .then(() => { setMsg(remove ? 'notice removed' : 'notice saved'); load(); })
      .catch((e) => setErr(e.message || 'failed')).finally(() => setBusy(false));
  };

  const saveSteps = (reset) => {
    setBusy(true); setErr(''); setMsg('');
    let payload;
    if (reset) payload = { onboardingSteps: null };
    else {
      const strings = { en: {}, ko: {}, ja: {} };
      const arr = steps.map((s, i) => {
        const out = { icon: s.icon.trim() || 'info', title: `onbA${i}Title`, body: `onbA${i}Body` };
        for (const [l] of CFG_LANGS) {
          if (s.title[l].trim()) strings[l][`onbA${i}Title`] = s.title[l];
          if (s.body[l].trim()) strings[l][`onbA${i}Body`] = s.body[l];
        }
        if (Object.values(s.cta).some((v) => v.trim())) {
          out.cta = `onbA${i}Cta`;
          for (const [l] of CFG_LANGS) if (s.cta[l].trim()) strings[l][`onbA${i}Cta`] = s.cta[l];
        }
        if (s.route.trim()) out.route = s.route.trim();
        return out;
      });
      payload = { onboardingSteps: arr, strings };
    }
    AdminService.setConfig({ copy: payload })
      .then(() => { setMsg(reset ? 'onboarding reset to app defaults' : 'onboarding saved'); load(); })
      .catch((e) => setErr(e.message || 'failed')).finally(() => setBusy(false));
  };

  const upStep = (i, patch) => setSteps(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const upLang = (i, field, lang, v) => upStep(i, { [field]: { ...steps[i][field], [lang]: v } });
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j], next[i]];
    setSteps(next);
  };

  if (err && !copyDoc) return <div className="adm-err">{err}</div>;
  if (!notice || !steps) return <div className="adm-loading"><Loader2 className="spin" /> loading config…</div>;

  return (
    <>
      {err && <div className="adm-err">{err}</div>}
      {msg && <div className="adm-muted" style={{ marginBottom: 10 }}>✓ {msg}</div>}

      <h3 className="adm-h3"><span className="adm-hinted" tabIndex={0} data-hint="The in-app notice. Shows to everyone until each person dismisses it; a new id makes it show again.">Announcement banner</span> <span className="adm-muted">(shows in-app to everyone until each user dismisses it — new id re-shows)</span></h3>
      <div className="adm-cfgcard">
        <div className="adm-cfgrow">
          <label className="adm-cfginline">
            <input type="checkbox" checked={notice.enabled} onChange={(e) => setNotice({ ...notice, enabled: e.target.checked })} /> enabled
          </label>
          <label>id <input value={notice.id} onChange={(e) => setNotice({ ...notice, id: e.target.value })} style={{ width: 140 }} /></label>
          <label>link <input value={notice.link} placeholder="/tryon or https://…" onChange={(e) => setNotice({ ...notice, link: e.target.value })} style={{ width: 220 }} /></label>
        </div>
        {CFG_LANGS.map(([l]) => (
          <div className="adm-cfgrow" key={l}>
            <span className="adm-cfglang">{l}</span>
            <textarea rows={1} value={notice.text[l]} placeholder="banner text"
              onChange={(e) => setNotice({ ...notice, text: { ...notice.text, [l]: e.target.value } })} />
            {notice.link.trim() && (
              <input value={notice.linkLabel[l]} placeholder="button label"
                onChange={(e) => setNotice({ ...notice, linkLabel: { ...notice.linkLabel, [l]: e.target.value } })} style={{ width: 140 }} />
            )}
          </div>
        ))}
        <div className="adm-cfgrow">
          <button className="adm-btn" disabled={busy} onClick={() => saveNotice(false)}>save notice</button>
          {copyDoc?.notice && <button className="adm-btn" disabled={busy} onClick={() => saveNotice(true)}>remove notice</button>}
        </div>
      </div>

      <h3 className="adm-h3"><span className="adm-hinted" tabIndex={0} data-hint="The onboarding deck copy, server-overridable so it changes without an app release.">Onboarding flow</span> <span className="adm-muted">({stepsRemote ? 'server override active' : 'app defaults shown'} · applies without an app release)</span></h3>
      {steps.map((s, i) => (
        <div className="adm-cfgcard" key={i}>
          <div className="adm-cfgrow">
            <strong>step {i + 1}</strong>
            <label>icon <input value={s.icon} onChange={(e) => upStep(i, { icon: e.target.value })} style={{ width: 130 }} title="material symbol name" /></label>
            <label>route <input value={s.route} placeholder="(optional) /path — CTA navigates" onChange={(e) => upStep(i, { route: e.target.value })} style={{ width: 220 }} /></label>
            <span className="adm-cfgtools">
              <button className="adm-btn" onClick={() => move(i, -1)} disabled={i === 0}><ChevronUp size={13} /></button>
              <button className="adm-btn" onClick={() => move(i, 1)} disabled={i === steps.length - 1}><ChevronDown size={13} /></button>
              <button className="adm-btn" onClick={() => setSteps(steps.filter((_, j) => j !== i))} disabled={steps.length <= 1}><Trash2 size={13} /></button>
            </span>
          </div>
          {CFG_LANGS.map(([l]) => (
            <div className="adm-cfgrow" key={l}>
              <span className="adm-cfglang">{l}</span>
              <input value={s.title[l]} placeholder="title" onChange={(e) => upLang(i, 'title', l, e.target.value)} style={{ width: 220 }} />
              <textarea rows={1} value={s.body[l]} placeholder="body" onChange={(e) => upLang(i, 'body', l, e.target.value)} />
              <input value={s.cta[l]} placeholder="CTA label (optional)" onChange={(e) => upLang(i, 'cta', l, e.target.value)} style={{ width: 160 }} />
            </div>
          ))}
        </div>
      ))}
      <div className="adm-cfgrow" style={{ marginBottom: 18 }}>
        <button className="adm-btn" onClick={() => setSteps([...steps, { icon: 'info', route: '', title: emptyLangs(), body: emptyLangs(), cta: emptyLangs() }])} disabled={steps.length >= 8}>
          <Plus size={13} /> add step
        </button>
        <button className="adm-btn" disabled={busy} onClick={() => saveSteps(false)}>save onboarding</button>
        <button className="adm-btn" disabled={busy} onClick={() => saveSteps(true)}>reset to app defaults</button>
      </div>
      <p className="adm-muted">Empty ko/ja fields fall back to en at runtime. Native apps pick these up from the next store build; web is immediate (next session).</p>

      <ModelsCard />

      <TrendsCuration />
    </>
  );
}

const TABS = [['overview', 'Overview', TrendingUp], ['top', 'Top try-ons', Sparkles], ['users', 'Users', Users], ['marketing', 'Marketing', Megaphone], ['config', 'Config', SlidersHorizontal], ['errors', 'Errors', AlertTriangle]];

export function Admin({ user }) {
  const [tab, setTab] = useState('overview');
  const [detailUid, setDetailUid] = useState(null);

  // Belt-and-suspenders: App.jsx already guards the route, but guard here too.
  const allowed = useMemo(() => !!user && !user.isAnonymous, [user]);
  if (!allowed) return <div className="adm-wrap"><div className="adm-err">Not authorized.</div></div>;

  return (
    <div className="adm-wrap">
      <style>{ADMIN_CSS}</style>
      <header className="adm-top">
        <h1>drape <span className="adm-muted">/ admin</span></h1>
        <nav className="adm-tabs">
          {TABS.map(([k, label, Icon]) => (
            <button key={k} className={k === tab && !detailUid ? 'on' : ''} onClick={() => { setTab(k); setDetailUid(null); }}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="adm-main">
        {detailUid
          ? <UserDetail uid={detailUid} onBack={() => setDetailUid(null)} />
          : tab === 'overview' ? <Overview />
            : tab === 'top' ? <TopTryons />
              : tab === 'errors' ? <ErrorsTab />
                : tab === 'config' ? <ConfigTab />
                  : tab === 'marketing' ? <MarketingTab />
                  : <UsersTab onPick={setDetailUid} />}
      </main>
    </div>
  );
}

const ADMIN_CSS = `
.adm-cfgcard{border:1px solid var(--border);border-radius:12px;padding:12px 14px;margin-bottom:12px;display:flex;flex-direction:column;gap:8px}
.adm-cfgrow{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.adm-cfgrow label{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-muted)}
.adm-cfgrow input,.adm-cfgrow textarea{font:inherit;font-size:13px;padding:6px 8px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:inherit}
.adm-cfgrow textarea{flex:1;min-width:220px;resize:vertical}
.adm-cfglang{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);width:20px;flex:none}
.adm-cfginline{font-size:13px !important;color:inherit !important}
.adm-cfgtools{margin-left:auto;display:flex;gap:4px}
.adm-wrap{max-width:1720px;margin:0 auto;padding:20px 32px;color:var(--text-primary);font-family:var(--font-body)}
@media (max-width:768px){.adm-wrap{padding:12px}}
.adm-top{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);padding-bottom:12px;margin-bottom:16px}
.adm-top h1{font-size:22px;margin:0;font-weight:700}
.adm-tabs{display:flex;gap:6px}
.adm-tabs button,.adm-seg button{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--border);background:var(--surface);color:var(--text-secondary);padding:7px 12px;border-radius:9px;font-size:13px;cursor:pointer}
.adm-tabs button.on{background:var(--accent);border-color:var(--accent);color:#fff}
.adm-seg{display:inline-flex;border:1px solid var(--border);border-radius:9px;overflow:hidden}
.adm-seg button{border:0;border-radius:0;border-right:1px solid var(--border)}
.adm-seg button:last-child{border-right:0}
.adm-seg button.on{background:var(--accent-soft);color:var(--accent-strong);font-weight:600}
.adm-muted{color:var(--text-muted);font-size:12px}
.adm-loading,.adm-err{display:flex;align-items:center;gap:8px;padding:32px 0;color:var(--text-secondary)}
.adm-err{color:var(--error)}
.adm-toolbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.adm-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--border);background:var(--surface);padding:7px 12px;border-radius:9px;font-size:13px;cursor:pointer;color:var(--text-primary)}
.adm-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:18px}
.adm-tile{border:1px solid var(--border);border-radius:12px;padding:14px;background:var(--surface)}
.adm-tile-val{font-size:26px;font-weight:700;line-height:1}
.adm-tile-label{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--text-secondary);margin-top:6px}
.adm-tile-sub{margin-top:4px}
.adm-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px;margin-bottom:8px}
.adm-grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:8px}
.adm-card{border:1px solid var(--border);border-radius:12px;padding:14px;background:var(--surface)}
.adm-card-head{display:flex;justify-content:space-between;align-items:center;font-size:13px;font-weight:600;margin-bottom:8px}
.adm-card-foot{margin-top:6px}
.adm-note{margin:8px 0 0;font-size:12px;line-height:1.5;color:var(--text-secondary)}
.adm-chart{width:100%;height:auto;display:block}
.adm-axis{fill:var(--text-muted);font-size:11px;font-family:var(--font-body)}
.adm-daterow{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:12px}
.adm-daterow label{font-size:13px;color:var(--text-secondary);display:inline-flex;gap:6px;align-items:center}
.adm-daterow input[type=date]{border:1px solid var(--border);border-radius:8px;padding:6px 8px;font-size:13px;font-family:var(--font-body)}
.adm-search{flex:1;min-width:200px;border:1px solid var(--border);border-radius:8px;padding:8px 10px;font-size:13px;font-family:var(--font-body)}
.adm-errrow{border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:6px;cursor:pointer}
.adm-errrow:hover{background:var(--surface-elevated)}
.adm-errhead{display:flex;justify-content:space-between;gap:10px;font-size:13px}
.adm-errhead strong{color:var(--error);word-break:break-word}
.adm-errmeta{margin-top:3px;word-break:break-all}
.adm-errstack{margin-top:8px;padding:10px;background:var(--surface-elevated);border-radius:8px;font-size:11px;white-space:pre-wrap;word-break:break-word;overflow-x:auto}
.adm-h3{font-size:14px;margin:22px 0 10px;font-weight:700}
.adm-tablewrap{overflow-x:auto;border:1px solid var(--border);border-radius:12px}
.adm-table{width:100%;border-collapse:collapse;font-size:13px}
.adm-table th,.adm-table td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--border);white-space:nowrap}
.adm-table th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted);background:var(--surface-elevated)}
.adm-table tr:last-child td{border-bottom:0}
.adm-clickable{cursor:pointer}
.adm-clickable:hover td{background:var(--accent-soft)}
.adm-kv{display:flex;justify-content:space-between;font-size:13px;padding:5px 0;border-bottom:1px solid var(--border)}
.adm-kv:last-child{border-bottom:0}
.adm-filters{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:12px}
.adm-regions{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
.adm-regions button{border:1px solid var(--border);background:var(--surface);color:var(--text-secondary);padding:5px 10px;border-radius:20px;font-size:12px;cursor:pointer}
.adm-regions button.on{background:var(--accent);border-color:var(--accent);color:#fff}
.adm-regions button b{font-weight:700}
.adm-toplist{display:flex;flex-direction:column;gap:6px}
.adm-toprow{display:flex;align-items:center;gap:10px;padding:8px;border:1px solid var(--border);border-radius:10px;text-decoration:none;color:inherit}
.adm-toprow:hover{background:var(--accent-soft)}
.adm-rank{width:22px;text-align:center;font-weight:700;color:var(--text-muted)}
.adm-thumb{width:40px;height:40px;border-radius:8px;object-fit:cover;background:var(--surface-elevated)}
.adm-thumb-empty{background:var(--surface-elevated);display:inline-block}
.adm-topname{display:flex;flex-direction:column;min-width:140px;flex:0 0 180px}
.adm-topname strong{font-size:13px}
.adm-bar{flex:1;height:8px;background:var(--surface-elevated);border-radius:6px;overflow:hidden}
/* Every chart and panel title carries a title= explaining what it actually
   counts. The dotted underline is the only cue that hovering is worth it. */
.adm-hinted{position:relative;border-bottom:1px dotted var(--border-hover);cursor:help;outline:none}
/* Drawn, not the native title=: this page re-renders under the pointer (GA
   fetches, spinners) and every re-render cancels the browser's pending
   tooltip, so title= gave you the help cursor and nothing else. */
.adm-hinted::after{
  content:attr(data-hint);
  position:absolute;left:0;top:calc(100% + 6px);
  width:max-content;max-width:300px;
  padding:7px 9px;border-radius:6px;
  background:var(--text-primary);color:#fff;
  font-size:11px;font-weight:400;line-height:1.45;letter-spacing:0;
  white-space:normal;text-align:left;
  box-shadow:var(--shadow-md);
  opacity:0;visibility:hidden;transform:translateY(-2px);
  transition:opacity .12s ease,transform .12s ease;
  pointer-events:none;z-index:60;
}
.adm-hinted:hover::after,.adm-hinted:focus-visible::after{opacity:1;visibility:visible;transform:translateY(0)}
/* The card would otherwise clip a tooltip that hangs below its title. */
.adm-card,.adm-card-head{overflow:visible}
.adm-legend{display:flex;gap:10px;font-size:11px;white-space:nowrap}
.adm-bar span{display:block;height:100%;background:var(--accent)}
.adm-count{font-weight:700;width:46px;text-align:right}
.adm-userhead{display:flex;gap:14px;align-items:flex-start;margin-bottom:16px}
.adm-avatar{width:64px;height:64px;border-radius:50%;object-fit:cover}
.adm-userhead h2{margin:0 0 4px;font-size:20px}
.adm-bio{font-size:13px;margin:6px 0}
.adm-gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:6px;margin-bottom:6px}
.adm-gcell{aspect-ratio:3/4;border-radius:8px;overflow:hidden;background:var(--surface-elevated)}
.adm-gcell img{width:100%;height:100%;object-fit:cover}
.adm-note{margin-top:16px}
.spin{animation:adm-spin 1s linear infinite}
@keyframes adm-spin{to{transform:rotate(360deg)}}
`;
