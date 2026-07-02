// Try-on A/B rig (outfit-ref mode) — compare image models for the virtual
// try-on, offline. Reuses the EXACT production prompt + Cloud Vision face-blur
// (tryon.js `_tryonInternals`) so identity preservation is judged on the real
// pipeline. No deploy; writes to gitignored .crop-ab/tryon-out/.
//
// The gate for try-on is STRICTER than the crop: the result face/body must stay
// the identity person's (not the outfit model's), AND the outfit must transfer.
//
// Run FROM functions/ (cwd needed for @imgly; ADC needed for Firestore/Storage
// + Vision):
//   cd functions
//   VITE_GEMINI_API_KEY_DEV=<key> node test-tryon-ab.js <outfitId> [<outfitId> ...]
//
//   .crop-ab/tryon/identity.jpg  ← the identity reference photo (person)
//   .crop-ab/tryon-out/          ← results + contact sheets
// Outfit ids are PUBLIC outfits/{id} docs (their worn photo is the garment src).

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const admin = require('firebase-admin');
const { GoogleGenAI } = require('@google/genai');

const API_KEY = process.env.VITE_GEMINI_API_KEY_DEV || process.env.GEMINI_API_KEY;
if (!API_KEY) { console.error('no API key (VITE_GEMINI_API_KEY_DEV / GEMINI_API_KEY)'); process.exit(1); }

try { admin.initializeApp({ projectId: 'drape-9e532', storageBucket: 'drape-9e532.firebasestorage.app' }); } catch {}
const db = admin.firestore();
const bucket = admin.storage().bucket();
const { tryOnPrompt, blurOutfitFace, extractImage, downloadAsInlineData } = require('./tryon.js')._tryonInternals;

const BASE = process.env.CROP_AB_DIR || path.join(__dirname, '..', '.crop-ab');
const IDENTITY = path.join(BASE, 'tryon', 'identity.jpg');
const OUT_DIR = path.join(BASE, 'tryon-out');
fs.mkdirSync(OUT_DIR, { recursive: true });

const CANDIDATES = [
  { key: 'pro',      model: 'gemini-3-pro-image',          imageSize: '2K' },
  { key: 'flash2k',  model: 'gemini-3.1-flash-image',      imageSize: '2K' },
  { key: 'flash1k',  model: 'gemini-3.1-flash-image',      imageSize: '1K' },
  { key: 'lite1k',   model: 'gemini-3.1-flash-lite-image', imageSize: '1K' },
];
const OUT_RATE = { 'gemini-3-pro-image': 120, 'gemini-3.1-flash-image': 60, 'gemini-3.1-flash-lite-image': 30 };
const SAFETY = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
];

const ai = new GoogleGenAI({ apiKey: API_KEY });

async function outfitPhotoPart(id) {
  const snap = await db.collection('outfits').doc(id).get();
  if (!snap.exists) throw new Error('outfit missing');
  const o = snap.data();
  const sources = [[o.photoPath, o.photoUrl], [o.sourcePhotoPath, o.sourcePhotoUrl], [o.coverPath, o.coverUrl], [o.photoCutPath, o.photoCutUrl]];
  for (const [p] of sources) {
    if (p) { try { return await downloadAsInlineData(bucket, p); } catch {} }
  }
  throw new Error('no usable outfit photo path');
}

async function runCandidate(cand, parts) {
  const t0 = Date.now();
  const res = await ai.models.generateContent({
    model: cand.model,
    contents: parts,
    config: { safetySettings: SAFETY, imageConfig: { imageSize: cand.imageSize } },
  });
  const ms = Date.now() - t0;
  const img = extractImage(res);
  if (!img) throw new Error('no image returned (likely safety-blocked)');
  const buf = Buffer.from(img.data, 'base64');
  const meta = await sharp(buf).metadata();
  const u = res.usageMetadata || {};
  const outTok = u.candidatesTokenCount || 0;
  const usd = (outTok * (OUT_RATE[cand.model] || 0)) / 1e6;
  return { buf, ms, w: meta.width, h: meta.height, outTok, usd };
}

async function labelStrip(text, width) {
  const svg = `<svg width="${width}" height="34" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#141312"/><text x="8" y="22" font-family="monospace" font-size="15" fill="#f4efe6">${text}</text></svg>`;
  return Buffer.from(svg);
}

async function cell(buf, label, W = 512) {
  const strip = await labelStrip(label, W);
  const tile = buf
    ? await sharp(buf).resize(W, Math.round(W * 4 / 3), { fit: 'contain', background: '#ffffff' }).png().toBuffer()
    : await sharp({ create: { width: W, height: Math.round(W * 4 / 3), channels: 3, background: '#e8d8d8' } }).png().toBuffer();
  const H = Math.round(W * 4 / 3);
  return sharp({ create: { width: W, height: H + 34, channels: 3, background: '#141312' } })
    .composite([{ input: strip, top: 0, left: 0 }, { input: tile, top: 34, left: 0 }]).png().toBuffer();
}

async function main() {
  const ids = process.argv.slice(2);
  if (!ids.length) { console.error('usage: node test-tryon-ab.js <outfitId> [...]'); process.exit(1); }
  if (!fs.existsSync(IDENTITY)) { console.error(`missing identity photo: ${IDENTITY}`); process.exit(1); }

  const identityBuf = fs.readFileSync(IDENTITY);
  const identityPart = { inlineData: { data: identityBuf.toString('base64'), mimeType: 'image/jpeg' } };
  const promptText = tryOnPrompt([], '', '', 1, 'outfit-ref');

  for (const id of ids) {
    console.log(`━━ outfit ${id}`);
    let outfitPart;
    try { outfitPart = await outfitPhotoPart(id); }
    catch (e) { console.log(`  skip: ${e.message}`); continue; }

    // Show the ORIGINAL outfit photo in the sheet, feed the BLURRED one (prod).
    const originalOutfitBuf = Buffer.from(outfitPart.inlineData.data, 'base64');
    const blurred = await blurOutfitFace(originalOutfitBuf);
    const blurredPart = { inlineData: { data: blurred.toString('base64'), mimeType: 'image/jpeg' } };
    const parts = [identityPart, blurredPart, { text: promptText }];

    const cols = [await cell(identityBuf, 'IDENTITY'), await cell(originalOutfitBuf, 'OUTFIT src')];
    for (const cand of CANDIDATES) {
      try {
        const r = await runCandidate(cand, parts);
        fs.writeFileSync(path.join(OUT_DIR, `${id}__${cand.key}.png`), r.buf);
        console.log(`  ${cand.key.padEnd(9)} ${(r.w+'x'+r.h).padEnd(10)} ${r.ms}ms  outTok=${r.outTok}  $${r.usd.toFixed(4)}`);
        cols.push(await cell(r.buf, `${cand.key} ${r.w}x${r.h} $${r.usd.toFixed(4)}`));
      } catch (e) {
        console.log(`  ${cand.key.padEnd(9)} FAIL: ${e.message}`);
        cols.push(await cell(null, `${cand.key} FAIL`));
      }
    }
    const W = 512, PAD = 6, H = Math.round(W * 4 / 3) + 34;
    const rowW = cols.length * W + (cols.length - 1) * PAD;
    const row = await sharp({ create: { width: rowW, height: H, channels: 3, background: '#141312' } })
      .composite(cols.map((b, i) => ({ input: b, top: 0, left: i * (W + PAD) }))).png().toBuffer();
    fs.writeFileSync(path.join(OUT_DIR, `${id}__ab.png`), row);
    console.log(`  → ${id}__ab.png\n`);
  }
  console.log(`✓ done → ${OUT_DIR}`);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
