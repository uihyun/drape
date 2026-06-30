#!/usr/bin/env node
// === drape engagement stats ============================================
// Who is actually USING the app — real signups vs seed personas vs dev
// accounts — broken down by core action (item / OOTD / board / try-on).
//
// Run:   node scripts/db-stats.cjs              # print report
//        node scripts/db-stats.cjs --save       # also write a dated local JSON snapshot
//        node scripts/db-stats.cjs --firestore  # also upsert the snapshot into Firestore (adminStats/{date})
//        node scripts/db-stats.cjs --json       # machine-readable to stdout
//
// The --firestore snapshot is aggregate-only (bucket counts, no PII) and is the
// data source for the future admin page. adminStats is locked in firestore.rules
// (admin SDK / admin-gated callable only — no client access).
//
// Auth: uses Application Default Credentials (gcloud auth application-default
// login) against project drape-9e532. firebase-admin is resolved from
// functions/node_modules so no extra install is needed.
//
// Why buckets matter: seed personas were bulk-created to populate the feed.
// They're identifiable by their auth email — `<handle>.<hash>@extras-seed.example.com`
// — and/or a `src: 'seed'` field on the profile/user doc. Dev accounts are ours
// (hard-coded below). "Real" = everyone else: organic third-party signups. The
// future admin page should read these same buckets.

const path = require('path');
const admin = require(path.join(__dirname, '../functions/node_modules/firebase-admin'));

const PROJECT = 'drape-9e532';

// Accounts that are ours, not users. Keep in sync as we add test rigs.
const DEV = new Set([
  'uGbBCTlG1HZipGVHJ1K9TqEbR1L2', // amy   — dev showcase (the landing mockups)
  'DJ4BHbgBGjXNtv2cuIvbCqFXaDt2', // aake  — dev test
  '6cFtHe7gFmSRJA22JDqvE2ZTGJn1', // Uihyun Kim — developer
]);

const ACTIONS = ['items', 'ootd', 'ootdPriv', 'board', 'tryon'];

const SEED_EMAIL = '@extras-seed.example.com';

function classify(uid, { email = '', src = '' } = {}) {
  if (DEV.has(uid)) return 'dev';
  if (email.endsWith(SEED_EMAIL) || src === 'seed') return 'seed';
  return 'real';
}

async function collect() {
  admin.initializeApp({ projectId: PROJECT });
  const db = admin.firestore();
  const auth = admin.auth();

  // identity from Firebase Auth (email is the authoritative seed marker)
  const id = {};
  let page = await auth.listUsers(1000);
  while (true) {
    page.users.forEach(uu => {
      id[uu.uid] = {
        email: uu.email || '',
        name: uu.displayName || '',
        prov: (uu.providerData[0]?.providerId || 'anon').replace('.com', ''),
        created: (uu.metadata.creationTime || '').slice(0, 16),
      };
    });
    if (!page.pageToken) break;
    page = await auth.listUsers(1000, page.pageToken);
  }

  const prof = {};
  (await db.collection('profiles').get()).forEach(d => {
    const x = d.data();
    prof[d.id] = { handle: x.handle || '', name: x.displayName || id[d.id]?.name || '', src: x.src || '' };
  });
  (await db.collection('users').get()).forEach(d => {
    if (d.data().src && prof[d.id]) prof[d.id].src = d.data().src;
  });

  const u = {};
  const bump = (uid, k) => {
    if (!uid) return;
    (u[uid] ||= { items: 0, ootd: 0, ootdPriv: 0, board: 0, tryon: 0 })[k]++;
  };
  (await db.collection('items').get()).forEach(d => bump(d.data().userId, 'items'));
  (await db.collection('boards').get()).forEach(d => bump(d.data().userId, 'board'));
  (await db.collection('generations').get()).forEach(d => bump(d.data().userId, 'tryon'));
  // OOTDs are `outfits` docs carrying a `date`; plain outfits (no date) are
  // the builder's saved looks and aren't counted as an OOTD action here.
  (await db.collection('outfits').get()).forEach(d => {
    const x = d.data();
    if (!x.date) return;
    bump(x.userId, 'ootd');
    if (x.isPublic === false) bump(x.userId, 'ootdPriv');
  });

  const allUids = new Set([...Object.keys(prof), ...Object.keys(u), ...Object.keys(id)]);
  const buckets = { real: [], seed: [], dev: [] };
  allUids.forEach(uid => buckets[classify(uid, { email: id[uid]?.email, src: prof[uid]?.src })].push(uid));

  return { id, prof, u, buckets };
}

function summarize({ u, buckets }) {
  const out = {};
  for (const [label, uids] of Object.entries(buckets)) {
    const per = {};
    for (const k of ACTIONS) {
      const who = uids.filter(id => (u[id]?.[k] || 0) > 0);
      per[k] = { users: who.length, total: who.reduce((s, id) => s + u[id][k], 0) };
    }
    out[label] = { accounts: uids.length, active: uids.filter(id => u[id]).length, ...per };
  }
  return out;
}

function printReport({ id, prof, u, buckets }, summary) {
  const order = [
    ['real', 'REAL organic signups'],
    ['seed', 'SEED personas (@extras-seed.example.com / src=seed)'],
    ['dev', 'DEV accounts (excluded from real metrics)'],
  ];
  for (const [key, label] of order) {
    const s = summary[key];
    console.log(`\n=== ${label} — ${s.accounts} accounts, ${s.active} active ===`);
    for (const k of ACTIONS) console.log(`  ${k.padEnd(9)}: ${String(s[k].users).padStart(3)} users, ${s[k].total} total`);
    buckets[key].filter(uid => u[uid])
      .sort((a, b) => (u[b].items + u[b].tryon) - (u[a].items + u[a].tryon))
      .forEach(uid => {
        const c = u[uid], m = id[uid] || {};
        console.log(`     ${(m.name || prof[uid]?.handle || '(no name)').slice(0, 18).padEnd(18)} ${(m.email || '').padEnd(34)} ${(m.prov || '').padEnd(7)} ${m.created || ''}  item:${c.items} ootd:${c.ootd}(p${c.ootdPriv}) board:${c.board} tryon:${c.tryon}`);
      });
  }
}

(async () => {
  const data = await collect();
  const summary = summarize(data);
  const stamp = new Date().toISOString();
  const day = stamp.slice(0, 10);

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ stamp, summary }, null, 2));
  } else {
    console.log(`drape engagement stats — ${stamp}`);
    printReport(data, summary);
  }

  if (process.argv.includes('--save')) {
    const fs = require('fs');
    const dir = path.join(__dirname, 'stats-snapshots');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${day}.json`);
    fs.writeFileSync(file, JSON.stringify({ stamp, summary }, null, 2));
    console.log(`\nlocal snapshot → ${path.relative(process.cwd(), file)}`);
  }

  if (process.argv.includes('--firestore')) {
    // One doc per day (id = YYYY-MM-DD) so re-runs upsert rather than pile up.
    // Aggregate-only; the admin page reads this collection over time.
    await admin.firestore().collection('adminStats').doc(day).set({
      day, stamp, summary, source: 'db-stats.cjs',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`firestore snapshot → adminStats/${day}`);
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
