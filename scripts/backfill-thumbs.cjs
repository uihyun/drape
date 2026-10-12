#!/usr/bin/env node
// One-off: give every existing closet item a grid thumbnail (functions/thumbs.js
// makes them for new and re-cropped items from now on). Idempotent: skips items
// whose thumb already matches their cutout, so it can be re-run safely.
//
//   node scripts/backfill-thumbs.cjs [--uid <uid>] [--limit N] [--dry]
//
// Uses the same makeItemThumb as the trigger, so a backfilled thumb is
// byte-for-byte what a new item gets.
const path = require('path');
const FN = path.join(__dirname, '..', 'functions');
const admin = require(path.join(FN, 'node_modules', 'firebase-admin'));
admin.initializeApp({ projectId: 'drape-9e532', storageBucket: 'drape-9e532.firebasestorage.app' });
const { makeItemThumb } = require(path.join(FN, 'thumbs.js'));

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const UID = arg('--uid');
const LIMIT = Number(arg('--limit') || 0);
const DRY = process.argv.includes('--dry');

(async () => {
  const db = admin.firestore();
  const bucket = admin.storage().bucket();
  let q = db.collection('items');
  if (UID) q = q.where('userId', '==', UID);
  const snap = await q.get();
  const todo = snap.docs.filter((d) => { const x = d.data(); return x.croppedPath && x.userId && x.thumbFor !== x.croppedPath; });
  const list = LIMIT ? todo.slice(0, LIMIT) : todo;
  console.log(`items ${snap.size}, need thumbs ${todo.length}, doing ${list.length}${DRY ? ' (dry)' : ''}`);
  if (DRY) process.exit(0);
  let done = 0, failed = 0, bytes = 0;
  const queue = [...list];
  await Promise.all(Array.from({ length: 8 }, async () => {
    for (let d = queue.shift(); d; d = queue.shift()) {
      try {
        const { bytes: b, ...fields } = await makeItemThumb(bucket, d.id, d.data());
        await d.ref.update(fields);
        done++; bytes += b;
      } catch (e) { failed++; console.warn('fail', d.id, e.message); }
      if ((done + failed) % 100 === 0) console.log(`  ${done + failed}/${list.length}`);
    }
  }));
  console.log(`done ${done}, failed ${failed}, avg ${done ? Math.round(bytes / done / 1024) : 0} KB`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
