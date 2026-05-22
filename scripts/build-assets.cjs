// Convert resources/*.svg → resources/*.png so `@capacitor/assets` (which
// expects PNG inputs) can generate every iOS / Android / web favicon size
// from a single source. Re-run whenever the brand SVGs change.
//
//   node scripts/build-assets.js
//
// Then:
//   npx capacitor-assets generate
//   npx cap sync ios

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const RES = path.join(__dirname, '..', 'resources');
const items = [
  { svg: 'icon-only.svg',       png: 'icon-only.png',       w: 1024, h: 1024 },
  { svg: 'icon-foreground.svg', png: 'icon-foreground.png', w: 1024, h: 1024 },
  { svg: 'icon-background.svg', png: 'icon-background.png', w: 1024, h: 1024 },
  { svg: 'splash.svg',          png: 'splash.png',          w: 2732, h: 2732 },
  { svg: 'splash-dark.svg',     png: 'splash-dark.png',     w: 2732, h: 2732 },
];

(async () => {
  for (const it of items) {
    const svg = fs.readFileSync(path.join(RES, it.svg));
    // density tuned per target — 300 for 1024px, 200 for 2732px so the
    // intermediate raster stays under sharp's default pixel limit.
    const density = it.w >= 2000 ? 200 : 300;
    await sharp(svg, { density, limitInputPixels: false })
      .resize(it.w, it.h, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(RES, it.png));
    console.log(`✓ ${it.svg} → ${it.png} (${it.w}×${it.h})`);
  }
  console.log('\nNext: npx capacitor-assets generate && npx cap sync ios');
})().catch(err => { console.error(err); process.exit(1); });
