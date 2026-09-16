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

// ── Hero slides ────────────────────────────────────────────────────────
// A look photo filling the whole poster with the line laid over it. The photos
// are 1200px tall, so filling 2796 means a 2.33x upscale — there is no larger
// original, the app resizes on upload.
const HERO_SIZE = 92;
const HERO_BASELINE_FROM_BOTTOM = 190;
// Ivory type needs help over a bright road; this is the lightest gradient that
// holds it on all three photos without reading as a box.
const HERO_SCRIM_H = 940;
const HERO_SCRIM_MAX = 0.9;

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
  // Full-bleed looks from real OOTDs in the app. `cx` is the figure's centre as
  // a fraction of source width, read off a tenths grid laid over the original —
  // centring on the photo, or on the outermost limb, puts the person off-axis.
  { out: '01-hero-closet', hero: 'street-yellow', cx: 0.48 },
  { out: '02-hero-own',    hero: 'street-tile',   cx: 0.50 },
  // trends-3, not the other masthead captures: it's the only full-length shot,
  // so the outfit reads at thumbnail size — and it sets up the two that follow.
  { out: '03-trends',      src: 'trends-3' },
  // Trends and calendar are a pair — other people's outfits, then your own —
  // and they open the deck's first act: looking at looks.
  { out: '04-calendar',    src: 'calendar' },
  // Second act: wearing them. analyze → tryon is the deck's one literal chain
  // (the same varsity jacket, read off a photo then put on a body), so nothing
  // goes between them except the title card.
  { out: '05-analyze',     src: 'analyzed-photo' },
  { out: '06-hero-tryon',  hero: 'park-bench',    cx: 0.50, iosOnly: true },
  { out: '07-tryon',       src: 'tryon-3' },
  { out: '08-closet',      src: 'closet-1' },
  { out: '09-stylist',     src: 'stylist' },
  { out: '10-board',       src: 'board', iosOnly: true },
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
    '03-trends': 'what everyone’s wearing',
    '04-calendar': 'log every outfit',
    '05-analyze': 'shop any photo',
    '07-tryon': 'see it on you, first',
    '08-closet': 'your closet, digitized',
    '09-stylist': 'a stylist in your closet',
    '10-board': 'moodboard your style',
  },
  ja: {
    '03-trends': '今週のスタイル',
    '04-calendar': '毎日のコーデを記録',
    '05-analyze': '気になる服を見つける',
    '07-tryon': 'まず、自分で試着',
    '08-closet': 'クローゼットをデジタルに',
    '09-stylist': 'クローゼット専属スタイリスト',
    '10-board': 'スタイルをムードボードに',
  },
  es: {
    '03-trends': 'lo que se lleva ahora',
    '04-calendar': 'anota cada look',
    '05-analyze': 'compra desde una foto',
    '07-tryon': 'pruébatelo antes',
    '08-closet': 'tu armario, en digital',
    '09-stylist': 'un estilista en tu armario',
    '10-board': 'tu estilo, en un mural',
  },
  fr: {
    '03-trends': 'ce que l’on porte',
    '04-calendar': 'notez chaque tenue',
    '05-analyze': 'achetez depuis une photo',
    '07-tryon': 'essayez-la sur vous',
    '08-closet': 'votre dressing, en numérique',
    '09-stylist': 'un styliste dans votre dressing',
    '10-board': 'votre style en planche',
  },
};

// Hero copy is positioning, not features — the seven product slides already
// carry those, and repeating one here would read as a duplicate slide. The
// sequence is: what it is, what it does for you, why it's different. No
// wordmark slide: the store already prints the icon and the app name directly
// above the screenshots, so spending the most-seen slot restating them is waste.
const HERO_LINES = {
  en: {
    '01-hero-closet': 'your closet, in your pocket',
    '02-hero-own':    'wear what you already own',
    '06-hero-tryon':  'try it on before it\u2019s yours',
  },
  ja: {
    '01-hero-closet': 'クローゼットごと、ポケットに',
    '02-hero-own':    '今ある服で、着こなす',
    '06-hero-tryon':  '買う前に、着た姿を見る',
  },
  es: {
    '01-hero-closet': 'tu armario, en el bolsillo',
    '02-hero-own':    'viste lo que ya tienes',
    '06-hero-tryon':  'lo ves en ti antes de comprarlo',
  },
  fr: {
    '01-hero-closet': 'votre dressing, dans votre poche',
    '02-hero-own':    'portez ce que vous avez déjà',
    '06-hero-tryon':  'voyez-le sur vous avant d\u2019acheter',
  },
};

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const hasCJK = (s) => /[぀-ヿ㐀-鿿가-힯]/.test(s);

// Rough advance widths so a long line can be stepped down until it fits rather
// than running off the canvas — the failure mode is invisible until upload.
function fitSize(line, base = HEAD_SIZE) {
  const wide = [...line].filter(hasCJK).length;
  const narrow = line.length - wide;
  const emWidth = wide * 1.0 + narrow * 0.42; // Didot italic lowercase is narrow
  const maxPx = W - 150 * 2;
  let size = base;
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

function heroSvg(line) {
  const size = fitSize(line, HERO_SIZE);
  return `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#0c0b0a" stop-opacity="0"/>
    <stop offset="0.5" stop-color="#0c0b0a" stop-opacity="${HERO_SCRIM_MAX / 2}"/>
    <stop offset="1" stop-color="#0c0b0a" stop-opacity="${HERO_SCRIM_MAX}"/>
  </linearGradient></defs>
  <rect x="0" y="${H - HERO_SCRIM_H}" width="${W}" height="${HERO_SCRIM_H}" fill="url(#scrim)"/>
  <text x="${W / 2}" y="${H - HERO_BASELINE_FROM_BOTTOM}" text-anchor="middle"
        font-family="${HEAD_FAMILY}" font-style="italic"
        font-size="${size}" fill="#F4F1EA">${esc(line)}</text>
</svg>`;
}

// Fill by height and crop the width — the photos are 3:4 and the poster is
// 9:19.5, so something has to give. Cropping width around `cx` keeps the figure
// whole; filling by width instead would leave a third of the poster empty.
async function heroPoster(file, cx, line) {
  const m = await sharp(file).metadata();
  const win = Math.round(m.height * (W / H));
  const left = Math.max(0, Math.min(m.width - win, Math.round(m.width * cx - win / 2)));
  return sharp(file)
    .extract({ left, top: 0, width: Math.min(win, m.width), height: m.height })
    .resize(W, H, { kernel: 'lanczos3' })
    .composite([{ input: Buffer.from(heroSvg(line)) }])
    // JPEG, not PNG: these are photographs, and lossless costs ~6 MB a slide
    // for no visible gain. Both stores accept JPEG screenshots.
    .jpeg({ quality: 92, mozjpeg: true, chromaSubsampling: '4:4:4' })
    .toBuffer();
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
  const LOOKS = path.join(REPO, 'resources/app-store/looks');

  const lines = LINES[locale];
  const heroes = HERO_LINES[locale];
  if (!lines || !heroes) throw new Error(`No copy for '${locale}'. Have: ${Object.keys(LINES).join(', ')}`);
  if (!fs.existsSync(SRC)) throw new Error(`Capture folder not found: ${SRC}`);

  // Never inside `posters-shipped/` — that holds the decks actually on the
  // stores, and once 2.1.0 replaces them there is no other copy anywhere.
  const OUT = path.join(REPO, `resources/app-store/posters-2.1.0-${locale}`);
  fs.mkdirSync(OUT, { recursive: true });

  console.log(`${locale} → ${OUT}`);
  for (const { out, src, hero, cx, iosOnly } of DECK) {
    let poster;
    let line;
    if (hero) {
      line = heroes[out];
      const file = path.join(LOOKS, `${hero}.jpg`);
      if (!fs.existsSync(file)) throw new Error(`Missing look: ${file}`);
      poster = await heroPoster(file, cx, line);
    } else {
      line = lines[out];
      const file = path.join(SRC, `${src}.png`);
      if (!fs.existsSync(file)) throw new Error(`Missing capture: ${file}`);
      const card = await roundedCard(file);
      poster = await sharp(Buffer.from(posterSvg(line)))
        .composite([{ input: card, left: CARD_X, top: CARD_Y }])
        .extract({ left: 0, top: 0, width: W, height: H })
        .png()
        .toBuffer();
    }
    // The two stores don't take the same number of screenshots — Play caps at
    // 8, the App Store at 10 — so the filename says which slides Play skips.
    // Names still sort into the right sequence with those two absent.
    const name = `${out}${iosOnly ? '-ios-only' : ''}.${hero ? 'jpg' : 'png'}`;
    const dest = path.join(OUT, name);
    await fs.promises.writeFile(dest, poster);
    console.log(`  ✓ ${path.basename(dest)}   “${line}”`);
  }
})();
