#!/usr/bin/env node
// Build a side-by-side comparison sheet of icon concepts at large + home-screen size.
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..', 'resources', 'concepts');
const W = 1500;
const H = 1700;
const ICONS = [
  { key: 'A', label: 'A — Arch Window', sub: 'Architectural symbol — refined Palladian motif', file: 'icon-A-arch.svg.png' },
  { key: 'B', label: 'B — Monogram',   sub: 'Italic ‘a’ + gold full-stop — minimal, brand-forward', file: 'icon-B-monogram.svg.png' },
  { key: 'C', label: 'C — Wordmark',   sub: 'Full archelier wordmark — splash-leaning', file: 'icon-C-wordmark.svg.png' },
];

(async () => {
  // Background canvas — warm cream
  const bg = await sharp({
    create: { width: W, height: H, channels: 3, background: { r: 245, g: 237, b: 224 } },
  }).png().toBuffer();

  const composites = [];

  // Title strip (rendered as SVG text overlay)
  const titleSvg = `
    <svg width="${W}" height="180" xmlns="http://www.w3.org/2000/svg">
      <text x="${W/2}" y="80" font-family="Hoefler Text, Didot, serif" font-size="56" font-weight="400" text-anchor="middle" fill="#1F1B16">Icon concepts — archelier</text>
      <text x="${W/2}" y="130" font-family="Helvetica Neue, sans-serif" font-size="24" text-anchor="middle" fill="#1F1B16" opacity="0.6">Pick a direction · Large preview (top) and home-screen size simulation (bottom)</text>
    </svg>`;
  composites.push({ input: Buffer.from(titleSvg), top: 0, left: 0 });

  // Layout: 3 columns.
  const COL_W = W / 3;
  const TOP_Y = 220;
  const LARGE_SIZE = 360;
  const SMALL_SIZE = 120;

  for (let i = 0; i < ICONS.length; i++) {
    const item = ICONS[i];
    const cx = i * COL_W + COL_W / 2;

    // Large icon
    const large = await sharp(path.join(ROOT, item.file))
      .resize(LARGE_SIZE, LARGE_SIZE)
      .composite([{
        input: Buffer.from(`<svg width="${LARGE_SIZE}" height="${LARGE_SIZE}"><rect width="${LARGE_SIZE}" height="${LARGE_SIZE}" rx="80" ry="80" fill="white"/></svg>`),
        blend: 'dest-in',
      }])
      .png()
      .toBuffer();
    composites.push({ input: large, top: TOP_Y, left: Math.round(cx - LARGE_SIZE / 2) });

    // Small icon (home screen sim)
    const small = await sharp(path.join(ROOT, item.file))
      .resize(SMALL_SIZE, SMALL_SIZE)
      .composite([{
        input: Buffer.from(`<svg width="${SMALL_SIZE}" height="${SMALL_SIZE}"><rect width="${SMALL_SIZE}" height="${SMALL_SIZE}" rx="26" ry="26" fill="white"/></svg>`),
        blend: 'dest-in',
      }])
      .png()
      .toBuffer();
    const smallY = TOP_Y + LARGE_SIZE + 220;
    composites.push({ input: small, top: smallY, left: Math.round(cx - SMALL_SIZE / 2) });

    // Labels (large icon caption + small caption + description)
    const labelSvg = `
      <svg width="${COL_W}" height="600" xmlns="http://www.w3.org/2000/svg">
        <text x="${COL_W/2}" y="${LARGE_SIZE + 50 + 220 - TOP_Y}" font-family="Hoefler Text, Didot, serif" font-size="36" font-weight="500" text-anchor="middle" fill="#1F1B16">${item.label}</text>
        <text x="${COL_W/2}" y="${LARGE_SIZE + 90 + 220 - TOP_Y}" font-family="Helvetica Neue, sans-serif" font-size="18" text-anchor="middle" fill="#1F1B16" opacity="0.65">${item.sub}</text>
        <text x="${COL_W/2}" y="${LARGE_SIZE + SMALL_SIZE + 100 + 220 - TOP_Y}" font-family="Helvetica Neue, sans-serif" font-size="16" text-anchor="middle" fill="#1F1B16" opacity="0.5">at home-screen size (~120px)</text>
      </svg>`;
    composites.push({ input: Buffer.from(labelSvg), top: TOP_Y, left: Math.round(i * COL_W) });
  }

  // Footer note
  const footerSvg = `
    <svg width="${W}" height="120" xmlns="http://www.w3.org/2000/svg">
      <text x="${W/2}" y="40" font-family="Helvetica Neue, sans-serif" font-size="18" text-anchor="middle" fill="#1F1B16" opacity="0.6">All concepts use Hoefler Text / Didot system fonts as a placeholder for final hand-drawn paths.</text>
      <text x="${W/2}" y="74" font-family="Helvetica Neue, sans-serif" font-size="18" text-anchor="middle" fill="#1F1B16" opacity="0.6">Final wordmark would be redrawn as SVG paths to avoid font licensing.</text>
    </svg>`;
  composites.push({ input: Buffer.from(footerSvg), top: H - 130, left: 0 });

  await sharp(bg)
    .composite(composites)
    .png()
    .toFile(path.join(ROOT, 'compare.png'));

  console.log('Wrote', path.join(ROOT, 'compare.png'));
})();
