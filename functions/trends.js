// === Trends ============================================================
// The feed's replacement while the community is small (owner call,
// 2026-09-15): a ranking-board of what people actually do in drape —
// aggregated from real users' closets/try-ons, fronted by the stylist
// personas. The feed code stays intact behind config/app.feedMode.
//
// PRIVACY CONTRACT: private closet data feeds NUMBERS ONLY (category/style/
// color counts). Images shown in Trends must come from surfaces the owner
// explicitly made public: public outfits (isPublic) and marketplace
// listings (forSale). Never leak a private item's photo into trends/current
// — the doc is world-readable.

const admin = require('firebase-admin');
const { onCall } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { classify } = require('./admin-helpers.js');

function db() { return admin.firestore(); }

// Style axis → persona who fronts that section (mirrors stylist.js lenses).
const STYLE_PERSONA = {
  minimal: 'noa', classic: 'noa', normcore: 'noa', workwear: 'noa',
  street: 'remy', casual: 'remy', sporty: 'remy', gorpcore: 'remy', techwear: 'remy', y2k: 'remy',
  romantic: 'sol', bohemian: 'sol', vintage: 'sol', preppy: 'sol', chic: 'sol',
  'avant-garde': 'juno', grunge: 'juno',
};

async function realUidSet() {
  // Auth emails are the seed marker (same discipline as admin.js).
  const ids = {};
  let tok;
  do {
    const page = await admin.auth().listUsers(1000, tok);
    page.users.forEach((u) => { ids[u.uid] = u.email || ''; });
    tok = page.pageToken;
  } while (tok);
  const real = new Set();
  for (const [uid, email] of Object.entries(ids)) {
    if (classify(uid, { email }) === 'real') real.add(uid);
  }
  return real;
}

const top = (map, n) => Object.entries(map)
  .sort((a, b) => b[1] - a[1]).slice(0, n)
  .map(([key, count]) => ({ key, count }));

async function computeTrends() {
  const real = await realUidSet();
  const weekAgo = admin.firestore.Timestamp.fromMillis(Date.now() - 7 * 864e5);

  // Closet composition — real users, NUMBERS ONLY. Styles are bucketed by
  // WHEN the piece was added (this week vs the week before) so "on the rise"
  // means actual momentum, not an all-time tally.
  const twoWeeksAgo = admin.firestore.Timestamp.fromMillis(Date.now() - 14 * 864e5);
  const cat = {}, col = {}, sty = {}, styWeek = {}, styPrev = {}, brands = {};
  let itemsTotal = 0, itemsThisWeek = 0;
  (await db().collection('items').get()).forEach((d) => {
    const x = d.data();
    if (!real.has(x.userId) || x.isArchived) return;
    itemsTotal++;
    const ms = x.createdAt ? x.createdAt.toMillis() : 0;
    const isThisWeek = ms >= weekAgo.toMillis();
    const isPrevWeek = ms >= twoWeeksAgo.toMillis() && ms < weekAgo.toMillis();
    if (isThisWeek) itemsThisWeek++;
    const t = x.tags || {};
    if (t.category) cat[t.category] = (cat[t.category] || 0) + 1;
    (Array.isArray(t.colors) ? t.colors.slice(0, 2) : []).forEach((c) => { col[c] = (col[c] || 0) + 1; });
    (Array.isArray(t.styles) ? t.styles.slice(0, 2) : []).forEach((st) => {
      sty[st] = (sty[st] || 0) + 1;
      if (isThisWeek) styWeek[st] = (styWeek[st] || 0) + 1;
      else if (isPrevWeek) styPrev[st] = (styPrev[st] || 0) + 1;
    });
    // Brand names are free text from the vision tagger — fold case/spacing
    // so "SHEIN" and "Shein" are one row.
    const rawBrand = typeof x.brand === 'string' ? x.brand : (typeof t.brand === 'string' ? t.brand : '');
    const b = rawBrand.trim().replace(/\s+/g, ' ');
    if (b && b.length <= 40) {
      const key = b.toLowerCase();
      const cur = brands[key] || { label: b, count: 0 };
      cur.count += 1;
      // Prefer the prettiest casing seen (Title Case over SHOUTING).
      if (b !== b.toUpperCase() && cur.label === cur.label.toUpperCase()) cur.label = b;
      brands[key] = cur;
    }
  });

  // Try-on activity — real users, category-level counts (no images).
  const triedCat = {};
  let tryonsThisWeek = 0, tryonsTotal = 0;
  const itemCatCache = new Map();
  const gensSnap = await db().collection('generations').get();
  const itemIdsToResolve = new Set();
  const genRows = [];
  gensSnap.forEach((d) => {
    const g = d.data();
    if (!real.has(g.userId)) return;
    tryonsTotal++;
    if (g.createdAt && g.createdAt.toMillis() >= weekAgo.toMillis()) tryonsThisWeek++;
    const ids = Array.isArray(g.itemIds) ? g.itemIds : [];
    ids.forEach((id) => itemIdsToResolve.add(id));
    genRows.push(ids);
  });
  // Resolve tried-on item categories in chunks of 30 (Firestore getAll cap-ish).
  const idList = [...itemIdsToResolve];
  for (let i = 0; i < idList.length; i += 100) {
    const refs = idList.slice(i, i + 100).map((id) => db().collection('items').doc(id));
    const snaps = await db().getAll(...refs);
    snaps.forEach((s) => { if (s.exists) itemCatCache.set(s.id, s.data().tags?.category || null); });
  }
  genRows.forEach((ids) => ids.forEach((id) => {
    const c = itemCatCache.get(id);
    if (c) triedCat[c] = (triedCat[c] || 0) + 1;
  }));

  // ── This week's looks (editorial) ──────────────────────────────────
  // Pool = every PUBLIC outfit with a photo, seed closets included (they
  // already exist as browsable profiles in the app). Nothing auto-promotes:
  // only ids the owner explicitly features in trends/curation.featured[]
  // render, in that order. `hidden` kills a look from the pool for good.
  // Still images-from-public-surfaces only — the privacy contract stands.
  const curSnap = await db().collection('trends').doc('curation').get();
  const curation = curSnap.exists ? curSnap.data() : {};
  const hidden = new Set(Array.isArray(curation.hidden) ? curation.hidden : []);
  const featuredIds = Array.isArray(curation.featured) ? curation.featured : [];
  const coverId = curation.coverId || null;

  const poolMap = new Map();
  const pubSnap = await db().collection('outfits')
    .where('isPublic', '==', true).orderBy('createdAt', 'desc').limit(60).get();
  pubSnap.forEach((d) => {
    const x = d.data();
    const img = x.photoUrl || x.photoCutUrl || null;
    if (!img) return;
    poolMap.set(d.id, {
      id: d.id,
      img,
      style: Array.isArray(x.style) && x.style[0] ? x.style[0].label : null,
      seed: !real.has(x.userId),
      hidden: hidden.has(d.id),
      featured: featuredIds.includes(d.id),
    });
  });
  // Featured ids may point at older outfits outside the recent window.
  for (const id of featuredIds) {
    if (poolMap.has(id)) continue;
    const d = await db().collection('outfits').doc(id).get();
    if (!d.exists) continue;
    const x = d.data();
    if (x.isPublic !== true) continue;
    const img = x.photoUrl || x.photoCutUrl || null;
    if (!img) continue;
    poolMap.set(id, {
      id, img,
      style: Array.isArray(x.style) && x.style[0] ? x.style[0].label : null,
      seed: !real.has(x.userId), hidden: hidden.has(id), featured: true,
    });
  }
  const looksPool = [...poolMap.values()];
  const looks = featuredIds
    .map((id) => poolMap.get(id))
    .filter((l) => l && !l.hidden)
    .map(({ hidden: _h, featured: _f, seed: _s, ...rest }) => rest);
  const cover = (coverId && poolMap.get(coverId) && !poolMap.get(coverId).hidden)
    ? { id: coverId, img: poolMap.get(coverId).img, style: poolMap.get(coverId).style }
    : null;

  // Marketplace row — listings are public by definition.
  const market = [];
  const mktSnap = await db().collection('items')
    .where('forSale', '==', true).orderBy('listedAt', 'desc').limit(20).get();
  mktSnap.forEach((d) => {
    if (market.length >= 8) return;
    const x = d.data();
    const img = x.croppedUrl || x.originalUrl || null;
    if (!img) return;
    market.push({ id: d.id, img, category: x.tags?.category || null });
  });

  // Where closets live — profile city strings, real users, counts only.
  const regions = {};
  (await db().collection('profiles').get()).forEach((d) => {
    const x = d.data();
    if (!real.has(d.id) || !x.location) return;
    regions[String(x.location)] = (regions[String(x.location)] || 0) + 1;
  });

  // Rank by this week's additions when there's enough signal, else fall back
  // to the all-time tally (a brand-new week shouldn't blank the section).
  const weekTotal = Object.values(styWeek).reduce((a, b) => a + b, 0);
  const basis = weekTotal >= 10 ? styWeek : sty;
  const topStyles = top(basis, 6).map((s) => {
    const week = styWeek[s.key] || 0;
    const prev = styPrev[s.key] || 0;
    let trend = 'flat';
    if (prev === 0 && week > 0) trend = 'new';
    else if (week > prev * 1.2) trend = 'up';
    else if (week * 1.2 < prev) trend = 'down';
    return { key: s.key, count: s.count, week, prev, trend, total: sty[s.key] || 0 };
  });
  const topBrands = Object.values(brands)
    .sort((a, b) => b.count - a.count).slice(0, 8)
    .map((b) => ({ key: b.label, count: b.count }));

  const doc = {
    computedAt: admin.firestore.FieldValue.serverTimestamp(),
    stats: { itemsTotal, itemsThisWeek, tryonsTotal, tryonsThisWeek, users: real.size },
    topCategories: top(cat, 6),
    topColors: top(col, 8),
    topStyles,
    topBrands,
    basis: weekTotal >= 10 ? 'week' : 'alltime',
    triedOnCategories: top(triedCat, 6),
    looks,
    looksPool,
    cover,
    coverId,
    market,
    regions: top(regions, 5),
  };
  await db().collection('trends').doc('current').set(doc);
  return doc;
}

exports.dailyTrends = onSchedule(
  { schedule: 'every day 04:30', timeZone: 'Etc/UTC', timeoutSeconds: 300, memory: '512MiB' },
  async () => { await computeTrends(); },
);

// Owner curation: hide/unhide picks, pin a cover. Persists in
// trends/curation and takes effect immediately (recompute inline).
exports.adminCurateTrends = onCall(
  { cors: true, timeoutSeconds: 300, memory: '512MiB' },
  async (request) => {
    const { assertAdmin } = require('./admin.js');
    assertAdmin(request);
    const ref = db().collection('trends').doc('curation');
    const snap = await ref.get();
    const cur = snap.exists ? snap.data() : {};
    const hidden = new Set(Array.isArray(cur.hidden) ? cur.hidden : []);
    const featured = Array.isArray(cur.featured) ? [...cur.featured] : [];
    const { hide, unhide, feature, unfeature, coverId } = request.data || {};
    if (typeof hide === 'string') { hidden.add(hide); const i = featured.indexOf(hide); if (i >= 0) featured.splice(i, 1); }
    if (typeof unhide === 'string') hidden.delete(unhide);
    if (typeof feature === 'string' && !featured.includes(feature)) featured.push(feature);
    if (typeof unfeature === 'string') { const i = featured.indexOf(unfeature); if (i >= 0) featured.splice(i, 1); }
    const next = { hidden: [...hidden].slice(0, 200), featured: featured.slice(0, 12) };
    if (coverId !== undefined) next.coverId = coverId || null;
    else if (cur.coverId) next.coverId = cur.coverId;
    await ref.set(next);
    const doc = await computeTrends();
    return { ok: true, looks: doc.looks.length, coverId: next.coverId || null };
  },
);

// Manual recompute from /admin (and for the first backfill).
exports.adminRecomputeTrends = onCall(
  { cors: true, timeoutSeconds: 300, memory: '512MiB' },
  async (request) => {
    const { assertAdmin } = require('./admin.js');
    assertAdmin(request);
    const doc = await computeTrends();
    return { ok: true, stats: doc.stats, looks: doc.looks.length, market: doc.market.length };
  },
);
