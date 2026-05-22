// Canvas-based "Made with Drape" watermark applied to Free-tier downloads.
// Pro tier downloads the raw bytes. The intent is light brand marking, not
// piracy prevention — Pro users get the clean asset.

const WORDMARK = 'Made with Drape';
const FONT = '600 16px -apple-system, BlinkMacSystemFont, "Helvetica Neue", "Segoe UI", sans-serif';

/**
 * Returns a Blob of the watermarked image. Falls back to the original blob
 * if Canvas is unavailable or the source image fails to decode.
 */
export async function applyWatermark(blob) {
  if (typeof document === 'undefined' || !blob) return blob;
  try {
    const url = URL.createObjectURL(blob);
    const img = await loadImage(url);
    URL.revokeObjectURL(url);

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    // Bottom-right pill with the wordmark.
    const padding = Math.round(canvas.width * 0.018);
    const fontPx = Math.max(12, Math.round(canvas.width * 0.018));
    ctx.font = FONT.replace('16px', `${fontPx}px`);
    const metrics = ctx.measureText(WORDMARK);
    const w = metrics.width + padding * 2;
    const h = fontPx + padding;
    const x = canvas.width - w - padding;
    const y = canvas.height - h - padding;

    ctx.fillStyle = 'rgba(14, 14, 16, 0.72)';
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fill();

    ctx.fillStyle = '#FAFAFA';
    ctx.textBaseline = 'middle';
    ctx.fillText(WORDMARK, x + padding, y + h / 2);

    return await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b || blob), 'image/png');
    });
  } catch (err) {
    console.warn('watermark failed, returning original:', err?.message);
    return blob;
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
