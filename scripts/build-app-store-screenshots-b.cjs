#!/usr/bin/env node
// Variant B — LOUD: dark charcoal background, cream all-caps headlines,
// terracotta horizontal accent line, larger screenshot. Designed to pop in
// App Store search thumbnails. Pairs visually with the existing icon system
// (charcoal a + terracotta dot) but at higher contrast than A.
//
// Output: resources/app-store/screenshots-6.7-<locale>-marketing-b/
//
// Usage: node scripts/build-app-store-screenshots-b.cjs [locale] [srcDir]
//   locale — caption language, default 'en'. Must exist in CAPTIONS below.
//   srcDir — raw 1290x2796 captures, default resources/app-store/captures-<locale>,
//            falling back to captures-en (the phone UI stays English then; a
//            Spanish-UI capture set is better but optional).

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const W = 1290;
const H = 2796;
const LOCALE = process.argv[2] || 'en';
const ASSETS = path.join(__dirname, '..', 'resources', 'app-store');
const SRC_DIR = process.argv[3]
  || [path.join(ASSETS, `captures-${LOCALE}`), path.join(ASSETS, 'captures-en')]
       .find((d) => fs.existsSync(d))
  || path.join(ASSETS, 'captures-en');
const OUT_DIR = path.join(ASSETS, `screenshots-6.7-${LOCALE}-marketing-b`);

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// The deck, per locale. `src` is the capture filename — shared across locales,
// so a new language is a captions entry and nothing else.
//
// Spanish is neutral Latin-American, matching src/locales/es.js. Headlines run
// longer than English; MAX_HEAD_CHARS below guards against silent overflow,
// which on a store screenshot means text sliced off at the right edge.
const SLIDES = [
  // Slides 1–2 are one sentence told across two frames: the look you saw on
  // someone else, then the same look on you. A try-on result on its own has no
  // context — the viewer can't tell what they're looking at. Only the first
  // two or three slides get seen on the product page, so the story goes there.
  { src: '01-look.png',     key: 'look' },
  { src: '02-tryon.png',    key: 'tryon' },
  { src: '03-closet.png',   key: 'closet' },
  { src: '04-stylist.png',  key: 'stylist' },
  { src: '05-calendar.png', key: 'calendar' },
  { src: '06-trends.png',   key: 'trends' },
];

const CAPTIONS = {
  en: {
    look:     { headline: 'SAW THIS\nON SOMEONE', subhead: 'Any look, from any member's closet.' },
    tryon:    { headline: 'NOW SEE IT\nON YOURSELF', subhead: 'Your real face and body. 5 free every day.' },
    closet:   { headline: 'YOUR CLOSET,\nDIGITAL', subhead: 'One photo per piece. Tagged for you.' },
    stylist:  { headline: 'YOUR OWN\nAI STYLIST', subhead: 'Looks built from what you already own.' },
    calendar: { headline: 'YOUR YEAR\nIN OUTFITS', subhead: 'One photo a day fills the calendar.' },
    trends:   { headline: 'WHAT PEOPLE\nARE WEARING', subhead: 'A new issue every Monday.' },
  },
  ko: {
    look:     { headline: '남의 룩에서\n마음에 들면', subhead: '누구의 옷이든 고를 수 있어요.' },
    tryon:    { headline: '내 몸으로\n바로 확인', subhead: '진짜 내 얼굴과 체형. 하루 5번 무료.' },
    closet:   { headline: '내 옷장을\n디지털로', subhead: '한 벌에 사진 한 장. 태그는 자동.' },
    stylist:  { headline: '나만의\nAI 스타일리스트', subhead: '가진 옷으로 만드는 코디.' },
    calendar: { headline: '입은 옷으로\n쌓는 1년', subhead: '하루 한 장이면 달력이 채워져요.' },
    trends:   { headline: '지금 뜨는\n스타일', subhead: '매주 월요일 새 이슈.' },
  },
  ja: {
    look:     { headline: '誰かのコーデが\n気になったら', subhead: 'どのメンバーの服でも選べます。' },
    tryon:    { headline: 'そのまま\n自分の体で', subhead: '本物の顔と体。毎日5回無料。' },
    closet:   { headline: 'クローゼットを\nデジタルに', subhead: '一着に一枚。タグ付けは自動。' },
    stylist:  { headline: 'あなた専用の\nAIスタイリスト', subhead: '手持ちの服だけで組むコーデ。' },
    calendar: { headline: '着た服で\n埋まる1年', subhead: '一日一枚でカレンダーが埋まる。' },
    trends:   { headline: 'いま着られて\nいるもの', subhead: '毎週月曜、新しい号。' },
  },
  es: {
    look:     { headline: 'LO VISTE EN\nOTRA PERSONA', subhead: 'Cualquier look, de cualquier miembro.' },
    tryon:    { headline: 'AHORA, EN TI', subhead: 'Tu cara y tu cuerpo reales. 5 gratis al día.' },
    closet:   { headline: 'TU ARMARIO,\nDIGITAL', subhead: 'Una foto por prenda. Se etiqueta sola.' },
    stylist:  { headline: 'TU ESTILISTA\nCON IA', subhead: 'Looks armados con lo que ya tienes.' },
    calendar: { headline: 'TU AÑO\nEN LOOKS', subhead: 'Una foto al día llena el calendario.' },
    trends:   { headline: 'LO QUE SE\nESTÁ USANDO', subhead: 'Una edición nueva cada lunes.' },
  },
  fr: {
    look:     { headline: 'VU SUR\nQUELQU’UN', subhead: 'N’importe quelle tenue, de n’importe quel membre.' },
    tryon:    { headline: 'MAINTENANT,\nSUR VOUS', subhead: 'Votre vrai visage, votre silhouette. 5 par jour.' },
    closet:   { headline: 'VOTRE DRESSING,\nNUMÉRIQUE', subhead: 'Une photo par pièce. Le tag se fait tout seul.' },
    stylist:  { headline: 'VOTRE STYLISTE\nIA', subhead: 'Des looks composés avec ce que vous avez déjà.' },
    calendar: { headline: 'VOTRE ANNÉE\nEN TENUES', subhead: 'Une photo par jour remplit le calendrier.' },
    trends:   { headline: 'CE QUE L’ON\nPORTE', subhead: 'Un nouveau numéro chaque lundi.' },
  },
};

// Fit check in ems, not characters: a full-width CJK glyph is ~1 em where a
// Latin cap is ~0.58 em, so "15 characters" would pass a Korean line that
// overruns the canvas by half its width. Available width is
// 1290 - 100 (left margin) - 60 (right breathing room) = 1130px at 124pt.
const HEAD_SIZE_PX = 124;
const MAX_HEAD_EM = 1130 / HEAD_SIZE_PX;
const isWide = (ch) => /[\u1100-\u11FF\u2E80-\u9FFF\uA960-\uA97F\uAC00-\uD7FF\uF900-\uFAFF\uFF00-\uFF60]/.test(ch);
const headEm = (line) => [...line].reduce((w, ch) => w + (isWide(ch) ? 1.0 : 0.58), 0);

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Two-line headline laid out manually (the SLIDES table embeds \n).
function buildTextSvg({ headline, subhead }) {
  const lines = headline.split('\n');
  const HEAD_SIZE = 124;
  const HEAD_TOP = 280;
  const LINE_HEIGHT = 132;
  const ACCENT_Y = HEAD_TOP + (lines.length - 1) * LINE_HEIGHT + 90;
  const SUB_Y = ACCENT_Y + 110;

  const headTspans = lines
    .map((ln, i) => `<text x="100" y="${HEAD_TOP + i * LINE_HEIGHT}"
      font-family="Helvetica Neue, Avenir Next, -apple-system, sans-serif"
      font-size="${HEAD_SIZE}" font-weight="700" fill="#F0E6D2"
      letter-spacing="-3">${esc(ln)}</text>`)
    .join('\n');

  return `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <!-- charcoal background -->
  <rect width="${W}" height="${H}" fill="#1F1B16"/>

  ${headTspans}

  <!-- terracotta horizontal accent line under the headline block -->
  <rect x="100" y="${ACCENT_Y}" width="160" height="6" fill="#B5654A"/>

  <!-- subhead, warm cream, light grotesque -->
  <text x="100" y="${SUB_Y}"
        font-family="Helvetica Neue, Avenir Next, -apple-system, sans-serif"
        font-size="44" font-weight="400" fill="#F0E6D2" opacity="0.72">${esc(subhead)}</text>
</svg>`;
}

async function buildShadow(w, h) {
  const SHADOW_OFFSET = 22;
  const SHADOW_BLUR = 48;
  const ow = w + SHADOW_BLUR * 2;
  const oh = h + SHADOW_BLUR * 2;
  const svg = `
<svg width="${ow}" height="${oh}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="b" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="${SHADOW_BLUR / 2}"/>
    </filter>
  </defs>
  <rect x="${SHADOW_BLUR}" y="${SHADOW_BLUR + SHADOW_OFFSET}"
        width="${w}" height="${h}" rx="56" ry="56"
        fill="#000000" opacity="0.55" filter="url(#b)"/>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function roundCorners(buffer, radius) {
  const { width, height } = await sharp(buffer).metadata();
  const mask = Buffer.from(`
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="white"/>
</svg>`);
  return sharp(buffer)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
}

async function buildSlide(slide, index) {
  const srcPath = path.join(SRC_DIR, slide.src);
  if (!fs.existsSync(srcPath)) throw new Error(`Source not found: ${srcPath}`);

  // Slightly larger screenshot than A — 88% width — to make it dominate the
  // lower half visually.
  const SCALED_W = 1140;
  const SCALED_H = Math.round(SCALED_W * (H / W));
  const SHOT_LEFT = Math.round((W - SCALED_W) / 2);
  const SHOT_TOP = H - SCALED_H + 320; // push further down for bleed

  const screenshot = await sharp(srcPath).resize({ width: SCALED_W }).toBuffer();
  const rounded = await roundCorners(screenshot, 56);
  const shadow = await buildShadow(SCALED_W, SCALED_H);

  const out = await sharp(Buffer.from(buildTextSvg(slide)))
    .composite([
      { input: shadow,  left: SHOT_LEFT - 48, top: SHOT_TOP - 48 },
      { input: rounded, left: SHOT_LEFT,       top: SHOT_TOP },
    ])
    .png()
    .toBuffer();

  const final = await sharp(out)
    .extract({ left: 0, top: 0, width: W, height: H })
    .png({ quality: 95 })
    .toBuffer();

  const outPath = path.join(OUT_DIR, `${String(index + 1).padStart(2, '0')}-${slide.src}`);
  await fs.promises.writeFile(outPath, final);
  return outPath;
}

(async () => {
  const copy = CAPTIONS[LOCALE];
  if (!copy) throw new Error(`No captions for locale '${LOCALE}'. Have: ${Object.keys(CAPTIONS).join(', ')}`);
  const over = [];
  for (const s of SLIDES) {
    for (const ln of copy[s.key].headline.split('\n')) {
      const em = headEm(ln);
      if (em > MAX_HEAD_EM) over.push(`${s.key}: "${ln}" (${em.toFixed(1)}em > ${MAX_HEAD_EM.toFixed(1)}em)`);
    }
  }
  if (over.length) throw new Error(`Headline too long for the canvas:\n  ${over.join('\n  ')}`);
  if (!fs.existsSync(SRC_DIR)) throw new Error(`Capture folder not found: ${SRC_DIR}`);

  console.log(`Building ${SLIDES.length} marketing screenshots (variant B — loud dark, ${LOCALE}) → ${OUT_DIR}`);
  console.log(`  captures: ${path.relative(process.cwd(), SRC_DIR)}`);
  for (let i = 0; i < SLIDES.length; i++) {
    const p = await buildSlide({ ...SLIDES[i], ...copy[SLIDES[i].key] }, i);
    console.log(`  ✓ ${path.basename(p)}`);
  }
  console.log('done.');
})();
