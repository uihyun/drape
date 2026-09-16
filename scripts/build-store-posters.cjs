#!/usr/bin/env node
/* App Store / Play poster deck.
 *
 * Rebuilds the treatment used for the live 1.5.0 deck, measured pixel-for-pixel
 * off `posters-shipped/1.5.0-en/01-calendar.png`: ink ground, one
 * centred Didot-italic lowercase line, a single pine dot beneath it, and the
 * app capture as a white rounded card. No subhead — the line carries it.
 *
 * Usage:
 *   node scripts/build-store-posters.cjs en        # also ja · es · fr
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
// Japanese has no italic, so the counterpart to Bodoni is a high-contrast
// Mincho. Shippori Mincho — what the shipped 1.5.0 Japanese deck used — goes
// spindly at 100px beside Bodoni's thick strokes; Zen Old Mincho at Medium
// holds the contrast, which is the whole job here. The font lives in
// resources/fonts/ and must be installed for fontconfig to see it:
// cp resources/fonts/*.ttf ~/Library/Fonts && fc-cache -f
const HEAD_FAMILY_JA = 'Zen Old Mincho, Shippori Mincho, Hiragino Mincho ProN, serif';
const HEAD_WEIGHT_JA = 500;

// ── The deck ───────────────────────────────────────────────────────────
// `02-feed` became trends and `06-market` became the stylist, because the feed
// lost its tab and the marketplace has no entry point in the shipped app.
// Boards is the least-used profile tab — 198 views / 39 users across 90 days
// of GA, against closet's 1,887 / 71 — so it earns the last slot, not a
// front one, and slide 7 is past everything that decides a tap anyway.
//
// Order is the argument, not the feature list. Search results show the first
// three portrait shots before anyone taps, and the 1.5.0 order spent all three
// on calendar + feed + closet — which describes Lekondo exactly as well as it
// describes drape. These three instead run the one story no competitor can
// tell: see someone's look, drape reads the outfit, it lands on your body.
// Closet is the foundation but not the pitch, so it follows; calendar closes,
// because a habit feature is for people already sold.
const DECK = [
  // trends-3, not the other masthead captures: it's the only full-length shot,
  // so the outfit reads at thumbnail size — and it sets up the next two slides,
  // where that kind of street look gets analysed and tried on.
  { out: '01-trends',   src: 'trends-3' },
  { out: '02-analyze',  src: 'analyzed-photo' },
  { out: '03-tryon',    src: 'tryon-3' },
  { out: '04-closet',   src: 'closet-1' },
  { out: '05-stylist',  src: 'stylist' },
  { out: '06-calendar', src: 'calendar' },
  // `crop` keeps the collage owning the card. Shot as-is, the lower 40% is the
  // comments block and a green "Publish to feed" button — and the feed has no
  // tab in the shipped app, so the store would be advertising a door that
  // isn't there.
  { out: '07-board',    src: 'board', crop: 0.60 },
];

// EN and JA keep their shipped lines word for word; only trends and stylist
// are new in JA, because only those two slides changed.
//
// No Korean deck on purpose. The treatment is a Bodoni italic, and the Hangul
// counterpart to that is a Myeongjo — but Myeongjo at display size reads
// literary and dated in Korean, where fashion display type is overwhelmingly a
// modern sans. Three passes at the font could not make the Korean sit beside
// the English deck, so the KR storefront inherits the English set rather than
// shipping a weaker one. Reviving it means changing the treatment for Korean,
// not picking another serif.
const LINES = {
  en: {
    '01-trends': 'what everyone’s wearing',
    '02-analyze': 'shop any photo',
    '03-tryon': 'see it on you, first',
    '04-closet': 'your closet, digitized',
    '05-stylist': 'a stylist in your closet',
    '06-calendar': 'log every outfit',
    '07-board':    'moodboard your style',
  },
  ja: {
    '01-trends': '今週のスタイル',
    '02-analyze': '気になる服を見つける',
    '03-tryon': 'まず、自分で試着',
    '04-closet': 'クローゼットをデジタルに',
    '05-stylist': 'クローゼット専属スタイリスト',
    '06-calendar': '毎日のコーデを記録',
    '07-board':    'スタイルをムードボードに',
  },
  es: {
    '01-trends': 'lo que se lleva ahora',
    '02-analyze': 'compra desde una foto',
    '03-tryon': 'pruébatelo antes',
    '04-closet': 'tu armario, en digital',
    '05-stylist': 'un estilista en tu armario',
    '06-calendar': 'anota cada look',
    '07-board':    'tu estilo, en un mural',
  },
  fr: {
    '01-trends': 'ce que l’on porte',
    '02-analyze': 'achetez depuis une photo',
    '03-tryon': 'essayez-la sur vous',
    '04-closet': 'votre dressing, en numérique',
    '05-stylist': 'un styliste dans votre dressing',
    '06-calendar': 'notez chaque tenue',
    '07-board':    'votre style en planche',
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
  const cjk = hasCJK(line);
  const family = cjk ? HEAD_FAMILY_JA : HEAD_FAMILY;
  const style = cjk ? '' : 'font-style="italic"';
  const weight = cjk ? HEAD_WEIGHT_JA : 400;
  return `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="${GROUND}"/>
  <text x="${W / 2}" y="${HEAD_BASELINE}" text-anchor="middle"
        font-family="${family}" ${style} font-weight="${weight}"
        font-size="${size}" fill="#F4F1EA">${esc(line)}</text>
  <circle cx="${W / 2}" cy="${DOT_CY}" r="${DOT_R}" fill="${DOT_FILL}"/>
</svg>`;
}

async function roundedCard(file, crop) {
  const cardH = Math.round(CARD_W * (H / W));
  // A capture whose interesting part is only the top: trim before scaling, so
  // the subject fills the card instead of being one band inside it.
  const trimmed = crop
    ? await sharp(file).metadata().then(({ width, height }) => sharp(file)
        .extract({ left: 0, top: 0, width, height: Math.round(height * crop) })
        .toBuffer())
    : file;
  const shot = await sharp(trimmed).resize({ width: CARD_W }).toBuffer();
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
  for (const { out, src, crop } of DECK) {
    const file = path.join(SRC, `${src}.png`);
    if (!fs.existsSync(file)) throw new Error(`Missing capture: ${file}`);
    const card = await roundedCard(file, crop);
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
