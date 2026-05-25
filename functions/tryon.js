// === virtualTryOn ======================================================
// Compose the user's identity reference photos + 1..N clothing items into
// a single try-on render (Nano Banana Pro, gemini-3-pro-image-preview).
//
// Quality strategy (brief §7):
//   - Always feed ALL identity refs (2~3 full-body shots) so the model
//     locks face + body + pose.
//   - Prompt explicitly forbids identity drift ("preserve face, body shape,
//     hairstyle, pose; only the garments may change").
//   - N parallel variants (default 2 with Pro, 4 with Flash). Caller picks.
//   - Every call writes a Generation doc — even failed ones — to feed the
//     rating/regeneration analytics loop.
//   - modelTier=='flash' for cheap previews ("does this even kind of work")
//     vs default 'pro' for the final saveable result.

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const geminiApiKey = defineSecret('GEMINI_API_KEY');

const IMAGE_PRO   = 'gemini-3-pro-image-preview';
const IMAGE_FLASH = 'gemini-3.1-flash-image-preview';

function bucketUrl(bucket, path) {
  return `https://storage.googleapis.com/${bucket}/${path}`;
}

async function downloadAsInlineData(bucket, path) {
  const [buf] = await bucket.file(path).download();
  return {
    inlineData: {
      data: buf.toString('base64'),
      mimeType: 'image/jpeg', // both identity refs + cropped items are stored as jpg/png; jpeg here is fine for the SDK
    },
  };
}

function extractImage(response) {
  const parts = response?.candidates?.[0]?.content?.parts || [];
  for (const p of parts) {
    if (p.inlineData?.data) {
      return { data: p.inlineData.data, mimeType: p.inlineData.mimeType || 'image/png' };
    }
  }
  return null;
}

function tryOnPrompt(items, customPrompt, backgroundDesc, refCount) {
  const itemSummary = items.map((it, i) => {
    const t = it.tags || {};
    const parts = [t.subcategory || t.category || 'garment'];
    if (t.colors?.length) parts.push(`(${t.colors.join('/')})`);
    return `(${i + 1}) ${parts.join(' ')}`;
  }).join(', ');

  const refClause = refCount > 1
    ? `The FIRST reference image is the primary canvas — match its pose,
camera angle, and framing. The other reference images are additional
views of the SAME person for identity preservation (face, body, hair).`
    : `The reference image is the canvas — match its pose, camera angle,
and framing.`;

  // Identity refs are pre-processed with the background already removed
  // (see processIdentityRef). Default output is a flat white catalog
  // plate so the user only sees a real environment when they explicitly
  // ask for one via backgroundDesc.
  const bgClause = backgroundDesc
    ? `Place the person against this background: ${backgroundDesc}.
Render it photoreal and consistent with the lighting on the person.`
    : `Place the person against a flat, pure white background.
No room, no floor, no props, no environment — just the person on
white, like a fashion lookbook plate.`;

  return `You are dressing the person from the reference image(s) in the
following clothing item(s): ${itemSummary}.

${refClause}

The image(s) AFTER the reference photos show the garments isolated on a
white background. Composite them onto the person's body, replacing
whatever they're currently wearing in that region, with realistic drape,
fit, shadowing, and lighting.

CRITICAL — identity preservation:
- Keep the person's face IDENTICAL (do not stylize, do not change features).
- Keep the person's hair, skin tone, body proportions, and pose unchanged.
- ONLY the clothing and the background should differ from the reference.

${bgClause}

${customPrompt ? `Additional direction: ${customPrompt}` : ''}

Output a single photoreal full-body image.`;
}

exports.virtualTryOn = onCall(
  { secrets: [geminiApiKey], cors: true, timeoutSeconds: 180, memory: '1GiB' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'sign in required');

    const {
      itemIds,
      modelTier = 'pro',
      prompt = '',
      backgroundDesc = '',
      variants = null,
      regenerateOf = null,
    } = request.data || {};
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      throw new HttpsError('invalid-argument', 'itemIds required');
    }
    if (itemIds.length > 6) {
      // Practical limit — more than ~6 layered items pushes Nano Banana Pro
      // past its quoted 14-image total budget once we add identity refs +
      // safety/system parts. Reject early instead of hoping it copes.
      throw new HttpsError('invalid-argument', 'too many items (max 6)');
    }

    const db = admin.firestore();
    const bucket = admin.storage().bucket();

    // ── Load identity refs ─────────────────────────────────────────────
    const userSnap = await db.collection('users').doc(uid).get();
    const identityRefs = (userSnap.exists && userSnap.data().identityRefs) || [];
    if (identityRefs.length === 0) {
      throw new HttpsError(
        'failed-precondition',
        'no identity reference photos — add 2-3 full-body photos in Settings first'
      );
    }

    // ── Load items + verify ownership ──────────────────────────────────
    const itemDocs = await Promise.all(
      itemIds.map(id => db.collection('items').doc(id).get())
    );
    const items = [];
    for (const snap of itemDocs) {
      if (!snap.exists) throw new HttpsError('not-found', 'item missing');
      const data = snap.data();
      if (data.userId !== uid) throw new HttpsError('permission-denied', 'not your item');
      if (data.status !== 'ready' || !data.croppedPath) {
        throw new HttpsError('failed-precondition', 'item not processed yet');
      }
      items.push({ id: snap.id, ...data });
    }

    // ── Build prompt parts ─────────────────────────────────────────────
    // Identity refs first, then each item crop. The prompt references "the
    // first reference image(s)" so the model knows which is the canvas.
    const parts = [];
    for (const ref of identityRefs) {
      parts.push(await downloadAsInlineData(bucket, ref.path));
    }
    for (const it of items) {
      parts.push(await downloadAsInlineData(bucket, it.croppedPath));
    }
    parts.push({ text: tryOnPrompt(items, prompt, backgroundDesc, identityRefs.length) });

    const modelId = modelTier === 'flash' ? IMAGE_FLASH : IMAGE_PRO;
    // Default one variant — multi-variant grid felt cluttered and most
    // users just want one result. Caller can still request more via
    // `variants: N` if a "show me 3 options" UI ever lands.
    const n = variants ?? 1;

    // ── Pre-write the generation doc so failures still leave a record ─
    const genRef = db.collection('generations').doc();
    await genRef.set({
      userId: uid,
      itemIds,
      identityRefCount: identityRefs.length,
      modelTier,
      modelId,
      prompt: prompt || null,
      regenerateOf: regenerateOf || null,
      status: 'pending',
      rating: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // ── Run N variants in parallel ─────────────────────────────────────
    const genai = new GoogleGenerativeAI(geminiApiKey.value());
    const model = genai.getGenerativeModel({ model: modelId });

    const runs = Array.from({ length: n }, async (_, idx) => {
      try {
        const res = await model.generateContent(parts);
        const img = extractImage(res.response);
        if (!img) return { idx, ok: false, error: 'no image returned' };
        const path = `generations/${uid}/${genRef.id}/${idx}.png`;
        await bucket.file(path).save(Buffer.from(img.data, 'base64'), {
          metadata: { contentType: img.mimeType, cacheControl: 'public,max-age=31536000,immutable' },
        });
        await bucket.file(path).makePublic().catch(() => {});
        return { idx, ok: true, url: bucketUrl(bucket.name, path), path };
      } catch (err) {
        console.warn('try-on variant failed', idx, err.message);
        return { idx, ok: false, error: err.message };
      }
    });

    const results = await Promise.all(runs);
    const variantUrls = results.filter(r => r.ok).map(r => r.url);
    const variantPaths = results.filter(r => r.ok).map(r => r.path);

    await genRef.update({
      status: variantUrls.length > 0 ? 'ready' : 'failed',
      variantUrls,
      variantPaths,
      variantsRequested: n,
      variantsReturned: variantUrls.length,
      errors: results.filter(r => !r.ok).map(r => r.error),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { generationId: genRef.id, variantUrls };
  }
);
