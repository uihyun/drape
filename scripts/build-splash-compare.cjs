#!/usr/bin/env node
// Render splash D + I to PNG and build a side-by-side comparison sheet.
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'resources', 'concepts');

const SPLASHES = [
  {
    key: 'D',
    label: 'D — Quiet Atelier',
    sub: '베이지 limewash · roman a · 작은 테라코타 노트',
    svg: 'splash-D-quiet-atelier.svg',
    icon: 'icon-D-quiet-atelier.svg.png',
  },
  {
    key: 'I',
    label: 'I — Carved Stone',
    sub: '석회석 음각 · 빛과 그림자가 글자를 만든다',
    svg: 'splash-I-carved-stone.svg',
    icon: 'icon-I-carved-stone.svg.png',
  },
];

const SHEET_W = 1700;
const SHEET_H = 1900;

(async () => {
  // 1. Render each splash SVG to half-size PNG (540×1170)
  for (const s of SPLASHES) {
    const svgBuf = fs.readFileSync(path.join(ROOT, s.svg));
    const outPath = path.join(ROOT, s.svg.replace('.svg', '.svg.png'));
    await sharp(svgBuf, { density: 220 })
      .resize(540, 1170)
      .png()
      .toFile(outPath);
    console.log('rendered splash', s.key, '→', path.basename(outPath));
  }

  // 2. Build comparison sheet
  const bg = await sharp({
    create: { width: SHEET_W, height: SHEET_H, channels: 3, background: { r: 245, g: 240, b: 230 } },
  }).png().toBuffer();

  const composites = [];

  // Title
  const titleSvg = `<svg width="${SHEET_W}" height="180" xmlns="http://www.w3.org/2000/svg">
    <text x="${SHEET_W/2}" y="80" font-family="Hoefler Text, Didot, serif" font-size="56" font-weight="400" text-anchor="middle" fill="#1F1B16">Splash + Icon — D · I</text>
    <text x="${SHEET_W/2}" y="130" font-family="Helvetica Neue, sans-serif" font-size="22" text-anchor="middle" fill="#1F1B16" opacity="0.6">모바일 portrait 1080×2340 풀세트 + 동일 시스템의 아이콘 미리보기</text>
  </svg>`;
  composites.push({ input: Buffer.from(titleSvg), top: 0, left: 0 });

  // Two columns
  const COL_W = SHEET_W / 2;
  const ICON_SIZE = 160;
  const SPLASH_W = 540;
  const SPLASH_H = 1170;
  const ICON_TOP = 220;
  const SPLASH_TOP = ICON_TOP + ICON_SIZE + 90;

  for (let i = 0; i < SPLASHES.length; i++) {
    const s = SPLASHES[i];
    const colCx = i * COL_W + COL_W / 2;

    // Icon (rounded mask)
    const icon = await sharp(path.join(ROOT, s.icon))
      .resize(ICON_SIZE, ICON_SIZE)
      .composite([{
        input: Buffer.from(`<svg width="${ICON_SIZE}" height="${ICON_SIZE}"><rect width="${ICON_SIZE}" height="${ICON_SIZE}" rx="36" ry="36" fill="white"/></svg>`),
        blend: 'dest-in',
      }])
      .png()
      .toBuffer();
    composites.push({ input: icon, top: ICON_TOP, left: Math.round(colCx - ICON_SIZE/2) });

    // Caption above splash
    const captionSvg = `<svg width="${COL_W}" height="60" xmlns="http://www.w3.org/2000/svg">
      <text x="${COL_W/2}" y="36" font-family="Helvetica Neue, sans-serif" font-size="14" text-anchor="middle" fill="#1F1B16" opacity="0.5" letter-spacing="3">A P P   I C O N   ↓   S P L A S H</text>
    </svg>`;
    composites.push({ input: Buffer.from(captionSvg), top: ICON_TOP + ICON_SIZE + 12, left: Math.round(i * COL_W) });

    // Splash with rounded phone-frame corners
    const splashPath = path.join(ROOT, s.svg.replace('.svg', '.svg.png'));
    const splashWithFrame = await sharp(splashPath)
      .composite([{
        input: Buffer.from(`<svg width="${SPLASH_W}" height="${SPLASH_H}"><rect width="${SPLASH_W}" height="${SPLASH_H}" rx="56" ry="56" fill="white"/></svg>`),
        blend: 'dest-in',
      }])
      .png()
      .toBuffer();
    composites.push({ input: splashWithFrame, top: SPLASH_TOP, left: Math.round(colCx - SPLASH_W/2) });

    // Label below splash
    const labelTop = SPLASH_TOP + SPLASH_H + 30;
    const labelSvg = `<svg width="${COL_W}" height="120" xmlns="http://www.w3.org/2000/svg">
      <text x="${COL_W/2}" y="40" font-family="Hoefler Text, Didot, serif" font-size="32" font-weight="500" text-anchor="middle" fill="#1F1B16">${s.label}</text>
      <text x="${COL_W/2}" y="76" font-family="Helvetica Neue, sans-serif" font-size="18" text-anchor="middle" fill="#1F1B16" opacity="0.65">${s.sub}</text>
    </svg>`;
    composites.push({ input: Buffer.from(labelSvg), top: labelTop, left: Math.round(i * COL_W) });
  }

  await sharp(bg).composite(composites).png().toFile(path.join(ROOT, 'compare-splash.png'));
  console.log('Wrote', path.join(ROOT, 'compare-splash.png'));
})();
