// Generates the social-share / link-preview image (public/og-image.png, 1200x630).
// Brand: ivory Didot-italic `drape` wordmark + a lowercase tagline on espresso
// ink #141312 — matches the app icon / wordmark. Re-run after wording changes:
//   node scripts/build-og-image.cjs
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const INK = '#141312';
const IVORY = '#F4F1EA';

const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="${INK}"/>
  <text x="600" y="318" text-anchor="middle"
        font-family="Didot, 'Bodoni 72', Georgia, serif" font-style="italic"
        font-size="200" fill="${IVORY}">drape</text>
  <text x="600" y="420" text-anchor="middle"
        font-family="Helvetica Neue, Helvetica, Arial, sans-serif"
        font-size="30" letter-spacing="7" fill="${IVORY}" fill-opacity="0.55">digital closet · virtual try-on · ootd calendar</text>
</svg>`;

const svgPath = path.join(__dirname, '..', 'resources', 'og-image.svg');
// Versioned filename: link-preview services (iMessage / KakaoTalk / Slack)
// cache the image by URL independently of the page, so a same-name overwrite
// keeps serving the old cached graphic. Bump the suffix to force a fresh fetch.
const pngPath = path.join(__dirname, '..', 'public', 'og-image-v2.png');

fs.writeFileSync(svgPath, svg);
sharp(Buffer.from(svg))
  .png()
  .toFile(pngPath)
  .then(() => console.log('wrote', pngPath, 'and', svgPath))
  .catch((e) => { console.error(e); process.exit(1); });
