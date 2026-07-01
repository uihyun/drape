#!/usr/bin/env node
// Full project health check — re-runnable any time via `npm run check`.
//
// Each check is independent and reports PASS / FAIL / WARN with detail. The
// script exits non-zero if any hard check fails, so it doubles as a CI gate.
// Designed to catch the classes of bug we've actually hit:
//   - missing named imports that build-but-crash-at-runtime (IMG_CACHE,
//     useSearchParams) — Vite build doesn't catch these
//   - locale drift between en / ko / ja
//   - native (iOS/Android) identity / config inconsistency
//   - broken unit tests / broken production build
//
// Usage: node scripts/check.mjs [--fast]   (--fast skips build + unit tests)

import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const FAST = process.argv.includes('--fast');
const results = [];
const rel = (p) => p.replace(ROOT, '');

function record(name, status, detail = '') {
  results.push({ name, status, detail });
  const icon = status === 'PASS' ? '✓' : status === 'WARN' ? '!' : '✗';
  const color = status === 'PASS' ? '\x1b[32m' : status === 'WARN' ? '\x1b[33m' : '\x1b[31m';
  console.log(`${color}${icon}\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`);
}

function sh(cmd, opts = {}) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
}

function listSrc() {
  return sh("find src -name '*.jsx' -o -name '*.js'").trim().split('\n').filter(Boolean);
}

// ── 1. Missing named-import audit ──────────────────────────────────────
// Identifiers that are module exports somewhere in src and must be imported
// (not just defined) wherever referenced. Vite build does NOT flag these.
function checkNamedImports() {
  const files = listSrc();
  // (symbol, regex-usage). Add new shared symbols here as the app grows.
  const SYMBOLS = ['IMG_CACHE'];
  // React + react-router hooks: used-but-not-imported is a guaranteed crash.
  const RRD = ['useSearchParams', 'useNavigate', 'useParams', 'useLocation', 'Navigate', 'Outlet', 'useOutletContext', 'NavLink'];
  const REACT = ['useState', 'useEffect', 'useMemo', 'useCallback', 'useRef', 'useContext', 'useReducer', 'useLayoutEffect'];
  const misses = [];
  for (const f of files) {
    const src = readFileSync(`${ROOT}/${f}`, 'utf8');
    // Strip import statements + comments before checking usage so an import
    // line or a mention in a comment doesn't count as "used".
    const body = src
      .replace(/^\s*import[^;]*;?\s*$/gm, '')
      .replace(/\/\/[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    // `kind` distinguishes how the symbol is referenced:
    //   'call'  — function/component: name( or <name   (hooks, components)
    //   'value' — bare value reference: any word-boundary use (constants)
    const check = (name, fromRe, kind) => {
      const used = kind === 'value'
        ? new RegExp(`[^A-Za-z0-9_.$]${name}[^A-Za-z0-9_.$]`).test(body)
        : (new RegExp(`[^A-Za-z0-9_.]${name}\\s*\\(`).test(body) || new RegExp(`<${name}[\\s/>]`).test(body));
      const imported = new RegExp(fromRe).test(src);
      const defined = new RegExp(`(const|let|var|function|class)\\s+${name}\\b`).test(body);
      if (used && !imported && !defined) misses.push(`${rel(f)} → ${name}`);
    };
    for (const s of SYMBOLS) check(s, `import\\s*\\{[^}]*\\b${s}\\b[^}]*\\}`, 'value');
    for (const s of RRD) check(s, `import[^;]*\\b${s}\\b[^;]*react-router-dom`, 'call');
    for (const s of REACT) check(s, `import[^;]*\\b${s}\\b[^;]*from 'react'`, 'call');
  }
  if (misses.length) record('named-import audit', 'FAIL', misses.join('; '));
  else record('named-import audit', 'PASS', `${files.length} files`);
}

// ── 2. Locale parity ───────────────────────────────────────────────────
function checkLocaleParity() {
  const langs = ['en', 'ko', 'ja'];
  const keysByLang = {};
  for (const l of langs) {
    const src = readFileSync(`${ROOT}/src/locales/${l}.js`, 'utf8');
    const keys = new Set([...src.matchAll(/^\s{2}([a-zA-Z][a-zA-Z0-9]*):/gm)].map(m => m[1]));
    keysByLang[l] = keys;
  }
  const base = keysByLang.en;
  const problems = [];
  for (const l of ['ko', 'ja']) {
    const missing = [...base].filter(k => !keysByLang[l].has(k));
    const extra = [...keysByLang[l]].filter(k => !base.has(k));
    if (missing.length) problems.push(`${l} missing: ${missing.slice(0, 8).join(',')}${missing.length > 8 ? '…' : ''}`);
    if (extra.length) problems.push(`${l} extra: ${extra.slice(0, 8).join(',')}${extra.length > 8 ? '…' : ''}`);
  }
  if (problems.length) record('locale parity', 'FAIL', problems.join(' | '));
  else record('locale parity', 'PASS', `${base.size} keys × en/ko/ja`);
}

// ── 3. Native identity consistency ─────────────────────────────────────
// Ensure no voda/archelier leftovers in the parts that define app identity,
// and that bundle id is consistent across iOS + Android + capacitor config.
function checkNativeIdentity() {
  const want = 'com.uihyun.drape';
  const checks = [
    ['capacitor.config.json', /"appId":\s*"([^"]+)"/],
    ['ios/App/App.xcodeproj/project.pbxproj', /PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/],
    ['android/app/build.gradle', /applicationId "([^"]+)"/],
  ];
  const bad = [];
  for (const [file, re] of checks) {
    const p = `${ROOT}/${file}`;
    if (!existsSync(p)) { bad.push(`${file} missing`); continue; }
    const m = readFileSync(p, 'utf8').match(re);
    const val = m?.[1]?.trim();
    if (val !== want) bad.push(`${file}: ${val}`);
  }
  // Stale brand strings in identity-defining files (NOT firebase configs,
  // which legitimately may lag until the console regen — that's tracked
  // separately in memory).
  const stale = [];
  const identityFiles = [
    'ios/App/App/Info.plist',
    'android/app/src/main/res/values/strings.xml',
    'capacitor.config.json',
  ];
  for (const f of identityFiles) {
    const p = `${ROOT}/${f}`;
    if (existsSync(p) && /voda|archelier/i.test(readFileSync(p, 'utf8'))) stale.push(f);
  }
  if (bad.length) record('native bundle id', 'FAIL', bad.join('; '));
  else record('native bundle id', 'PASS', want);
  if (stale.length) record('native brand strings', 'WARN', `voda/archelier in: ${stale.join(', ')}`);
  else record('native brand strings', 'PASS', 'no voda/archelier leftovers');
}

// ── 4. Firebase config alignment (web vs native) ───────────────────────
// Web uses drape-9e532; native Google config files may still point at the
// old voda project. Surface it as a WARN (known/tracked), not a hard fail.
function checkFirebaseConfig() {
  const webSrc = readFileSync(`${ROOT}/src/firebase.js`, 'utf8');
  const webProject = webSrc.match(/projectId:\s*['"]([^'"]+)['"]/)?.[1];
  const issues = [];
  const gsj = `${ROOT}/android/app/google-services.json`;
  if (existsSync(gsj)) {
    const proj = JSON.parse(readFileSync(gsj, 'utf8')).project_info?.project_id;
    if (proj !== webProject) issues.push(`android google-services: ${proj} ≠ web ${webProject}`);
  }
  const plist = `${ROOT}/ios/App/App/GoogleService-Info.plist`;
  if (existsSync(plist)) {
    const proj = readFileSync(plist, 'utf8').match(/<key>PROJECT_ID<\/key>\s*<string>([^<]+)</)?.[1];
    if (proj !== webProject) issues.push(`iOS GoogleService: ${proj} ≠ web ${webProject}`);
  }
  if (issues.length) record('firebase project alignment', 'WARN', issues.join('; '));
  else record('firebase project alignment', 'PASS', webProject);
}

// ── 5. Production build ────────────────────────────────────────────────
function checkBuild() {
  if (FAST) { record('vite build', 'WARN', 'skipped (--fast)'); return; }
  try {
    sh('npx vite build', { stdio: ['ignore', 'ignore', 'pipe'] });
    record('vite build', 'PASS');
  } catch (e) {
    record('vite build', 'FAIL', (e.stderr || e.stdout || e.message).toString().split('\n').slice(-3).join(' '));
  }
}

// ── 6. Unit tests ──────────────────────────────────────────────────────
function checkUnitTests() {
  if (FAST) { record('unit tests', 'WARN', 'skipped (--fast)'); return; }
  try {
    // All unit tests EXCEPT the Firestore-rules suite, which needs the
    // emulator (Java) — that runs separately via `npm run test:rules`.
    const out = sh("npx vitest run tests/ --exclude '**/firestore-rules.test.js'", { stdio: ['ignore', 'pipe', 'pipe'] });
    const m = out.match(/Tests\s+(\d+) passed/);
    record('unit tests', 'PASS', m ? `${m[1]} passed` : 'ok');
  } catch (e) {
    record('unit tests', 'FAIL', (e.stdout || e.message).toString().split('\n').slice(-6).join(' '));
  }
}

// ── 7. No leftover temp/dev-only files ─────────────────────────────────
function checkNoTempFiles() {
  const offenders = [];
  for (const f of listSrc()) {
    if (/__|\.tmp\.|\.bak$/.test(f.split('/').pop())) offenders.push(rel(f));
  }
  if (offenders.length) record('no temp/dev files', 'WARN', offenders.join(', '));
  else record('no temp/dev files', 'PASS');
}

// ── run all ────────────────────────────────────────────────────────────
console.log(`\n🔎 drape full check${FAST ? ' (fast)' : ''}\n`);
checkNamedImports();
checkLocaleParity();
checkNativeIdentity();
checkFirebaseConfig();
checkNoTempFiles();
checkBuild();
checkUnitTests();

const fails = results.filter(r => r.status === 'FAIL');
const warns = results.filter(r => r.status === 'WARN');
console.log(`\n${fails.length === 0 ? '\x1b[32m✓ all hard checks passed' : `\x1b[31m✗ ${fails.length} failed`}\x1b[0m` +
  `${warns.length ? `  \x1b[33m(${warns.length} warn)\x1b[0m` : ''}\n`);
process.exit(fails.length ? 1 : 0);
