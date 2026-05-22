# App Store screenshot assets

## Sources

- `screenshots-6.7-en/` — raw iPhone captures (1290×2796), no marketing text.

## Marketing variants

Three styles were prototyped from the same 6 captures. Build scripts live in
`scripts/build-app-store-screenshots*.cjs` — each variant is reproducible.

| Variant | Folder | Tone | Notes |
|---|---|---|---|
| A | `screenshots-6.7-en-marketing-a/` | Quiet atelier — beige bg, 96pt serif headline, small terracotta dot | Brand-faithful but reads small at thumbnail size |
| **B (selected)** | `screenshots-6.7-en-marketing-b/` | Loud dark — charcoal bg, 124pt all-caps sans, terracotta bar, larger shot | Highest contrast / strongest in search results |
| C | `screenshots-6.7-en-marketing-c/` | Hybrid — cover (slide 1) hero with cropped before/after + italic serif; remainder identical to A | Compromise between editorial and impact |

## Upload

App Store Connect → archelier → App Store → 1.0.x → Screenshots (6.7" Display) →
upload the 6 files from the **B folder** in numeric order.

Localized variants (KR / JA) not yet generated; the iOS App Store accepts
English-only screenshots and renders them across locales unless overridden.
