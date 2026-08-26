# SEO & AEO — drape

*Rewritten 2026-08-26 (was a stale copy of archelier's doc). Context: archelier
gets meaningful organic traffic via ChatGPT with zero marketing; drape should
inherit the same playbook. As of 2026-08-26 a `"drape.nyc"` web search returns
NOTHING — we are not indexed, while the "drape" name space is crowded with
direct competitors (drapeapp.app, drapedai.com, drapeai.app, drapetryon.com).*

## Why Bing matters — the AI-search channel

Bing's own share is small, but AI search uses its index:

| AI search | source |
|---|---|
| **ChatGPT** (web search) | **Bing API** |
| **Microsoft Copilot** | Bing |
| **DuckDuckGo** | partly Bing |
| **Perplexity** | own + partly Bing |
| Google Gemini | Google |

→ To be cited by ChatGPT/Copilot, drape.nyc must be in the Bing index.
This is what archelier's ChatGPT traffic runs on.

## What's live (shipped 2026-08-26 + earlier)

- `<title>` / description / keywords / canonical / Open Graph / Twitter Card /
  hreflang (x-default, en, ko, ja) — `index.html`.
- **JSON-LD** `@graph`: SoftwareApplication (featureList, free-tier `offers`,
  `installUrl` App Store + Play), Organization (`sameAs` → IG + stores),
  WebSite, **FAQPage (7 Q/A)**.
- **AEO fallback**: hidden `<main class="seo-only">` — what/how/privacy/FAQ/
  "drape vs other AI closet apps" prose for crawlers that don't run JS.
- `public/robots.txt` (Allow all, Disallow /__/, sitemap link).
- `public/sitemap.xml` — /, /landing, /get, /feed, support/privacy/terms.
- `public/llms.txt` — LLM-crawler summary (emerging convention; costs nothing).

## Registration status (verified 2026-08-26)

1. [x] **Google Search Console** — REGISTERED (verified via the
       `google-site-verification` TXT record on drape.nyc DNS). GA already
       shows a trickle of `bing / organic` (7 users in 30d) and
       `google / organic`.
2. [?] **Bing Webmaster Tools** — status unknown from here, but
       `site:drape.nyc` on Bing returns ZERO pages (checked 2026-08-26).
       Since ChatGPT search rides the Bing index, this is the gap between
       archelier's ChatGPT traffic and ours. Owner: open Bing Webmaster
       Tools and confirm drape.nyc is imported + sitemap listed; if not,
       "Import from Google Search Console" (one-shot import — future
       subdomains/sitemaps must be added to Bing manually).
3. **IndexNow** (done 2026-08-26): key file
       `public/51aba95749d1f22ca525c9e82873ab3e.txt` is live and all 7
       sitemap URLs were submitted to api.indexnow.org (HTTP 202). Bing/
       Copilot/Seznam consume IndexNow directly — this accelerates indexing
       independent of Webmaster Tools. Re-ping after adding major pages:
       `curl -X POST https://api.indexnow.org/indexnow -H 'Content-Type:
       application/json' -d '{"host":"drape.nyc","key":"51ab…3e",
       "keyLocation":"https://drape.nyc/51ab…3e.txt","urlList":[…]}'`
4. [ ] (after 1–2 weeks) re-check `site:drape.nyc` on Bing; then ask
       ChatGPT "what is drape.nyc?" — and watch GA for `chatgpt.com`
       referrals.

## Keyword reality check (2026-08-26)

"drape" alone is unwinnable short-term (crowded namespace). Rank instead on:
- brand+qualifier: `drape nyc`, `drape closet app`, `drape try-on`
- category long-tail: `virtual try-on with my own face`, `digital closet with
  ootd calendar`, `try on clothes before buying app`, `sell clothes closet
  app try on`
- The marketplace + try-on combination ("try it on before you DM the seller")
  is a phrase no competitor owns — use it in copy.

## Future levers (not started)

- Public outfit/profile pages (`/o/:id`, `/u/:handle`) have no per-page meta —
  a prerender/meta-function pass would turn real UGC into indexable pages
  (lekondo does this with its public ontology instead).
- App Store Optimization is a separate track (title/subtitle keywords) —
  revisit with the 1.5.1 store release.
- GA4: watch `session_source` for `chatgpt.com` / `perplexity.ai` referrals
  once indexed — that's the signal this file exists to produce.
