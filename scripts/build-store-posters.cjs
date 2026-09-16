#!/usr/bin/env node
/* App Store / Play poster deck.
 *
 * Rebuilds the treatment used for the live 1.5.0 deck, measured pixel-for-pixel
 * off `posters-shipped/1.5.0-en/01-calendar.png`: ink ground, one
 * centred Didot-italic lowercase line, a single pine dot beneath it, and the
 * app capture as a white rounded card. No subhead — the line carries it.
 *
 * Usage:
 *   node scripts/build-store-posters.cjs en        # also ko · ja · es · fr
 *   node scripts/build-store-posters.cjs en --src <dir>
 *
 * Everything lives in the repo: captures in resources/app-store/captures/,
 * output in resources/app-store/posters-2.1.0-<locale>/. Both are committed —
 * the rendered decks are not reliably reproducible off this machine, because
 * the headline face is a macOS system font.
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
// The app's own brand face — resources/fonts/BodoniModa-Italic.ttf, aliased in
// the stylesheets as 'Brand Didone'. Using the system Didot instead put a
// different typeface on the store than the one inside the app.
const HEAD_FAMILY = 'Bodoni Moda, Didot, Bodoni 72, serif';
// CJK has no italic, so the counterpart is a high-contrast Mincho/Myeongjo —
// the closest thing to Bodoni's thick/thin in those scripts. Shippori Mincho
// is what the shipped Japanese deck was designed in; Gowun Batang is its
// Korean equivalent, lighter and more current than Nanum/Noto Serif, which
// read institutional next to a Bodoni italic.
// Fonts live in resources/fonts/ and must be installed for fontconfig to see
// them: cp resources/fonts/*.ttf ~/Library/Fonts && fc-cache -f
// The Korean statics are instanced out of NotoSerifKR[wght].ttf — fontconfig
// resolves a named weight from a variable font inconsistently, and the failure
// is silent: the poster just renders at Regular.
// Weight matters more than family here: at 100px a Regular-weight Mincho goes
// spindly next to Bodoni's thick strokes and the poster looks weak.
// The two scripts don't land at the same weight. Zen Old Mincho's Medium
// already carries Bodoni-like contrast; Hangul's even stroke density makes the
// same nominal weight read lighter, so Korean is set one step up.
const HEAD_FAMILY_JA = 'Zen Old Mincho, Shippori Mincho, Hiragino Mincho ProN, serif';
const HEAD_FAMILY_KO = 'Noto Serif KR, Apple SD Gothic Neo, serif';
const HEAD_WEIGHT_JA = 500;
const HEAD_WEIGHT_KO = 600;

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

// EN and JA keep their shipped lines word for word; only trends and stylist
// are new in JA, because only those two slides changed. KO has no shipped deck,
// so all six are written fresh.
//
// Register matters as much as meaning. The shipped English lines are crisp
// product statements — "log every outfit", "your closet, digitized" — not
// chat. An earlier pass wrote the Korean as conversational questions
// ("오늘 뭐 입지?"), which reads like a chatbot next to a Bodoni italic. These
// are short editorial phrases, the register Korean and Japanese fashion press
// actually uses.
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
    '01-calendar': '매일의 기록',
    '02-trends':   '이번 주의 스타일',
    '03-closet':   '손안의 옷장',
    '04-analyze':  '사진 속 그 옷',
    '05-tryon':    '내 몸으로 먼저',
    '06-stylist':  '내 옷장의 스타일리스트',
  },
  ja: {
    '01-calendar': '毎日のコーデを記録',
    '02-trends':   '今週のスタイル',
    '03-closet':   'クローゼットをデジタルに',
    '04-analyze':  '気になる服を見つける',
    '05-tryon':    'まず、自分で試着',
    '06-stylist':  'クローゼット専属スタイリスト',
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

const hasHangul = (s) => /[가-힯]/.test(s);

function posterSvg(line) {
  const size = fitSize(line);
  const family = hasHangul(line) ? HEAD_FAMILY_KO
    : hasCJK(line) ? HEAD_FAMILY_JA
    : HEAD_FAMILY;
  const style = hasCJK(line) ? '' : 'font-style="italic"';
  const weight = hasHangul(line) ? HEAD_WEIGHT_KO
    : hasCJK(line) ? HEAD_WEIGHT_JA
    : 400;
  return `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="${GROUND}"/>
  <text x="${W / 2}" y="${HEAD_BASELINE}" text-anchor="middle"
        font-family="${family}" ${style} font-weight="${weight}"
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
  const REPO = path.join(__dirname, '..');
  const SRC = srcFlag > -1
    ? process.argv[srcFlag + 1].replace(/^~/, os.homedir())
    : path.join(REPO, 'resources/app-store/captures');

  const lines = LINES[locale];
  if (!lines) throw new Error(`No copy for '${locale}'. Have: ${Object.keys(LINES).join(', ')}`);
  if (!fs.existsSync(SRC)) throw new Error(`Capture folder not found: ${SRC}`);

  // Never inside `posters-shipped/` — that holds the decks actually on the
  // stores, and once 2.1.0 replaces them there is no other copy anywhere.
  const OUT = path.join(REPO, `resources/app-store/posters-2.1.0-${locale}`);
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
