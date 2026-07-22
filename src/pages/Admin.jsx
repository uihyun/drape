// === Admin dashboard ===================================================
// Internal analytics surface at /admin — owner-only (route guard in App.jsx,
// real enforcement in functions/admin.js). English-only by design; this is
// never user-facing, so the locale-parity rule doesn't apply.
//
// All data arrives through AdminService callables. Charts are hand-rolled
// inline SVG so we add no charting dependency.

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, RefreshCw, ArrowLeft, TrendingUp, Users, Sparkles, AlertTriangle, Megaphone } from 'lucide-react';
import { AdminService } from '../services/admin-service.js';
import { MarketingTab } from './AdminMarketing.jsx';
import { cityDisplay, cityCountry } from '../data/cities.js';

const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString());
const pct = (x) => `${Math.round((x || 0) * 100)}%`;

// ── Inline SVG line chart with axes ─────────────────────────────────────
const mmdd = (day) => { const p = (day || '').split('-'); return p.length === 3 ? `${+p[1]}/${+p[2]}` : day; };

function AxisChart({ title, series, color = 'var(--accent)' }) {
  const data = series || [];
  const total = data.reduce((s, d) => s + d.count, 0);
  // Geometry in a fixed viewBox; scales responsively (meet) so axis text stays legible.
  const W = 560; const H = 200; const PL = 38; const PR = 10; const PT = 14; const PB = 24;
  const plotW = W - PL - PR; const plotH = H - PT - PB;
  const max = Math.max(1, ...data.map((d) => d.count));
  const niceMax = max <= 4 ? max : Math.ceil(max / 5) * 5;
  const x = (i) => PL + (data.length > 1 ? (i / (data.length - 1)) * plotW : plotW / 2);
  const y = (c) => PT + plotH - (c / niceMax) * plotH;
  const pts = data.map((d, i) => `${x(i).toFixed(1)},${y(d.count).toFixed(1)}`).join(' ');
  const yticks = [0, niceMax / 2, niceMax];
  const xidx = data.length <= 1 ? [0] : [0, Math.floor((data.length - 1) / 2), data.length - 1];

  return (
    <div className="adm-card">
      <div className="adm-card-head">
        <span>{title}</span>
        <span className="adm-muted">{fmt(total)} total</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="adm-chart" role="img" preserveAspectRatio="xMidYMid meet">
        {yticks.map((t, i) => (
          <g key={i}>
            <line x1={PL} y1={y(t)} x2={W - PR} y2={y(t)} stroke="var(--border)" strokeWidth="1" />
            <text x={PL - 6} y={y(t) + 3} textAnchor="end" className="adm-axis">{fmt(Math.round(t))}</text>
          </g>
        ))}
        {data.length > 1 && <polygon points={`${PL},${PT + plotH} ${pts} ${W - PR},${PT + plotH}`} fill={color} opacity="0.08" />}
        {data.length > 1
          ? <polyline points={pts} fill="none" stroke={color} strokeWidth="2" />
          : data.length === 1 && <circle cx={x(0)} cy={y(data[0].count)} r="3" fill={color} />}
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
      <h3 className="adm-h3">Where users spend time <span className="adm-muted">(GA screen engagement, {from} → {to}){busy && <Loader2 size={13} className="spin" style={{ marginLeft: 6 }} />}</span></h3>
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
  const [range, setRange] = useState(null); // { from, to }
  const [gaFunnel, setGaFunnel] = useState(null); // { daily, totals }

  useEffect(() => {
    if (!range) return;
    AdminService.gaFunnel(range).then(setGaFunnel).catch(() => setGaFunnel({ daily: [], totals: null }));
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
    AdminService.overview().then((d) => {
      setData(d);
      const axis = d.trends.signups.map((p) => p.day);
      // Empty corpus → no dated docs → empty axis; still set a range so the
      // tab renders (empty charts) instead of spinning forever.
      const today = new Date().toISOString().slice(0, 10);
      setRange(axis.length ? { from: axis[0], to: axis[axis.length - 1] } : { from: today, to: today });
    }).catch((e) => setErr(e.message || 'failed')).finally(() => setBusy(false));
  };
  useEffect(load, []);

  if (err) return <div className="adm-err">{err}</div>;
  if (!data || !range) return <div className="adm-loading"><Loader2 className="spin" /> crunching the whole corpus…</div>;

  const t = data.totals;
  const axis = data.trends.signups.map((p) => p.day);
  const firstDay = axis[0] || range.from; const lastDay = axis[axis.length - 1] || range.to;
  const applyPreset = (days) => {
    if (!days) return setRange({ from: firstDay, to: lastDay });
    const d = new Date(lastDay + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - days + 1);
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

      <h3 className="adm-h3">Totals <span className="adm-muted">(all time)</span></h3>
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
          <h3 className="adm-h3">Activation funnel <span className="adm-muted">(real users, ever — the split GA can't do)</span></h3>
          <div className="adm-tiles">
            <Tile label="signed up" value={fmt(data.activation.signed)} />
            <Tile label="added an item" value={fmt(data.activation.item)} sub={pct(data.activation.item / (data.activation.signed || 1))} />
            <Tile label="ran a try-on" value={fmt(data.activation.tryon)} sub={pct(data.activation.tryon / (data.activation.signed || 1))} />
            <Tile label="logged an OOTD" value={fmt(data.activation.ootd)} sub={pct(data.activation.ootd / (data.activation.signed || 1))} />
            <Tile label="made an outfit" value={fmt(data.activation.outfit)} sub={pct(data.activation.outfit / (data.activation.signed || 1))} />
          </div>
        </>
      )}

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
          <h3 className="adm-h3">Acquisition funnel <span className="adm-muted">(GA, {range.from} → {range.to})</span></h3>
          <div className="adm-tiles">
            <Tile label="landing visitors" value={fmt(gaTotals.landing)} sub="web (marketing traffic)" />
            <Tile label="app installs" value={fmt(gaTotals.installs)} sub={`first_open · ${gaTotals.landing ? pct(gaTotals.installs / gaTotals.landing) : '—'} of visitors`} />
            <Tile label="app users" value={fmt(gaTotals.appUsers)} sub="opened the app in range (iOS+Android)" />
            <Tile label="real signups" value={fmt(win('signups'))} sub="accounts created in range" />
          </div>
        </>
      )}

      <ScreensCard from={range.from} to={range.to} />

      <h3 className="adm-h3">Activity over time <span className="adm-muted">({range.from} → {range.to})</span></h3>
      <div className="adm-tiles">
        <Tile label="signups" value={fmt(win('signups'))} sub="in range" />
        <Tile label="items added" value={fmt(win('items'))} sub="in range" />
        <Tile label="try-ons" value={fmt(win('tryons'))} sub="in range" />
        <Tile label="OOTDs" value={fmt(win('ootds'))} sub="in range" />
        <Tile label="boards" value={fmt(win('boards'))} sub="in range" />
      </div>
      <div className="adm-grid">
        <AxisChart title="Signups" series={slice(data.trends.signups, range.from, range.to)} />
        <AxisChart title="Items added" series={slice(data.trends.items, range.from, range.to)} />
        <AxisChart title="Try-ons" series={slice(data.trends.tryons, range.from, range.to)} />
        <AxisChart title="OOTDs" series={slice(data.trends.ootds, range.from, range.to)} />
        <AxisChart title="Boards" series={slice(data.trends.boards, range.from, range.to)} />
        <AxisChart title="Landing visitors / day (web)" series={gaDaily.map((r) => ({ day: r.day, count: r.landing }))} color="var(--accent-strong, #7a5c3e)" />
        <AxisChart title="App installs / day (first_open)" series={gaDaily.map((r) => ({ day: r.day, count: r.installs }))} color="var(--accent-strong, #7a5c3e)" />
        <AxisChart title="App active users / day (iOS+Android)" series={gaDaily.map((r) => ({ day: r.day, count: r.appUsers }))} color="var(--accent-strong, #7a5c3e)" />
        <AxisChart title="Actions per app user / day" series={perUser} color="var(--accent-strong, #7a5c3e)" />
        <AxisChart title="App engagement min / day" series={gaDaily.map((r) => ({ day: r.day, count: Math.round(r.appEngagementSec / 60) }))} color="var(--accent-strong, #7a5c3e)" />
      </div>

      <h3 className="adm-h3">Try-on health <span className="adm-muted">(all time)</span></h3>
      <div className="adm-tiles">
        <Tile label="ready" value={fmt(data.tryon.ready)} />
        <Tile label="failed" value={fmt(data.tryon.failed)} />
        <Tile label="pending" value={fmt(data.tryon.pending)} sub="started, unfinished (stuck if old)" />
        <Tile label="variant yield" value={pct(data.tryon.avgVariantYield)} sub="returned / requested" />
      </div>

      <h3 className="adm-h3">Buckets (real / seed / dev)</h3>
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

const TABS = [['overview', 'Overview', TrendingUp], ['top', 'Top try-ons', Sparkles], ['users', 'Users', Users], ['marketing', 'Marketing', Megaphone], ['errors', 'Errors', AlertTriangle]];

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
                : tab === 'marketing' ? <MarketingTab />
                  : <UsersTab onPick={setDetailUid} />}
      </main>
    </div>
  );
}

const ADMIN_CSS = `
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
