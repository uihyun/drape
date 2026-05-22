/* Generate one preview image per interior style (19 cards) by sending a sample
 * room photo through Gemini's image-edit model with a "redesign in {style}"
 * prompt. Output goes to public/style-thumbnails/{styleKey}.jpg.
 *
 * Usage:
 *   GEMINI_API_KEY=xxx node scripts/build-style-thumbnails.cjs
 *   (or `firebase functions:secrets:access GEMINI_API_KEY` and pass through)
 *
 * Runs styles in chunks of 4 in parallel; each call ≈ 60–90s, so total ≈ 6–8 min.
 * Re-runs are idempotent — only missing thumbnails are generated unless --force.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error('GEMINI_API_KEY not set. Run `firebase functions:secrets:access GEMINI_API_KEY` first.');
  process.exit(1);
}

const FORCE = process.argv.includes('--force');
const SAMPLE_DIR = '/Users/uihyun/Desktop/idea/voda/sample-room';
const OUT_DIR = path.join(__dirname, '..', 'public', 'style-thumbnails');
fs.mkdirSync(OUT_DIR, { recursive: true });

// Each style → (sample image filename, style description for prompt). Sample
// pick is the closest "starting room" to that style — but the prompt explicitly
// allows changing layout / furniture / mood, so the AI re-stages aggressively.
const STYLES = [
  { key: 'modern',       sample: 'IMG_1574.JPG', name: 'Modern',           desc: 'Clean lines, neutral tones, minimalist contemporary' },
  { key: 'scandinavian', sample: 'IMG_4679.jpg', name: 'Scandinavian',     desc: 'Bright, natural materials, light wood, cozy Nordic warmth, white walls' },
  { key: 'ikea',         sample: 'IMG_4707.jpg', name: 'IKEA',             desc: 'Functional, affordable, smart Scandinavian everyday design — light pine wood, simple shapes' },
  { key: 'japandi',      sample: 'IMG_3996.jpg', name: 'Japandi',          desc: 'Japanese minimalism meets Scandinavian warmth — natural wood, off-white, low furniture' },
  { key: 'industrial',   sample: 'IMG_3359.jpg', name: 'Industrial',       desc: 'Raw materials, exposed brick or concrete, dark metal, urban loft, leather sofa' },
  { key: 'coastal',      sample: 'IMG_4221.JPG', name: 'Coastal',          desc: 'Breezy beach house — white shiplap, light blue accents, rattan, linen, lots of natural light' },
  { key: 'classic',      sample: 'IMG_5150.JPG', name: 'Classic',          desc: 'Timeless elegance — rich fabrics, ornate molding, warm wood, traditional silhouettes' },
  { key: 'artdeco',      sample: 'IMG_5150.JPG', name: 'Art Deco',         desc: 'Bold geometry, gold accents, glamorous 1920s opulence, velvet, lacquered wood' },
  { key: 'midcentury',   sample: 'IMG_3352.jpg', name: 'Mid-Century Modern', desc: 'Organic shapes, walnut wood, mustard / teal accents, 1950–60s retro-modern charm' },
  { key: 'maximalist',   sample: 'IMG_3352.jpg', name: 'Maximalist',       desc: 'Bold patterns, rich layered colors, gallery walls, more-is-more philosophy' },
  { key: 'vintage',      sample: 'IMG_4625.jpg', name: 'Vintage',          desc: 'Nostalgic charm, antique finds, warm retro palette, patina, mid-1900s feel' },
  { key: 'bohemian',     sample: 'IMG_3352.jpg', name: 'Bohemian',         desc: 'Free-spirited, colorful textiles, layered rugs, plants everywhere, eclectic art' },
  { key: 'tropical',     sample: 'IMG_4221.JPG', name: 'Tropical',         desc: 'Lush greenery, banana leaf prints, rattan, breezy resort feel, light woods' },
  { key: 'cottagecore',  sample: 'IMG_3996.jpg', name: 'Cottagecore',      desc: 'Romantic English countryside — floral wallpaper, soft pastels, vintage prints, dried flowers' },
  { key: 'rustic',       sample: 'IMG_0095.JPG', name: 'Rustic',           desc: 'Weathered wood beams, stone, warm farmhouse charm, leather, iron fixtures' },
  { key: 'wabisabi',     sample: 'IMG_4680.jpg', name: 'Wabi-Sabi',        desc: 'Imperfect beauty — raw plaster walls, hand-thrown ceramics, neutral earth tones, quiet asceticism' },
  { key: 'gothic',       sample: 'IMG_4623.jpg', name: 'Gothic',           desc: 'Moody dark drama — black walls, deep velvet, ornate silhouettes, candlelight, vintage frames' },
  { key: 'cyberpunk',    sample: 'IMG_4625.jpg', name: 'Cyberpunk',        desc: 'Neon-lit futurism, hi-tech surfaces, urban dystopia, magenta + cyan glow, holograms' },
  { key: 'gaming',       sample: 'IMG_7067.JPG', name: 'Gaming',           desc: 'RGB-lit setup, sleek black tech, multi-monitor battlestation, neon strips, immersive vibe' },
  { key: 'taisho_romance', sample: 'IMG_1574.JPG', name: 'Taisho Romance', desc: 'Early 20th-century Japanese-Western fusion — tatami floor with Western armchairs, lace curtains, stained glass lamps, dark lacquered wood, romantic Art Nouveau touches' },
  { key: 'biophilic',    sample: 'IMG_3352.jpg', name: 'Biophilic',        desc: 'Plants everywhere — monstera, fiddle leaf fig, hanging vines — natural wood, jute rug, large windows with soft natural light, organic textures, living wall feel' },
  { key: 'cozy',         sample: 'IMG_4625.jpg', name: 'Cozy',             desc: 'Hygge warmth — chunky knit throws, layered rugs, warm amber lamp light, candles, soft cushions, neutral warm palette, inviting and intimate' },
];

// Exterior + Garden: text-only generation (no input photo). Each (key, type,
// prompt) — `type` is 'exterior' | 'garden' so we can group output paths.
const TEXT_ONLY = [
  // Exterior — original 6
  { key: 'modern_facade',        type: 'exterior', name: 'Modern Facade',         desc: 'A photoreal exterior of a modern home — clean geometry, large glass walls, mixed materials (wood, dark metal, stone), flat or low-pitched roof, neutral palette, daytime natural light, professional architecture photo' },
  { key: 'modern_farmhouse',     type: 'exterior', name: 'Modern Farmhouse',      desc: 'A photoreal exterior of a modern farmhouse — white vertical siding, black trim windows, gable roof, wood accent door, covered porch, simple landscaping, daytime' },
  { key: 'mediterranean',        type: 'exterior', name: 'Mediterranean',         desc: 'A photoreal Mediterranean villa exterior — cream stucco walls, terracotta tile roof, arched windows and doorways, wrought iron details, palm and olive trees, warm sunlight' },
  { key: 'craftsman',            type: 'exterior', name: 'Craftsman',             desc: 'A photoreal Craftsman bungalow exterior — wood shingle siding, low-pitched gable, exposed rafter tails, tapered columned porch, earthy palette, mature trees' },
  { key: 'contemporary',         type: 'exterior', name: 'Contemporary',          desc: 'A photoreal contemporary house exterior — bold rectangular volumes, concrete and steel, sharp angles, large picture windows, minimal landscaping' },
  { key: 'minimalist_exterior',  type: 'exterior', name: 'Minimalist Exterior',   desc: 'A photoreal minimalist house exterior — single material focus (white concrete or charred wood), simple cubic form, clean restrained palette, narrow vertical window slits' },
  // Exterior — new 5
  { key: 'tudor',                type: 'exterior', name: 'Tudor',                 desc: 'A photoreal English Tudor revival house exterior — half-timbered with dark timber framing on white stucco, steep multi-gable roof, leaded diamond-pane glass windows, brick chimney, mature garden' },
  { key: 'cape_cod',             type: 'exterior', name: 'Cape Cod',              desc: 'A photoreal Cape Cod house exterior — white cedar shingle siding, black shutters, symmetrical gable roof with central chimney, dormer windows, picket fence, hydrangeas, New England charm' },
  { key: 'japanese_traditional', type: 'exterior', name: 'Japanese Traditional',  desc: 'A photoreal traditional Japanese minka house exterior — exposed wood post-and-beam structure, dark kawara tile roof, white or natural-wood walls, shoji-style sliding doors, engawa wraparound porch, stone path, small zen courtyard' },
  { key: 'mountain_cabin',       type: 'exterior', name: 'Mountain Cabin',        desc: 'A photoreal mountain cabin exterior — log or timber-frame walls, steep pitched roof with snow caps, large stone chimney, wood deck, surrounded by pine trees and mountains, golden hour light, alpine retreat' },
  { key: 'midcentury_exterior',  type: 'exterior', name: 'Mid-Century Exterior',  desc: 'A photoreal mid-century modern house exterior — flat or low-slope roof, post-and-beam construction, floor-to-ceiling glass walls, horizontal lines, warm wood and stucco, palm springs feel, blue sky' },

  // Garden — 5
  { key: 'zen',      type: 'garden', name: 'Zen Garden',         desc: 'A photoreal Japanese zen garden — raked white gravel patterns, carefully placed dark river stones, sparse moss, a small Japanese maple, stone lantern, minimalism, contemplative atmosphere, soft natural light' },
  { key: 'cottage',  type: 'garden', name: 'Cottage Garden',     desc: 'A photoreal English cottage garden — densely planted perennial borders with foxgloves, hollyhocks, lavender, climbing roses on a wood arbor, narrow stone path, romantic abundance, soft morning light' },
  { key: 'desert',   type: 'garden', name: 'Desert Garden',      desc: 'A photoreal desert xeriscape garden — agave, golden barrel cactus, ocotillo, gravel mulch, large boulders, weathered wood fence, southwestern palette, bright sunlight' },
  { key: 'tropical', type: 'garden', name: 'Tropical Garden',    desc: 'A photoreal tropical garden — lush layered foliage with monstera, banana, palm fronds, hibiscus blooms, stone path, koi pond or fountain, dappled sunlight through leaves, resort feel' },
  { key: 'english',  type: 'garden', name: 'English Garden',     desc: 'A photoreal formal English garden — manicured lawn, low boxwood hedges in geometric patterns, layered perennial borders, gravel path, classical urn or sundial, balanced and orderly composition' },
];

// People-removal note for samples that contain humans.
const PEOPLE_REMOVAL_FOR = new Set(['IMG_0095.JPG']);

function buildPrompt(style) {
  const peopleNote = PEOPLE_REMOVAL_FOR.has(style.sample)
    ? '\nIMPORTANT: Remove all people from the scene. The output must be an empty room with no humans visible.'
    : '';
  return `Redesign the provided interior space photo into a fully ${style.name} style room.

TARGET STYLE: ${style.name}
Style characteristics: ${style.desc}

You may change the layout, furniture, materials, color palette, lighting — whatever needed to make the result a clean, photoreal exemplar of ${style.name} style. The result is for a STYLE PREVIEW THUMBNAIL, so style fidelity matters more than preserving the original room.

Keep the same general space type (living room / bedroom / kitchen as appropriate) and the camera viewpoint roughly the same. Make the result inviting and well-lit. Render at full resolution as a real photograph.${peopleNote}`;
}

async function callGemini(imageBase64, mimeType, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${API_KEY}`;
  const parts = [{ text: prompt }];
  if (imageBase64) parts.push({ inlineData: { mimeType, data: imageBase64 } });
  const body = { contents: [{ parts }] };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini ${res.status}: ${text.slice(0, 400)}`);
  }
  const json = await res.json();
  const respParts = json?.candidates?.[0]?.content?.parts || [];
  const imgPart = respParts.find(p => p.inlineData?.data);
  if (!imgPart) {
    throw new Error('Gemini returned no image — ' + JSON.stringify(json).slice(0, 300));
  }
  return { data: imgPart.inlineData.data, mimeType: imgPart.inlineData.mimeType || 'image/jpeg' };
}

async function generateOne(style) {
  const outPath = path.join(OUT_DIR, `${style.key}.jpg`);
  if (!FORCE && fs.existsSync(outPath)) {
    console.log(`skip ${style.key} (exists)`);
    return;
  }

  const inPath = path.join(SAMPLE_DIR, style.sample);
  if (!fs.existsSync(inPath)) {
    console.warn(`!! sample missing for ${style.key}: ${style.sample}`);
    return;
  }

  // Normalize EXIF orientation + downscale to 1024px so the request is fast.
  const inputBuf = await sharp(inPath).rotate().resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
  const inputBase64 = inputBuf.toString('base64');

  const prompt = buildPrompt(style);
  console.log(`→ ${style.key} (${style.sample})`);
  const t0 = Date.now();
  const out = await callGemini(inputBase64, 'image/jpeg', prompt);
  const ms = Date.now() - t0;

  const outBuf = Buffer.from(out.data, 'base64');
  // Re-encode to JPEG (Gemini may return PNG) at 85% quality.
  const finalBuf = await sharp(outBuf).resize({ width: 800, height: 800, fit: 'cover' }).jpeg({ quality: 85 }).toBuffer();
  fs.writeFileSync(outPath, finalBuf);
  console.log(`✓ ${style.key} ${(ms/1000).toFixed(1)}s — ${(finalBuf.length/1024).toFixed(0)} KB`);
}

async function generateTextOnly(item) {
  const subdir = item.type === 'exterior' ? 'exterior-thumbnails' : 'garden-thumbnails';
  const outDir = path.join(__dirname, '..', 'public', subdir);
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${item.key}.jpg`);
  if (!FORCE && fs.existsSync(outPath)) {
    console.log(`skip ${item.type}/${item.key} (exists)`);
    return;
  }
  console.log(`→ ${item.type}/${item.key} (text-only)`);
  const t0 = Date.now();
  const out = await callGemini(null, null, item.desc);
  const ms = Date.now() - t0;
  const outBuf = Buffer.from(out.data, 'base64');
  const finalBuf = await sharp(outBuf).resize({ width: 800, height: 800, fit: 'cover' }).jpeg({ quality: 85 }).toBuffer();
  fs.writeFileSync(outPath, finalBuf);
  console.log(`✓ ${item.type}/${item.key} ${(ms/1000).toFixed(1)}s — ${(finalBuf.length/1024).toFixed(0)} KB`);
}

async function main() {
  const CHUNK = 4;
  // Interior — sample-photo based
  for (let i = 0; i < STYLES.length; i += CHUNK) {
    const batch = STYLES.slice(i, i + CHUNK);
    await Promise.all(batch.map(s => generateOne(s).catch(e => console.error(`✗ ${s.key}:`, e.message))));
  }
  // Exterior + Garden — text-only
  for (let i = 0; i < TEXT_ONLY.length; i += CHUNK) {
    const batch = TEXT_ONLY.slice(i, i + CHUNK);
    await Promise.all(batch.map(s => generateTextOnly(s).catch(e => console.error(`✗ ${s.type}/${s.key}:`, e.message))));
  }
  console.log('\nDone. Output:', OUT_DIR, '+ exterior-thumbnails / garden-thumbnails');
}

main().catch(e => { console.error(e); process.exit(1); });
