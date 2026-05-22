#!/usr/bin/env node
// Compare D + 4 variants (D-1, D-1a, D-1b, D-2).
const sharp = require('sharp');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'resources', 'concepts');

const ITEMS = [
  { label: 'D',     sub: 'Hoefler · y=760 (lower)',         file: 'icon-D-quiet-atelier.svg.png' },
  { label: 'D-1',   sub: 'Fraunces 400 · display opsz',     file: 'icon-D-1-fraunces.svg.png' },
  { label: 'D-1a',  sub: 'Fraunces 300 (Light)',            file: 'icon-D-1a-fraunces-light.svg.png' },
  { label: 'D-1b',  sub: 'Fraunces opsz=14 (Text)',         file: 'icon-D-1b-fraunces-text.svg.png' },
  { label: 'D-2',   sub: 'Hoefler · y=720 (centered)',      file: 'icon-D-2-hoefler-centered.svg.png' },
];

const W = 2000;
const H = 1100;

(async () => {
  const bg = await sharp({
    create: { width: W, height: H, channels: 3, background: { r: 245, g: 240, b: 230 } },
  }).png().toBuffer();

  const composites = [];

  const titleSvg = `<svg width="${W}" height="180" xmlns="http://www.w3.org/2000/svg">
    <text x="${W/2}" y="80" font-family="Hoefler Text, Didot, serif" font-size="56" font-weight="400" text-anchor="middle" fill="#1F1B16">D variants — 5종 비교</text>
    <text x="${W/2}" y="130" font-family="Helvetica Neue, sans-serif" font-size="22" text-anchor="middle" fill="#1F1B16" opacity="0.6">폰트 (Hoefler vs Fraunces) × weight × 위치 매트릭스</text>
  </svg>`;
  composites.push({ input: Buffer.from(titleSvg), top: 0, left: 0 });

  const COL_W = W / 5;
  const ICON_TOP = 220;
  const LARGE_SIZE = 320;
  const SMALL_SIZE = 110;

  for (let i = 0; i < ITEMS.length; i++) {
    const item = ITEMS[i];
    const colCx = i * COL_W + COL_W / 2;

    const large = await sharp(path.join(ROOT, item.file))
      .resize(LARGE_SIZE, LARGE_SIZE)
      .composite([{
        input: Buffer.from(`<svg width="${LARGE_SIZE}" height="${LARGE_SIZE}"><rect width="${LARGE_SIZE}" height="${LARGE_SIZE}" rx="72" ry="72" fill="white"/></svg>`),
        blend: 'dest-in',
      }])
      .png()
      .toBuffer();
    composites.push({ input: large, top: ICON_TOP, left: Math.round(colCx - LARGE_SIZE/2) });

    const small = await sharp(path.join(ROOT, item.file))
      .resize(SMALL_SIZE, SMALL_SIZE)
      .composite([{
        input: Buffer.from(`<svg width="${SMALL_SIZE}" height="${SMALL_SIZE}"><rect width="${SMALL_SIZE}" height="${SMALL_SIZE}" rx="24" ry="24" fill="white"/></svg>`),
        blend: 'dest-in',
      }])
      .png()
      .toBuffer();
    composites.push({ input: small, top: ICON_TOP + LARGE_SIZE + 220, left: Math.round(colCx - SMALL_SIZE/2) });

    const labelSvg = `<svg width="${COL_W}" height="700" xmlns="http://www.w3.org/2000/svg">
      <text x="${COL_W/2}" y="380" font-family="Hoefler Text, Didot, serif" font-size="36" font-weight="500" text-anchor="middle" fill="#1F1B16">${item.label}</text>
      <text x="${COL_W/2}" y="416" font-family="Helvetica Neue, sans-serif" font-size="16" text-anchor="middle" fill="#1F1B16" opacity="0.6">${item.sub}</text>
      <text x="${COL_W/2}" y="600" font-family="Helvetica Neue, sans-serif" font-size="13" text-anchor="middle" fill="#1F1B16" opacity="0.45">~110px</text>
    </svg>`;
    composites.push({ input: Buffer.from(labelSvg), top: ICON_TOP, left: Math.round(i * COL_W) });
  }

  await sharp(bg).composite(composites).png().toFile(path.join(ROOT, 'compare-d-variants.png'));
  console.log('Wrote', path.join(ROOT, 'compare-d-variants.png'));
})();
