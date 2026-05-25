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

// Plain-English region per item category, used in the prompt so the
// model knows exactly what to clear out and replace. Subcategory hints
// (e.g. boots vs sneakers) tighten the height descriptor.
function categoryRegion(category, subcategory) {
  const sub = (subcategory || '').toLowerCase();
  // Sub-word overrides for the common mis-tag case (e.g. boots auto-tagged
  // as 'outerwear' instead of 'footwear'). Keep these narrow so a
  // legitimate top called "boot-cut shirt" doesn't get hijacked.
  if (/\b(boot|sneaker|loafer|sandal|heel|mule|oxford)\b/.test(sub)) {
    category = 'footwear';
  } else if (/\b(jean|trouser|pant|short|skirt|legging)\b/.test(sub)) {
    category = 'bottom';
  }
  switch (category) {
    case 'top':
      return 'upper-body garment (any shirt / tee / blouse / sweater currently worn between the shoulders and the waist; remove existing tops in that region)';
    case 'outerwear':
      return 'outer layer (jacket / coat / blazer worn over the top; remove any existing outerwear so this becomes the visible outer piece)';
    case 'bottom':
      return 'lower-body garment from the waist down (pants / jeans / shorts / skirt currently worn; replace fully)';
    case 'dress':
      return 'one-piece covering the torso AND the lower body (remove both the current top and the current bottom in that region)';
    case 'footwear': {
      if (sub.includes('boot')) return 'footwear AND the visible lower leg up to the boot\'s natural shaft height (remove sneakers / sandals AND cover any bare skin the boots would naturally cover)';
      if (sub.includes('sandal') || sub.includes('flip')) return 'footwear (remove the existing shoes; show the foot strap pattern of the supplied sandal)';
      return 'footwear (remove sneakers / boots / sandals currently worn and replace with the supplied pair)';
    }
    case 'bag':
      return 'bag carried in hand or over the shoulder (replace any existing bag; if none present, place naturally in the hand or on the shoulder appropriate to the supplied bag\'s style)';
    case 'accessory':
      return 'small accessory region (hat / belt / scarf / jewelry — place where it naturally sits)';
    case 'innerwear':
      return 'innerwear / base layer (visible only if the supplied piece is meant to show)';
    default:
      return 'corresponding clothing region';
  }
}

function tryOnPrompt(items, customPrompt, backgroundDesc, refCount, mode) {
  const itemSummary = items.map((it, i) => {
    const t = it.tags || {};
    const parts = [t.subcategory || t.category || 'garment'];
    if (t.colors?.length) parts.push(`(${t.colors.join('/')})`);
    return `(${i + 1}) ${parts.join(' ')}`;
  }).join(', ');

  // mode === 'custom-photo': the user uploaded a fresh, in-the-wild photo
  // for this single try-on. Preserve EVERYTHING about it (pose, background,
  // lighting, identity) and only swap the clothing region.
  if (mode === 'custom-photo') {
    const itemRegionLines = items.map((it, i) => {
      const cat = it.tags?.category || 'item';
      const sub = it.tags?.subcategory || '';
      const region = categoryRegion(cat, sub);
      return `(${i + 1}) ${sub || cat} → replace the current ${region}.`;
    }).join('\n');

    return `You are dressing the person from the FIRST reference image in
the following clothing item(s): ${itemSummary}.

The images AFTER the first one are the garments isolated on white
backgrounds. Composite ONLY those garments onto the person's body.

REPLACEMENT — be assertive, not additive:
For each supplied garment, REMOVE whatever the person is currently
wearing in that garment's body region and put the supplied garment in
its place. Do NOT layer the new piece under or over the existing one
unless explicitly told to. Specifically:

${itemRegionLines}

Match the supplied garment's silhouette exactly — if it is long boots,
the visible leg should be covered up the boot's natural height even if
the original photo showed bare leg or sneakers. If it is a short-sleeve
tee, the existing long-sleeve shirt must go (do not leave sleeves
sticking out). If it is an outerwear piece, hide the original outer
layer entirely.

ABSOLUTE PRESERVATION RULES — the first image is the source of truth
for everything else:
- KEEP the original background EXACTLY (do NOT remove, regenerate, blur,
  brighten, or restyle it). Same room, same wall, same floor, same props.
- KEEP the person's face IDENTICAL (every feature, expression, gaze).
- KEEP the person's hair, skin tone, body proportions, height, and pose.
- KEEP the original camera angle, framing, lens distortion, and crop.
- KEEP the original lighting direction, color temperature, and shadows
  on the person and background.
- KEEP any objects the person is holding, jewelry, glasses, hats,
  tattoos, and other accessories that are NOT in a replaced region.
- KEEP any region of clothing for which no replacement was supplied
  (e.g. if only a top was given, leave the bottoms exactly as they are).

Render fabric drape, fold, wrinkle, and shadow naturally and consistently
with the existing lighting and pose. The output should be indistinguishable
from a real photo of the same person, in the same place, at the same
moment, wearing the supplied garment(s) instead of what they had on.

${customPrompt ? `Additional direction: ${customPrompt}` : ''}

Output a single photoreal image matching the first image's resolution
and aspect.`;
  }

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

  const itemRegionLines = items.map((it, i) => {
    const cat = it.tags?.category || 'item';
    const sub = it.tags?.subcategory || '';
    const region = categoryRegion(cat, sub);
    return `(${i + 1}) ${sub || cat} → covers the ${region}.`;
  }).join('\n');

  return `You are dressing the person from the reference image(s) in the
following clothing item(s): ${itemSummary}.

${refClause}

The image(s) AFTER the reference photos show the garments isolated on a
white background. Composite them onto the person's body, replacing
whatever they're currently wearing in that region, with realistic drape,
fit, shadowing, and lighting.

REPLACEMENT — be assertive, not additive. Remove whatever the reference
person was wearing in each supplied garment's region and put the
supplied garment in its place. Match the supplied garment's silhouette
exactly (long boots cover the leg up to the shaft even if the original
showed sneakers; a short-sleeve tee replaces a long-sleeve shirt with
no sleeves sticking out; outerwear hides the original outer layer).

${itemRegionLines}

CRITICAL — identity preservation:
- Keep the person's face IDENTICAL (do not stylize, do not change features).
- Keep the person's hair, skin tone, body proportions, and pose unchanged.
- ONLY the clothing and the background should differ from the reference.
- For any body region with no supplied garment, fall back to neutral
  basics consistent with the rest of the look (do not invent loud pieces).

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

    // ── Load reference image(s) ────────────────────────────────────────
    // Two modes: custom one-shot photo OR saved identityRefs.
    let referenceParts = [];
    let referenceCount = 0;
    if (customPhotoPath) {
      // Path safety: the custom photo MUST live under the user's own
      // tryon-input/ prefix. Refuse anything else so a request can't
      // exfiltrate someone else's image into a prompt.
      if (!customPhotoPath.startsWith(`tryon-input/${uid}/`)) {
        throw new HttpsError('permission-denied', 'bad customPhotoPath');
      }
      referenceParts = [await downloadAsInlineData(bucket, customPhotoPath)];
      referenceCount = 1;
    } else {
      const userSnap = await db.collection('users').doc(uid).get();
      const identityRefs = (userSnap.exists && userSnap.data().identityRefs) || [];
      if (identityRefs.length === 0) {
        throw new HttpsError(
          'failed-precondition',
          'no identity reference photos — add 2-3 full-body photos in Settings first'
        );
      }
      for (const ref of identityRefs) {
        referenceParts.push(await downloadAsInlineData(bucket, ref.path));
      }
      referenceCount = identityRefs.length;
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
    // Reference(s) first, then each item crop. The prompt references "the
    // first reference image(s)" so the model knows which is the canvas.
    const parts = [...referenceParts];
    for (const it of items) {
      parts.push(await downloadAsInlineData(bucket, it.croppedPath));
    }
    const promptMode = customPhotoPath ? 'custom-photo' : 'identity-refs';
    parts.push({ text: tryOnPrompt(items, prompt, backgroundDesc, referenceCount, promptMode) });

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
