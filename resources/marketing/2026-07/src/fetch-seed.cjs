// Pull seed-user (amy, rina_cafe_life, ...) closet/OOTD/try-on assets for ad material.
const path = require('path');
const fs = require('fs');
const admin = require('/Users/uihyun/Desktop/work/drape/functions/node_modules/firebase-admin');

admin.initializeApp({ projectId: 'drape-9e532', storageBucket: 'drape-9e532.firebasestorage.app' });
const db = admin.firestore();

const OUT = '/private/tmp/claude-501/-Users-uihyun-Desktop-work-drape/d7c5166a-a2ce-461a-9fd4-3993458b1b28/scratchpad/seed';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const handles = process.argv.slice(2);
  // resolve uids by profile handle (amy uid is known-dev, look it up too)
  const profs = await db.collection('profiles').get();
  const byHandle = {};
  profs.forEach((d) => {
    const x = d.data();
    const h = (x.handle || x.username || x.displayName || '').toLowerCase();
    byHandle[h] = { uid: d.id, ...x };
  });
  console.log('total profiles:', profs.size);
  for (const h of handles) {
    const p = byHandle[h.toLowerCase()];
    if (!p) { console.log(`NOT FOUND: ${h}`, 'similar:', Object.keys(byHandle).filter(k => k.includes(h.slice(0,3))).slice(0,8)); continue; }
    console.log(`\n=== ${h} uid=${p.uid} name=${p.displayName || ''} country=${p.location?.country || ''}`);
    const dump = { profile: { uid: p.uid, handle: h, displayName: p.displayName, bio: p.bio, photoURL: p.photoURL } };

    const items = await db.collection('items').where('userId', '==', p.uid).limit(60).get();
    dump.items = items.docs.map((d) => { const x = d.data(); return { id: d.id, category: x.category, subcategory: x.subcategory, croppedUrl: x.croppedUrl, originalUrl: x.originalUrl, tags: x.tags?.slice?.(0, 6) }; });
    console.log('items:', items.size);

    for (const coll of ['ootds', 'outfits', 'generations']) {
      try {
        let q = await db.collection(coll).where('userId', '==', p.uid).limit(30).get();
        dump[coll] = q.docs.map((d) => { const x = d.data(); return { id: d.id, ...Object.fromEntries(Object.entries(x).filter(([k,v]) => typeof v === 'string' && v.length < 500).slice(0, 12)) }; });
        console.log(`${coll}:`, q.size);
      } catch (e) { console.log(`${coll}: ERR`, e.message.slice(0, 80)); }
    }
    fs.writeFileSync(`${OUT}/${h}.json`, JSON.stringify(dump, null, 1));
  }
})();
