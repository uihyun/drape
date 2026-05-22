#!/usr/bin/env node
// Build comparison sheet for H–M (letter variations + symbolic marks).
const sharp = require('sharp');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'resources', 'concepts');
const W = 1800;
const H = 2400;
const ICONS = [
  // Row 1 — letter variations
  { key: 'H', label: 'H — Sumi Brush',    sub: '글자 변형 · 굵은 이탤릭 + 잉크 splatter',          file: 'icon-H-sumi-brush.svg.png' },
  { key: 'I', label: 'I — Carved Stone',  sub: '글자 변형 · 석회석에 음각된 a',                     file: 'icon-I-carved-stone.svg.png' },
  { key: 'J', label: 'J — Capital A',     sub: '글자 변형 · 기념비적 A + 양 끝 lintel 라인',        file: 'icon-J-capital-A.svg.png' },
  // Row 2 — symbolic marks (no letter)
  { key: 'K', label: 'K — Light Cone',    sub: '상징 · 어둠 속 한 줄기 빛 (Ando Church of Light)',  file: 'icon-K-light-cone.svg.png' },
  { key: 'L', label: 'L — Soft Bloom',    sub: '상징 · Claude식 bloom · 공간을 채우는 따뜻한 빛',   file: 'icon-L-soft-bloom.svg.png' },
  { key: 'M', label: 'M — Plan Compass',  sub: '상징 · 도면 북쪽 화살표 · 건축가의 signature',      file: 'icon-M-plan-compass.svg.png' },
];

(async () => {
  const bg = await sharp({
    create: { width: W, height: H, channels: 3, background: { r: 245, g: 240, b: 230 } },
  }).png().toBuffer();

  const composites = [];

  // Title
  const titleSvg = `
    <svg width="${W}" height="180" xmlns="http://www.w3.org/2000/svg">
      <text x="${W/2}" y="80" font-family="Hoefler Text, Didot, serif" font-size="56" font-weight="400" text-anchor="middle" fill="#1F1B16">More concepts — H · I · J · K · L · M</text>
      <text x="${W/2}" y="130" font-family="Helvetica Neue, sans-serif" font-size="22" text-anchor="middle" fill="#1F1B16" opacity="0.6">상단 — 글자 변형 (H/I/J) · 하단 — 상징 마크 (K/L/M)</text>
    </svg>`;
  composites.push({ input: Buffer.from(titleSvg), top: 0, left: 0 });

  // 3 columns x 2 rows layout
  const COLS = 3;
  const COL_W = W / COLS;
  const ROW1_TOP = 220;
  const ROW2_TOP = 1280;
  const LARGE_SIZE = 380;
  const SMALL_SIZE = 120;

  for (let i = 0; i < ICONS.length; i++) {
    const item = ICONS[i];
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const cx = col * COL_W + COL_W / 2;
    const rowTop = row === 0 ? ROW1_TOP : ROW2_TOP;

    const large = await sharp(path.join(ROOT, item.file))
      .resize(LARGE_SIZE, LARGE_SIZE)
      .composite([{
        input: Buffer.from(`<svg width="${LARGE_SIZE}" height="${LARGE_SIZE}"><rect width="${LARGE_SIZE}" height="${LARGE_SIZE}" rx="84" ry="84" fill="white"/></svg>`),
        blend: 'dest-in',
      }])
      .png()
      .toBuffer();
    composites.push({ input: large, top: rowTop, left: Math.round(cx - LARGE_SIZE / 2) });

    const small = await sharp(path.join(ROOT, item.file))
      .resize(SMALL_SIZE, SMALL_SIZE)
      .composite([{
        input: Buffer.from(`<svg width="${SMALL_SIZE}" height="${SMALL_SIZE}"><rect width="${SMALL_SIZE}" height="${SMALL_SIZE}" rx="26" ry="26" fill="white"/></svg>`),
        blend: 'dest-in',
      }])
      .png()
      .toBuffer();
    const smallY = rowTop + LARGE_SIZE + 240;
    composites.push({ input: small, top: smallY, left: Math.round(cx - SMALL_SIZE / 2) });

    const labelSvg = `
      <svg width="${COL_W}" height="700" xmlns="http://www.w3.org/2000/svg">
        <text x="${COL_W/2}" y="430" font-family="Hoefler Text, Didot, serif" font-size="34" font-weight="500" text-anchor="middle" fill="#1F1B16">${item.label}</text>
        <text x="${COL_W/2}" y="470" font-family="Helvetica Neue, sans-serif" font-size="18" text-anchor="middle" fill="#1F1B16" opacity="0.65">${item.sub}</text>
        <text x="${COL_W/2}" y="640" font-family="Helvetica Neue, sans-serif" font-size="14" text-anchor="middle" fill="#1F1B16" opacity="0.45">at home-screen size (~120px)</text>
      </svg>`;
    composites.push({ input: Buffer.from(labelSvg), top: rowTop, left: Math.round(col * COL_W) });
  }

  // Footer
  const footerSvg = `
    <svg width="${W}" height="120" xmlns="http://www.w3.org/2000/svg">
      <text x="${W/2}" y="40" font-family="Helvetica Neue, sans-serif" font-size="16" text-anchor="middle" fill="#1F1B16" opacity="0.55">A·B·C (compare.png) · D·E·F·G (compare-2.png) 모두 보존됨. 이 시트는 H–M.</text>
      <text x="${W/2}" y="70" font-family="Helvetica Neue, sans-serif" font-size="16" text-anchor="middle" fill="#1F1B16" opacity="0.55">상징 마크 (K·L·M) 는 글자 의존 없음 — 어떤 언어 사용자에게도 동등.</text>
    </svg>`;
  composites.push({ input: Buffer.from(footerSvg), top: H - 130, left: 0 });

  await sharp(bg)
    .composite(composites)
    .png()
    .toFile(path.join(ROOT, 'compare-3.png'));

  console.log('Wrote', path.join(ROOT, 'compare-3.png'));
})();
