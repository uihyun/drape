#!/usr/bin/env node
// Lock SVG visual output to its sharp-rendered PNG by embedding the rendered raster
// as a base64 image inside the SVG. This makes the SVG renderer-independent —
// Preview, browser, sharp, rsvg-convert all show the exact same pixels.
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'resources', 'concepts');

const FILES = [
  { svg: 'icon-D-quiet-atelier.svg',   w: 1024, h: 1024 },
  { svg: 'icon-D-centered.svg',        w: 1024, h: 1024 },
  { svg: 'icon-I-carved-stone.svg',    w: 1024, h: 1024 },
  { svg: 'mark-D.svg',                 w: 1024, h: 1024 },
  { svg: 'splash-D-quiet-atelier.svg', w: 1080, h: 2340 },
  { svg: 'splash-I-carved-stone.svg',  w: 1080, h: 2340 },
];

(async () => {
  for (const f of FILES) {
    const svgPath = path.join(ROOT, f.svg);
    const svgBuf = fs.readFileSync(svgPath);

    // Render via sharp at 2x density then resize down for clean antialiasing.
    const pngBuf = await sharp(svgBuf, { density: 144 })
      .resize(f.w, f.h)
      .png({ quality: 92 })
      .toBuffer();

    const base64 = pngBuf.toString('base64');

    const wrappedSvg = `<svg width="${f.w}" height="${f.h}" viewBox="0 0 ${f.w} ${f.h}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <image x="0" y="0" width="${f.w}" height="${f.h}" preserveAspectRatio="xMidYMid slice" xlink:href="data:image/png;base64,${base64}"/>
</svg>
`;
    fs.writeFileSync(svgPath, wrappedSvg);
    fs.writeFileSync(svgPath + '.png', pngBuf);

    console.log(`✓ ${f.svg.padEnd(34)} svg ${(wrappedSvg.length/1024).toFixed(0).padStart(4)} KB · png ${(pngBuf.length/1024).toFixed(0).padStart(4)} KB`);
  }
  console.log('\nSVG and PNG are now pixel-identical for D/I icons + splashes.');
})();
