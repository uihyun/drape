// === Marketing post queue ==============================================
// Admin-gated CRUD over the `marketingPosts` collection — the scheduling
// queue behind the /admin Marketing tab. Firestore rules never open this
// collection to clients; everything goes through these callables.
//
// Doc shape:
//   { imageUrl, caption, targets: ['instagram'|'threads'],
//     scheduledAt: Timestamp, status: 'queued'|'published'|'failed'|'canceled',
//     results: { instagram?, threads? }, createdAt, updatedAt }
//
// Publisher: `publishMarketingPosts` (onSchedule, 15 min) drains due queued
// docs → IG Graph (media container → publish) + Threads API. Tokens live in
// the admin-only `marketingConfig/tokens` doc — NOT in deploy-time secrets —
// because both are 60-day tokens the weekly `refreshMarketingTokens` job
// rotates in place (a secret would go stale between deploys). Seed/rotate by
// hand with scripts/seed-marketing-tokens.cjs. Setup history in
// resources/marketing/README.md.

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { assertAdmin } = require('./admin.js');

const opts = { cors: true, timeoutSeconds: 60, memory: '256MiB' };
const COLL = 'marketingPosts';
const TARGETS = ['instagram', 'threads'];
// IG caption hard limit; Threads is 500 but long queue captions get trimmed
// at publish time for that target rather than rejected here.
const CAPTION_MAX = 2200;

const toMillis = (t) => (t?.toMillis ? t.toMillis() : null);
const serialize = (doc) => {
  const x = doc.data();
  return {
    id: doc.id,
    imageUrl: x.imageUrl,
    caption: x.caption,
    targets: x.targets,
    status: x.status,
    results: x.results || null,
    scheduledAt: toMillis(x.scheduledAt),
    createdAt: toMillis(x.createdAt),
    updatedAt: toMillis(x.updatedAt),
  };
};

exports.adminMarketingList = onCall(opts, async (request) => {
  assertAdmin(request);
  const snap = await admin.firestore().collection(COLL)
    .orderBy('scheduledAt', 'desc').limit(200).get();
  return { posts: snap.docs.map(serialize) };
});

exports.adminMarketingUpsert = onCall(opts, async (request) => {
  assertAdmin(request);
  const { id, imageUrl, caption, targets, scheduledAt } = request.data || {};

  if (typeof imageUrl !== 'string' || !/^https:\/\//.test(imageUrl)) {
    throw new HttpsError('invalid-argument', 'IMAGE_URL_HTTPS_REQUIRED');
  }
  if (typeof caption !== 'string' || !caption.trim() || caption.length > CAPTION_MAX) {
    throw new HttpsError('invalid-argument', 'CAPTION_INVALID');
  }
  if (!Array.isArray(targets) || !targets.length || targets.some((t) => !TARGETS.includes(t))) {
    throw new HttpsError('invalid-argument', 'TARGETS_INVALID');
  }
  const when = new Date(scheduledAt);
  if (Number.isNaN(when.getTime())) throw new HttpsError('invalid-argument', 'SCHEDULED_AT_INVALID');

  const db = admin.firestore();
  const now = admin.firestore.FieldValue.serverTimestamp();
  const patch = {
    imageUrl,
    caption: caption.trim(),
    targets,
    scheduledAt: admin.firestore.Timestamp.fromDate(when),
    updatedAt: now,
  };

  if (id) {
    const ref = db.collection(COLL).doc(id);
    const cur = await ref.get();
    if (!cur.exists) throw new HttpsError('not-found', 'POST_NOT_FOUND');
    // Published posts are history, not drafts — edits would silently lie
    // about what actually went out.
    if (cur.data().status === 'published') throw new HttpsError('failed-precondition', 'ALREADY_PUBLISHED');
    await ref.update({ ...patch, status: 'queued', results: null });
    return { id };
  }
  const ref = await db.collection(COLL).add({ ...patch, status: 'queued', results: null, createdAt: now });
  return { id: ref.id };
});

exports.adminMarketingDelete = onCall(opts, async (request) => {
  assertAdmin(request);
  const { id } = request.data || {};
  if (!id) throw new HttpsError('invalid-argument', 'ID_REQUIRED');
  const ref = admin.firestore().collection(COLL).doc(id);
  const cur = await ref.get();
  if (!cur.exists) throw new HttpsError('not-found', 'POST_NOT_FOUND');
  if (cur.data().status === 'published') {
    // Keep the audit trail; flip to canceled instead of erasing history.
    throw new HttpsError('failed-precondition', 'ALREADY_PUBLISHED');
  }
  await ref.delete();
  return { ok: true };
});

// Storage-hosted ad creatives (uploaded public by scripts/upload-marketing-assets.cjs)
// so the admin picker can offer them without hand-pasting URLs.
exports.adminMarketingAssets = onCall(opts, async (request) => {
  assertAdmin(request);
  const bucket = admin.storage().bucket();
  const [files] = await bucket.getFiles({ prefix: 'marketing/' });
  const assets = files
    .filter((f) => /\.(png|jpe?g|webp|mp4)$/i.test(f.name))
    .map((f) => ({
      path: f.name,
      url: `https://storage.googleapis.com/${bucket.name}/${encodeURI(f.name)}`,
    }));
  return { assets };
});

// ── Publisher ───────────────────────────────────────────────────────────
// Tokens doc: marketingConfig/tokens { igToken, igUserId, threadsToken,
// threadsUserId?, igRefreshedAt, threadsRefreshedAt }. Rules never expose it.

const IG_GRAPH = 'https://graph.instagram.com/v23.0';
const TH_GRAPH = 'https://graph.threads.net/v1.0';

async function metaFetch(url, params) {
  const body = new URLSearchParams(params);
  const res = await fetch(url, { method: 'POST', body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    throw new Error(json.error?.message || `HTTP_${res.status}`);
  }
  return json;
}

// IG: create container → publish. Media must be at a public URL (our Storage
// objects). Videos publish as Reels: their container processes async, so we
// poll status_code until FINISHED before media_publish (API-published Reels
// can't attach licensed audio — trending-music posts still go via the app).
const isVideo = (url) => /\.(mp4|mov)(\?|$)/i.test(url);

async function waitForContainer(id, token, tries = 40) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(`${IG_GRAPH}/${id}?fields=status_code&access_token=${encodeURIComponent(token)}`);
    const json = await res.json().catch(() => ({}));
    if (json.status_code === 'FINISHED') return;
    if (json.status_code === 'ERROR') throw new Error('CONTAINER_PROCESSING_ERROR');
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error('CONTAINER_PROCESSING_TIMEOUT');
}

async function publishInstagram({ imageUrl, caption }, cfg) {
  const video = isVideo(imageUrl);
  const container = await metaFetch(`${IG_GRAPH}/me/media`, video
    ? { media_type: 'REELS', video_url: imageUrl, caption, access_token: cfg.igToken }
    : { image_url: imageUrl, caption, access_token: cfg.igToken });
  if (video) await waitForContainer(container.id, cfg.igToken);
  const pub = await metaFetch(`${IG_GRAPH}/me/media_publish`, {
    creation_id: container.id,
    access_token: cfg.igToken,
  });
  return { mediaId: pub.id, type: video ? 'reel' : 'image' };
}

// Threads: same two-step shape, 500-char text cap.
async function publishThreads({ imageUrl, caption }, cfg) {
  const container = await metaFetch(`${TH_GRAPH}/me/threads`, {
    media_type: 'IMAGE',
    image_url: imageUrl,
    text: caption.slice(0, 500),
    access_token: cfg.threadsToken,
  });
  const pub = await metaFetch(`${TH_GRAPH}/me/threads_publish`, {
    creation_id: container.id,
    access_token: cfg.threadsToken,
  });
  return { mediaId: pub.id };
}

exports.publishMarketingPosts = onSchedule(
  { schedule: 'every 15 minutes', timeoutSeconds: 300, memory: '256MiB', retryCount: 0 },
  async () => {
    const db = admin.firestore();
    const cfgSnap = await db.doc('marketingConfig/tokens').get();
    if (!cfgSnap.exists) { console.log('marketing: no tokens configured, skipping'); return; }
    const cfg = cfgSnap.data();

    const due = await db.collection(COLL)
      .where('status', '==', 'queued')
      .where('scheduledAt', '<=', admin.firestore.Timestamp.now())
      .orderBy('scheduledAt')
      .limit(5) // spread bursts across runs — IG rate limits per account
      .get();
    if (due.empty) return;

    for (const doc of due.docs) {
      const post = doc.data();
      const results = {};
      let anyFail = false;
      for (const target of post.targets) {
        try {
          if (target === 'instagram') {
            if (!cfg.igToken) throw new Error('IG_TOKEN_MISSING');
            results.instagram = await publishInstagram(post, cfg);
          } else if (target === 'threads') {
            if (!cfg.threadsToken) throw new Error('THREADS_TOKEN_MISSING');
            results.threads = await publishThreads(post, cfg);
          }
        } catch (e) {
          anyFail = true;
          results[target] = { error: String(e.message || e).slice(0, 300) };
          console.error(`marketing publish ${doc.id} → ${target} failed:`, e.message);
        }
      }
      await doc.ref.update({
        status: anyFail ? 'failed' : 'published',
        results,
        publishedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`marketing publish ${doc.id}: ${anyFail ? 'FAILED' : 'ok'}`, JSON.stringify(results));
    }
  },
);

// Both platforms hand out 60-day tokens that can be refreshed once they're
// >24h old. Weekly keeps them perpetually fresh with a wide safety margin.
exports.refreshMarketingTokens = onSchedule(
  { schedule: 'every monday 04:00', timeZone: 'Etc/UTC', timeoutSeconds: 60, memory: '256MiB' },
  async () => {
    const db = admin.firestore();
    const ref = db.doc('marketingConfig/tokens');
    const snap = await ref.get();
    if (!snap.exists) return;
    const cfg = snap.data();
    const patch = {};
    const refresh = async (url) => {
      const res = await fetch(url);
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) throw new Error(json.error?.message || `HTTP_${res.status}`);
      return json.access_token;
    };
    if (cfg.igToken) {
      try {
        patch.igToken = await refresh(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(cfg.igToken)}`);
        patch.igRefreshedAt = admin.firestore.FieldValue.serverTimestamp();
      } catch (e) { console.error('IG token refresh failed:', e.message); }
    }
    if (cfg.threadsToken) {
      try {
        patch.threadsToken = await refresh(`https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${encodeURIComponent(cfg.threadsToken)}`);
        patch.threadsRefreshedAt = admin.firestore.FieldValue.serverTimestamp();
      } catch (e) { console.error('Threads token refresh failed:', e.message); }
    }
    if (Object.keys(patch).length) await ref.set(patch, { merge: true });
  },
);
