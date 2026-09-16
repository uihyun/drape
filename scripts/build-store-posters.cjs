#!/usr/bin/env node
/* App Store / Play poster deck.
 *
 * Rebuilds the treatment used for the live 1.5.0 deck, measured pixel-for-pixel
 * off `~/Desktop/idea/drape/screenshots/poster/01-calendar.png`: ink ground, one
 * centred Didot-italic lowercase line, a single pine dot beneath it, and the
 * app capture as a white rounded card. No subhead — the line carries it.
 *
 * Usage:
 *   node scripts/build-store-posters.cjs en
 *   node scripts/build-store-posters.cjs en --src ~/Desktop/idea/drape/screenshots
 *
 * Captures are looked up by the `src` key in DECK below. Output lands in
 * <srcDir>/poster-<locale>/ (and plain `poster/` for English, matching the
 * existing folders).
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ── Measured from the live deck ────────────────────────────────────────
const W = 1290;
const H = 2796;
const GROUND = '#141312';
const CARD_X = 155;              // left edge; the card is centred, 155 either side
const CARD_W = W - CARD_X * 2;   // 980
const CARD_Y = 560;
const CARD_R = 40;               // corner radius
const HEAD_BASELINE = 356;       // glyph band measured at y 270..369
const HEAD_SIZE = 104;
const DOT_CY = 430;
const DOT_R = 7;
const DOT_FILL = '#2C4737';
// Didot is the brand face and a macOS system font; Bodoni 72 is the fallback
// that ships alongside it. Both are italic-capable — the treatment depends on it.
const HEAD_FAMILY = 'Didot, Bodoni 72, Hoefler Text, Times New Roman, serif';
// CJK has no italic; the live Japanese deck used Shippori Mincho, and the
// nearest system face here is Hiragino Mincho.
const HEAD_FAMILY_CJK = 'Hiragino Mincho ProN, Yu Mincho, AppleMyungjo, serif';

// ── The deck ───────────────────────────────────────────────────────────
// Order follows the live 1.5.0 deck; `02-feed` became trends and `06-market`
// became the stylist, because the feed lost its tab and the marketplace has no
// entry point in the shipped app. `07-board` dropped: least-used tab in 90
// days of GA (4.4% of profile views, 8 s/user).
const DECK = [
  { out: '01-calendar', src: 'calendar' },
  { out: '02-trends',   src: 'trends-1' },
  { out: '03-closet',   src: 'closet-1' },
  { out: '04-analyze',  src: 'analyzed-photo' },
  { out: '05-tryon',    src: 'tryon-3' },
  { out: '06-stylist',  src: 'stylist' },
];

// Lines for the four unchanged slides are the LIVE ones, read back off the
// shipped posters — there is no reason to rewrite copy that is already out
// there. Only trends and stylist are new, written to the same length and
// register.
//
// Live EN deck: log every outfit · a feed of real looks · your closet,
// digitized · shop any photo · see it on you, first · buy & sell pre-loved ·
// moodboard your style
// Live JA deck: 毎日のコーデを記録 · リアルなルックのフィード ·
// クローゼットをデジタルに · 気になる服を見つける · まず、自分で試着 ·
// 古着を、人から人へ · スタイルをムードボードに
//
// KO / ES / FR have no live deck — the Korean storefront runs the English
// screenshots today — so those lines are new throughout.
const LINES = {
  en: {
    '01-calendar': 'log every outfit',
    '02-trends':   'what everyone’s wearing',
    '03-closet':   'your closet, digitized',
    '04-analyze':  'shop any photo',
    '05-tryon':    'see it on you, first',
    '06-stylist':  'a stylist in your closet',
  },
  ko: {
    '01-calendar': '매일의 코디를 기록',
    '02-trends':   '지금 다들 입는 것',
    '03-closet':   '옷장을 디지털로',
    '04-analyze':  '사진 속 옷을 찾다',
    '05-tryon':    '먼저, 내 몸으로',
    '06-stylist':  '내 옷장의 스타일리스트',
  },
  ja: {
    '01-calendar': '毎日のコーデを記録',
    '02-trends':   'いま着られているもの',
    '03-closet':   'クローゼットをデジタルに',
    '04-analyze':  '気になる服を見つける',
    '05-tryon':    'まず、自分で試着',
    '06-stylist':  'あなた専属のスタイリスト',
  },
  es: {
    '01-calendar': 'anota cada look',
    '02-trends':   'lo que se lleva ahora',
    '03-closet':   'tu armario, en digital',
    '04-analyze':  'compra desde una foto',
    '05-tryon':    'pruébatelo antes',
    '06-stylist':  'un estilista en tu armario',
  },
  fr: {
    '01-calendar': 'notez chaque tenue',
    '02-trends':   'ce que l’on porte',
    '03-closet':   'votre dressing, en numérique',
    '04-analyze':  'achetez depuis une photo',
    '05-tryon':    'essayez-la sur vous',
    '06-stylist':  'un styliste dans votre dressing',
  },
};


const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const hasCJK = (s) => /[぀-ヿ㐀-鿿가-힯]/.test(s);

// Rough advance widths so a long line can be stepped down until it fits rather
// than running off the canvas — the failure mode is invisible until upload.
function fitSize(line) {
  const wide = [...line].filter(hasCJK).length;
  const narrow = line.length - wide;
  const emWidth = wide * 1.0 + narrow * 0.42; // Didot italic lowercase is narrow
  const maxPx = W - 150 * 2;
  let size = HEAD_SIZE;
  while (size > 48 && emWidth * size > maxPx) size -= 2;
  return size;
}

function posterSvg(line) {
  const size = fitSize(line);
  const family = hasCJK(line) ? HEAD_FAMILY_CJK : HEAD_FAMILY;
  const style = hasCJK(line) ? '' : 'font-style="italic"';
  return `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="${GROUND}"/>
  <text x="${W / 2}" y="${HEAD_BASELINE}" text-anchor="middle"
        font-family="${family}" ${style}
        font-size="${size}" fill="#F4F1EA">${esc(line)}</text>
  <circle cx="${W / 2}" cy="${DOT_CY}" r="${DOT_R}" fill="${DOT_FILL}"/>
</svg>`;
}

async function roundedCard(file) {
  const cardH = Math.round(CARD_W * (H / W));
  const shot = await sharp(file).resize({ width: CARD_W }).toBuffer();
  const mask = Buffer.from(
    `<svg width="${CARD_W}" height="${cardH}" xmlns="http://www.w3.org/2000/svg">` +
    `<rect width="${CARD_W}" height="${cardH}" rx="${CARD_R}" ry="${CARD_R}" fill="#fff"/></svg>`
  );
  return sharp(shot)
    .resize(CARD_W, cardH, { fit: 'cover', position: 'top' })
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
}

(async () => {
  const locale = process.argv[2] || 'en';
  const srcFlag = process.argv.indexOf('--src');
  const SRC = srcFlag > -1
    ? process.argv[srcFlag + 1].replace(/^~/, os.homedir())
    : path.join(os.homedir(), 'Desktop/idea/drape/screenshots');

  const lines = LINES[locale];
  if (!lines) throw new Error(`No copy for '${locale}'. Have: ${Object.keys(LINES).join(', ')}`);
  if (!fs.existsSync(SRC)) throw new Error(`Capture folder not found: ${SRC}`);

  // Never write into  or  — those hold the shipped 1.5.0
  // deck, and a run that overwrites them destroys the only full-res copy
  // outside Apple'''s CDN.
  const OUT = path.join(SRC, `poster-2.1.0-${locale}`);
  fs.mkdirSync(OUT, { recursive: true });

  console.log(`${locale} → ${OUT}`);
  for (const { out, src } of DECK) {
    const file = path.join(SRC, `${src}.png`);
    if (!fs.existsSync(file)) throw new Error(`Missing capture: ${file}`);
    const card = await roundedCard(file);
    const poster = await sharp(Buffer.from(posterSvg(lines[out])))
      .composite([{ input: card, left: CARD_X, top: CARD_Y }])
      .extract({ left: 0, top: 0, width: W, height: H })
      .png()
      .toBuffer();
    const dest = path.join(OUT, `${out}.png`);
    await fs.promises.writeFile(dest, poster);
    console.log(`  ✓ ${out}.png   “${lines[out]}”`);
  }
})();
