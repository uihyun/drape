#!/usr/bin/env node
// Build marketing-style App Store screenshots from the raw app captures.
//
// Each output is 1290×2796 (iPhone 6.7"). Composition:
//   - Top ~35% : limewash beige gradient + serif headline + sans subhead +
//                terracotta accent dot
//   - Bottom ~65% : the original screenshot scaled down, rounded corners,
//                   subtle drop shadow, anchored toward the bottom edge for
//                   a "rising from base" feel.
//
// Brand palette per BRANDING.md / project_brand_visual.md (Quiet Atelier D):
//   bg gradient  : #E1D9C8 → #C9C0AF
//   text         : #1F1B16 (charcoal)
//   accent dot   : #B5654A (terracotta)
//   subhead      : #1F1B16 @ 60% opacity
//
// Output: resources/app-store/screenshots-6.7-en-marketing/

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const W = 1290;
const H = 2796;
const SRC_DIR = path.join(__dirname, '..', 'resources', 'app-store', 'screenshots-6.7-en');
const OUT_DIR = path.join(__dirname, '..', 'resources', 'app-store', 'screenshots-6.7-en-marketing-a');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// Pick the 6 strongest screenshots and assign marketing copy.
// Keep headlines under 32 chars, subheads under 56 chars — readable at the
// thumbnail size users see in App Store search results.
const SLIDES = [
  {
    src: '01-before-after-playroom.png',
    headline: 'Any room, reimagined',
    subhead: 'Photo in. Design out. About a minute.',
  },
  {
    src: '03-style-picker.png',
    headline: 'Pick a style, or invent one',
    subhead: '19 presets. 4 modes. Unlimited mix.',
  },
  {
    src: '04-floor-plan-to-3d.png',
    headline: 'Sketches read like photos',
    subhead: 'Plans, drawings, even 3D — all input.',
  },
  {
    src: '05-ai-analysis.png',
    headline: 'Designer notes included',
    subhead: 'Color, style, furniture — explained.',
  },
  {
    src: '06-furniture-shop.png',
    headline: 'Shop what you see',
    subhead: 'Every piece, tappable.',
  },
  {
    src: '09-feed.png',
    headline: 'See what’s possible',
    subhead: 'A community of AI-designed spaces.',
  },
];

// XML-escape helper for SVG text.
const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Top text block — serif headline + sans subhead + tiny terracotta dot
// accent on a left-aligned, breathing layout. Anchored at the very top so
// the entire upper third reads as one tight block.
function buildTextSvg({ headline, subhead }) {
  // Headline split: allow up to 2 lines manually so we keep type size large.
  // The headlines we ship all fit one line at 96pt within 1100px so a single
  // line is fine. If we ever need wrapping, add an additional tspan here.
  const HEAD_Y = 360;          // baseline for headline
  const ACCENT_Y = HEAD_Y + 70; // terracotta dot below the headline
  const SUB_Y = ACCENT_Y + 90;  // subhead baseline below the dot

  return `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#E1D9C8"/>
      <stop offset="1" stop-color="#C9C0AF"/>
    </linearGradient>
  </defs>
  <!-- background -->
  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <!-- headline (Hoefler / Cochin serif) -->
  <text x="100" y="${HEAD_Y}"
        font-family="Hoefler Text, Cochin, Garamond, 'Times New Roman', serif"
        font-size="96" font-weight="500" fill="#1F1B16"
        letter-spacing="-2">${esc(headline)}</text>

  <!-- terracotta accent dot — quiet atelier brand signature -->
  <circle cx="118" cy="${ACCENT_Y}" r="11" fill="#B5654A"/>

  <!-- subhead (Helvetica Neue / Avenir light grotesque) -->
  <text x="100" y="${SUB_Y}"
        font-family="Helvetica Neue, Avenir Next, -apple-system, sans-serif"
        font-size="42" font-weight="400" fill="#1F1B16" opacity="0.62">${esc(subhead)}</text>
</svg>`;
}

// Drop-shadow + rounded corner for the embedded screenshot. We do this by
// pre-compositing a slightly-larger black blurred rectangle behind the
// scaled screenshot. Sharp doesn't have a CSS-style filter, so we cheat:
// render a soft black rectangle via SVG and overlay before the screenshot.
async function buildShadow(w, h) {
  // 30px softened black band behind the screenshot, ~22% opacity.
  const SHADOW_OFFSET = 18;
  const SHADOW_BLUR = 36;
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
        fill="#1F1B16" opacity="0.22" filter="url(#b)"/>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// Rounded-corner mask for the screenshot itself.
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

  // Scale screenshot to ~76% width (980px). At source aspect 1290:2796 the
  // resulting height is 980 * (2796/1290) ≈ 2123. We anchor the screenshot
  // to the bottom edge with ~80px breathing space.
  const SCALED_W = 980;
  const SCALED_H = Math.round(SCALED_W * (H / W));
  const SHOT_LEFT = Math.round((W - SCALED_W) / 2);
  const SHOT_TOP = H - SCALED_H + 220; // push down so bottom is cut off

  // The screenshot extends past the bottom of the canvas so the on-screen
  // bottom tab bar isn't fully visible — the design feels like the app is
  // "rising" from below the frame. Acceptable for marketing where chrome
  // doesn't need to be readable.

  const screenshot = await sharp(srcPath)
    .resize({ width: SCALED_W })
    .toBuffer();
  const rounded = await roundCorners(screenshot, 48);
  const shadow = await buildShadow(SCALED_W, SCALED_H);

  const textSvg = buildTextSvg(slide);

  // Order: gradient bg + text (single SVG) → shadow under shot → shot.
  const out = await sharp(Buffer.from(textSvg))
    .composite([
      {
        input: shadow,
        left: SHOT_LEFT - 36, // SHADOW_BLUR
        top: SHOT_TOP - 36,
      },
      {
        input: rounded,
        left: SHOT_LEFT,
        top: SHOT_TOP,
      },
    ])
    .png()
    .toBuffer();

  // Crop to exact canvas (shadow may have extended past edges).
  const final = await sharp(out)
    .extract({ left: 0, top: 0, width: W, height: H })
    .png({ quality: 95 })
    .toBuffer();

  const outPath = path.join(OUT_DIR, `${String(index + 1).padStart(2, '0')}-${slide.src}`);
  await fs.promises.writeFile(outPath, final);
  return outPath;
}

(async () => {
  console.log(`Building ${SLIDES.length} marketing screenshots → ${OUT_DIR}`);
  for (let i = 0; i < SLIDES.length; i++) {
    const p = await buildSlide(SLIDES[i], i);
    console.log(`  ✓ ${path.basename(p)}`);
  }
  console.log('done.');
})();
