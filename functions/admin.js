// === Admin analytics ===================================================
// Server-side aggregation for the /admin dashboard. Firestore rules keep
// every user's items/generations/users docs owner-only, so the client can't
// read across accounts — these admin-gated callables do it with the admin
// SDK (which bypasses rules) and hand back only what the dashboard needs.
//
// Gating is by email, matching firestore.rules (admin/{document=**}) and the
// db-stats.cjs DEV set. The route guard in App.jsx is cosmetic; THIS is the
// real wall. If the admin roster changes, update ADMIN_EMAILS here AND the
// firestore.rules email list together.
//
// Scale note: collectAll() reads whole collections on every call. That's fine
// at our size and mirrors scripts/db-stats.cjs; when the corpus grows this
// moves to count() aggregations + the daily adminStats rollup.

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');

const ADMIN_EMAILS = ['uihyunkei@gmail.com'];

// Pure aggregation helpers live in a firebase-free module so they're unit-
// testable (tests/admin-helpers.test.js).
const { DEV, SEED_EMAIL, ACTIONS, classify, dayKey, emptyTrends, bump, buildTrends, summarizeBuckets } = require('./admin-helpers.js');

function assertAdmin(request) {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'AUTH_REQUIRED');
  const email = request.auth.token?.email || '';
  if (!ADMIN_EMAILS.includes(email)) throw new HttpsError('permission-denied', 'ADMIN_ONLY');
}
// Shared with sibling admin-gated modules (marketing.js) so the roster
// stays defined in exactly one place.
exports.assertAdmin = assertAdmin;

// ── Single full-corpus pass ────────────────────────────────────────────
// One read of every collection, assembling everything the heavy endpoints
// need: identity, per-user action counts, bucket assignment, time-series,
// try-on health, marketplace, and a top-tried-on tally.
async function collectAll() {
  const db = admin.firestore();
  const auth = admin.auth();

  // Identity from Auth — email is the authoritative seed marker.
  const id = {};
  let pageTok;
  do {
    const page = await auth.listUsers(1000, pageTok);
    page.users.forEach((uu) => {
      id[uu.uid] = {
        email: uu.email || '',
        name: uu.displayName || '',
        prov: (uu.providerData[0]?.providerId || 'anon').replace('.com', ''),
        created: (uu.metadata.creationTime || ''),
      };
    });
    pageTok = page.pageToken;
  } while (pageTok);

  const prof = {};
  (await db.collection('profiles').get()).forEach((d) => {
    const x = d.data();
    prof[d.id] = {
      handle: x.handle || '',
      name: x.displayName || id[d.id]?.name || '',
      src: x.src || '',
      followerCount: x.followerCount || 0,
      followingCount: x.followingCount || 0,
      outfitCount: x.outfitCount || 0,
      location: x.location || '',   // city id — client maps to country/name
      createdAt: dayKey(x.createdAt) || dayKey(id[d.id]?.created),
      lastActiveAt: dayKey(x.lastActiveAt),
    };
  });
  (await db.collection('users').get()).forEach((d) => {
    if (d.data().src && prof[d.id]) prof[d.id].src = d.data().src;
  });

  const bucketOf = (uid) =>
    classify(uid, { email: id[uid]?.email, src: prof[uid]?.src });

  const u = {};
  const touch = (uid) => (u[uid] ||= { items: 0, ootd: 0, ootdPriv: 0, board: 0, tryon: 0, outfits: 0 });

  const trends = emptyTrends();
  // Signups come from the profile/auth creation date (real users only).
  Object.keys(prof).forEach((uid) => {
    if (bucketOf(uid) === 'real') bump(trends.signups, prof[uid].createdAt);
  });

  const tryon = { ready: 0, failed: 0, pending: 0, total: 0, variantReq: 0, variantRet: 0 };
  const marketplace = { listings: 0, byCurrency: {} };
  const topCount = {};          // itemId -> # of try-ons referencing it
  const itemMeta = {};          // itemId -> { name, croppedUrl, category, userId }

  // Skip ownerless docs everywhere below — a doc with no userId (e.g. a stray
  // resurrection orphan) would otherwise aggregate under an `undefined` key and
  // surface as a phantom "(no handle)" user + inflate the try-on "pending" count.
  (await db.collection('items').get()).forEach((d) => {
    const x = d.data();
    const uid = x.userId;
    if (!uid) return;
    touch(uid).items++;
    itemMeta[d.id] = {
      name: x.name || '',
      croppedUrl: x.croppedUrl || x.originalUrl || '',
      category: x.tags?.category || '',
      userId: uid || '',
    };
    if (bucketOf(uid) === 'real') bump(trends.items, dayKey(x.createdAt));
    if (x.forSale) {
      marketplace.listings++;
      const cur = x.currency || '?';
      marketplace.byCurrency[cur] = (marketplace.byCurrency[cur] || 0) + 1;
    }
  });

  (await db.collection('boards').get()).forEach((d) => {
    const uid = d.data().userId;
    if (!uid) return;
    touch(uid).board++;
  });

  (await db.collection('generations').get()).forEach((d) => {
    const x = d.data();
    const uid = x.userId;
    if (!uid) return;
    touch(uid).tryon++;
    tryon.total++;
    if (x.status === 'ready') tryon.ready++;
    else if (x.status === 'failed') tryon.failed++;
    else tryon.pending++;
    tryon.variantReq += Number(x.variantsRequested) || 0;
    tryon.variantRet += Number(x.variantsReturned) || 0;
    if (bucketOf(uid) === 'real') bump(trends.tryons, dayKey(x.createdAt));
    (Array.isArray(x.itemIds) ? x.itemIds : []).forEach((iid) => {
      if (iid) topCount[iid] = (topCount[iid] || 0) + 1;
    });
  });

  // OOTDs are `outfits` docs carrying a `date`; plain outfits are the
  // builder's saved looks (counted under `outfits`, not `ootd`).
  (await db.collection('outfits').get()).forEach((d) => {
    const x = d.data();
    const uid = x.userId;
    if (!uid) return;
    const rec = touch(uid);
    rec.outfits++;
    if (x.date) {
      rec.ootd++;
      if (x.isPublic === false) rec.ootdPriv++;
      if (bucketOf(uid) === 'real') bump(trends.ootds, dayKey(x.createdAt));
    }
  });

  const allUids = new Set([...Object.keys(prof), ...Object.keys(u), ...Object.keys(id)]);
  const buckets = { real: [], seed: [], dev: [] };
  allUids.forEach((uid) => buckets[bucketOf(uid)].push(uid));

  return { id, prof, u, buckets, trends, tryon, marketplace, topCount, itemMeta };
}

// Recently-active real users (lastActiveAt within `days`).
function activeWithin(prof, buckets, days) {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  const cut = cutoff.toISOString().slice(0, 10);
  return buckets.real.filter((uid) => (prof[uid]?.lastActiveAt || '') >= cut).length;
}

// Shared by adminOverview (live) and dailyAdminSnapshot (cron).
async function computeOverview() {
  const data = await collectAll();
  const { prof, buckets, trends, tryon, marketplace } = data;
  const summary = summarizeBuckets(data);
  const totals = {
    users: buckets.real.length,
    active7: activeWithin(prof, buckets, 7),
    active30: activeWithin(prof, buckets, 30),
    items: summary.real.items.total,
    outfits: buckets.real.reduce((s, uid) => s + (data.u[uid]?.outfits || 0), 0),
    ootds: summary.real.ootd.total,
    boards: summary.real.board.total,
    tryons: summary.real.tryon.total,
    listings: marketplace.listings,
  };
  return {
    generatedAt: new Date().toISOString(),
    summary,
    totals,
    tryon: {
      ...tryon,
      successRate: tryon.total ? tryon.ready / tryon.total : 0,
      avgVariantYield: tryon.variantReq ? tryon.variantRet / tryon.variantReq : 0,
    },
    marketplace,
    trends: buildTrends({
      signups: trends.signups,
      items: trends.items,
      tryons: trends.tryons,
      ootds: trends.ootds,
    }),
  };
}

// ── Endpoints ──────────────────────────────────────────────────────────
const opts = { cors: true, timeoutSeconds: 120, memory: '512MiB' };

exports.adminOverview = onCall(opts, async (request) => {
  assertAdmin(request);
  // Trends are recomputed live from createdAt on each load; point-in-time
  // history (follower counts, that-day active) accumulates via
  // dailyAdminSnapshot into adminStats/{day} for a future history view.
  return computeOverview();
});

exports.adminTopTryons = onCall(opts, async (request) => {
  assertAdmin(request);
  const limit = Math.min(Math.max(Number(request.data?.limit) || 30, 1), 100);
  const { topCount, itemMeta } = await collectAll();
  const ranked = Object.entries(topCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([itemId, count]) => ({ itemId, count, ...(itemMeta[itemId] || { name: '(deleted)', croppedUrl: '', category: '' }) }));
  return { items: ranked };
});

exports.adminUsers = onCall(opts, async (request) => {
  assertAdmin(request);
  const bucket = ['real', 'seed', 'dev'].includes(request.data?.bucket) ? request.data.bucket : 'real';
  const sort = request.data?.sort || 'recent';
  const limit = Math.min(Math.max(Number(request.data?.limit) || 200, 1), 1000);
  const { id, prof, u, buckets } = await collectAll();

  let rows = buckets[bucket].map((uid) => {
    const c = u[uid] || { items: 0, ootd: 0, board: 0, tryon: 0, outfits: 0 };
    return {
      uid,
      handle: prof[uid]?.handle || '',
      displayName: prof[uid]?.name || id[uid]?.name || '',
      provider: id[uid]?.prov || 'anon',
      createdAt: prof[uid]?.createdAt || dayKey(id[uid]?.created) || '',
      lastActiveAt: prof[uid]?.lastActiveAt || '',
      followerCount: prof[uid]?.followerCount || 0,
      followingCount: prof[uid]?.followingCount || 0,
      location: prof[uid]?.location || '',
      counts: { items: c.items, outfits: c.outfits, ootd: c.ootd, board: c.board, tryon: c.tryon },
    };
  });

  const activity = (r) => r.counts.items + r.counts.tryon + r.counts.outfits + r.counts.board;
  const cmp = {
    recent: (a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''),
    activity: (a, b) => activity(b) - activity(a),
    followers: (a, b) => b.followerCount - a.followerCount,
    following: (a, b) => b.followingCount - a.followingCount,
    active: (a, b) => (b.lastActiveAt || '').localeCompare(a.lastActiveAt || ''),
  }[sort] || ((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  rows = rows.sort(cmp).slice(0, limit);
  return { bucket, sort, total: buckets[bucket].length, users: rows };
});

// One user, deep — activity metrics + ALREADY-PUBLIC content thumbnails only.
// Deliberately excludes identityRefs (face photos), DMs, and private OOTD /
// closet photo URLs. Don't loosen this without a privacy review.
exports.adminUserDetail = onCall(opts, async (request) => {
  assertAdmin(request);
  const uid = request.data?.uid;
  if (!uid || typeof uid !== 'string') throw new HttpsError('invalid-argument', 'uid required');
  const db = admin.firestore();

  let authMeta = {};
  try {
    const uu = await admin.auth().getUser(uid);
    authMeta = {
      email: uu.email || '',
      provider: (uu.providerData[0]?.providerId || 'anon').replace('.com', ''),
      created: uu.metadata.creationTime || '',
      lastSignIn: uu.metadata.lastSignInTime || '',
    };
  } catch { /* deleted-from-auth but data lingers — show what we have */ }

  const profSnap = await db.collection('profiles').doc(uid).get();
  const profile = profSnap.exists ? profSnap.data() : {};

  const [itemsSnap, outfitsSnap, boardsSnap, gensSnap] = await Promise.all([
    db.collection('items').where('userId', '==', uid).get(),
    db.collection('outfits').where('userId', '==', uid).get(),
    db.collection('boards').where('userId', '==', uid).get(),
    db.collection('generations').where('userId', '==', uid).get(),
  ]);

  const catCount = {};
  const colorCount = {};
  let forSale = 0;
  const sellThumbs = [];
  itemsSnap.forEach((d) => {
    const x = d.data();
    const cat = x.tags?.category || 'untagged';
    catCount[cat] = (catCount[cat] || 0) + 1;
    (Array.isArray(x.tags?.colors) ? x.tags.colors : []).forEach((c) => { if (c) colorCount[c] = (colorCount[c] || 0) + 1; });
    if (x.forSale) {
      forSale++;
      if (sellThumbs.length < 24 && x.croppedUrl) {
        sellThumbs.push({ id: d.id, url: x.croppedUrl, name: x.name || '', price: x.priceAsking, currency: x.currency || '' });
      }
    }
  });

  let ootd = 0; let ootdPub = 0;
  const publicOutfits = [];
  outfitsSnap.forEach((d) => {
    const x = d.data();
    if (x.date) { ootd++; if (x.isPublic !== false) ootdPub++; }
    // Only surface covers for content the user already made public.
    if ((x.isPublic === true || x.isListed === true) && x.coverUrl && publicOutfits.length < 24) {
      publicOutfits.push({ id: d.id, url: x.coverUrl, caption: x.caption || '', likeCount: x.likeCount || 0, listed: !!x.isListed });
    }
  });

  const publicBoards = [];
  boardsSnap.forEach((d) => {
    const x = d.data();
    if (x.isPublic === true && x.coverUrl && publicBoards.length < 24) {
      publicBoards.push({ id: d.id, url: x.coverUrl, name: x.name || '', likeCount: x.likeCount || 0 });
    }
  });

  let ready = 0; let failed = 0; let regen = 0;
  gensSnap.forEach((d) => {
    const x = d.data();
    if (x.status === 'ready') ready++; else if (x.status === 'failed') failed++;
    if (x.regenerateOf) regen++;
  });

  const top = (m, n = 8) => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ key: k, count: v }));

  return {
    uid,
    profile: {
      handle: profile.handle || '',
      displayName: profile.displayName || authMeta.email || '',
      bio: profile.bio || '',
      location: profile.location || '',
      photoURL: profile.photoURL || '',
      followerCount: profile.followerCount || 0,
      followingCount: profile.followingCount || 0,
      createdAt: dayKey(profile.createdAt) || dayKey(authMeta.created) || '',
      lastActiveAt: dayKey(profile.lastActiveAt) || '',
    },
    auth: { provider: authMeta.provider || 'anon', created: authMeta.created, lastSignIn: authMeta.lastSignIn },
    counts: {
      items: itemsSnap.size,
      outfits: outfitsSnap.size,
      ootd,
      ootdPublic: ootdPub,
      boards: boardsSnap.size,
      forSale,
      tryons: gensSnap.size,
    },
    tryon: { ready, failed, regenerated: regen, total: gensSnap.size, successRate: gensSnap.size ? ready / gensSnap.size : 0 },
    categories: top(catCount),
    colors: top(colorCount),
    publicContent: { outfits: publicOutfits, boards: publicBoards, forSale: sellThumbs },
  };
});

// Recent client error logs (errorLogs is admin-read in firestore.rules, but
// the client can't run the ordered query under those rules — so we serve it
// here). Newest first; optional substring filter on the message.
exports.adminErrors = onCall(opts, async (request) => {
  assertAdmin(request);
  const limit = Math.min(Math.max(Number(request.data?.limit) || 100, 1), 500);
  const q = (request.data?.q || '').toString().toLowerCase();
  const snap = await admin.firestore().collection('errorLogs')
    .orderBy('createdAt', 'desc').limit(limit).get();
  let rows = snap.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      message: x.message || '',
      stack: x.stack || '',
      context: x.context || null,
      userId: x.userId || null,
      appVersion: x.appVersion || '',
      url: x.url || '',
      userAgent: x.userAgent || '',
      createdAt: x.createdAt?.toDate ? x.createdAt.toDate().toISOString() : null,
    };
  });
  if (q) rows = rows.filter((r) => r.message.toLowerCase().includes(q) || (r.url || '').toLowerCase().includes(q));
  return { errors: rows };
});

// ── Daily snapshot ───────────────────────────────────────────────────────
// Point-in-time metrics (follower counts, that-day active users) can't be
// reconstructed from createdAt later, so we stamp them daily into
// adminStats/{day}. The admin page reads this collection for true history.
exports.dailyAdminSnapshot = onSchedule(
  { schedule: 'every day 03:00', timeZone: 'Etc/UTC', timeoutSeconds: 300, memory: '512MiB' },
  async () => {
    const overview = await computeOverview();
    const day = overview.generatedAt.slice(0, 10);
    await admin.firestore().collection('adminStats').doc(day).set({
      day,
      stamp: overview.generatedAt,
      summary: overview.summary,
      totals: overview.totals,
      tryon: overview.tryon,
      marketplace: overview.marketplace,
      source: 'dailyAdminSnapshot',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log(`adminStats/${day} written (${overview.totals.users} real users)`);
  },
);
