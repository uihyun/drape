# drape

> Digital closet · Virtual try-on · OOTD calendar · Lookbook SNS.
>
> Snap each piece you own → drape crops the garment cleanly and auto-tags it →
> Virtual try-on shows clothes on your body before you wear them → daily OOTD
> calendar + community feed.

drape's core differentiator is **virtual try-on quality**. Competitors (Lekondo) treat the closet as a log; drape mainly exists so you don't have to physically try anything on. The closet, calendar and SNS are the rails around that.

## ✨ Features (MVP)

- **Closet** — Snap each item; Drape crops the garment off any background and auto-tags it (category, color, season, style, fit). Registration is async — every new item lands as a skeleton card immediately so you keep shooting.
- **Virtual try-on** — Pick any item (or build a full outfit) and see it composited onto your own body. Identity refs (2–3 full-body photos) lock face, body and pose so the try-on doesn't morph you.
- **Outfit builder** — Combine items into named outfits.
- **OOTD calendar** — One tap to log today's outfit + optional selfie. Month-view lookbook.
- **Community feed** — Public outfits with follow, like, comment. Reports + automated SFW gating.
- **Languages** — English, Korean, lean Japanese fallback.

## 🛠 Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 18 + Vite + react-router-dom v7 |
| Mobile | Capacitor 7 (iOS + Android) |
| Backend | Firebase (Auth + Firestore + Storage + Cloud Functions v2 / Node 22) |
| AI — try-on / crop / hair-makeup (later) | Google Gemini **Nano Banana Pro** (`gemini-3-pro-image-preview`) + **Nano Banana 2** (`gemini-3-flash-image-preview`) for fast variants |
| AI — auto-tag (vision) | Gemini Flash structured-output |
| Billing | RevenueCat (iOS + Android IAP). Web Stripe lands later. |
| PWA | vite-plugin-pwa (web only — disabled inside Capacitor) |

## 📁 Project layout

```
drape/
├── src/
│   ├── App.jsx               # routing shell + auth + credits
│   ├── main.jsx              # PWA + native bootstrap
│   ├── firebase.js           # Firebase config (REPLACE_ME placeholders)
│   ├── components/           # Header, MobileTabBar, FeedCard, Onboarding…
│   ├── pages/                # Closet, AddItem, ItemDetail, OutfitList,
│   │                         # OutfitBuilder, OutfitDetail, OutfitShare,
│   │                         # Calendar, TryOn, GenerationDetail, Feed,
│   │                         # Settings, Privacy/Terms/Support
│   ├── services/             # client-side data layer
│   │   ├── taxonomy.js       # clothing tag vocab (single source of truth)
│   │   ├── item-service.js   # closet CRUD + async processing dispatch
│   │   ├── outfit-service.js
│   │   ├── ootd-service.js
│   │   ├── generation-service.js
│   │   ├── identity-service.js   # identity reference photos
│   │   ├── ai-service.js     # thin client wrapper + error logging
│   │   ├── auth-service.js   # Google / Apple sign-in
│   │   ├── credits-service.js
│   │   ├── billing-service.js (Stripe stub — server endpoint missing)
│   │   ├── follow / comment / profile / referral / revenuecat services
│   │   └── …
│   ├── locales/              # en / ko / ja
│   └── styles/               # main.css (base) + drape.css (components)
├── functions/                # Cloud Functions (Node 22)
│   ├── index.js              # helpers + re-exports
│   ├── items.js              # processItem callable
│   ├── tryon.js              # virtualTryOn callable
│   ├── taxonomy.js           # server mirror of the tag vocab
│   ├── moderation.js         # SFW gating + reports
│   ├── profile.js            # handle claims + counters
│   ├── account.js            # nuclear account deletion
│   ├── referral.js / promo.js
│   ├── revenuecat.js         # IAP webhook
│   └── follow/collection/comment-counter triggers
├── firestore.rules
├── firestore.indexes.json
├── storage.rules
├── capacitor.config.json
├── ROADMAP.md                # MVP → Phase 2 → Later
├── PROGRESS.md               # running log of what's done / in-flight / TODO
└── _archive/voda-docs/       # original voda product/branding docs (reference)
```

## 🚀 Local dev

```bash
# install
npm install
(cd functions && npm install)

# dev server (Vite, http://localhost:3000)
npm run dev

# Firebase emulators (auth + firestore + storage + functions) in a second terminal
firebase emulators:start
```

> First run will fail to talk to Firebase until you fill in `src/firebase.js` (or run against the emulators). See **Setup** below.

## 🔧 Setup

1. **Create a Firebase project**
   - Firebase Console → Add project → "drape" (id e.g. `drape-app`)
   - Add a web app → copy the SDK config → paste into `src/firebase.js`
   - Update `.firebaserc` with `{ "projects": { "default": "<your-project-id>" } }`
   - Add `VITE_FIREBASE_PROJECT_ID=<your-project-id>` to `.env` (used by `src/services/api-base.js` for HTTP function calls)
   - Enable: Authentication (Google + Apple), Firestore, Storage, Functions
2. **Provision the Gemini key**
   ```bash
   firebase functions:secrets:set GEMINI_API_KEY
   # paste the key when prompted
   ```
3. **Deploy rules + indexes + functions**
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes,storage,functions
   ```
4. **(Optional) RevenueCat** — create the iOS + Android apps, paste public keys into `.env`:
   ```
   VITE_REVENUECAT_PUBLIC_KEY_IOS=appl_...
   VITE_REVENUECAT_PUBLIC_KEY_ANDROID=goog_...
   ```
5. **iOS / Android** — when you're ready to build natively:
   ```bash
   npm run build && npx cap sync
   npm run cap:open:ios     # opens Xcode
   npm run cap:open:android # opens Android Studio
   ```
   Bundle id is `com.uihyun.drape`. Update the iOS team + Android signing config as usual.

## 🧪 Tests

```bash
npm run test:rules    # Firestore rules vs. emulator
npm run test:unit     # vitest run tests/
```

## 🚢 Deploy

```bash
npm run deploy            # build + firebase deploy (hosting + functions)
npm run deploy:hosting    # web only
npm run deploy:functions  # functions only
```

## 📚 Docs

- **[ROADMAP.md](ROADMAP.md)** — MVP / Phase 2 / Later, from the brief.
- **[PROGRESS.md](PROGRESS.md)** — what's done vs in-flight vs known gaps.
- **[drape-app-brief.md](drape-app-brief.md)** — original product brief (Korean).
- **`_archive/voda-docs/`** — the achelier (voda) product/branding/sprint docs that drape forked from. Reference only.

## 🧭 Working with Claude Code

This project was bootstrapped by copying achelier (voda) and substituting the closet/try-on/calendar/OOTD layer for the interior-design layer. The SNS plumbing (auth, credits, follows, comments, lookbooks, moderation, reports, RevenueCat) is largely the same. When evolving:

- The closed tag vocabulary in `src/services/taxonomy.js` and `functions/taxonomy.js` must stay in sync — the auto-tag function enforces enums against the server copy.
- The async registration pipeline is the most important UX invariant. Don't make `createItem` wait on the cropping/tagging work — the user must always feel like the camera is "free" between shots.
- Identity preservation in try-on is the single quality metric we obsess over. Don't strip identity refs from the prompt to save tokens; don't downgrade to Flash for the final saveable variant unless the user opts in.

## License

ISC.
