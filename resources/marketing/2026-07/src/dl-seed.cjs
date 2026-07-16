// Download seed users' outfit photos / amy's items + try-on results for ad material.
const fs = require('fs');
const admin = require('/Users/uihyun/Desktop/work/drape/functions/node_modules/firebase-admin');
admin.initializeApp({ projectId: 'drape-9e532' });
const db = admin.firestore();

const OUT = '/private/tmp/claude-501/-Users-uihyun-Desktop-work-drape/d7c5166a-a2ce-461a-9fd4-3993458b1b28/scratchpad/seed';
const USERS = {
  rina_cafe_life: 'nMBOGHs6a5gjtEG4zcRYZZbWylo1',
  jisu_daily: 'NnkmRNQ7rRaPUOuBgMnXk6jBSNG3',
  bibi: 'UejNO3UbYdPp03dSGThsTOb3f9j2',
  jiho: 'XRa0n0BYOROJOck8tZBKBW8y8wo2',
  natalie: '1hVhZ2f5zeP9PkDl2A1b3ofaJkp2',
  jiyongg: 'X1paT9ci0HhT0B9s9khHi77zemy2',
  kenta_games_jp: 'ANA2VWVNcPVRiL1T1YtAc3DDoxX2',
  kazuki_t: 'e9SHTA2uBEMi9CuR64bjx0WFX5i2',
  amy: 'uGbBCTlG1HZipGVHJ1K9TqEbR1L2',
};

async function dl(url, file) {
  const res = await fetch(url);
  if (!res.ok) return console.log('FAIL', file, res.status);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

(async () => {
  for (const [h, uid] of Object.entries(USERS)) {
    const dir = `${OUT}/${h}`;
    fs.mkdirSync(dir, { recursive: true });
    const outfits = await db.collection('outfits').where('userId', '==', uid).limit(8).get();
    let i = 0;
    for (const d of outfits.docs) {
      const x = d.data();
      const url = x.photoUrl || x.sourcePhotoUrl;
      if (url) await dl(url, `${dir}/outfit-${i++}.jpg`);
    }
    console.log(h, 'outfits:', i);
  }
  // amy extras: items + generations
  const uid = USERS.amy;
  const items = await db.collection('items').where('userId', '==', uid).limit(60).get();
  let i = 0;
  fs.mkdirSync(`${OUT}/amy/items`, { recursive: true });
  for (const d of items.docs) {
    const x = d.data();
    if (x.croppedUrl && i < 16) await dl(x.croppedUrl, `${OUT}/amy/items/item-${i++}-${(x.category||'x')}.png`);
  }
  console.log('amy items:', i);
  const gens = await db.collection('generations').where('userId', '==', uid).limit(30).get();
  let g = 0;
  fs.mkdirSync(`${OUT}/amy/gens`, { recursive: true });
  for (const d of gens.docs) {
    const x = d.data();
    const url = x.resultUrl || x.imageUrl || x.url;
    if (g === 0) console.log('gen fields:', Object.keys(x).join(','));
    if (url && g < 10) await dl(url, `${OUT}/amy/gens/gen-${g++}.png`);
  }
  console.log('amy gens:', g);
})();
