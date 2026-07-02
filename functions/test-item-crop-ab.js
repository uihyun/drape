// Item-crop A/B rig — compare image models/resolutions/prompts for the garment
// catalog crop, offline (no deploy, no Firebase). Used to pick the production
// crop model (2026-07: chose gemini-3.1-flash-lite-image @1K — see docs/COST.md).
// Kept for re-running whenever a new/cheaper image model appears.
//
// Runs each input photo through N candidates → segments each with the
// production @imgly step → writes per-candidate PNGs + a side-by-side contact
// sheet, and logs measured resolution / output tokens / $ / latency.
//
// Run FROM functions/ (so @imgly resolves its bundled model relative to cwd):
//   cd functions
//   VITE_GEMINI_API_KEY_DEV=<key> node test-item-crop-ab.js            # all photos
//   VITE_GEMINI_API_KEY_DEV=<key> node test-item-crop-ab.js IMG_7442  # one photo
// Or read the key from ../.env yourself and export it first.
//
// Photos live in a gitignored dir so personal images never get committed:
//   .crop-ab/in/   ← drop test photos here (jpg/png/webp)
//   .crop-ab/out/  ← results written here
// Override the base dir with CROP_AB_DIR=/some/path.

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { GoogleGenAI } = require('@google/genai');
const { removeBackground } = require('@imgly/background-removal-node');

const API_KEY = process.env.VITE_GEMINI_API_KEY_DEV || process.env.GEMINI_API_KEY;
if (!API_KEY) { console.error('no API key (VITE_GEMINI_API_KEY_DEV / GEMINI_API_KEY)'); process.exit(1); }

const BASE = process.env.CROP_AB_DIR || path.join(__dirname, '..', '.crop-ab');
const IN_DIR = path.join(BASE, 'in');
const OUT_DIR = path.join(BASE, 'out');
fs.mkdirSync(OUT_DIR, { recursive: true });

// PROD = the production crop prompt's stable core (matches functions/items.js).
const PROD_PROMPT = `Extract ONLY the item from this photo and present it
in the standard catalog product view for its category:
- Clothing (tops, bottoms, dresses, outerwear): axis-vertical, front-on,
  as if photographed from directly above on a flat surface or worn on
  an invisible body. Top of the garment at the top of the frame, hem
  at the bottom. Symmetric and centered.
- Footwear (shoes, boots, sandals, heels): ALWAYS render exactly TWO —
  a matching left + right pair, side by side, same side-profile angle.
  Never one shoe, never three or more. If the photo shows only a single
  shoe, still output the matching pair (two). A pair is two, never three.
- Bags: upright, frontal, handles up.
- Accessories (hats, jewelry, belts, glasses): centered, in the angle
  that shows the design most clearly — for caps and hats, the front.

You MAY rotate, flatten, and re-orient the item to achieve this view.
You may NOT change length, silhouette, proportions, color, fabric
texture, prints, or design — preserve all of those EXACTLY as in the
input. Do not turn pants into shorts, do not crop sleeves, do not
re-fit the garment.

Place the item centered on a fully white background, occupying ~80%
of a square frame. Remove the wearer, hangers, mannequin, bed sheets,
floor, and surrounding scene. This is a faithful catalog cutout, not
a redesign.`;

// BOOST = PROD + explicit hard constraints (now shipped in production).
const BOOST_SUFFIX = `

CRITICAL — HARD CONSTRAINTS (do not violate):
- The output garment MUST have the EXACT same hem length, sleeve length,
  and number of pieces as the input. If the input pants reach the ankle,
  the output pants MUST reach the ankle — NEVER shorten them into shorts
  or crops. If sleeves are long, keep them full-length to the wrist —
  NEVER shorten or crop sleeves.
- Footwear: output EXACTLY TWO shoes forming ONE matching left+right pair.
  Never one, never three or more — even if the input shows a single shoe.
- Reproduce the exact shape, proportions, color, print, and fabric texture
  of the input. Fill ~80% of the frame — do not render the item small.
- Before finalizing, verify the length and silhouette of your output match
  the input garment. If they differ, correct them.`;

const BOOST_PROMPT = PROD_PROMPT + BOOST_SUFFIX;

// imageSize: null → don't send imageConfig (model default).
const CANDIDATES = [
  { key: 'pro',          model: 'gemini-3-pro-image',          prompt: PROD_PROMPT,  imageSize: '2K' },
  { key: 'flashProd2k',  model: 'gemini-3.1-flash-image',      prompt: PROD_PROMPT,  imageSize: '2K' },
  { key: 'flashBoost2k', model: 'gemini-3.1-flash-image',      prompt: BOOST_PROMPT, imageSize: '2K' },
  { key: 'flashBoost1k', model: 'gemini-3.1-flash-image',      prompt: BOOST_PROMPT, imageSize: '1K' },
  { key: 'liteBoost1k',  model: 'gemini-3.1-flash-lite-image', prompt: BOOST_PROMPT, imageSize: '1K' }, // ← shipped
];

// Official image-output token rates ($/1M tokens), standard tier (2026-07).
const OUT_RATE = {
  'gemini-3-pro-image': 120,
  'gemini-3.1-flash-image': 60,
  'gemini-3.1-flash-lite-image': 30,
};

const ai = new GoogleGenAI({ apiKey: API_KEY });

function extractImage(response) {
  const parts = response?.candidates?.[0]?.content?.parts || [];
  let last = null;
  for (const p of parts) {
    if (p.inlineData?.data) last = { data: p.inlineData.data, mimeType: p.inlineData.mimeType || 'image/png' };
  }
  return last;
}

async function segmentForeground(buf, mime = 'image/png') {
  const blob = new Blob([buf], { type: mime });
  const out = await removeBackground(blob, { output: { format: 'image/png', quality: 0.9 } });
  return Buffer.from(await out.arrayBuffer());
}

async function maskOpacityRatio(pngBuf) {
  const { data, info } = await sharp(pngBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 4) return 1;
  let opaque = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 16) opaque++;
  return opaque / (info.width * info.height);
}

async function runCandidate(cand, inputB64, inputMime) {
  const config = { responseModalities: ['IMAGE'] };
  if (cand.imageSize) config.imageConfig = { imageSize: cand.imageSize };
  const t0 = Date.now();
  const response = await ai.models.generateContent({
    model: cand.model,
    contents: [
      { inlineData: { data: inputB64, mimeType: inputMime } },
      { text: cand.prompt },
    ],
    config,
  });
  const ms = Date.now() - t0;
  const img = extractImage(response);
  if (!img) throw new Error('no inline image in response');
  const cropBuf = Buffer.from(img.data, 'base64');
  const meta = await sharp(cropBuf).metadata();
  const u = response.usageMetadata || {};
  const outTok = u.candidatesTokenCount || 0;
  const usd = (outTok * (OUT_RATE[cand.model] || 0)) / 1e6;
  return { cropBuf, ms, w: meta.width, h: meta.height, outTok, totalTok: u.totalTokenCount || 0, usd };
}

async function labelStrip(text, width) {
  const svg = `<svg width="${width}" height="34" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#141312"/>
    <text x="8" y="22" font-family="monospace" font-size="15" fill="#f4efe6">${text}</text>
  </svg>`;
  return Buffer.from(svg);
}

async function main() {
  const only = process.argv[2];
  let files = fs.existsSync(IN_DIR) ? fs.readdirSync(IN_DIR).filter(f => /\.(jpe?g|png|webp)$/i.test(f)) : [];
  if (only) files = files.filter(f => f === only || path.parse(f).name === only);
  if (!files.length) { console.error(`no images in ${IN_DIR}${only ? ` matching "${only}"` : ''}`); process.exit(1); }
  console.log(`▸ ${files.length} input(s), ${CANDIDATES.length} candidates each\n`);

  const COL_W = 512, PAD = 6;

  for (const file of files) {
    const name = path.parse(file).name;
    console.log(`━━ ${file}`);
    const inputBuf = fs.readFileSync(path.join(IN_DIR, file));
    const inputMime = file.toLowerCase().endsWith('.png') ? 'image/png'
      : file.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/jpeg';
    const inputB64 = inputBuf.toString('base64');

    const cols = [{ label: 'INPUT', buf: inputBuf }];
    for (const cand of CANDIDATES) {
      try {
        const r = await runCandidate(cand, inputB64, inputMime);
        fs.writeFileSync(path.join(OUT_DIR, `${name}__${cand.key}_crop.png`), r.cropBuf);
        const seg = await segmentForeground(r.cropBuf);
        let final = seg;
        try { final = await sharp(seg).trim({ threshold: 10 }).png().toBuffer(); } catch {}
        fs.writeFileSync(path.join(OUT_DIR, `${name}__${cand.key}_final.png`), final);
        const ratio = await maskOpacityRatio(final);
        console.log(`  ${cand.key.padEnd(13)} ${(r.w+'x'+r.h).padEnd(10)} ${r.ms}ms  outTok=${r.outTok}  $${r.usd.toFixed(4)}  alpha=${ratio.toFixed(2)}`);
        cols.push({ label: `${cand.key} ${r.w}x${r.h} $${r.usd.toFixed(4)}`, buf: r.cropBuf });
      } catch (e) {
        console.log(`  ${cand.key.padEnd(13)} FAIL: ${e.message}`);
        cols.push({ label: `${cand.key} FAIL`, buf: null });
      }
    }

    const cells = [];
    for (const c of cols) {
      const label = await labelStrip(c.label, COL_W);
      const imgTile = c.buf
        ? await sharp(c.buf).resize(COL_W, COL_W, { fit: 'contain', background: '#ffffff' }).png().toBuffer()
        : await sharp({ create: { width: COL_W, height: COL_W, channels: 3, background: '#e8d8d8' } }).png().toBuffer();
      const cell = await sharp({ create: { width: COL_W, height: COL_W + 34, channels: 3, background: '#141312' } })
        .composite([{ input: label, top: 0, left: 0 }, { input: imgTile, top: 34, left: 0 }])
        .png().toBuffer();
      cells.push(cell);
    }
    const rowW = cells.length * COL_W + (cells.length - 1) * PAD;
    const row = await sharp({ create: { width: rowW, height: COL_W + 34, channels: 3, background: '#141312' } })
      .composite(cells.map((b, i) => ({ input: b, top: 0, left: i * (COL_W + PAD) })))
      .png().toBuffer();
    fs.writeFileSync(path.join(OUT_DIR, `${name}__ab.png`), row);
    console.log(`  → ${name}__ab.png\n`);
  }
  console.log(`✓ done → ${OUT_DIR}`);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
