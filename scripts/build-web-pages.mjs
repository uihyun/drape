// Generate standalone, app-shell-free web pages (support / privacy / terms)
// into public/. These are plain static HTML — external visitors (the App Store
// "App Support" link, the Privacy Policy URL) see only the content, with no app
// nav / back button that could lead them into the web app. Re-run after editing
// src/data/legal.js:  node scripts/build-web-pages.mjs
import { PRIVACY, TERMS, LEGAL_EFFECTIVE, LEGAL_CONTACT } from '../src/data/legal.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const PUB = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const LANGS = ['en', 'ko', 'ja'];
const LBL = { en: 'EN', ko: 'KO', ja: 'JA' };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const T = {
  support: { en: 'Support', ko: '고객지원', ja: 'サポート' },
  privacy: { en: 'Privacy Policy', ko: '개인정보 처리방침', ja: 'プライバシーポリシー' },
  terms: { en: 'Terms of Service', ko: '이용약관', ja: '利用規約' },
  eff: { en: 'Effective', ko: '시행일', ja: '施行日' },
};
const SUPPORT_BODY = {
  en: `<p class="lead">Need a hand?</p><p>We're happy to help. Email us at <a href="mailto:${LEGAL_CONTACT}">${LEGAL_CONTACT}</a> and we'll get back to you as soon as we can.</p><p style="margin-top:14px">For how we handle your data, see the <a href="/privacy.html">Privacy Policy</a> and <a href="/terms.html">Terms of Service</a>.</p>`,
  ko: `<p class="lead">도움이 필요하신가요?</p><p>무엇이든 도와드릴게요. <a href="mailto:${LEGAL_CONTACT}">${LEGAL_CONTACT}</a> 으로 문의 주시면 최대한 빨리 답변드립니다.</p><p style="margin-top:14px">데이터 처리 방식은 <a href="/privacy.html">개인정보 처리방침</a>과 <a href="/terms.html">이용약관</a>을 참고하세요.</p>`,
  ja: `<p class="lead">お困りですか？</p><p>喜んでサポートします。<a href="mailto:${LEGAL_CONTACT}">${LEGAL_CONTACT}</a> までご連絡ください。できる限り早くお返事します。</p><p style="margin-top:14px">データの取り扱いについては<a href="/privacy.html">プライバシーポリシー</a>と<a href="/terms.html">利用規約</a>をご覧ください。</p>`,
};

const sectionsHtml = (arr) => arr.map((s) => `${s.h ? `<h2>${esc(s.h)}</h2>` : ''}<p>${esc(s.p)}</p>`).join('\n');

function docBody(slug, lang) {
  if (slug === 'support') return `<h1 class="title">${T.support[lang]}</h1>${SUPPORT_BODY[lang]}`;
  const arr = slug === 'privacy' ? PRIVACY[lang] : TERMS[lang];
  return `<h1 class="title">${T[slug][lang]}</h1><p class="eff">${T.eff[lang]} ${LEGAL_EFFECTIVE}</p>${sectionsHtml(arr)}`;
}

function page(slug) {
  const langBlocks = LANGS.map((l) => `<div class="lang" data-lang="${l}"${l === 'en' ? '' : ' hidden'}>${docBody(slug, l)}</div>`).join('\n');
  const toggle = LANGS.map((l) => `<button data-l="${l}"${l === 'en' ? ' class="on"' : ''}>${LBL[l]}</button>`).join('');
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>drape — ${T[slug].en}</title>
<style>
@font-face{font-family:'Brand Didone';font-style:italic;font-weight:500;src:url('/fonts/bodoni-moda-italic.woff2') format('woff2');}
:root{--ink:#141312;--ivory:#F4F1EA;--mut:rgba(244,241,234,.6)}
*{box-sizing:border-box;margin:0}
html,body{background:var(--ink)}
body{color:var(--ivory);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans KR','Noto Sans JP',sans-serif;line-height:1.62;-webkit-font-smoothing:antialiased}
.wrap{max-width:720px;margin:0 auto;padding:60px 24px 100px}
.top{display:flex;align-items:center;justify-content:space-between}
.brand{font-family:'Brand Didone',serif;font-style:italic;font-size:32px;color:var(--ivory)}
.toggle button{background:none;border:1px solid rgba(244,241,234,.22);color:var(--mut);padding:5px 11px;border-radius:999px;font-size:12px;cursor:pointer;margin-left:6px}
.toggle button.on{color:var(--ink);background:var(--ivory);border-color:var(--ivory)}
.title{font-family:'Brand Didone',serif;font-style:italic;font-weight:500;font-size:42px;margin:44px 0 6px}
.eff{color:var(--mut);font-size:13px;margin-bottom:10px}
.lead{font-size:19px;color:var(--ivory);margin:0 0 10px}
h2{font-size:17px;font-weight:600;margin:28px 0 6px;color:var(--ivory)}
p{color:rgba(244,241,234,.82);font-size:15px;margin:0 0 6px}
a{color:var(--ivory);text-underline-offset:2px}
footer{margin-top:52px;padding-top:22px;border-top:1px solid rgba(244,241,234,.12);font-size:14px;color:var(--mut)}
footer a{color:var(--mut);margin-right:18px}
</style></head>
<body><div class="wrap">
<div class="top"><span class="brand">drape</span><div class="toggle">${toggle}</div></div>
${langBlocks}
<footer><a href="/support.html">Support</a><a href="/privacy.html">Privacy</a><a href="/terms.html">Terms</a><a href="mailto:${LEGAL_CONTACT}">${LEGAL_CONTACT}</a></footer>
</div>
<script>
document.querySelectorAll('.toggle button').forEach(function(b){b.onclick=function(){var l=b.dataset.l;document.querySelectorAll('.toggle button').forEach(function(x){x.classList.toggle('on',x===b)});document.querySelectorAll('.lang').forEach(function(s){s.hidden=s.dataset.lang!==l})}});
</script>
</body></html>`;
}

for (const slug of ['support', 'privacy', 'terms']) {
  writeFileSync(join(PUB, `${slug}.html`), page(slug));
  console.log('wrote public/' + slug + '.html');
}
