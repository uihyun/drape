#!/usr/bin/env node
// Upload marketing kit creatives to Storage as PUBLIC objects under
// `marketing/<kit>/…`. Public URLs are required twice over: the /admin
// Marketing picker previews them, and the IG Graph API can only ingest
// images it can fetch from a public URL.
//
// Run:  node scripts/upload-marketing-assets.cjs [kit]     # default 2026-07
// Auth: Application Default Credentials (gcloud auth application-default login)

const path = require('path');
const fs = require('fs');
const admin = require(path.join(__dirname, '../functions/node_modules/firebase-admin'));

const KIT = process.argv[2] || '2026-07';
const ROOT = path.join(__dirname, '../resources/marketing', KIT);

admin.initializeApp({ projectId: 'drape-9e532', storageBucket: 'drape-9e532.firebasestorage.app' });
const bucket = admin.storage().bucket();

(async () => {
  if (!fs.existsSync(ROOT)) { console.error(`kit not found: ${ROOT}`); process.exit(1); }
  const dirs = fs.readdirSync(ROOT).filter((d) => fs.statSync(path.join(ROOT, d)).isDirectory() && d !== 'src');
  let n = 0;
  for (const dir of dirs) {
    for (const f of fs.readdirSync(path.join(ROOT, dir)).filter((f) => /\.(png|jpe?g|webp|mp4)$/i.test(f))) {
      const dest = `marketing/${KIT}/${dir}/${f}`;
      await bucket.upload(path.join(ROOT, dir, f), {
        destination: dest,
        metadata: { cacheControl: 'public,max-age=31536000' },
      });
      await bucket.file(dest).makePublic();
      console.log(`https://storage.googleapis.com/${bucket.name}/${dest}`);
      n += 1;
    }
  }
  console.log(`\n${n} assets uploaded public under marketing/${KIT}/`);
})();
