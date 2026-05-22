#!/usr/bin/env node
// Build a side-by-side comparison sheet for D/E/F/G mood directions.
// Original A/B/C compare.png is preserved — this is a new sheet.
const sharp = require('sharp');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'resources', 'concepts');
const W = 1800;
const H = 1700;
const ICONS = [
  { key: 'D', label: 'D — Quiet Atelier',  sub: 'Kinfolk + Ando · 차분한 베이지 + 작은 테라코타',  file: 'icon-D-quiet-atelier.svg.png' },
  { key: 'E', label: 'E — Modern Japan',   sub: 'Muji-adjacent · bone white + sumi + 朱',            file: 'icon-E-modern-japan.svg.png' },
  { key: 'F', label: 'F — Architect',      sub: '제도판 · blueprint grid + 기술적 산세리프',         file: 'icon-F-drafting.svg.png' },
  { key: 'G', label: 'G — Pure Ando',      sub: '콘크리트 회색 · 액센트 0 · 가장 엄격한 모노톤',     file: 'icon-G-pure-ando.svg.png' },
];

(async () => {
  // Cream canvas (warm neutral so dark + light icons both read)
  const bg = await sharp({
    create: { width: W, height: H, channels: 3, background: { r: 245, g: 240, b: 230 } },
  }).png().toBuffer();

  const composites = [];

  // Title strip
  const titleSvg = `
    <svg width="${W}" height="180" xmlns="http://www.w3.org/2000/svg">
      <text x="${W/2}" y="80" font-family="Hoefler Text, Didot, serif" font-size="56" font-weight="400" text-anchor="middle" fill="#1F1B16">Mood directions — D · E · F · G</text>
      <text x="${W/2}" y="130" font-family="Helvetica Neue, sans-serif" font-size="22" text-anchor="middle" fill="#1F1B16" opacity="0.6">모노톤 / 안도 다다오 결 — 진짜 작업실 / 종이 / 콘크리트 무드</text>
    </svg>`;
  composites.push({ input: Buffer.from(titleSvg), top: 0, left: 0 });

  const COL_W = W / 4;
  const TOP_Y = 220;
  const LARGE_SIZE = 360;
  const SMALL_SIZE = 120;

  for (let i = 0; i < ICONS.length; i++) {
    const item = ICONS[i];
    const cx = i * COL_W + COL_W / 2;

    // Large icon with iOS rounded corner mask
    const large = await sharp(path.join(ROOT, item.file))
      .resize(LARGE_SIZE, LARGE_SIZE)
      .composite([{
        input: Buffer.from(`<svg width="${LARGE_SIZE}" height="${LARGE_SIZE}"><rect width="${LARGE_SIZE}" height="${LARGE_SIZE}" rx="80" ry="80" fill="white"/></svg>`),
        blend: 'dest-in',
      }])
      .png()
      .toBuffer();
    composites.push({ input: large, top: TOP_Y, left: Math.round(cx - LARGE_SIZE / 2) });

    // Small icon
    const small = await sharp(path.join(ROOT, item.file))
      .resize(SMALL_SIZE, SMALL_SIZE)
      .composite([{
        input: Buffer.from(`<svg width="${SMALL_SIZE}" height="${SMALL_SIZE}"><rect width="${SMALL_SIZE}" height="${SMALL_SIZE}" rx="26" ry="26" fill="white"/></svg>`),
        blend: 'dest-in',
      }])
      .png()
      .toBuffer();
    const smallY = TOP_Y + LARGE_SIZE + 240;
    composites.push({ input: small, top: smallY, left: Math.round(cx - SMALL_SIZE / 2) });

    // Label block
    const labelSvg = `
      <svg width="${COL_W}" height="600" xmlns="http://www.w3.org/2000/svg">
        <text x="${COL_W/2}" y="430" font-family="Hoefler Text, Didot, serif" font-size="32" font-weight="500" text-anchor="middle" fill="#1F1B16">${item.label}</text>
        <text x="${COL_W/2}" y="470" font-family="Helvetica Neue, sans-serif" font-size="16" text-anchor="middle" fill="#1F1B16" opacity="0.65">${item.sub}</text>
        <text x="${COL_W/2}" y="600" font-family="Helvetica Neue, sans-serif" font-size="14" text-anchor="middle" fill="#1F1B16" opacity="0.45">at home-screen size (~120px)</text>
      </svg>`;
    composites.push({ input: Buffer.from(labelSvg), top: TOP_Y, left: Math.round(i * COL_W) });
  }

  // Footer
  const footerSvg = `
    <svg width="${W}" height="120" xmlns="http://www.w3.org/2000/svg">
      <text x="${W/2}" y="40" font-family="Helvetica Neue, sans-serif" font-size="16" text-anchor="middle" fill="#1F1B16" opacity="0.55">기존 A·B·C (compare.png) 는 그대로 보존됨. 이 시트는 D·E·F·G 모음.</text>
      <text x="${W/2}" y="68" font-family="Helvetica Neue, sans-serif" font-size="16" text-anchor="middle" fill="#1F1B16" opacity="0.55">최종 워드마크는 SVG path 직접 그려 폰트 라이선스 회피 예정.</text>
    </svg>`;
  composites.push({ input: Buffer.from(footerSvg), top: H - 130, left: 0 });

  await sharp(bg)
    .composite(composites)
    .png()
    .toFile(path.join(ROOT, 'compare-2.png'));

  console.log('Wrote', path.join(ROOT, 'compare-2.png'));
})();
