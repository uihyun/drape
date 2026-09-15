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

  // Closet composition — real users, NUMBERS ONLY.
  const cat = {}, col = {}, sty = {};
  let itemsTotal = 0, itemsThisWeek = 0;
  (await db().collection('items').get()).forEach((d) => {
    const x = d.data();
    if (!real.has(x.userId) || x.isArchived) return;
    itemsTotal++;
    if (x.createdAt && x.createdAt.toMillis() >= weekAgo.toMillis()) itemsThisWeek++;
    const t = x.tags || {};
    if (t.category) cat[t.category] = (cat[t.category] || 0) + 1;
    (Array.isArray(t.colors) ? t.colors.slice(0, 2) : []).forEach((c) => { col[c] = (col[c] || 0) + 1; });
    (Array.isArray(t.styles) ? t.styles.slice(0, 2) : []).forEach((s) => { sty[s] = (sty[s] || 0) + 1; });
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

  // Community picks — ONLY outfits the owner made public, real users, with
  // a visual. Owner curation (trends/curation: hidden[], coverId — written
  // by adminCurateTrends) survives every recompute: hidden picks drop out
  // of the public list, the chosen cover moves to slot 0. picksAll keeps
  // the full pool (hidden flagged) for the admin curation UI — all of it
  // is already-public content, so the world-readable doc leaks nothing.
  const curSnap = await db().collection('trends').doc('curation').get();
  const curation = curSnap.exists ? curSnap.data() : {};
  const hidden = new Set(Array.isArray(curation.hidden) ? curation.hidden : []);
  const coverId = curation.coverId || null;

  const picksAll = [];
  const pubSnap = await db().collection('outfits')
    .where('isPublic', '==', true).orderBy('createdAt', 'desc').limit(60).get();
  pubSnap.forEach((d) => {
    if (picksAll.length >= 24) return;
    const x = d.data();
    if (!real.has(x.userId)) return;
    const img = x.photoCutUrl || x.photoUrl || null;
    if (!img) return;
    picksAll.push({
      id: d.id,
      img,
      style: Array.isArray(x.style) && x.style[0] ? x.style[0].label : null,
      hidden: hidden.has(d.id),
    });
  });
  let picks = picksAll.filter((p) => !p.hidden).map(({ hidden: _h, ...rest }) => rest);
  const coverIdx = picks.findIndex((p) => p.id === coverId);
  if (coverIdx > 0) picks = [picks[coverIdx], ...picks.filter((_, i) => i !== coverIdx)];
  picks = picks.slice(0, 12);

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

  const topStyles = top(sty, 6).map((s) => ({ ...s, persona: STYLE_PERSONA[s.key] || 'juno' }));

  const doc = {
    computedAt: admin.firestore.FieldValue.serverTimestamp(),
    stats: { itemsTotal, itemsThisWeek, tryonsTotal, tryonsThisWeek, users: real.size },
    topCategories: top(cat, 6),
    topColors: top(col, 8),
    topStyles,
    triedOnCategories: top(triedCat, 6),
    picks,
    picksAll,
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
    const { hide, unhide, coverId } = request.data || {};
    if (typeof hide === 'string') hidden.add(hide);
    if (typeof unhide === 'string') hidden.delete(unhide);
    const next = { hidden: [...hidden].slice(0, 200) };
    if (coverId !== undefined) next.coverId = coverId || null;
    else if (cur.coverId) next.coverId = cur.coverId;
    await ref.set(next);
    const doc = await computeTrends();
    return { ok: true, picks: doc.picks.length, coverId: next.coverId || null };
  },
);

// Manual recompute from /admin (and for the first backfill).
exports.adminRecomputeTrends = onCall(
  { cors: true, timeoutSeconds: 300, memory: '512MiB' },
  async (request) => {
    const { assertAdmin } = require('./admin.js');
    assertAdmin(request);
    const doc = await computeTrends();
    return { ok: true, stats: doc.stats, picks: doc.picks.length, market: doc.market.length };
  },
);
