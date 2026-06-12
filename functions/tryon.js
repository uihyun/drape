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

// Same as above but from a download URL — used when an outfit only carries a
// photo URL (e.g. seed / older OOTDs) and not a storage path. Node 22 has a
// global fetch.
async function fetchAsInlineData(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return {
    inlineData: {
      data: buf.toString('base64'),
      mimeType: res.headers.get('content-type') || 'image/jpeg',
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
// Place a segmented figure centered on a white 3:4 card. Computes the bbox
// from the ALPHA channel (solid pixels, alpha>128) instead of color-trim, so
// a faint segmentation artifact on one side can't widen the box and shove the
// figure off-center (which read as "the result is shifted right").
async function figureOnWhiteCard(cutoutBuf, W = 900, H = 1200) {
  try {
    const { data, info } = await sharp(cutoutBuf).ensureAlpha().raw()
      .toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;
    let minX = width, minY = height, maxX = -1, maxY = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * channels + 3] > 128) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < minX || maxY < minY) throw new Error('empty mask');
    const cropped = await sharp(cutoutBuf)
      .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
      .resize({ width: Math.round(W * 0.9), height: Math.round(H * 0.92), fit: 'inside' })
      .toBuffer();
    return await sharp({ create: { width: W, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
      .composite([{ input: cropped, gravity: 'centre' }])
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .png().toBuffer();
  } catch {
    // Fallback: simple contain onto white.
    return await sharp(cutoutBuf)
      .resize({ width: W, height: H, fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .png().toBuffer();
  }
}

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

  // ── outfit-ref: copy a whole worn look from a reference photo ─────
  // The garment input is NOT an isolated crop — it's a photo of someone
  // (or a flat-lay) wearing the complete outfit. Re-create that entire
  // styling on the user's identity, keeping THEIR face/body but taking the
  // clothing head-to-toe from the reference look.
  if (mode === 'outfit-ref') {
    const bgClause = backgroundDesc
      ? `Place them against this background: ${backgroundDesc}.`
      : `Place them against a plain white fashion lookbook background.`;
    return `You are given identity reference photo(s) of a person FIRST,
then a photo showing a complete outfit/look worn by someone else (or laid
out). Re-create that ENTIRE outfit on the person from the identity photos.

Take the full styling from the outfit photo — every visible garment and
how they are combined (top, bottom, outerwear, shoes, and notable
accessories), including colors, materials, proportions, and the way the
pieces are layered and worn. Reproduce the look as faithfully as possible.

KEEP the person from the identity photos IDENTICAL: face, hair, skin tone,
body proportions, height. Give them a natural full-body standing pose. Show
exactly ONE person, full body head to feet; do not add a second person from
the reference photos. Do NOT copy the other person's face, body, or identity
from the outfit photo — only their clothing and styling.

CRITICAL — you MUST synthesize a NEW image. Do NOT return, crop, or lightly
edit any of the input photos. The identity person must be shown WEARING THE
NEW OUTFIT from the outfit photo — never their own original clothes from the
identity photos. If the output looks like one of the input photos, it is wrong.

BODY — critical: the height, weight, build, and body proportions come
ENTIRELY from the identity photos. The person in the outfit photo may have a
completely different body type; IGNORE their build. Do NOT make the identity
person heavier, thinner, taller, or shorter to match the outfit photo — keep
the identity person's exact slim/natural build from their own photos. Only
the clothing transfers, never the body.

Render fabric texture, drape, fold, and shadow naturally on the body.

${bgClause}

${customPrompt ? `Additional direction: ${customPrompt}` : ''}

OUTPUT FORMAT — strict: a SINGLE photorealistic image of ONE person,
centered in the frame, full body head to feet with even margins on the left
and right. Do NOT produce a grid, collage, contact sheet, side-by-side
comparison, before/after split, or multiple poses. One image, one frame,
one person, no panels.`;
  }

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
and have them wear the supplied garments instead. Match the FIRST reference
photo's pose and framing — keep the person's natural stance. Show exactly
ONE person, full body head to feet; do not add a second person from the
reference photos.

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
      title = '',
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
      // Outfit-reference mode: re-create the FULL look from a public outfit's
      // photo on the user's identity. The garment input is that worn-outfit
      // photo (not isolated crops), so no itemIds are needed. The server
      // resolves the photo from the outfit doc and only allows public ones.
      outfitRefId = null,
    } = request.data || {};
    const isOutfitRef = !!outfitRefId;
    if (!isOutfitRef && (!Array.isArray(itemIds) || itemIds.length === 0)) {
      throw new HttpsError('invalid-argument', 'itemIds required');
    }
    if (Array.isArray(itemIds) && itemIds.length > 6) {
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
      itemIds: Array.isArray(itemIds) ? itemIds : [],
      outfitRefId: outfitRefId || null,
      title: (title || '').slice(0, 80),
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

    // ── Load garment input ─────────────────────────────────────────────
    // Two sources: (a) the user's own item crops (itemIds), ownership-checked;
    // (b) a public outfit's worn-look photo (outfitRefId) — re-create the
    // whole look. Only ONE mode is active per call.
    const items = [];
    let outfitRefPart = null;
    if (isOutfitRef) {
      const oSnap = await db.collection('outfits').doc(outfitRefId).get();
      if (!oSnap.exists) {
        await genRef.update({ status: 'failed', errors: ['outfit missing'], updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        throw new HttpsError('not-found', 'outfit missing');
      }
      const o = oSnap.data();
      // Only public outfits can be borrowed (your own private ones too).
      if (!o.isPublic && o.userId !== uid) {
        await genRef.update({ status: 'failed', errors: ['outfit not public'], updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        throw new HttpsError('permission-denied', 'outfit not public');
      }
      // Use the FULL worn photo (scene intact), NOT the person-cutout. The
      // cutout is a person on a white/transparent plate — visually identical
      // to the user's identity refs (also white-bg cutouts), so feeding it
      // makes the model confuse "person to copy clothes FROM" with "person to
      // keep the identity OF": it keeps the identity's own clothes or copies
      // the wrong face. A full scene photo reads clearly as "someone else
      // wearing the look" — which is why analyzed posts (no cutout) already
      // work. Try each source as a storage PATH first, then as a download URL
      // (seed/older OOTDs may carry only the URL); the cutout is the last
      // resort.
      const sources = [
        [o.photoPath, o.photoUrl],
        [o.sourcePhotoPath, o.sourcePhotoUrl],
        [o.coverPath, o.coverUrl],
        [o.photoCutPath, o.photoCutUrl],
      ];
      for (const [p, u] of sources) {
        try {
          if (p) { outfitRefPart = await downloadAsInlineData(bucket, p); break; }
          if (u) { outfitRefPart = await fetchAsInlineData(u); break; }
        } catch (e) {
          console.warn('outfit-ref source load failed, trying next:', e?.message);
        }
      }
      if (!outfitRefPart) {
        await genRef.update({ status: 'failed', errors: ['outfit has no usable photo'], updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        throw new HttpsError('failed-precondition', 'outfit has no photo');
      }
    } else {
      const itemDocs = await Promise.all(
        itemIds.map(id => db.collection('items').doc(id).get())
      );
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
    }

    // ── Build prompt parts ─────────────────────────────────────────────
    const parts = [...referenceParts];
    if (isOutfitRef) {
      parts.push(outfitRefPart);
    } else {
      for (const it of items) {
        parts.push(await downloadAsInlineData(bucket, it.croppedPath));
      }
    }
    const promptMode = isOutfitRef
      ? 'outfit-ref'
      : (customPhotoPath ? 'custom-photo' : 'identity-refs');
    parts.push({ text: tryOnPrompt(items, prompt, backgroundDesc, referenceCount, promptMode) });

    // ── Run N variants in parallel ─────────────────────────────────────
    // Relax safety to BLOCK_ONLY_HIGH: at the default MEDIUM threshold the
    // image model over-refuses ordinary fashion photos of people (esp. young
    // women in skirts/dresses) and, instead of erroring, silently returns one
    // of the INPUT photos unchanged — which surfaced as "the try-on just shows
    // my reference photo". This is legitimate styling content; loosen it so
    // the model actually generates.
    const genai = new GoogleGenerativeAI(geminiApiKey.value());
    const safetySettings = [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    ];
    const model = genai.getGenerativeModel({ model: modelId, safetySettings });

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
              // Center the figure on a white 3:4 card via its alpha bbox
              // (robust to faint artifacts that color-trim would mis-include).
              buf = await figureOnWhiteCard(cutout);
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
