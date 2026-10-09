// Model A/B — runs the REAL production functions (processItem, analyzeOotd,
// stylistChat, and the try-on prompt) against two model configs and writes one
// HTML report to compare them side by side. Used to decide model swaps
// (docs/AI-MODELS.md); kept for the next new model.
//
// Nothing touches production: getModels is swapped per run, and every
// Firestore/Storage write is replaced with a no-op that records what WOULD
// have been written (cutout PNGs are kept for the report). Reads are real.
//
// Run FROM functions/ (cwd needed for @imgly; ADC for Firestore/Storage/Vision):
//   cd functions
//   VITE_GEMINI_API_KEY_DEV=<key> node test-model-ab.js config.json
// config.json: { "a": {vision, imageCrop, imageTryon}, "b": {...},
//   "items": [{id, focus?}], "ootds": [id], "chat": {uid, lang, text},
//   "tryonOutfits": [id] }
// Output: .crop-ab/model-ab/<timestamp>/report.html (gitignored).

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const API_KEY = process.env.VITE_GEMINI_API_KEY_DEV || process.env.GEMINI_API_KEY;
if (!API_KEY && process.argv[2] !== '--rebuild') { console.error('no API key'); process.exit(1); }
process.env.GEMINI_API_KEY = API_KEY || '';   // defineSecret().value() reads this locally

try { admin.initializeApp({ projectId: 'drape-9e532', storageBucket: 'drape-9e532.firebasestorage.app' }); } catch {}

// ── Block every write, keep a record ────────────────────────────────────
const writes = [];
const files = new Map();   // storage path → Buffer
const { DocumentReference, CollectionReference, WriteBatch, Transaction } = require('@google-cloud/firestore');
const noop = (kind) => function patched(...args) { writes.push({ kind, path: this.path || this._path?.relativeName || '', data: args[0] }); return Promise.resolve(); };
for (const m of ['set', 'update', 'delete', 'create']) DocumentReference.prototype[m] = noop(`doc.${m}`);
CollectionReference.prototype.add = function add(data) { writes.push({ kind: 'col.add', path: this.path, data }); return Promise.resolve(this.doc()); };
WriteBatch.prototype.set = function set(ref, data) { writes.push({ kind: 'batch.set', path: ref.path, data }); return this; };
WriteBatch.prototype.update = function update(ref, data) { writes.push({ kind: 'batch.update', path: ref.path, data }); return this; };
WriteBatch.prototype.delete = function del() { return this; };
WriteBatch.prototype.commit = () => Promise.resolve([]);
for (const m of ['set', 'update', 'create', 'delete']) Transaction.prototype[m] = function t() { return this; };
const { File } = require('@google-cloud/storage');
File.prototype.save = function save(buf) { files.set(this.name, Buffer.from(buf)); return Promise.resolve(); };
File.prototype.makePublic = () => Promise.resolve();

// ── Model override ──────────────────────────────────────────────────────
const modelConfig = require('./model-config.js');
let current = { ...modelConfig.MODEL_DEFAULTS };
modelConfig.getModels = async () => current;
const items = require('./items.js');
const stylist = require('./stylist.js');
const { tryOnPrompt, blurOutfitFace, extractImage, downloadAsInlineData } = require('./tryon.js')._tryonInternals;
const { GoogleGenAI } = require('@google/genai');

// `--rebuild <out dir>` regenerates report.html from a saved results.json
// (e.g. after merging runs) without calling any model.
const REBUILD = process.argv[2] === '--rebuild' ? process.argv[3] : null;
const cfg = REBUILD
  ? JSON.parse(fs.readFileSync(path.join(REBUILD, 'results.json'), 'utf8')).cfg
  : JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const OUT = REBUILD || path.join(__dirname, '..', '.crop-ab', 'model-ab', new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(OUT, { recursive: true });
const db = admin.firestore();
const bucket = admin.storage().bucket();
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function timed(fn) {
  const t0 = Date.now();
  try { return { ok: true, value: await fn(), ms: Date.now() - t0 }; }
  catch (e) { return { ok: false, error: e.message, ms: Date.now() - t0 }; }
}
const auth = (uid) => ({ uid, token: { firebase: { sign_in_provider: 'google.com' } } });

async function main() {
  const res = { items: [], ootds: [], chat: [], tryon: [] };
  const sides = [['a', cfg.a], ['b', cfg.b]];

  for (const it of cfg.items || []) {
    const doc = (await db.doc(`items/${it.id}`).get()).data();
    if (!doc) continue;
    const row = { id: it.id, name: doc.name, original: doc.originalUrl, before: doc.croppedUrl };
    for (const [k, m] of sides) {
      current = { ...modelConfig.MODEL_DEFAULTS, ...m };
      files.clear();
      const r = await timed(() => items.processItem.run({ data: { itemId: it.id, focus: it.focus || null, lang: doc.lang || 'en' }, auth: auth(doc.userId) }));
      const png = [...files.entries()].find(([p]) => p.includes('/cropped-'));
      if (png) { const f = `item-${it.id}-${k}.png`; fs.writeFileSync(path.join(OUT, f), png[1]); row[`${k}Img`] = f; }
      row[k] = r.ok ? { tags: r.value.tags, ms: r.ms } : { error: r.error, ms: r.ms };
      console.log(`item ${it.id} ${k}: ${r.ok ? 'ok' : r.error} ${r.ms}ms`);
    }
    res.items.push(row);
  }

  for (const id of cfg.ootds || []) {
    const doc = (await db.doc(`outfits/${id}`).get()).data();
    if (!doc) continue;
    const row = { id, photo: doc.photoUrl };
    for (const [k, m] of sides) {
      current = { ...modelConfig.MODEL_DEFAULTS, ...m };
      const r = await timed(() => items.analyzeOotd.run({ data: { ootdId: id, lang: 'en' }, auth: auth(doc.userId) }));
      row[k] = r.ok ? { pieces: r.value.pieces, style: r.value.style, palette: r.value.palette, notes: r.value.notes, ms: r.ms } : { error: r.error, ms: r.ms };
      console.log(`ootd ${id} ${k}: ${r.ok ? 'ok' : r.error} ${r.ms}ms`);
    }
    res.ootds.push(row);
  }

  if (cfg.chat) {
    for (const persona of ['noa', 'remy', 'sol', 'juno']) {
      const row = { persona };
      for (const [k, m] of sides) {
        current = { ...modelConfig.MODEL_DEFAULTS, ...m };
        const r = await timed(() => stylist.stylistChat.run({ data: { persona, text: cfg.chat.text, lang: cfg.chat.lang }, auth: auth(cfg.chat.uid) }));
        row[k] = r.ok ? { reply: r.value.messages[1].text, outfits: r.value.messages[1].outfits, ms: r.ms } : { error: r.error, ms: r.ms };
        console.log(`chat ${persona} ${k}: ${r.ok ? 'ok' : r.error} ${r.ms}ms`);
      }
      res.chat.push(row);
    }
    const names = {};
    (await db.collection('items').where('userId', '==', cfg.chat.uid).get()).forEach((d) => { names[d.id] = { name: d.data().name, img: d.data().croppedUrl || d.data().originalUrl }; });
    res.chatItems = names;
  }

  const identity = path.join(__dirname, '..', '.crop-ab', 'tryon', 'identity.jpg');
  if ((cfg.tryonOutfits || []).length && fs.existsSync(identity)) {
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const idBuf = fs.readFileSync(identity);
    fs.copyFileSync(identity, path.join(OUT, 'identity.jpg'));
    const prompt = tryOnPrompt([], '', '', 1, 'outfit-ref');
    for (const id of cfg.tryonOutfits) {
      const o = (await db.doc(`outfits/${id}`).get()).data();
      const part = await downloadAsInlineData(bucket, o.photoPath);
      const blurred = await blurOutfitFace(Buffer.from(part.inlineData.data, 'base64'));
      const row = { id, outfit: o.photoUrl };
      for (const [k, m] of sides) {
        const r = await timed(async () => {
          const out = await ai.models.generateContent({
            model: m.imageTryon,
            contents: [{ inlineData: { data: idBuf.toString('base64'), mimeType: 'image/jpeg' } }, { inlineData: { data: blurred.toString('base64'), mimeType: 'image/jpeg' } }, { text: prompt }],
            config: { imageConfig: { imageSize: m.imageTryonSize || '1K' } },
          });
          const img = extractImage(out);
          if (!img) throw new Error('no image (blocked?)');
          return Buffer.from(img.data, 'base64');
        });
        if (r.ok) { const f = `tryon-${id}-${k}.png`; fs.writeFileSync(path.join(OUT, f), r.value); row[k] = { img: f, ms: r.ms }; }
        else row[k] = { error: r.error, ms: r.ms };
        console.log(`tryon ${id} ${k}: ${r.ok ? 'ok' : r.error} ${r.ms}ms`);
      }
      res.tryon.push(row);
    }
  }

  res.cfg = cfg;
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(res, null, 1));
  fs.writeFileSync(path.join(OUT, 'report.html'), report(res));
  const leaked = writes.filter((w) => w.kind && !w.kind.startsWith('doc') && !w.kind.startsWith('col') && !w.kind.startsWith('batch'));
  console.log(`\n✓ ${OUT}/report.html  (blocked ${writes.length} writes${leaked.length ? `, unexpected: ${leaked.length}` : ''})`);
  process.exit(0);
}

function sec(t) { return `<h2>${esc(t)}</h2>`; }
function ms(x) { return x ? `<span class="ms">${(x.ms / 1000).toFixed(1)}s</span>` : ''; }
function tagList(t) {
  if (!t) return '<em>none</em>';
  return ['name', 'category', 'subcategory', 'colors', 'styles', 'seasons', 'fit', 'brand']
    .map((k) => `<div><b>${k}</b> ${esc(Array.isArray(t[k]) ? t[k].join(', ') : t[k] ?? '')}</div>`).join('');
}
function report(r) {
  const A = esc(JSON.stringify(cfg.a)); const B = esc(JSON.stringify(cfg.b));
  let h = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Model A/B</title><style>
  body{font:14px/1.45 -apple-system,system-ui,sans-serif;margin:24px;color:#1a1a1a;background:#fafaf8}
  h1{font-size:20px;margin:0 0 4px} h2{font-size:16px;margin:32px 0 10px;border-bottom:1px solid #ddd;padding-bottom:6px}
  .cfg{font:12px monospace;color:#555;margin:2px 0}
  .row{display:grid;grid-template-columns:160px 1fr 1fr;gap:12px;align-items:start;padding:12px 0;border-bottom:1px solid #eee}
  .row.three{grid-template-columns:repeat(4,1fr)}
  .cell{background:#fff;border:1px solid #e6e6e6;border-radius:10px;padding:10px}
  .cell img{width:100%;max-height:340px;object-fit:contain;background:#fff;border-radius:6px}
  .lab{font-weight:600;font-size:12px;color:#2E4A3A;margin-bottom:6px;display:flex;justify-content:space-between}
  .ms{color:#888;font-weight:400} .err{color:#c24545} b{display:inline-block;min-width:84px;color:#777;font-weight:500}
  .look{margin-top:8px;border-top:1px dashed #ddd;padding-top:6px} .thumbs{display:flex;gap:4px;flex-wrap:wrap;margin-top:4px}
  .thumbs img{width:54px;height:66px;object-fit:contain;background:#f4f4f4;border-radius:4px}
  .src img{width:100%;border-radius:6px}
  .sum{background:#fff;border:1px solid #e6e6e6;border-radius:12px;padding:14px 18px;margin:16px 0}
  .sum table{border-collapse:collapse;width:100%} .sum td,.sum th{border-bottom:1px solid #eee;padding:6px 8px;text-align:left;vertical-align:top}
  .good{color:#2E4A3A;font-weight:600} .bad{color:#c24545;font-weight:600}
  </style></head><body><h1>Model A/B — ${new Date().toISOString().slice(0, 16)}</h1>
  <div class="cfg">A = ${A}</div><div class="cfg">B = ${B}</div>${r.summaryHtml || ''}`;
  if (r.items.length) {
    h += sec('Items — cutout (imageCrop) + tags (vision)');
    for (const it of r.items) {
      h += `<div class="row"><div class="cell src"><div class="lab">source</div><img src="${esc(it.original)}"><div>${esc(it.name)}</div></div>`;
      for (const k of ['a', 'b']) {
        const x = it[k] || {};
        h += `<div class="cell"><div class="lab">${k.toUpperCase()} ${ms(x)}</div>${it[`${k}Img`] ? `<img src="${it[`${k}Img`]}">` : '<div class="err">no cutout</div>'}${x.error ? `<div class="err">${esc(x.error)}</div>` : tagList(x.tags)}</div>`;
      }
      h += '</div>';
    }
  }
  if (r.ootds.length) {
    h += sec('OOTD analysis (vision)');
    for (const o of r.ootds) {
      h += `<div class="row"><div class="cell src"><div class="lab">photo</div><img src="${esc(o.photo)}"></div>`;
      for (const k of ['a', 'b']) {
        const x = o[k] || {};
        h += `<div class="cell"><div class="lab">${k.toUpperCase()} ${ms(x)}</div>${x.error ? `<div class="err">${esc(x.error)}</div>` : `
          <div><b>pieces</b> ${esc((x.pieces || []).map((p) => `${p.name} (${p.category})`).join(' · '))}</div>
          <div><b>style</b> ${esc((x.style || []).map((s) => `${s.label} ${s.level ?? ''}`).join(', '))}</div>
          <div><b>palette</b> ${esc((x.palette || []).map((p) => p.name).join(', '))}</div>
          <div><b>notes</b> ${esc(x.notes)}</div>`}</div>`;
      }
      h += '</div>';
    }
  }
  if (r.chat.length) {
    h += sec(`Stylist chat (vision) — “${cfg.chat.text}”`);
    const thumbs = (o) => `<div class="thumbs">${o.itemIds.map((id) => `<img title="${esc(r.chatItems[id]?.name)}" src="${esc(r.chatItems[id]?.img)}">`).join('')}</div>`;
    for (const c of r.chat) {
      h += `<div class="row"><div class="cell"><div class="lab">${esc(c.persona)}</div></div>`;
      for (const k of ['a', 'b']) {
        const x = c[k] || {};
        h += `<div class="cell"><div class="lab">${k.toUpperCase()} ${ms(x)}</div>${x.error ? `<div class="err">${esc(x.error)}</div>` : `<div>${esc(x.reply)}</div>${(x.outfits || []).map((o) => `<div class="look"><b>${esc(o.title)}</b><div>${esc(o.why)}</div>${thumbs(o)}</div>`).join('')}`}</div>`;
      }
      h += '</div>';
    }
  }
  if (r.tryon.length) {
    h += sec('Try-on (imageTryon) — identity · outfit · A · B');
    for (const t of r.tryon) {
      h += `<div class="row three"><div class="cell"><div class="lab">identity</div><img src="identity.jpg"></div><div class="cell"><div class="lab">outfit</div><img src="${esc(t.outfit)}"></div>`;
      for (const k of ['a', 'b']) {
        const x = t[k] || {};
        h += `<div class="cell"><div class="lab">${k.toUpperCase()} ${ms(x)}</div>${x.img ? `<img src="${x.img}">` : `<div class="err">${esc(x.error)}</div>`}</div>`;
      }
      h += '</div>';
    }
  }
  return `${h}</body></html>`;
}

if (REBUILD) {
  const res = JSON.parse(fs.readFileSync(path.join(REBUILD, 'results.json'), 'utf8'));
  fs.writeFileSync(path.join(REBUILD, 'report.html'), report(res));
  console.log(`✓ rebuilt ${REBUILD}/report.html`);
  process.exit(0);
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
