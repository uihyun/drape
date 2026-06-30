#!/usr/bin/env node
// === drape engagement stats ============================================
// Who is actually USING the app — real signups vs seed personas vs dev
// accounts — broken down by core action (item / OOTD / board / try-on).
//
// Run:   node scripts/db-stats.cjs              # print report
//        node scripts/db-stats.cjs --save       # also write a dated snapshot
//        node scripts/db-stats.cjs --json       # machine-readable to stdout
//
// Auth: uses Application Default Credentials (gcloud auth application-default
// login) against project drape-9e532. firebase-admin is resolved from
// functions/node_modules so no extra install is needed.
//
// Why buckets matter: seed personas were bulk-created to populate the feed
// (custom handles, OOTD-only). Dev accounts are ours. "Real" = organic
// signups, which get an auto-generated `drape<uidprefix>` handle they never
// changed. That handle pattern is the cleanest seed/real discriminator we have
// (no isSeed flag in the data). Revisit if we ever let users pick handles at
// signup. The future admin page should read these same buckets.

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

function classify(uid, handle) {
  if (DEV.has(uid)) return 'dev';
  if (/^drape[a-z0-9]{6,}$/.test(handle)) return 'real';  // auto signup handle
  if (!handle) return 'real?';                            // partial/blank profile
  return 'seed';                                          // curated custom handle
}

async function collect() {
  admin.initializeApp({ projectId: PROJECT });
  const db = admin.firestore();

  const prof = {};
  (await db.collection('profiles').get()).forEach(d => {
    const x = d.data();
    prof[d.id] = { handle: x.handle || '', name: x.displayName || '' };
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

  const allUids = new Set([...Object.keys(prof), ...Object.keys(u)]);
  const buckets = { real: [], 'real?': [], seed: [], dev: [] };
  allUids.forEach(uid => buckets[classify(uid, prof[uid]?.handle || '')].push(uid));

  return { prof, u, buckets };
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

function printReport({ prof, u, buckets }, summary) {
  const order = [
    ['real', 'REAL public signups (auto handle)'],
    ['real?', 'REAL? blank/partial-profile signups'],
    ['seed', 'SEED personas + uncategorized (custom handles)'],
    ['dev', 'DEV accounts (excluded from real metrics)'],
  ];
  for (const [key, label] of order) {
    const s = summary[key];
    console.log(`\n=== ${label} — ${s.accounts} accounts, ${s.active} active ===`);
    for (const k of ACTIONS) console.log(`  ${k.padEnd(9)}: ${String(s[k].users).padStart(3)} users, ${s[k].total} total`);
    buckets[key].filter(id => u[id])
      .sort((a, b) => (u[b].items + u[b].tryon) - (u[a].items + u[a].tryon))
      .forEach(id => {
        const c = u[id];
        console.log(`     ${(prof[id]?.handle || '(blank)').padEnd(16)} ${(prof[id]?.name || '').slice(0, 16).padEnd(16)} item:${c.items} ootd:${c.ootd}(p${c.ootdPriv}) board:${c.board} tryon:${c.tryon}`);
      });
  }
}

(async () => {
  const data = await collect();
  const summary = summarize(data);
  const stamp = new Date().toISOString();

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
    const file = path.join(dir, `${stamp.slice(0, 10)}.json`);
    fs.writeFileSync(file, JSON.stringify({ stamp, summary }, null, 2));
    console.log(`\nsnapshot saved → ${path.relative(process.cwd(), file)}`);
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
