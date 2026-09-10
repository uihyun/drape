// === Stylist ===========================================================
// SPEC-1.6 §B/§D: per-user style profile (compressed taste summary) + the
// persona-fronted outfit recommender. Text-only gemini-3.5-flash — the third
// sanctioned Gemini call site (items.js = images/tagging, tryon.js = try-on;
// CLAUDE.md updated 2026-09-08). No image generation here, ever.
//
// Economics: recommendations are FREE, capped REC_DAILY/day (fitDayKey
// pattern on the users doc). They exist to manufacture try-on demand — the
// fit charge happens when the user tries a rec on, in tryon.js as always.

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { reserveFit, refundFit } = require('./fits.js');

const geminiApiKey = defineSecret('GEMINI_API_KEY');
const MODEL = 'gemini-3.5-flash';

const REC_DAILY = 3;            // free recommendations per user-local day; after
                                // that each rec charges ONE fit (same wallet as
                                // try-on — no second refill economy, owner 9/10)
const PROFILE_TTL_MS = 12 * 60 * 60 * 1000; // refresh profile at most 2x/day
const MAX_ITEMS = 150;          // inventory digest cap fed to the model

// Personas are PROMPT LENSES, not people. Client renders them as illustrated,
// explicitly-AI characters (house rule: no photoreal synthetic humans).
const PERSONAS = {
  noa:  { name: 'Noa',  lens: 'minimal & classic: restrained palettes, clean silhouettes, long-lived pieces, quiet luxury. You dislike logos and clutter.' },
  remy: { name: 'Remy', lens: 'street & casual: proportion play, layering, sneakers-first thinking, relaxed fits with one loud element.' },
  sol:  { name: 'Sol',  lens: 'romantic & feminine: color harmony, soft textures, seasonal mood, dresses and knits, delicate details.' },
  juno: { name: 'Juno', lens: 'bold & experimental: unexpected pairings, color blocking, rediscovering ignored pieces, fashion-forward risks.' },
};

// "YYYY-MM-DD" in the user's timezone — same convention as fits.js.
function dayKey(tz) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
  }
}

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
      isOotd: !!x.date,
    });
  });
  // Stated preferences beat inferred ones — the user said so explicitly.
  const stated = (profSnap.exists && profSnap.data().stylePrefs) || null;

  const model = genAI.getGenerativeModel({
    model: MODEL,
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

// ── Recommendation quota: 3 free/day, then one FIT per rec ─────────────
// One wallet, not two: past the free allowance a rec spends the same fit a
// try-on would (throws 'out_of_fits' when both are dry — same signal the
// client already knows). Free-slot write and fit charge share a transaction.
async function reserveRecOrFit(uid) {
  const userRef = db().collection('users').doc(uid);
  const profRef = db().collection('profiles').doc(uid);
  return db().runTransaction(async (txn) => {
    const [userSnap, profSnap] = await Promise.all([txn.get(userRef), txn.get(profRef)]);
    const u = userSnap.exists ? userSnap.data() : {};
    const tz = (profSnap.exists && profSnap.data().timezone) || 'America/New_York';
    const today = dayKey(tz);
    const used = u.styleRecDayKey === today ? (u.styleRecUsed || 0) : 0;
    if (used < REC_DAILY) {
      txn.set(userRef, { styleRecDayKey: today, styleRecUsed: used + 1 }, { merge: true });
      return { charged: 'free', freeRemaining: REC_DAILY - used - 1 };
    }
    // reserveFit does its own reads — fine here because this branch hasn't
    // written yet (Firestore txns forbid reads after writes).
    const fitType = await reserveFit(txn, uid); // 'daily' | 'bonus' | throws out_of_fits
    return { charged: fitType, freeRemaining: 0 };
  });
}

// ── The recommender (SPEC-1.6 §D) ───────────────────────────────────────
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
    const lang = ['en', 'ko', 'ja'].includes(request.data?.lang) ? request.data.lang : 'en';

    const inventory = await loadInventory(uid);
    if (inventory.filter((i) => i.kind === 'owned').length < 3) {
      throw new HttpsError('failed-precondition', 'closet_too_small');
    }

    const { charged, freeRemaining } = await reserveRecOrFit(uid);
    const genAI = new GoogleGenerativeAI(geminiApiKey.value());
    let profile;
    try {
      profile = await ensureStyleProfile(uid, genAI);
    } catch (e) {
      refundFit(uid, charged); // no-op for 'free'
      throw e;
    }

    const model = genAI.getGenerativeModel({
      model: MODEL,
      generationConfig: { responseMimeType: 'application/json' },
    });
    const langName = { en: 'English', ko: 'Korean', ja: 'Japanese' }[lang];
    const prompt = [
      `You are ${persona.name}, a personal fashion stylist inside the drape app. Your styling lens: ${persona.lens}`,
      `Build outfits ONLY from the user's closet below, referencing items by their exact "id". Rules:`,
      '- 2 to 3 outfits, each with 2-6 item ids that form ONE wearable look (no two of the same slot unless layering makes sense).',
      '- Prefer owned items; you may include AT MOST ONE wishlist item per outfit and only when it completes the look.',
      `- "title" and "why" in ${langName}. "why" is one sentence tied to THIS user's taste (use the profile), in your voice.`,
      'Return JSON: {"outfits":[{"title":string,"itemIds":string[],"why":string,"confidence":number 0-1}]}',
      profile?.summary ? `USER STYLE PROFILE:\n${profile.summary}` : '',
      profile?.avoidList?.length ? `AVOID: ${profile.avoidList.join(', ')}` : '',
      ask ? `USER REQUEST: ${ask}` : 'USER REQUEST: (none — style for a normal day this season)',
      `CLOSET: ${JSON.stringify(inventory).slice(0, 8000)}`,
    ].filter(Boolean).join('\n\n');

    let parsed;
    try {
      const res = await model.generateContent(prompt);
      parsed = JSON.parse(res.response.text());
    } catch (e) {
      refundFit(uid, charged); // paid rec that produced nothing → give it back
      throw new HttpsError('internal', 'STYLIST_FAILED', e?.message);
    }

    // Closed-world validation — the same discipline as sanitizeTags: a
    // hallucinated item id must die here, not render as a broken card.
    const byId = new Map(inventory.map((i) => [i.id, i]));
    const outfits = (Array.isArray(parsed.outfits) ? parsed.outfits : [])
      .map((o) => {
        const ids = [...new Set(Array.isArray(o.itemIds) ? o.itemIds : [])].filter((id) => byId.has(id));
        let wishlistUsed = 0;
        const kept = ids.filter((id) => {
          if (byId.get(id).kind !== 'wishlist') return true;
          return ++wishlistUsed <= 1;
        });
        return {
          title: String(o.title || '').slice(0, 80),
          itemIds: kept.slice(0, 6),
          why: String(o.why || '').slice(0, 300),
          confidence: Math.max(0, Math.min(1, Number(o.confidence) || 0.5)),
        };
      })
      .filter((o) => o.itemIds.length >= 2)
      .slice(0, 3);
    if (!outfits.length) {
      refundFit(uid, charged);
      throw new HttpsError('internal', 'STYLIST_EMPTY');
    }

    const recRef = await db().collection('stylistRecs').add({
      userId: uid,
      persona: personaKey,
      ask: ask || null,
      lang,
      outfits,
      charged,
      profileRev: profile?.rev || 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { recId: recRef.id, persona: personaKey, outfits, remaining: freeRemaining, charged };
  },
);
