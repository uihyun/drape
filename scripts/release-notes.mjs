#!/usr/bin/env node
// One page with every locale's release notes for a version, each block with a
// copy button — for pasting into App Store Connect / Play Console. The notes
// stay tracked per locale in resources/app-store/listing-*.md (the source of
// truth); this only gathers them, so there is nothing to keep in sync.
//
//   npm run notes            # version from package.json
//   npm run notes -- 2.2.1   # a specific version
//
// Writes resources/app-store/builds/release-notes-<v>.html (gitignored, next to
// the AAB) and opens it.

import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const version = process.argv[2] || JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
const LOCALES = [
  ['en', 'English', 'en-US'],
  ['ko', '한국어', 'ko'],
  ['ja', '日本語', 'ja'],
  ['es', 'Español', 'es-ES · es-MX'],
  ['fr', 'Français', 'fr-FR'],
];
const LIMIT = { appstore: 4000, play: 500 };

// A version's notes are a bold header ending in "— <version>:" followed by a
// fenced block. The Play block says "Play" in its header; the other is App Store.
function notesFor(md) {
  const out = {};
  const re = new RegExp(String.raw`^\*\*[^\n]*— ${version.replace(/\./g, '\\.')}:\s*\n+\`\`\`\n([\s\S]*?)\n\`\`\``, 'gm');
  for (const m of md.matchAll(re)) {
    out[/Play/.test(m[0].split('\n')[0]) ? 'play' : 'appstore'] = m[1];
  }
  return out;
}

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const missing = [];
const sections = LOCALES.map(([code, name, stores]) => {
  const n = notesFor(readFileSync(join(ROOT, `resources/app-store/listing-${code}.md`), 'utf8'));
  const block = (key, label) => {
    const text = n[key];
    if (!text) { missing.push(`${code} ${key}`); return `<div class="block missing">${label}: no ${version} notes in listing-${code}.md</div>`; }
    const len = [...text].length;
    const over = len > LIMIT[key];
    return `<div class="block">
      <div class="bar"><span class="label">${label}</span>
        <span class="count${over ? ' over' : ''}">${len} / ${LIMIT[key]}</span>
        <button type="button" data-copy>Copy</button></div>
      <pre>${esc(text)}</pre></div>`;
  };
  return `<section><h2>${name} <small>${code} · ${stores}</small></h2>
    ${block('appstore', 'App Store — What\u2019s New')}
    ${block('play', 'Google Play — What\u2019s new')}</section>`;
}).join('\n');

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>drape ${version} release notes</title>
<style>
  :root { --bg:#f7f5f2; --card:#fff; --ink:#141312; --muted:#7a746d; --line:#e4dfd8; --warn:#b3261e; }
  @media (prefers-color-scheme: dark) { :root { --bg:#141312; --card:#1e1c1a; --ink:#f3efe8; --muted:#a59e95; --line:#34302c; --warn:#ff8a80; } }
  body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.5 -apple-system, system-ui, sans-serif; }
  main { max-width:760px; margin:0 auto; padding:24px 16px 64px; }
  h1 { font-family: Didot, serif; font-style:italic; font-weight:400; font-size:2rem; margin:0 0 4px; }
  .sub { color:var(--muted); margin:0 0 24px; }
  section { margin:0 0 28px; }
  h2 { font-size:1.05rem; margin:0 0 8px; } h2 small { color:var(--muted); font-weight:400; }
  .block { background:var(--card); border:1px solid var(--line); border-radius:10px; margin:0 0 10px; overflow:hidden; }
  .bar { display:flex; align-items:center; gap:10px; padding:8px 12px; border-bottom:1px solid var(--line); font-size:.82rem; }
  .label { font-weight:600; flex:1; } .count { color:var(--muted); font-variant-numeric:tabular-nums; } .count.over { color:var(--warn); font-weight:600; }
  button { font:inherit; border:1px solid var(--line); background:var(--bg); color:var(--ink); border-radius:6px; padding:3px 12px; cursor:pointer; }
  button.done { background:var(--ink); color:var(--bg); }
  pre { margin:0; padding:12px; white-space:pre-wrap; word-break:break-word; font:inherit; }
  .missing { padding:12px; color:var(--warn); }
</style></head><body><main>
<h1>drape ${version}</h1>
<p class="sub">Release notes · App Store ≤4000 · Play ≤500 · source: resources/app-store/listing-*.md</p>
${sections}
</main><script>
document.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
  const text = b.closest('.block').querySelector('pre').textContent;
  try { await navigator.clipboard.writeText(text); }
  catch { const r = document.createRange(); r.selectNodeContents(b.closest('.block').querySelector('pre')); getSelection().removeAllRanges(); getSelection().addRange(r); document.execCommand('copy'); }
  b.textContent = 'Copied'; b.classList.add('done');
  setTimeout(() => { b.textContent = 'Copy'; b.classList.remove('done'); }, 1500);
}));
</script></body></html>`;

const outPath = join(ROOT, `resources/app-store/builds/release-notes-${version}.html`);
writeFileSync(outPath, html);
console.log(`wrote ${outPath}${missing.length ? `\nmissing: ${missing.join(', ')}` : ''}`);
if (!process.env.NO_OPEN) { try { execFileSync('open', [outPath]); } catch { /* not macOS */ } }
