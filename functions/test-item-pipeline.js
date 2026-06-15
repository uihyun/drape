// Standalone test for the full processItem image pipeline:
//   input photo  →  Gemini catalog crop  →  segmentation alpha  →  PNG
//
// Usage:
//   GEMINI_API_KEY=xxx node test-item-pipeline.js test-white-shirt.jpg
// Or with .env auto-load:
//   node -r dotenv/config test-item-pipeline.js test-white-shirt.jpg
//
// Outputs in the current dir:
//   step1-gemini.png  — Gemini's catalog crop (flat bg)
//   step2-final.png   — after segmentation + alpha
// Prints the opacity ratio so you can tell if the segmentation
// actually cut the bg or returned the whole image opaque.

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { removeBackground } = require('@imgly/background-removal-node');

const IMAGE_PRO = 'gemini-3-pro-image';

const CROP_PROMPT = `Extract ONLY the item from this photo and present it
in the standard catalog product view for its category:
- Clothing (tops, bottoms, dresses, outerwear): axis-vertical, front-on,
  as if photographed from directly above on a flat surface or worn on
  an invisible body. Top of the garment at the top of the frame, hem
  at the bottom. Symmetric and centered.
- Shoes: clean side profile (right shoe facing right). If a pair, show
  the pair from the same angle.
- Bags: upright, frontal, handles up.
- Accessories (hats, jewelry, belts, glasses): centered, in the angle
  that shows the design most clearly.

You MAY rotate, flatten, and re-orient the item to achieve this view.
You may NOT change length, silhouette, proportions, color, fabric
texture, prints, or design — preserve all of those EXACTLY as in the
input. Do not turn pants into shorts, do not crop sleeves, do not
re-fit the garment.

Place the item centered on a fully white background, occupying ~80%
of a square frame. Remove the wearer, hangers, mannequin, bed sheets,
floor, and surrounding scene. This is a faithful catalog cutout, not
a redesign.`;

function extractImage(response) {
  const parts = response?.candidates?.[0]?.content?.parts || [];
  let last = null;
  for (const p of parts) {
    if (p.inlineData?.data) {
      last = { data: p.inlineData.data, mimeType: p.inlineData.mimeType || 'image/png' };
    }
  }
  return last;
}

async function maskOpacityRatio(pngBuf) {
  const img = sharp(pngBuf).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 4) return 1;
  let opaque = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 16) opaque++;
  }
  return opaque / (info.width * info.height);
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('usage: node test-item-pipeline.js <input.jpg>');
    process.exit(1);
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY env var required');
    process.exit(1);
  }

  console.log(`▸ input: ${inputPath}`);
  const inputBuf = fs.readFileSync(inputPath);
  const inputMime = inputPath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

  // ── Step 1: Gemini catalog crop ─────────────────────────────────────
  console.log('▸ step 1: calling Gemini Pro image crop…');
  const genai = new GoogleGenerativeAI(apiKey);
  const cropModel = genai.getGenerativeModel({ model: IMAGE_PRO });
  const t0 = Date.now();
  const res = await cropModel.generateContent([
    { inlineData: { data: inputBuf.toString('base64'), mimeType: inputMime } },
    { text: CROP_PROMPT },
  ]);
  console.log(`  Gemini took ${Date.now() - t0}ms`);

  const img = extractImage(res?.response);
  if (!img) {
    console.error('  Gemini returned no inline image — bailing');
    process.exit(1);
  }
  const geminiPng = Buffer.from(img.data, 'base64');
  fs.writeFileSync('step1-gemini.png', geminiPng);
  console.log(`  wrote step1-gemini.png (${geminiPng.length} bytes)`);

  // ── Step 2: segmentation strips the (white) bg to alpha ─────────────
  console.log('▸ step 2: running segmentation on Gemini output…');
  const t1 = Date.now();
  const blob = new Blob([geminiPng], { type: img.mimeType || 'image/png' });
  const out = await removeBackground(blob, { output: { format: 'image/png' } });
  const cutout = Buffer.from(await out.arrayBuffer());
  console.log(`  segmentation took ${Date.now() - t1}ms`);

  // Trim transparent edges so the saved PNG is a tight bbox.
  let final = cutout;
  try { final = await sharp(cutout).trim({ threshold: 10 }).png().toBuffer(); }
  catch (e) { console.warn('  trim failed:', e.message); }
  fs.writeFileSync('step2-final.png', final);
  console.log(`  wrote step2-final.png (${final.length} bytes)`);

  // ── Diagnostics ─────────────────────────────────────────────────────
  const ratio = await maskOpacityRatio(final);
  console.log(`▸ opacity ratio of step2-final.png: ${ratio.toFixed(3)}`);
  if (ratio > 0.98) {
    console.log('  ⚠️  segmentation likely did NOT cut the bg (all pixels opaque).');
    console.log('     For white-on-white this is expected.');
  } else if (ratio < 0.05) {
    console.log('  ⚠️  too few opaque pixels — segmentation lost the subject.');
  } else {
    console.log('  ✅  segmentation produced a real alpha channel.');
  }
}

main().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
