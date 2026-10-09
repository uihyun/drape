// === Stylist ===========================================================
// SPEC-1.6 §B/§D: per-user style profile (compressed taste summary) + the
// persona-fronted outfit recommender. Text-only gemini-3.8-flash — the third
// sanctioned Gemini call site (items.js = images/tagging, tryon.js = try-on;
// CLAUDE.md updated 2026-09-08). No image generation here, ever.
//
// Economics: every call here is priced in credits (functions/credits.js) —
// one credit per chat message, verdict or recommendation, out of the same
// wallet a try-on spends ten from.

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { reserveCredits, refundCredits, PRICE } = require('./credits.js');

const geminiApiKey = defineSecret('GEMINI_API_KEY');
const { getModels } = require('./model-config.js');
const MODEL = 'gemini-3.8-flash';   // default; overridable via config/models

const PROFILE_TTL_MS = 12 * 60 * 60 * 1000; // refresh profile at most 2x/day
const MAX_ITEMS = 150;          // inventory digest cap fed to the model

// Personal color is STATED by the user (usually from a paid consultation) —
// never read off a photo, where lighting moves undertone more than the gap
// between seasons. It steers what sits near the face; it is not a ban, so it
// rides alongside the stated prefs instead of joining avoidColors.
const PERSONAL_COLOR_GUIDE = {
  spring: 'warm, clear and light — coral, peach, warm beige, light camel, ivory',
  summer: 'cool, soft and light — dusty pink, lavender, soft navy, grey-blue, off-white',
  autumn: 'warm, muted and deep — camel, olive, rust, mustard, chocolate brown',
  winter: 'cool, clear and high-contrast — black, pure white, navy, jewel tones',
};
function personalColorLine(stated) {
  const guide = PERSONAL_COLOR_GUIDE[stated?.personalColor];
  if (!guide) return '';
  return `PERSONAL COLOR: they are a "${stated.personalColor}" (${guide}). Prefer these for what sits near the face — tops, outerwear, scarves. Off-season colors are fine away from the face (bottoms, shoes, bags); this is a preference, not a ban — only avoidColors is a hard rule.`;
}

// Personas are PROMPT LENSES, not people. Client renders them as illustrated,
// explicitly-AI characters (house rule: no photoreal synthetic humans).
// Four stylists, one closet, four visibly different answers. A "styling lens"
// alone does not get there: it sits as one line at the top of a prompt that then
// supplies the user's taste profile, stated preferences (marked *authoritative*),
// thumbs history and avoid-list — all far more specific, all pulling every
// persona toward the same safe pick.
//
// So each persona carries four things, and each does different work:
//   lens      — what they reach for
//   signature — one MECHANICAL rule that changes which items get picked. This is
//               what makes the outfits differ rather than just the wording.
//   refuses   — what they will not use. The refusals separate them more than the
//               preferences do, because they remove options the others would take.
//   voice     — how `title` and `why` read. The user experiences the persona
//               almost entirely through that one sentence, so leaving it at
//               "in your voice" (as it was) produced four identical narrators.
const PERSONAS = {
  noa: {
    name: 'Noa',
    lens: 'minimal & classic: restrained palettes, clean silhouettes, long-lived pieces, quiet luxury.',
    signature: 'Choose ONE excellent piece to carry the outfit and let everything else recede around it. Never more than three colours in a look.',
    refuses: 'logos, busy prints, anything bought for a trend, and any fourth colour.',
    voice: 'Calm and declarative. Short sentences. You talk about proportion, fabric quality and what will still look right in five years. You never exclaim, never use slang, and never oversell.',
    titles: 'plain and understated, naming the thing that carries the look — "The good coat", "Grey on grey", "One navy note".',
    example: 'The trousers do the work here; everything else stays quiet so they can.',
  },
  remy: {
    name: 'Remy',
    lens: 'street & casual: proportion play, oversized over fitted, layering, sneakers-first thinking.',
    signature: 'Pick the footwear FIRST and build the outfit upward from it. Exactly one loud element per look — if there are two, cut one.',
    refuses: 'tailoring, dress shoes, delicate or precious fabrics, and anything that reads formal.',
    voice: 'Clipped and confident, like a friend who is already out the door. Contractions, fragments, no filler. You point at one thing and move on.',
    titles: 'short and punchy, often naming the shoe or the silhouette — "Dunks first", "Big tee, small bag", "All slouch".',
    example: 'Start at the sneakers, let the jeans stack on them, keep the top boring on purpose.',
  },
  sol: {
    name: 'Sol',
    lens: 'romantic & soft: colour harmony, gentle textures, seasonal mood, dresses and knits.',
    signature: 'Choose for how the fabric moves, and always add the one small accessory nobody else would bother with.',
    refuses: 'all-black looks, sportswear, hard streetwear silhouettes, and anything stiff.',
    voice: 'Warm and sensory. You name how something falls, catches light or feels — ONE such image, not three. Unhurried but never florid.',
    titles: 'evocative and atmospheric — "Soft morning", "Linen and gold", "The last warm week".',
    example: 'The knit moves when you do, and the little gold chain keeps it from feeling like pyjamas.',
  },
  juno: {
    name: 'Juno',
    lens: 'bold & experimental: unexpected pairings, colour blocking, clashing texture, fashion-forward risk.',
    signature: 'Build around the piece this user has been ignoring, and force exactly one clash — of colour, texture or formality — that the others would smooth out.',
    refuses: 'the safe obvious combination. If a look could plausibly have come from any of the other three stylists, discard it and pick again.',
    voice: 'Provocative and playful. You dare the user. Short. The dare is always affectionate — you are excited on their behalf, never sneering at them, their body, or the clothes they own.',
    titles: 'provocations, not descriptions — "Wear the red one", "Clash on purpose", "Yes, with the boots".',
    example: "You've never worn this jacket with anything soft. That's exactly why it works.",
  },
};

// "YYYY-MM-DD" in the user's timezone — same convention as fits.js.
function dayKey(tz) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
  }
}

// Every locale the client can send must be here. es/fr were once added to the
// accepted list without being added to this map, so those users got a prompt
// reading "in undefined" and silently fell back to English. One function now,
// so a new caller can't reintroduce that.
const LANG_NAMES = {
  en: 'English', ko: 'Korean', ja: 'Japanese', es: 'Spanish', fr: 'French',
};
function langLabel(lang) { return LANG_NAMES[lang] || 'English'; }

function db() { return admin.firestore(); }

// Compact one-line-per-item inventory the model can reference by id.
async function loadInventory(uid) {
  const snap = await db().collection('items')
    .where('userId', '==', uid)
    .orderBy('createdAt', 'desc')
    .limit(MAX_ITEMS)
    .get();
  const items = [];
  snap.forEach((d) => {
    const x = d.data();
    const t = x.tags || {};
    items.push({
      id: d.id,
      name: x.name || '',
      category: t.category || '',
      subcategory: t.subcategory || '',
      colors: Array.isArray(t.colors) ? t.colors.slice(0, 3) : [],
      styles: Array.isArray(t.styles) ? t.styles.slice(0, 3) : [],
      seasons: Array.isArray(t.seasons) ? t.seasons : [],
      kind: x.kind === 'wishlist' ? 'wishlist' : 'owned',
    });
  });
  return items;
}

// Model output → outfits we can render: only ids from THIS closet (a
// hallucinated id would be a broken card), at most one wishlist piece, 2–6
// pieces each. Shared by the one-shot recommender and the chat.
function cleanOutfits(raw, inventory, max) {
  const byId = new Map(inventory.map((i) => [i.id, i]));
  return (Array.isArray(raw) ? raw : [])
    .map((o) => {
      const ids = [...new Set(Array.isArray(o?.itemIds) ? o.itemIds : [])].filter((id) => byId.has(id));
      let wishlistUsed = 0;
      const kept = ids.filter((id) => {
        if (byId.get(id).kind !== 'wishlist') return true;
        return ++wishlistUsed <= 1;
      });
      return {
        title: String(o?.title || '').slice(0, 80),
        itemIds: kept.slice(0, 6),
        why: String(o?.why || '').slice(0, 300),
        confidence: Math.max(0, Math.min(1, Number(o?.confidence) || 0.5)),
      };
    })
    .filter((o) => o.itemIds.length >= 2)
    .slice(0, max);
}

// ── Style profile (SPEC-1.6 §B) ─────────────────────────────────────────
// users/{uid}/private/styleProfile — server-written compressed taste
// portrait. Incremental on purpose: prompt = previous summary + deltas, so
// cost stays flat as history grows. Refreshed lazily from styleRecommend
// when stale; safe to call concurrently (last write wins, content converges).
async function ensureStyleProfile(uid, genAI, { force = false } = {}) {
  const ref = db().collection('users').doc(uid).collection('private').doc('styleProfile');
  const snap = await ref.get();
  const prev = snap.exists ? snap.data() : null;
  const fresh = prev?.updatedAt?.toMillis && (Date.now() - prev.updatedAt.toMillis() < PROFILE_TTL_MS);
  if (fresh && !force) return prev;

  // Past the TTL, only pay for a re-summary if the inputs actually moved.
  // The TTL alone regenerated identical text for users who added nothing
  // (owner, 2026-09-16) — a wasted model call on every stylist run.
  if (prev && !force) {
    // New closet pieces OR new outfits/OOTDs count: "how you've been
    // dressing" is mostly read off what they log, not what they own.
    const [latest, latestLook] = await Promise.all([
      db().collection('items').where('userId', '==', uid).orderBy('createdAt', 'desc').limit(1).get(),
      db().collection('outfits').where('userId', '==', uid).orderBy('createdAt', 'desc').limit(1).get(),
    ]);
    const msOf = (snap) => (snap.empty ? 0 : (snap.docs[0].data().createdAt?.toMillis?.() || 0));
    const lastItemMs = Math.max(msOf(latest), msOf(latestLook));
    const builtMs = prev.updatedAt?.toMillis?.() || 0;
    if (lastItemMs && lastItemMs < builtMs) {
      // Nothing new in the closet since the summary was written. Touch the
      // timestamp so the check doesn't re-run on every call this TTL.
      await ref.set({ updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      return prev;
    }
  }

  const [inventory, gensSnap, outfitsSnap, profSnap] = await Promise.all([
    loadInventory(uid),
    db().collection('generations').where('userId', '==', uid)
      .orderBy('createdAt', 'desc').limit(50).get(),
    db().collection('outfits').where('userId', '==', uid)
      .orderBy('createdAt', 'desc').limit(30).get(),
    db().collection('profiles').doc(uid).get(),
  ]);

  const tryons = [];
  gensSnap.forEach((d) => {
    const x = d.data();
    tryons.push({
      feedback: x.feedback || (x.liked ? 'up' : null),
      items: (x.itemIds || []).length,
      style: Array.isArray(x.style) ? x.style.slice(0, 2).map((s) => s.label) : [],
    });
  });
  const looks = [];
  outfitsSnap.forEach((d) => {
    const x = d.data();
    looks.push({
      styles: Array.isArray(x.style) ? x.style.filter((s) => s.level >= 4).map((s) => s.label) : [],
      colors: Array.isArray(x.palette) ? x.palette.slice(0, 2).map((p) => p.name) : [],
      pieces: Array.isArray(x.pieces) ? x.pieces.slice(0, 5).map((p) => p.name || p.category).filter(Boolean) : [],
      isOotd: !!x.date,
      date: x.date || null,
      tempC: x.weather?.meanC != null ? Math.round(x.weather.meanC) : null,
    });
  });
  // Stated preferences beat inferred ones — the user said so explicitly.
  const stated = (profSnap.exists && profSnap.data().stylePrefs) || null;

  const model = genAI.getGenerativeModel({
    model: (await getModels()).vision,
    generationConfig: { responseMimeType: 'application/json' },
  });
  const prompt = [
    'You maintain a compact style profile for a fashion app user. Update it from the data below.',
    'Return JSON: {"summary": string (max 1500 chars, 3rd person, concrete: silhouettes, colors, moods they gravitate to and avoid; note owned-vs-wishlist gaps), "topStyles": string[] (max 5), "topColors": string[] (max 5), "avoidList": string[] (max 5)}.',
    'Weigh signals: stated preferences (highest), thumbs on try-ons, what they log as daily outfits, then closet composition.',
    prev?.summary ? `PREVIOUS SUMMARY:\n${prev.summary}` : 'PREVIOUS SUMMARY: (none — first build)',
    stated ? `STATED PREFERENCES (authoritative): ${JSON.stringify(stated).slice(0, 1200)}` : '',
    `CLOSET (${inventory.length} items): ${JSON.stringify(inventory.map(({ id, ...rest }) => rest)).slice(0, 6000)}`,
    `RECENT TRY-ONS: ${JSON.stringify(tryons).slice(0, 2000)}`,
    `RECENT LOOKS/OOTDS: ${JSON.stringify(looks).slice(0, 2000)}`,
  ].filter(Boolean).join('\n\n');

  let parsed;
  try {
    const res = await model.generateContent(prompt);
    parsed = JSON.parse(res.response.text());
  } catch (e) {
    // Profile refresh must never block a recommendation — stale beats broken.
    console.warn('styleProfile refresh failed', uid, e?.message);
    return prev;
  }
  const doc = {
    summary: typeof parsed.summary === 'string' ? parsed.summary.slice(0, 2000) : (prev?.summary || ''),
    topStyles: Array.isArray(parsed.topStyles) ? parsed.topStyles.slice(0, 5).map(String) : [],
    topColors: Array.isArray(parsed.topColors) ? parsed.topColors.slice(0, 5).map(String) : [],
    avoidList: Array.isArray(parsed.avoidList) ? parsed.avoidList.slice(0, 5).map(String) : [],
    rev: (prev?.rev || 0) + 1,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  await ref.set(doc, { merge: true });
  return doc;
}

// One credit per stylist call. A thin wrapper so every call site charges and
// refunds the same way; the wallet rules live in credits.js.
function reserveStylistUse(uid, cost) {
  return db().runTransaction((txn) => reserveCredits(txn, uid, cost));
}
const refundStylistUse = refundCredits;

// What older app builds read off a response. `charged: 'credits'` matches none
// of their branches, so they show no quota line instead of a wrong one.
function quotaReply(res) {
  return { remaining: res.left, charged: 'credits', extra: 0, bought: 0, creditsLeft: res.left };
}


// ── The recommender (SPEC-1.6 §D) ───────────────────────────────────────
// ── "Would this suit me?" (§D companion) ───────────────────────────────
// styleRecommend answers "what should I wear" from MY closet. This answers a
// different question you can only ask about SOMEONE ELSE'S outfit: does this
// look suit me. Try-on already shows how it would look; this says whether it
// is your kind of thing — description vs judgement, and the judgement is the
// half the app could not give.
//
// Cached per (outfit, viewer, persona): the inputs barely move, and a verdict
// that changes every time you reopen the same look reads as noise rather than
// an opinion. Re-reading is free; only the first ask spends quota.
const VERDICT_MAX_WORDS = 26;

exports.styleVerdict = onCall(
  { secrets: [geminiApiKey], cors: true, timeoutSeconds: 60, memory: '512MiB' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'AUTH_REQUIRED');
    if (request.auth.token?.firebase?.sign_in_provider === 'anonymous') {
      throw new HttpsError('permission-denied', 'SIGN_IN_REQUIRED');
    }
    const outfitId = String(request.data?.outfitId || '').slice(0, 128);
    if (!outfitId) throw new HttpsError('invalid-argument', 'NO_OUTFIT');
    const personaKey = PERSONAS[request.data?.persona] ? request.data.persona : 'noa';
    const persona = PERSONAS[personaKey];
    const lang = Object.keys(LANG_NAMES).includes(request.data?.lang) ? request.data.lang : 'en';

    const outfitRef = db().collection('outfits').doc(outfitId);
    const outfitSnap = await outfitRef.get();
    if (!outfitSnap.exists) throw new HttpsError('not-found', 'NO_OUTFIT');
    const outfit = outfitSnap.data();
    // Mirrors the read rule rather than trusting the client: a verdict on a
    // private look would leak its contents to someone who cannot open it.
    const visible = outfit.isPublic === true || outfit.isListed === true || outfit.userId === uid;
    if (!visible) throw new HttpsError('permission-denied', 'NOT_VISIBLE');
    if (outfit.userId === uid) throw new HttpsError('failed-precondition', 'OWN_OUTFIT');

    const cacheRef = outfitRef.collection('verdicts').doc(`${uid}_${personaKey}_${lang}`);
    const cached = await cacheRef.get();
    if (cached.exists) return { ...cached.data(), cached: true };

    const res = await reserveStylistUse(uid, PRICE.verdict);
    const genAI = new GoogleGenerativeAI(geminiApiKey.value());
    let profile;
    try {
      profile = await ensureStyleProfile(uid, genAI);
    } catch (e) {
      await refundStylistUse(uid, res);
      throw e;
    }
    const profSnap = await db().collection('profiles').doc(uid).get();
    const stated = (profSnap.exists && profSnap.data().stylePrefs) || null;

    // What the look IS, in words. No photo — this is the text model, and the
    // outfit already carries the analysis the owner paid for.
    const look = {
      mood: outfit.mood || '',
      palette: (outfit.palette || []).slice(0, 5),
      styles: (outfit.styles || []).slice(0, 5),
      pieces: (outfit.pieces || outfit.detectedItems || [])
        .slice(0, 8)
        .map((x) => ({ name: x.name || x.label || '', category: x.category || '' })),
      notes: (outfit.notes || '').slice(0, 400),
    };

    const langName = langLabel(lang);
    const model = genAI.getGenerativeModel({
      model: (await getModels()).vision,
      generationConfig: { responseMimeType: 'application/json' },
    });
    const prompt = [
      `You are ${persona.name}, a personal fashion stylist inside the drape app.`,
      `LENS: ${persona.lens}`,
      `YOU REFUSE: ${persona.refuses}`,
      `VOICE: ${persona.voice}`,
      `Example of your voice: "${persona.example}"`,
      'Someone is looking at SOMEONE ELSE\'S outfit and wants to know whether it suits THEM.',
      'Judge the look against this person\'s taste — not against your own preferences, and not against whether the look is good in the abstract. A beautiful outfit that is wrong for them is a "no".',
      `Return JSON: {"fit": number 0-1, "verdict": string, "why": string}`,
      `- "verdict" is 2-4 words in ${langName}, your call: e.g. the equivalent of "Yes, this is you" / "Close, but heavy" / "Not your shape".`,
      `- "why" is ONE sentence in ${langName}, HARD LIMIT ${VERDICT_MAX_WORDS} WORDS, in YOUR voice. Name the specific thing about THEM that decides it — a colour they never wear, a silhouette they always reach for. Never generic praise.`,
      '- Be honest. If it does not suit them, say so plainly and kindly; a stylist who says yes to everything is useless.',
      '- Never disparage the person, their body, or their wardrobe.',
      profile?.summary ? `THEIR STYLE PROFILE:\n${profile.summary}` : '',
      stated ? `THEIR STATED PREFERENCES (authoritative — never contradict these): ${JSON.stringify(stated).slice(0, 800)}` : '',
      personalColorLine(stated),
      `THE OUTFIT THEY ARE LOOKING AT: ${JSON.stringify(look)}`,
      `STAY IN CHARACTER: you are ${persona.name}. Another stylist should reach a different call and say it differently.`,
    ].filter(Boolean).join('\n\n');

    let parsed;
    try {
      const res = await model.generateContent(prompt);
      parsed = JSON.parse(res.response.text());
    } catch (e) {
      await refundStylistUse(uid, res);
      console.error('styleVerdict failed:', e?.message);
      throw new HttpsError('internal', 'VERDICT_FAILED');
    }
    const out = {
      persona: personaKey,
      fit: Math.max(0, Math.min(1, Number(parsed.fit) || 0)),
      verdict: String(parsed.verdict || '').slice(0, 60),
      why: String(parsed.why || '').slice(0, 300),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await cacheRef.set(out);
    return {
      ...out, createdAt: null, cached: false,
      ...quotaReply(res),
    };
  },
);

exports.styleRecommend = onCall(
  { secrets: [geminiApiKey], cors: true, timeoutSeconds: 60, memory: '512MiB' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'AUTH_REQUIRED');
    if (request.auth.token?.firebase?.sign_in_provider === 'anonymous') {
      throw new HttpsError('permission-denied', 'SIGN_IN_REQUIRED');
    }
    const personaKey = PERSONAS[request.data?.persona] ? request.data.persona : 'noa';
    const persona = PERSONAS[personaKey];
    const ask = typeof request.data?.ask === 'string' ? request.data.ask.slice(0, 200) : '';
    const lang = ['en', 'ko', 'ja', 'es', 'fr'].includes(request.data?.lang) ? request.data.lang : 'en';

    // Stated prefs are read FRESH each call (not just via the profile
    // summary, which refreshes at most 2×/day) — an edit in Settings must
    // change the very next recommendation.
    const [inventory, profDoc, recentGens, recentRecs] = await Promise.all([
      loadInventory(uid),
      db().collection('profiles').doc(uid).get(),
      // Thumbs are read FRESH here, not just through the 12-hour profile
      // summary: a 👎 must change the very next recommendation, or rating
      // feels like it does nothing (owner, 2026-09-16).
      db().collection('generations').where('userId', '==', uid)
        .orderBy('createdAt', 'desc').limit(30).get(),
      // What this stylist proposed recently — a small closet otherwise gets
      // the same three outfits every time, which reads as a broken feature
      // rather than a limited wardrobe (owner, 2026-09-16).
      // Variety input only — if this read fails (index still building, quota
      // blip) the recommendation must still go out. Never let a nice-to-have
      // query take down the feature.
      db().collection('stylistRecs').where('userId', '==', uid)
        .orderBy('createdAt', 'desc').limit(4).get()
        .catch((e) => { console.warn('recentRecs read skipped:', e?.message); return { forEach: () => {} }; }),
    ]);
    const stated = (profDoc.exists && profDoc.data().stylePrefs) || null;
    const alreadyProposed = [];
    recentRecs.forEach((d) => {
      (d.data().outfits || []).forEach((o) => {
        if (Array.isArray(o.itemIds) && o.itemIds.length) alreadyProposed.push(o.itemIds);
      });
    });
    const loved = [];
    const disliked = [];
    recentGens.forEach((d) => {
      const g = d.data();
      const verdict = g.feedback || (g.liked ? 'up' : null);
      if (!verdict) return;
      const ids = (Array.isArray(g.itemIds) ? g.itemIds : []).slice(0, 4);
      if (!ids.length) return;
      (verdict === 'up' ? loved : disliked).push(ids);
    });
    if (inventory.filter((i) => i.kind === 'owned').length < 3) {
      throw new HttpsError('failed-precondition', 'closet_too_small');
    }

    const res = await reserveStylistUse(uid, PRICE.rec);
    const genAI = new GoogleGenerativeAI(geminiApiKey.value());
    let profile;
    try {
      profile = await ensureStyleProfile(uid, genAI);
    } catch (e) {
      await refundStylistUse(uid, res);
      throw e;
    }

    const model = genAI.getGenerativeModel({
      model: (await getModels()).vision,
      generationConfig: { responseMimeType: 'application/json' },
    });
    const langName = langLabel(lang);
    const prompt = [
      `You are ${persona.name}, a personal fashion stylist inside the drape app.`,
      `LENS: ${persona.lens}`,
      `SIGNATURE (apply to every outfit — this is what makes your picks yours): ${persona.signature}`,
      `YOU REFUSE: ${persona.refuses}`,
      `VOICE: ${persona.voice}`,
      `TITLE STYLE: ${persona.titles}`,
      `Example of a "why" in your voice: "${persona.example}"`,
      `Build outfits ONLY from the user's closet below, referencing items by their exact "id". Rules:`,
      '- 2 to 3 outfits, each with 2-6 item ids that form ONE wearable look (no two of the same slot unless layering makes sense).',
      '- Prefer owned items; you may include AT MOST ONE wishlist item per outfit and only when it completes the look.',
      `- "title" and "why" in ${langName}, written in YOUR voice and title style, not a neutral one.`,
      // The word cap needs to be stated as a countable constraint and repeated;
      // phrased once as "keep it short" the model wrote 30-word sentences that
      // ran to four lines on the card.
      '- "why" is ONE sentence, HARD LIMIT 18 WORDS. Count the words before you answer; if it is longer, cut it, do not reword it. It is read on a phone card — a 30-word sentence fails there even when it is beautiful.',
      '- "why" says why THIS combination works on THIS person. Never restate the item names, and never write a sentence any of the other three stylists could have written.',
      '- Never disparage the user, their body, or anything in their closet. You may be surprising; you may not be unkind.',
      'Return JSON: {"outfits":[{"title":string,"itemIds":string[],"why":string,"confidence":number 0-1}]}',
      profile?.summary ? `USER STYLE PROFILE:\n${profile.summary}` : '',
      stated ? `STATED PREFERENCES (authoritative — never contradict these): ${JSON.stringify(stated).slice(0, 800)}` : '',
      personalColorLine(stated),
      // Restated at the end because the lens is one line at the top of a long
      // prompt and the taste blocks below it are far more specific. Without
      // this, four stylists converge on the same safe outfit.
      `STAY IN CHARACTER: you are ${persona.name}. Within the user's stated preferences, both the outfits and the writing must be recognisably YOURS — another stylist given this same closet should reach a visibly different answer and describe it in a different voice. Apply your signature, honour your refusals, and keep every "why" under 18 words.`,
      loved.length ? `THEY RATED THESE COMBINATIONS 👍 (item ids — lean into what these share): ${JSON.stringify(loved.slice(0, 6))}` : '',
      disliked.length ? `THEY RATED THESE 👎 (do NOT repeat these combinations or their defining traits): ${JSON.stringify(disliked.slice(0, 6))}` : '',
      alreadyProposed.length
        ? `ALREADY PROPOSED RECENTLY — offer something different: ${JSON.stringify(alreadyProposed.slice(0, 9))}. Reuse individual pieces freely (that is what a closet is for), but the COMBINATION and the angle should feel new. If the closet is too small for a genuinely new combination, say so in "why" rather than repeating a look silently.`
        : '',
      profile?.avoidList?.length ? `AVOID: ${profile.avoidList.join(', ')}` : '',
      ask ? `USER REQUEST: ${ask}` : 'USER REQUEST: (none — style for a normal day this season)',
      `CLOSET: ${JSON.stringify(inventory).slice(0, 8000)}`,
    ].filter(Boolean).join('\n\n');

    let parsed;
    try {
      const res = await model.generateContent(prompt);
      parsed = JSON.parse(res.response.text());
    } catch (e) {
      await refundStylistUse(uid, res); // produced nothing → give it back
      throw new HttpsError('internal', 'STYLIST_FAILED', e?.message);
    }

    // Closed-world validation — the same discipline as sanitizeTags: a
    // hallucinated item id must die here, not render as a broken card.
    const outfits = cleanOutfits(parsed.outfits, inventory, 3);
    if (!outfits.length) {
      await refundStylistUse(uid, res);
      throw new HttpsError('internal', 'STYLIST_EMPTY');
    }

    const recRef = await db().collection('stylistRecs').add({
      userId: uid,
      persona: personaKey,
      ask: ask || null,
      lang,
      outfits,
      charged: res.cost,
      profileRev: profile?.rev || 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return {
      recId: recRef.id, persona: personaKey, outfits,
      ...quotaReply(res),
    };
  },
);

// ── Stylist chat (owner, 2026-10-08) ────────────────────────────────────
// Replaces the one-shot "Style me" button in the app: the user talks — where
// they're going, the mood, a piece they want to build around — and the
// stylist answers in its own voice with 0–2 outfits from their closet.
// Modelled on posture's Darwin coach.
//  - One thread per persona per local day: users/{uid}/stylistChats/
//    {persona}_{YYYY-MM-DD}, messages under it. Past days are the archive.
//  - Server-only writes (rules: owner read, no client writes), both turns in
//    one batch, so a client can't forge answers or reset its quota.
//  - Context is read here, never trusted from the client: closet, stated
//    prefs (authoritative), thumbs, style profile, today's weather (min/max/
//    rain — the user only sees the mean), and the last turns of today's thread.
//  - Outfits are ids the client renders from its own closet, validated by
//    cleanOutfits. Any message with outfits also writes a stylistRecs doc,
//    so 👍/👎, "already proposed", and the admin charts keep working.
//  - One credit per message (PRICE.chat), refunded if no reply comes back.
// styleRecommend stays deployed: older app builds still call it.
const CHAT_HISTORY = 10;          // turns of today's thread fed back in
const CHAT_MAX_TEXT = 400;
const CHAT_REPLY_MAX_WORDS = 70;
const { getPlace, fetchDay, weatherLine } = require('./weather.js');

exports.stylistChat = onCall(
  { secrets: [geminiApiKey], cors: true, timeoutSeconds: 60, memory: '512MiB' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'AUTH_REQUIRED');
    if (request.auth.token?.firebase?.sign_in_provider === 'anonymous') {
      throw new HttpsError('permission-denied', 'SIGN_IN_REQUIRED');
    }
    const personaKey = PERSONAS[request.data?.persona] ? request.data.persona : 'noa';
    const persona = PERSONAS[personaKey];
    const text = typeof request.data?.text === 'string' ? request.data.text.trim().slice(0, CHAT_MAX_TEXT) : '';
    if (!text) throw new HttpsError('invalid-argument', 'EMPTY');
    const lang = ['en', 'ko', 'ja', 'es', 'fr'].includes(request.data?.lang) ? request.data.lang : 'en';

    const profRef = db().collection('profiles').doc(uid);
    const profDoc = await profRef.get();
    const tz = (profDoc.exists && profDoc.data().timezone) || 'America/New_York';
    const day = dayKey(tz);
    const threadRef = db().collection('users').doc(uid).collection('stylistChats').doc(`${personaKey}_${day}`);

    const [inventory, recentGens, historySnap, place] = await Promise.all([
      loadInventory(uid),
      db().collection('generations').where('userId', '==', uid)
        .orderBy('createdAt', 'desc').limit(30).get(),
      threadRef.collection('messages').orderBy('createdAt', 'desc').limit(CHAT_HISTORY).get()
        .catch(() => ({ docs: [] })),
      getPlace(db(), uid).catch(() => null),
    ]);
    const stated = (profDoc.exists && profDoc.data().stylePrefs) || null;
    const loved = [];
    const disliked = [];
    recentGens.forEach((d) => {
      const g = d.data();
      const v = g.feedback || (g.liked ? 'up' : null);
      const ids = (Array.isArray(g.itemIds) ? g.itemIds : []).slice(0, 4);
      if (v && ids.length) (v === 'up' ? loved : disliked).push(ids);
    });
    const owned = inventory.filter((i) => i.kind === 'owned').length;
    const history = historySnap.docs.map((d) => d.data()).reverse();

    const res = await reserveStylistUse(uid, PRICE.chat);
    const genAI = new GoogleGenerativeAI(geminiApiKey.value());
    let profile = null;
    let weather = null;
    try {
      [profile, weather] = await Promise.all([
        ensureStyleProfile(uid, genAI),
        place ? fetchDay(place, day).catch(() => null) : null,
      ]);
    } catch (e) {
      await refundStylistUse(uid, res);
      throw e;
    }

    const langName = langLabel(lang);
    const transcript = history.map((m) => {
      const who = m.role === 'user' ? 'User' : persona.name;
      const looks = (m.outfits || []).map((o) => `[outfit "${o.title}": ${o.itemIds.join(', ')}]`).join(' ');
      return `${who}: ${m.text}${looks ? ` ${looks}` : ''}`;
    }).join('\n');

    const model = genAI.getGenerativeModel({
      model: (await getModels()).vision,
      generationConfig: { responseMimeType: 'application/json' },
    });
    const prompt = [
      `You are ${persona.name}, a personal fashion stylist inside the drape app, chatting with the user.`,
      `LENS: ${persona.lens}`,
      `SIGNATURE (apply to every outfit you propose): ${persona.signature}`,
      `YOU REFUSE: ${persona.refuses}`,
      `VOICE: ${persona.voice}`,
      `TITLE STYLE: ${persona.titles}`,
      `Example of your voice: "${persona.example}"`,
      'This is a conversation, not a form. Answer what they actually said. When they want something to wear — an occasion, a mood, a piece to build around, "what should I wear" — propose 1 or 2 outfits from their closet. When they are just talking, asking a question, or reacting to an earlier look, answer without new outfits (outfits: []). Never more than 2 outfits.',
      `Return JSON: {"reply": string, "outfits": [{"title": string, "itemIds": string[], "why": string}]}`,
      `- "reply": in ${langName}, in YOUR voice, at most ${CHAT_REPLY_MAX_WORDS} words. Talk to them, don't list the pieces (the app shows the outfit cards right under your reply).`,
      '- Outfits use ONLY item ids from the closet below, 2–6 ids forming one wearable look, at most one wishlist item per outfit and only if it completes the look.',
      `- "title" and "why" in ${langName}, your title style; "why" is ONE sentence, HARD LIMIT 18 WORDS, about why it works on THIS person today.`,
      '- Never disparage the user, their body, or anything in their closet.',
      owned < 3 ? 'THEIR CLOSET HAS FEWER THAN 3 OWNED PIECES — you cannot build outfits yet. Say so warmly and tell them to add a few pieces; outfits: [].' : '',
      weather ? weatherLine(weather, place) : 'WEATHER: unknown — do not guess it; dress for the season.',
      `TODAY: ${day}`,
      profile?.summary ? `USER STYLE PROFILE:\n${profile.summary}` : '',
      stated ? `STATED PREFERENCES (authoritative — never contradict these): ${JSON.stringify(stated).slice(0, 800)}` : '',
      personalColorLine(stated),
      loved.length ? `THEY RATED THESE COMBINATIONS 👍 (lean into what these share): ${JSON.stringify(loved.slice(0, 6))}` : '',
      disliked.length ? `THEY RATED THESE 👎 (do NOT repeat them or their defining traits): ${JSON.stringify(disliked.slice(0, 6))}` : '',
      `CLOSET (id + tags): ${JSON.stringify(inventory).slice(0, 8000)}`,
      transcript ? `EARLIER TODAY IN THIS CONVERSATION (don't re-propose the same outfit unless asked):\n${transcript}` : 'This is the first message today.',
      `User: ${text}`,
      `STAY IN CHARACTER: you are ${persona.name}. Within their stated preferences, both the outfits and the words must be recognisably yours.`,
    ].filter(Boolean).join('\n\n');

    let parsed;
    try {
      const r = await model.generateContent(prompt);
      parsed = JSON.parse(r.response.text());
    } catch (e) {
      await refundStylistUse(uid, res);
      console.error('stylistChat failed:', e?.message);
      throw new HttpsError('internal', 'STYLIST_ERROR');
    }
    const reply = String(parsed?.reply || '').trim().slice(0, 900);
    if (!reply) {
      await refundStylistUse(uid, res);
      throw new HttpsError('internal', 'STYLIST_EMPTY');
    }
    const outfits = owned >= 3
      ? cleanOutfits(parsed.outfits, inventory, 2).map(({ confidence, ...o }) => o)
      : [];

    const now = Date.now();
    let recId = null;
    if (outfits.length) {
      const recRef = db().collection('stylistRecs').doc();
      recId = recRef.id;
      await recRef.set({
        userId: uid, persona: personaKey, ask: text.slice(0, 200), lang, outfits,
        charged: res.cost, profileRev: profile?.rev || 0, source: 'chat',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    const userMsg = { role: 'user', text, createdAt: now };
    const stylistMsg = {
      role: 'stylist', text: reply, outfits, recId, createdAt: now + 1,
      weather: weather ? { code: weather.code, meanC: weather.meanC } : null,
    };
    const batch = db().batch();
    const msgs = threadRef.collection('messages');
    const userRef = msgs.doc();
    const replyRef = msgs.doc();
    batch.set(userRef, userMsg);
    batch.set(replyRef, stylistMsg);
    batch.set(threadRef, {
      persona: personaKey, dayKey: day,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      messageCount: admin.firestore.FieldValue.increment(2),
      ...(history.length ? {} : { firstMessage: text.slice(0, 140), startedAt: admin.firestore.FieldValue.serverTimestamp() }),
    }, { merge: true });
    await batch.commit();

    return {
      dayKey: day,
      messages: [{ id: userRef.id, ...userMsg }, { id: replyRef.id, ...stylistMsg }],
      ...quotaReply(res),
    };
  },
);

