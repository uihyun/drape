// node scripts/fill-test-closet.cjs [target=1500] | --clean
//
// Fill the owner's test account (@aake) with copies of seed items to make a
// ~1,500-piece closet for load testing (owner OK'd, 2026-10-12). Every copy is
// tagged testFill:true for cleanup (`--clean`). Copies point at the seed's
// existing files (crop + thumb) and carry thumbFor = croppedPath, so no new
// files are made and the thumb trigger no-ops; client delete only removes
// files under the item's own folder, so seed files are never touched.
const admin = require(require('path').join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));
admin.initializeApp({ projectId: 'drape-9e532' });
const db = admin.firestore();
const UID = 'DJ4BHbgBGjXNtv2cuIvbCqFXaDt2';
const TARGET = Number(process.argv[2] || 1500);
(async () => {
  if (process.argv.includes('--clean')) {
    const snap = await db.collection('items').where('userId', '==', UID).where('testFill', '==', true).get();
    for (let i = 0; i < snap.docs.length; i += 400) {
      const b = db.batch(); snap.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref)); await b.commit();
    }
    console.log('deleted', snap.size); process.exit(0);
  }
  const seeds = new Set();
  let tok; do { const p = await admin.auth().listUsers(1000, tok); p.users.forEach((u) => { if ((u.email || '').endsWith('@extras-seed.example.com')) seeds.add(u.uid); }); tok = p.pageToken; } while (tok);
  const src = [];
  (await db.collection('items').where('status', '==', 'ready').get()).forEach((d) => {
    const x = d.data(); if (seeds.has(x.userId) && x.croppedUrl && x.thumbUrl && !x.isArchived) src.push(x);
  });
  const have = (await db.collection('items').where('userId', '==', UID).where('testFill', '==', true).count().get()).data().count;
  const need = Math.max(0, TARGET - have);
  console.log('seed sources', src.length, 'already filled', have, 'adding', need);
  const base = Date.now() - 400 * 864e5; // spread createdAt over ~400 days
  for (let i = 0; i < need; i += 400) {
    const b = db.batch();
    for (let k = i; k < Math.min(need, i + 400); k++) {
      const s = src[k % src.length];
      const ref = db.collection('items').doc();
      b.set(ref, {
        userId: UID, kind: 'owned', status: 'ready', testFill: true,
        name: s.name || '', tags: s.tags || {}, lang: s.lang || 'en',
        originalUrl: s.originalUrl || s.croppedUrl, originalPath: s.originalPath || null,
        croppedUrl: s.croppedUrl, croppedPath: s.croppedPath,
        thumbUrl: s.thumbUrl, thumbPath: s.thumbPath, thumbFor: s.croppedPath,
        isArchived: false,
        createdAt: admin.firestore.Timestamp.fromMillis(base + k * 6 * 3600e3),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await b.commit();
  }
  const total = (await db.collection('items').where('userId', '==', UID).count().get()).data().count;
  console.log('aake closet now', total);
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
