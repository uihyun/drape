# SEO & AEO — archelier

*Last Updated: 2026-05-08*

## 현재 구현 상태 (What's Live)

### 도메인 / 인프라
- **Canonical**: `https://archelier.co/` (Namecheap, Firebase Hosting)
- **HTTPS**: Let's Encrypt 자동 (Firebase)
- **PWA manifest**: `/manifest.json` — start_url, theme_color, icons
- **Service Worker**: vite-plugin-pwa 자동 (precache + runtime cache)

### 검증 / 모니터링
- [x] **Google Search Console** — DNS TXT 인증 ✓ + sitemap 제출 ✓ (2026-05-08)
- [x] **Bing Webmaster Tools** — Import from Google Search Console 으로 등록 ✓ (2026-05-08)
- [ ] Schema Validator — JSON-LD 검증
- [ ] PageSpeed Insights — Core Web Vitals 베이스라인

### 왜 Bing 도 등록하나 — AEO 채널
Bing 자체 검색 점유율 작지만 (~3% 글로벌) **AI 검색이 Bing index 를 source 로 사용**:
| AI 검색 | source |
|---|---|
| **ChatGPT** (web search) | **Bing API** (OpenAI ↔ Microsoft 파트너십) |
| **Microsoft Copilot** | Bing |
| **DuckDuckGo** | 일부 Bing |
| **Perplexity** | 자체 + Bing 일부 |
| Google Gemini | Google |

→ archelier 가 ChatGPT / Copilot 답변에 인용되려면 Bing 인덱싱 필수.

### Google → Bing import 의 한계 (잊지 말 것)
**Import 는 일회성**. import 시점의 sites + sitemap 만 복사. 이후 자동 sync 없음.
- ✅ sitemap.xml 안의 URL 변경 → Bing 자동 crawl 으로 따라감
- ❌ 새 site (e.g. `blog.archelier.co`) 추가 시 → Bing 에 **수동 추가 필요**
- ❌ 새 sitemap 파일 (e.g. `blog-sitemap.xml`) 추가 시 → Bing 에 **수동 등록 필요**

**actionable**: 새 sub-domain / 새 sitemap 추가할 때마다 Bing Webmaster Tools 도 같이 업데이트.

### 구조화 데이터 (`index.html` 의 `<script type="application/ld+json">`)
| 스키마 타입 | 위치 | 상태 |
|---|---|---|
| SoftwareApplication | `index.html` | ✅ |
| Organization | `index.html` | ✅ |
| WebSite | `index.html` | ✅ |
| FAQPage (7 Q/A) | `index.html` | ✅ |

### 메타 태그
- `<title>`, `<meta description>`, keywords ✅
- Open Graph (`og:title`, `og:description`, `og:type`, `og:url`, `og:site_name`, `og:image`, `og:locale` + alternates) ✅
- Twitter Card (`summary_large_image`) ✅
- Canonical URL ✅
- Geo (US-NY) + target-markets (US, KR, JP) ✅
- Hreflang (x-default, en, ko, ja — 같은 URL, JS 으로 lang detect) ✅

### Crawler 설정
- `public/robots.txt` ✅ (Allow: /, Disallow: /__/, Sitemap link)
- `public/sitemap.xml` ✅ (7 URLs: /, /feed, /pricing, /support, /invite, /privacy, /terms)

### AEO (Answer Engine Optimization)
- **`index.html` 의 `<main class="seo-only">`** — visually hidden 이지만 crawler 가 보는 fallback
- 커버하는 질문:
  - "What is archelier?"
  - "How does archelier work?"
  - "Is archelier free?"
  - "Do I need a 3D model or floor plan?"
  - "Can I match a reference photo's style?"
  - "Can I edit only one part of the result?"
  - "Is archelier on iPhone / Android?"
  - "archelier vs other AI interior tools"

---

## 키워드 전략

### 메인 키워드
- `AI interior design`
- `AI room redesign`
- `AI home staging`
- `virtual home staging AI`
- `photo to room design`
- `archelier`

### 보조 키워드
- `AI exterior design`
- `AI garden design`
- `floor plan to render AI`
- `sketch to interior render`
- `3D model to interior`
- `reference style interior AI`
- `layout rearrangement AI`
- `before after room AI`

### 한국 / 일본 ASO 보조
- `공간담`, `AI 인테리어`, `AI 인테리어 디자인`
- `空間師`, `AIインテリア`

### 롱테일
- "turn a photo into a redesigned room"
- "AI that staged my empty apartment"
- "match a Pinterest photo's interior style"
- "edit just the sofa in my AI render"

---

## 기술 SEO 체크리스트

### 인프라
- [x] HTTPS (Firebase auto)
- [x] PWA manifest + Service Worker
- [x] robots.txt
- [x] sitemap.xml
- [x] Canonical URL
- [x] Mobile responsive (existing)

### 콘텐츠 / 메타
- [x] H1 in seo-only fallback
- [x] image alt 텍스트 (앱 내 디자인 카드 alt)
- [x] FAQ 구조화 데이터
- [ ] 블로그 / 콘텐츠 허브 (없음 — SPA only. 추후)
- [ ] 사례 / Success Stories 페이지 (없음)

### Performance
- [ ] PageSpeed Insights 점검
- [ ] LCP / FID / CLS 베이스라인
- [ ] 이미지 lazy-load (FeedCard 이미 적용)
- [ ] vendor chunk splitting (manualChunks 검토 — index.js 가 250KB 넘음)

---

## 미완료 / 추가 가능 최적화

### P0 (출시 직후)
1. **Google Search Console 설정** — DNS TXT 인증 + sitemap 제출
2. **og:image 전용 이미지** (1200×630) — 현재 icon-512.webp 사용 중 (정사각). Twitter / Facebook 미리보기 최적화 안 됨
3. **Privacy Policy / Terms 의 SEO** — 현재 정적 페이지. canonical / meta 추가
4. **AEO content 한·일 번역** — 현재 EN 만. SPA 라 lang 별 separate URL 어려움. fallback content 만 EN

### P1 (콘텐츠 허브)
1. **블로그 / Tips 섹션** — "How to stage a small bedroom with AI", "5 AI design styles for kids' rooms" 같은 long-form
2. **경쟁사 비교 페이지** — `/alternative/{competitor}` 라우트 신설:
   - Decor8 alternative
   - Reroom alternative
   - Reimagine Home alternative
   - 각 페이지 별도 SoftwareApplication schema + 비교 표
3. **Local landing pages** — `/cities/nyc`, `/cities/seoul`, `/cities/tokyo` 등 — 지역 + 인테리어 결합 검색 (단 글로벌 brand 라 우선순위 낮음)

### P2 (장기)
1. **백링크** — Product Hunt, Hacker News, Reddit (r/InteriorDesign), Dev.to, AlternativeTo 등록
2. **Google Business** — NYC 거주자 / 에이전시로 등록 검토
3. **YouTube SEO** — 사용 튜토리얼 (How to use reference style / How to brush-edit)
4. **AI 학습 데이터 제출** — Common Crawl, OpenAI / Anthropic 의 web 데이터셋

---

## 모니터링 체계

### 확인할 곳
- [Google Search Console](https://search.google.com/search-console) — 노출 / CTR / 순위
- [Schema Validator](https://validator.schema.org/) — JSON-LD 검증
- [PageSpeed Insights](https://pagespeed.web.dev/) — Core Web Vitals
- [Open Graph debugger](https://www.opengraph.xyz/) — 미리보기 검증

### 주요 지표
1. **오가닉 트래픽** — archelier.co 직접 방문 / 검색 도달
2. **키워드 순위** — 메인 키워드 Top 10 진입
3. **AEO 노출** — ChatGPT / Gemini / Perplexity 가 archelier 인용
4. **CTR** — SERP 클릭률
5. **Core Web Vitals** — LCP < 2.5s, FID < 100ms, CLS < 0.1

### 주기별 체크
**주간**
- [ ] Search Console 인덱싱 상태
- [ ] 새 콘텐츠 sitemap 반영

**월간**
- [ ] Featured Snippet 성과
- [ ] 경쟁사 (Decor8 / Reroom 등) 순위 비교
- [ ] AEO 검색 — "AI interior design app" + "best AI room redesign" 등 query

**분기**
- [ ] Technical SEO 감사
- [ ] 블로그 콘텐츠 plan
- [ ] 키워드 expansion

---

## 트러블슈팅

### 인덱싱 안 될 때
1. `robots.txt` 확인 — `Allow: /` 정상
2. `sitemap.xml` 접근 가능한지 — `curl https://archelier.co/sitemap.xml`
3. Search Console 의 "URL inspection" 으로 수동 인덱싱 요청
4. SPA 라 JS render 필요 — Google bot 은 JS 처리 OK. AI crawler 는 `<main class="seo-only">` fallback 으로 SEO 콘텐츠 받음

### Schema 깨질 때
- [Schema Validator](https://validator.schema.org/) 에 archelier.co 입력
- JSON-LD syntax error 또는 required field 누락 확인

### og:image 미리보기 안 보일 때
- Facebook / Twitter / LinkedIn 의 debugger 로 cache 비우기:
  - https://developers.facebook.com/tools/debug/
  - https://cards-dev.twitter.com/validator
  - https://www.linkedin.com/post-inspector/
