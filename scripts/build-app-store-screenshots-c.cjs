#!/usr/bin/env node
// Variant C — HYBRID: only the cover slide (#1) is loud; the rest stay in
// variant A's quiet atelier mood. The cover crops the before/after region
// out of the source screenshot and presents it full-width as the hero,
// with a large headline above.
//
// Output: resources/app-store/screenshots-6.7-en-marketing-c/

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const W = 1290;
const H = 2796;
const SRC_DIR = path.join(__dirname, '..', 'resources', 'app-store', 'screenshots-6.7-en');
const OUT_DIR = path.join(__dirname, '..', 'resources', 'app-store', 'screenshots-6.7-en-marketing-c');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const SLIDES = [
  // cover slide is rendered separately with the hero layout
  { src: '01-before-after-playroom.png', headline: '60 seconds.\nAny room.',     subhead: 'Photo in. AI redesign out.', hero: true },
  { src: '03-style-picker.png',           headline: 'Pick a style, or invent one', subhead: '19 presets. 4 modes. Unlimited mix.' },
  { src: '04-floor-plan-to-3d.png',       headline: 'Sketches read like photos',   subhead: 'Plans, drawings, even 3D — all input.' },
  { src: '05-ai-analysis.png',            headline: 'Designer notes included',     subhead: 'Color, style, furniture — explained.' },
  { src: '06-furniture-shop.png',         headline: 'Shop what you see',           subhead: 'Every piece, tappable.' },
  { src: '09-feed.png',                   headline: 'See what’s possible',     subhead: 'A community of AI-designed spaces.' },
];

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// ── A-style (quiet) — copied from build-app-store-screenshots.cjs ─────────
function buildTextSvgQuiet({ headline, subhead }) {
  const HEAD_Y = 360;
  const ACCENT_Y = HEAD_Y + 70;
  const SUB_Y = ACCENT_Y + 90;
  return `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#E1D9C8"/>
      <stop offset="1" stop-color="#C9C0AF"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <text x="100" y="${HEAD_Y}" font-family="Hoefler Text, Cochin, Garamond, 'Times New Roman', serif"
        font-size="96" font-weight="500" fill="#1F1B16" letter-spacing="-2">${esc(headline)}</text>
  <circle cx="118" cy="${ACCENT_Y}" r="11" fill="#B5654A"/>
  <text x="100" y="${SUB_Y}" font-family="Helvetica Neue, Avenir Next, -apple-system, sans-serif"
        font-size="42" font-weight="400" fill="#1F1B16" opacity="0.62">${esc(subhead)}</text>
</svg>`;
}

async function buildShadow(w, h, intense = false) {
  const SHADOW_OFFSET = intense ? 22 : 18;
  const SHADOW_BLUR = intense ? 48 : 36;
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
        width="${w}" height="${h}" rx="48" ry="48"
        fill="#1F1B16" opacity="${intense ? 0.32 : 0.22}" filter="url(#b)"/>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function roundCorners(buffer, radius) {
  const { width, height } = await sharp(buffer).metadata();
  const mask = Buffer.from(`
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="white"/>
</svg>`);
  return sharp(buffer).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}

// ── Quiet (A) slide ───────────────────────────────────────────────────────
async function buildSlideQuiet(slide, index) {
  const srcPath = path.join(SRC_DIR, slide.src);
  const SCALED_W = 980;
  const SCALED_H = Math.round(SCALED_W * (H / W));
  const SHOT_LEFT = Math.round((W - SCALED_W) / 2);
  const SHOT_TOP = H - SCALED_H + 220;

  const screenshot = await sharp(srcPath).resize({ width: SCALED_W }).toBuffer();
  const rounded = await roundCorners(screenshot, 48);
  const shadow = await buildShadow(SCALED_W, SCALED_H);

  const out = await sharp(Buffer.from(buildTextSvgQuiet(slide)))
    .composite([
      { input: shadow,  left: SHOT_LEFT - 36, top: SHOT_TOP - 36 },
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

// ── HERO slide — large headline + cropped before/after comparison ─────────
//
// The source screenshot 01-before-after-playroom is a regular phone capture.
// The visually interesting region (AI Design | Original split) lives in the
// upper third of that capture. We extract that strip and present it as the
// hero — full canvas width, anchored toward the bottom, with a big
// two-line headline + subhead on top.
async function buildSlideHero(slide, index) {
  const srcPath = path.join(SRC_DIR, slide.src);

  // Region of the source screenshot to extract (measured empirically against
  // the existing 1290×2796 capture). y-range covers the AI/Original card and
  // a touch of context below for breathing room.
  const CROP = { left: 0, top: 760, width: 1290, height: 1100 };

  // Pull out the before/after card and bump contrast/saturation slightly so
  // it pops against the beige bg.
  const card = await sharp(srcPath)
    .extract(CROP)
    .resize({ width: 1140 }) // leaves ~75px beige edge each side for shadow breathing room
    .modulate({ saturation: 1.06 })
    .toBuffer();
  const cardRounded = await roundCorners(card, 36);
  const { width: cw, height: ch } = await sharp(cardRounded).metadata();
  const cardLeft = Math.round((W - cw) / 2);
  const cardTop = Math.round(H - ch - 220);
  // Use non-intense shadow so the blur halo stays inside the canvas (1140
  // + 36*2 = 1212, well under 1290).
  const cardShadow = await buildShadow(cw, ch, false);

  // Hero text — bigger than quiet variant, italic serif headline for
  // editorial feel. Headline lives in the top ~30%, leaving room for the
  // card. We keep the brand's terracotta dot as a subtle anchor.
  const HEAD_TOP = 280;
  const LINE_HEIGHT = 144;
  const lines = slide.headline.split('\n');
  const ACCENT_Y = HEAD_TOP + (lines.length - 1) * LINE_HEIGHT + 80;
  const SUB_Y = ACCENT_Y + 95;

  const headTspans = lines
    .map((ln, i) => `<text x="80" y="${HEAD_TOP + i * LINE_HEIGHT}"
      font-family="Hoefler Text, Cochin, Garamond, 'Times New Roman', serif"
      font-size="132" font-weight="500" font-style="italic" fill="#1F1B16"
      letter-spacing="-3">${esc(ln)}</text>`)
    .join('\n');

  const textSvg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#E1D9C8"/>
      <stop offset="1" stop-color="#C9C0AF"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  ${headTspans}
  <circle cx="98" cy="${ACCENT_Y}" r="13" fill="#B5654A"/>
  <text x="80" y="${SUB_Y}"
        font-family="Helvetica Neue, Avenir Next, -apple-system, sans-serif"
        font-size="46" font-weight="400" fill="#1F1B16" opacity="0.62">${esc(slide.subhead)}</text>
</svg>`;

  const out = await sharp(Buffer.from(textSvg))
    .composite([
      { input: cardShadow, left: cardLeft - 36, top: cardTop - 36 },
      { input: cardRounded, left: cardLeft,    top: cardTop },
    ])
    .png()
    .toBuffer();

  const final = await sharp(out)
    .extract({ left: 0, top: 0, width: W, height: H })
    .png({ quality: 95 })
    .toBuffer();

  const outPath = path.join(OUT_DIR, `${String(index + 1).padStart(2, '0')}-hero-${slide.src}`);
  await fs.promises.writeFile(outPath, final);
  return outPath;
}

(async () => {
  console.log(`Building ${SLIDES.length} marketing screenshots (variant C — hybrid) → ${OUT_DIR}`);
  for (let i = 0; i < SLIDES.length; i++) {
    const slide = SLIDES[i];
    const p = slide.hero
      ? await buildSlideHero(slide, i)
      : await buildSlideQuiet(slide, i);
    console.log(`  ✓ ${path.basename(p)}`);
  }
  console.log('done.');
})();
