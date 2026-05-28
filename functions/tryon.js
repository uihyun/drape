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
const sharp = require('sharp');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { removeBackground } = require('@imgly/background-removal-node');

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

OUTPUT FORMAT — strict: a SINGLE photorealistic image at the same
resolution and aspect as the first reference photo. Do NOT produce a
grid, collage, contact sheet, side-by-side comparison, before/after
split, or multiple variations. One image, one frame, one person.`;
  }

  // ── identity-refs: full strip-and-redress on a studio plate ──────
  // The reference photos are the person's identity references. We ignore
  // what they were wearing and dress them in the supplied outfit. The
  // prompt is kept short and direct — earlier verbose if/then variants
  // triggered Gemini to return a 6-tile contact sheet inside a single
  // PNG.
  const bgClause = backgroundDesc
    ? `Place them against this background: ${backgroundDesc}.`
    : `Place them against a plain white fashion lookbook background.`;

  return `Dress the person from the reference photos in the supplied
clothing (${itemSummary}). Remove whatever they were originally wearing
and have them wear the supplied garments instead. Match the FIRST
reference photo's pose and framing exactly.

Render fabric texture, drape, fold, and shadow naturally on the person's
body. Keep the person's face, hair, skin, and body proportions IDENTICAL
to the reference photos. Full-body shot, head to feet, do not crop.

If a category isn't supplied (e.g. no bottom given), fill with quiet,
neutral basics in matching tones so the person is fully dressed.

${bgClause}

${customPrompt ? `Additional direction: ${customPrompt}` : ''}

OUTPUT FORMAT — strict: a SINGLE photorealistic image of ONE person in
ONE outfit. Do NOT produce a grid, collage, contact sheet, side-by-side
comparison, before/after split, or multiple poses. One image, one frame,
one person, no panels.`;
}

exports.virtualTryOn = onCall(
  { secrets: [geminiApiKey], cors: true, timeoutSeconds: 180, memory: '2GiB' },
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
      // Custom-photo mode default = keep the original scene. Pass true
      // to run segmentation on the result so the figure ends up on a
      // clean white card (matches the identity-refs default look).
      removeCustomBg = false,
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

    // Pro-only — the Flash tier was dropped (quality wasn't worth the
    // split). `modelTier` may still arrive from older clients; ignore it.
    const modelId = IMAGE_PRO;
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
      modelTier: 'pro',
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
        // Normalize EVERY variant (except custom-photo) to a fixed 3:4
        // canvas so every result card renders at the same size:
        //   - default identity-refs (no backgroundDesc) → Gemini paints
        //     the figure on a plain white catalog backdrop. trim strips
        //     that padding, then resize fit:contain pads back into 900x1200
        //     with white — figure fills the canvas vertically.
        //   - backgroundDesc set → Gemini paints a real scene. trim is a
        //     no-op on a varied edge; fit:cover scales to fill 900x1200
        //     and side-crops the scene (figure is centered, stays in
        //     frame). fit:contain would leave white bars top+bottom
        //     because the scene was 1:1 instead of 3:4.
        // Custom-photo mode: skip both — preserve the real photo aspect
        // and background.
        let buf = Buffer.from(img.data, 'base64');
        // Normalize unless we're in custom-photo mode AND the user
        // wants the original scene preserved. removeCustomBg=true
        // opts custom-photo into the same segmentation+white-card
        // pipeline as the identity-refs default.
        const shouldNormalize = !customPhotoPath || removeCustomBg;
        if (shouldNormalize) {
          const hasScene = !customPhotoPath && !!(backgroundDesc && backgroundDesc.trim());
          try {
            if (hasScene) {
              // Real scene — keep Gemini's backdrop, just fit to
              // the 3:4 canvas via cover crop.
              buf = await sharp(buf)
                .resize({ width: 900, height: 1200, fit: 'cover' })
                .png().toBuffer();
            } else {
              // No-scene mode: figure size must be consistent across
              // variants, but color-trim fails when Gemini draws a
              // gradient / cast shadow in its catalog backdrop (it
              // stops at the first non-matching pixel, leaving a
              // few-cm margin above the head and below the feet).
              // Solution: run segmentation on the Gemini output to
              // get a semantic figure mask, trim transparent edges
              // (always accurate, no threshold guesswork), then
              // composite the trimmed figure centered on a 900x1200
              // white card.
              const blob = new Blob([buf], { type: img.mimeType || 'image/png' });
              const cutoutBlob = await removeBackground(blob, {
                output: { format: 'image/png' },
              });
              const cutout = Buffer.from(await cutoutBlob.arrayBuffer());
              // Save the figure at full canvas resolution. Visual
              // breathing margin around the figure is added at CSS
              // level on .variant (padding), so the same image
              // looks calm no matter what size the card renders at.
              const figure = await sharp(cutout)
                .trim({ threshold: 1 })
                .resize({
                  width: 900,
                  height: 1200,
                  fit: 'contain',
                  background: { r: 255, g: 255, b: 255, alpha: 0 },
                })
                .png().toBuffer();
              buf = await sharp({
                create: { width: 900, height: 1200, channels: 3, background: { r: 255, g: 255, b: 255 } },
              }).composite([{ input: figure }]).png().toBuffer();
            }
          } catch (e) {
            console.warn('try-on normalize skipped:', e?.message);
          }
        }
        await bucket.file(path).save(buf, {
          metadata: { contentType: 'image/png', cacheControl: 'public,max-age=31536000,immutable' },
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
