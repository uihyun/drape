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

// Gemini Image often echoes the input photos back in candidates[0].parts
// before appending the actual generated output. Taking the FIRST inline
// image therefore saves one of the inputs (the reference selfie, or one
// of the supplied garment crops) rather than the try-on result, which
// is what produced the 'try-on result page shows the input garment'
// bug. Walk every part and keep the LAST inline image — that's the
// model's real output.
function extractImage(response) {
  const parts = response?.candidates?.[0]?.content?.parts || [];
  let last = null;
  for (const p of parts) {
    if (p.inlineData?.data) {
      last = { data: p.inlineData.data, mimeType: p.inlineData.mimeType || 'image/png' };
    }
  }
  return last;
}

// Plain-English region per item category, used in custom-photo mode so
// the model knows exactly what to clear out. Subcategory word overrides
// catch common mis-tags (e.g. boots auto-tagged as 'outerwear').
function categoryRegion(category, subcategory) {
  const sub = (subcategory || '').toLowerCase();
  if (/\b(boot|sneaker|loafer|sandal|heel|mule|oxford)\b/.test(sub)) {
    category = 'footwear';
  } else if (/\b(jean|trouser|pant|short|skirt|legging)\b/.test(sub)) {
    category = 'bottom';
  }
  switch (category) {
    case 'top':
      return 'upper-body garment (shirt / tee / blouse / sweater between the shoulders and waist)';
    case 'outerwear':
      return 'outer layer (jacket / coat / blazer worn over the top)';
    case 'bottom':
      return 'lower-body garment from the waist down (pants / jeans / shorts / skirt)';
    case 'dress':
      return 'one-piece covering both the torso AND the lower body';
    case 'footwear': {
      if (sub.includes('boot')) return 'footwear AND the visible lower leg up to the boot\'s natural shaft height';
      return 'footwear (shoes / sandals)';
    }
    case 'bag': return 'bag carried in hand or over the shoulder';
    case 'accessory': return 'small accessory region (hat / belt / scarf / jewelry)';
    case 'innerwear': return 'innerwear / base layer';
    default: return 'corresponding clothing region';
  }
}

function tryOnPrompt(items, customPrompt, backgroundDesc, refCount, mode) {
  const itemSummary = items.map((it, i) => {
    const t = it.tags || {};
    const parts = [t.subcategory || t.category || 'garment'];
    if (t.colors?.length) parts.push(`(${t.colors.join('/')})`);
    return `(${i + 1}) ${parts.join(' ')}`;
  }).join(', ');

  // ── custom-photo: surgical, region-only ──────────────────────────
  // Restored verbatim from commit 1bbfdbb (the first cut of this mode)
  // because the later region-by-region itemized version over-prescribed
  // and caused the model to swap regions it wasn't asked to (jacket →
  // gone, trousers → shorts). This simpler "REPLACE only the regions
  // the supplied garments cover + ABSOLUTE PRESERVATION RULES" form is
  // what actually produced the precise swaps the user wanted.
  if (mode === 'custom-photo') {
    return `You are dressing the person from the FIRST reference image in
the following clothing item(s): ${itemSummary}.

The images AFTER the first one are the garments isolated on white
backgrounds. Composite ONLY those garments onto the person's body,
replacing whatever they're currently wearing in that region.

ABSOLUTE PRESERVATION RULES — the first image is the source of truth:
- KEEP the original background EXACTLY (do NOT remove, regenerate, blur,
  brighten, or restyle it). Same room, same wall, same floor, same props.
- KEEP the person's face IDENTICAL (every feature, expression, gaze).
- KEEP the person's hair, skin tone, body proportions, height, and pose.
- KEEP the original camera angle, framing, lens distortion, and crop.
- KEEP the original lighting direction, color temperature, and shadows on
  the person and background.
- KEEP any objects the person is holding, jewelry, glasses, hats,
  tattoos, and visible accessories that ARE NOT being replaced.

REPLACE only the specific clothing region(s) that the supplied garments
cover. Render fabric drape, fold, wrinkle, and shadow naturally and
consistently with the existing lighting and pose. The output should be
indistinguishable from a real photo of the same person, in the same
place, at the same moment, just wearing the supplied garment(s) instead.

${customPrompt ? `Additional direction: ${customPrompt}` : ''}

Output a single photoreal image matching the first image's resolution
and aspect.`;
  }

  // ── identity-refs: full strip-and-redress on a studio plate ──────
  // The reference photos are the person's identity references (usually
  // a full outfit they have on). For this mode we IGNORE what they were
  // wearing on the ref and dress them in the supplied outfit. Any
  // category the user didn't supply must be filled with neutral basics
  // — never render the person nude or partially undressed.
  const refClause = refCount > 1
    ? `The FIRST reference image is the primary canvas — match its pose,
camera angle, and framing. The other reference images are additional
views of the SAME person for identity preservation only.`
    : `The reference image is the canvas — match its pose, camera angle,
and framing.`;

  const bgClause = backgroundDesc
    ? `Background: ${backgroundDesc}. Render photoreal and consistent
with the lighting on the person.`
    : `Background: flat pure white, like a fashion lookbook plate.
No room, no floor, no props.`;

  return `Dress the person from the reference image(s) in the clothing
shown in the remaining images: ${itemSummary}.

${refClause}

The remaining images are the new garments, each isolated on a white
background. Treat them as the complete outfit. The reference person was
photographed wearing other clothing — REMOVE that clothing entirely and
dress them in the supplied garments instead. Nothing the reference person
was originally wearing should remain visible.

FILL MISSING CATEGORIES WITH NEUTRAL BASICS (this is required — never
output a nude or partially-undressed person):
- If no top is supplied, add a plain neutral t-shirt or sweater that
  matches the supplied pieces tonally.
- If no bottom is supplied, add neutral straight-leg trousers in a
  matching neutral tone (off-white, beige, charcoal, or black).
- If no footwear is supplied, add simple low-profile shoes in a neutral
  tone (white sneakers or black low-profile leather shoes).
- These fill pieces should be visually quiet — the supplied items are
  the focus.

Transfer the supplied clothing design, fit, fabric texture, colors,
folds, wrinkles, shadows, and material details onto the person
naturally. Maintain realistic fabric draping, body tension, perspective,
lighting, and folds based on the person's pose and body shape.

Identity preservation is absolute: face IDENTICAL, hair / skin / body
proportions / pose unchanged. Only the clothing (and the background,
per the next line) should differ from the reference. Do not crop, zoom,
or cut off the head — full-body framing.

${bgClause}

${customPrompt ? `Additional direction: ${customPrompt}` : ''}

Output a single photorealistic full-body image — naturally worn, not
pasted on, indistinguishable from a real photo.`;
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
      // One-shot custom photo: when set, used as the FIRST (and only)
      // reference image instead of the user's saved identityRefs. The
      // prompt switches to preserve-everything-except-clothing mode.
      customPhotoPath = null,
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

    // Reject the obvious config errors before doing any I/O so the user
    // sees the error inline instead of a phantom 'pending' card.
    if (customPhotoPath && !customPhotoPath.startsWith(`tryon-input/${uid}/`)) {
      throw new HttpsError('permission-denied', 'bad customPhotoPath');
    }
    let identityRefs = [];
    if (!customPhotoPath) {
      const userSnap = await db.collection('users').doc(uid).get();
      identityRefs = (userSnap.exists && userSnap.data().identityRefs) || [];
      if (identityRefs.length === 0) {
        throw new HttpsError(
          'failed-precondition',
          'no identity reference photos — add 2-3 full-body photos in Settings first'
        );
      }
    }
    const referenceCount = customPhotoPath ? 1 : identityRefs.length;

    const modelId = modelTier === 'flash' ? IMAGE_FLASH : IMAGE_PRO;
    const n = variants ?? 1;

    // ── Pre-write the generation doc EARLY ─────────────────────────────
    // Doing this before the slow image downloads + Gemini call means the
    // user's TryOnHistory live subscription sees a 'pending' card within
    // ~500ms of pressing Generate. They can then navigate away (callable
    // resolves the URL list, but the UI doesn't have to wait for it).
    const genRef = db.collection('generations').doc();
    await genRef.set({
      userId: uid,
      itemIds,
      identityRefCount: referenceCount,
      customPhotoPath: customPhotoPath || null,
      modelTier,
      modelId,
      prompt: prompt || null,
      regenerateOf: regenerateOf || null,
      status: 'pending',
      rating: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // ── Load reference image(s) ────────────────────────────────────────
    let referenceParts = [];
    if (customPhotoPath) {
      referenceParts = [await downloadAsInlineData(bucket, customPhotoPath)];
    } else {
      for (const ref of identityRefs) {
        referenceParts.push(await downloadAsInlineData(bucket, ref.path));
      }
    }

    // ── Load items + verify ownership ──────────────────────────────────
    const itemDocs = await Promise.all(
      itemIds.map(id => db.collection('items').doc(id).get())
    );
    const items = [];
    for (const snap of itemDocs) {
      if (!snap.exists) {
        await genRef.update({ status: 'failed', errors: ['item missing'], updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        throw new HttpsError('not-found', 'item missing');
      }
      const data = snap.data();
      if (data.userId !== uid) {
        await genRef.update({ status: 'failed', errors: ['not your item'], updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        throw new HttpsError('permission-denied', 'not your item');
      }
      if (data.status !== 'ready' || !data.croppedPath) {
        await genRef.update({ status: 'failed', errors: ['item not processed yet'], updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        throw new HttpsError('failed-precondition', 'item not processed yet');
      }
      items.push({ id: snap.id, ...data });
    }

    // ── Build prompt parts ─────────────────────────────────────────────
    const parts = [...referenceParts];
    for (const it of items) {
      parts.push(await downloadAsInlineData(bucket, it.croppedPath));
    }
    const promptMode = customPhotoPath ? 'custom-photo' : 'identity-refs';
    parts.push({ text: tryOnPrompt(items, prompt, backgroundDesc, referenceCount, promptMode) });

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
