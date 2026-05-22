#!/usr/bin/env node
// Variant B — LOUD: dark charcoal background, cream all-caps headlines,
// terracotta horizontal accent line, larger screenshot. Designed to pop in
// App Store search thumbnails. Pairs visually with the existing icon system
// (charcoal a + terracotta dot) but at higher contrast than A.
//
// Output: resources/app-store/screenshots-6.7-en-marketing-b/

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const W = 1290;
const H = 2796;
const SRC_DIR = path.join(__dirname, '..', 'resources', 'app-store', 'screenshots-6.7-en');
const OUT_DIR = path.join(__dirname, '..', 'resources', 'app-store', 'screenshots-6.7-en-marketing-b');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// Same copy as A (the deck is the same), but visually amplified.
const SLIDES = [
  { src: '01-before-after-playroom.png', headline: 'ANY ROOM,\nREIMAGINED',     subhead: 'Photo in. Design out. About a minute.' },
  { src: '03-style-picker.png',           headline: 'PICK A STYLE,\nOR INVENT', subhead: '19 presets. 4 modes. Unlimited mix.' },
  { src: '04-floor-plan-to-3d.png',       headline: 'SKETCHES READ\nLIKE PHOTOS', subhead: 'Plans, drawings, even 3D — all input.' },
  { src: '05-ai-analysis.png',            headline: 'DESIGNER NOTES\nINCLUDED',  subhead: 'Color, style, furniture — explained.' },
  { src: '06-furniture-shop.png',         headline: 'SHOP\nWHAT YOU SEE',       subhead: 'Every piece, tappable.' },
  { src: '09-feed.png',                   headline: 'SEE WHAT’S\nPOSSIBLE', subhead: 'A community of AI-designed spaces.' },
];

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Two-line headline laid out manually (the SLIDES table embeds \n).
function buildTextSvg({ headline, subhead }) {
  const lines = headline.split('\n');
  const HEAD_SIZE = 124;
  const HEAD_TOP = 280;
  const LINE_HEIGHT = 132;
  const ACCENT_Y = HEAD_TOP + (lines.length - 1) * LINE_HEIGHT + 90;
  const SUB_Y = ACCENT_Y + 110;

  const headTspans = lines
    .map((ln, i) => `<text x="100" y="${HEAD_TOP + i * LINE_HEIGHT}"
      font-family="Helvetica Neue, Avenir Next, -apple-system, sans-serif"
      font-size="${HEAD_SIZE}" font-weight="700" fill="#F0E6D2"
      letter-spacing="-3">${esc(ln)}</text>`)
    .join('\n');

  return `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <!-- charcoal background -->
  <rect width="${W}" height="${H}" fill="#1F1B16"/>

  ${headTspans}

  <!-- terracotta horizontal accent line under the headline block -->
  <rect x="100" y="${ACCENT_Y}" width="160" height="6" fill="#B5654A"/>

  <!-- subhead, warm cream, light grotesque -->
  <text x="100" y="${SUB_Y}"
        font-family="Helvetica Neue, Avenir Next, -apple-system, sans-serif"
        font-size="44" font-weight="400" fill="#F0E6D2" opacity="0.72">${esc(subhead)}</text>
</svg>`;
}

async function buildShadow(w, h) {
  const SHADOW_OFFSET = 22;
  const SHADOW_BLUR = 48;
  const ow = w + SHADOW_BLUR * 2;
  const oh = h + SHADOW_BLUR * 2;
  const svg = `
<svg width="${ow}" height="${oh}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="b" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="${SHADOW_BLUR / 2}"/>
    </filter>
  </defs>
  <rect x="${SHADOW_BLUR}" y="${SHADOW_BLUR + SHADOW_OFFSET}"
        width="${w}" height="${h}" rx="56" ry="56"
        fill="#000000" opacity="0.55" filter="url(#b)"/>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function roundCorners(buffer, radius) {
  const { width, height } = await sharp(buffer).metadata();
  const mask = Buffer.from(`
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="white"/>
</svg>`);
  return sharp(buffer)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
}

async function buildSlide(slide, index) {
  const srcPath = path.join(SRC_DIR, slide.src);
  if (!fs.existsSync(srcPath)) throw new Error(`Source not found: ${srcPath}`);

  // Slightly larger screenshot than A — 88% width — to make it dominate the
  // lower half visually.
  const SCALED_W = 1140;
  const SCALED_H = Math.round(SCALED_W * (H / W));
  const SHOT_LEFT = Math.round((W - SCALED_W) / 2);
  const SHOT_TOP = H - SCALED_H + 320; // push further down for bleed

  const screenshot = await sharp(srcPath).resize({ width: SCALED_W }).toBuffer();
  const rounded = await roundCorners(screenshot, 56);
  const shadow = await buildShadow(SCALED_W, SCALED_H);

  const out = await sharp(Buffer.from(buildTextSvg(slide)))
    .composite([
      { input: shadow,  left: SHOT_LEFT - 48, top: SHOT_TOP - 48 },
      { input: rounded, left: SHOT_LEFT,       top: SHOT_TOP },
    ])
    .png()
    .toBuffer();

  const final = await sharp(out)
    .extract({ left: 0, top: 0, width: W, height: H })
    .png({ quality: 95 })
    .toBuffer();

  const outPath = path.join(OUT_DIR, `${String(index + 1).padStart(2, '0')}-${slide.src}`);
  await fs.promises.writeFile(outPath, final);
  return outPath;
}

(async () => {
  console.log(`Building ${SLIDES.length} marketing screenshots (variant B — loud dark) → ${OUT_DIR}`);
  for (let i = 0; i < SLIDES.length; i++) {
    const p = await buildSlide(SLIDES[i], i);
    console.log(`  ✓ ${path.basename(p)}`);
  }
  console.log('done.');
})();
