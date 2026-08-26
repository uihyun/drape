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

## OWNER TODO — the step code can't do (same 10-min flow as archelier 5/8)

1. [ ] **Google Search Console**: add property `drape.nyc` (DNS TXT at
       Namecheap), submit `https://drape.nyc/sitemap.xml`.
2. [ ] **Bing Webmaster Tools**: "Import from Google Search Console" right
       after. REMEMBER: the import is one-shot — future new subdomains or
       sitemap files must be added to Bing manually.
3. [ ] (after 1–2 weeks) check `site:drape.nyc` on Google AND Bing; then ask
       ChatGPT "what is drape.nyc?" to see if the index reaches it.

Without step 1–2 nothing else in this file produces traffic — archelier had
this done on 2026-05-08 and that's the difference today.

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
