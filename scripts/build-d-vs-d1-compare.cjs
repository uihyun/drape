#!/usr/bin/env node
// Build D vs D-1 side-by-side comparison (Hoefler vs Fraunces).
const sharp = require('sharp');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'resources', 'concepts');

const ITEMS = [
  {
    label: 'D (current) — Hoefler Text',
    sub: 'Apple 시스템 폰트. 비-Apple 디바이스에선 fallback',
    icon: 'icon-D-quiet-atelier.svg.png',
    splash: 'splash-D-quiet-atelier.svg.png',
  },
  {
    label: 'D-1 (proposed) — Fraunces',
    sub: 'OFL 무료 폰트. 모든 디바이스에서 동일 + a 위치 살짝 위로',
    icon: 'icon-D-1-fraunces.svg.png',
    splash: 'splash-D-1-fraunces.svg.png',
  },
];

const W = 1700;
const H = 2000;

(async () => {
  const bg = await sharp({
    create: { width: W, height: H, channels: 3, background: { r: 245, g: 240, b: 230 } },
  }).png().toBuffer();
  const composites = [];

  // Title
  const titleSvg = `<svg width="${W}" height="180" xmlns="http://www.w3.org/2000/svg">
    <text x="${W/2}" y="80" font-family="Hoefler Text, Didot, serif" font-size="56" font-weight="400" text-anchor="middle" fill="#1F1B16">D vs D-1 — Hoefler vs Fraunces</text>
    <text x="${W/2}" y="130" font-family="Helvetica Neue, sans-serif" font-size="22" text-anchor="middle" fill="#1F1B16" opacity="0.6">크로스 플랫폼 일관성 + 'a' 옵티컬 센터링</text>
  </svg>`;
  composites.push({ input: Buffer.from(titleSvg), top: 0, left: 0 });

  const COL_W = W / 2;
  const ICON_SIZE = 320;
  const ICON_TOP = 220;
  const SPLASH_W = 420;
  const SPLASH_H = 910;
  const SPLASH_TOP = ICON_TOP + ICON_SIZE + 100;

  for (let i = 0; i < ITEMS.length; i++) {
    const item = ITEMS[i];
    const colCx = i * COL_W + COL_W / 2;

    // Icon (rounded mask)
    const icon = await sharp(path.join(ROOT, item.icon))
      .resize(ICON_SIZE, ICON_SIZE)
      .composite([{
        input: Buffer.from(`<svg width="${ICON_SIZE}" height="${ICON_SIZE}"><rect width="${ICON_SIZE}" height="${ICON_SIZE}" rx="72" ry="72" fill="white"/></svg>`),
        blend: 'dest-in',
      }])
      .png()
      .toBuffer();
    composites.push({ input: icon, top: ICON_TOP, left: Math.round(colCx - ICON_SIZE/2) });

    // Splash (rounded mask)
    const splash = await sharp(path.join(ROOT, item.splash))
      .resize(SPLASH_W, SPLASH_H)
      .composite([{
        input: Buffer.from(`<svg width="${SPLASH_W}" height="${SPLASH_H}"><rect width="${SPLASH_W}" height="${SPLASH_H}" rx="44" ry="44" fill="white"/></svg>`),
        blend: 'dest-in',
      }])
      .png()
      .toBuffer();
    composites.push({ input: splash, top: SPLASH_TOP, left: Math.round(colCx - SPLASH_W/2) });

    // Label
    const labelTop = SPLASH_TOP + SPLASH_H + 30;
    const labelSvg = `<svg width="${COL_W}" height="120" xmlns="http://www.w3.org/2000/svg">
      <text x="${COL_W/2}" y="40" font-family="Hoefler Text, Didot, serif" font-size="28" font-weight="500" text-anchor="middle" fill="#1F1B16">${item.label}</text>
      <text x="${COL_W/2}" y="76" font-family="Helvetica Neue, sans-serif" font-size="16" text-anchor="middle" fill="#1F1B16" opacity="0.65">${item.sub}</text>
    </svg>`;
    composites.push({ input: Buffer.from(labelSvg), top: labelTop, left: Math.round(i * COL_W) });
  }

  // Footer
  const footerSvg = `<svg width="${W}" height="100" xmlns="http://www.w3.org/2000/svg">
    <text x="${W/2}" y="40" font-family="Helvetica Neue, sans-serif" font-size="16" text-anchor="middle" fill="#1F1B16" opacity="0.55">D 자산은 보존됨. D-1 은 별도 파일 (icon-D-1-fraunces.svg, splash-D-1-fraunces.svg).</text>
    <text x="${W/2}" y="68" font-family="Helvetica Neue, sans-serif" font-size="16" text-anchor="middle" fill="#1F1B16" opacity="0.55">Fraunces 는 ~/Library/Fonts/ 에 설치됨 — sharp / 브라우저 / Preview 모두 인식.</text>
  </svg>`;
  composites.push({ input: Buffer.from(footerSvg), top: H - 110, left: 0 });

  await sharp(bg).composite(composites).png().toFile(path.join(ROOT, 'compare-d-vs-d1.png'));
  console.log('Wrote', path.join(ROOT, 'compare-d-vs-d1.png'));
})();
