// share-service.js
//
// Single entry point for "share this URL" and "save / share this image" so
// the call sites (ResultStep, DesignDetail, ShareView, CollectionPage,
// Invite) don't each have to re-decide between Web Share API and the
// Capacitor native plugins.
//
// Web path: navigator.share when available; clipboard fallback.
// Native path (Sprint A 5단계): Capacitor Share + Filesystem. Images get
// written to the cache directory first, then handed to the native share
// sheet — iOS exposes a "Save Image" action that goes to Photos, and the
// usual Messages / Mail / AirDrop targets all work the same way.

import { isNativeApp } from './platform-service.js';

// --- Web helpers ------------------------------------------------------------

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result || '';
      const comma = String(result).indexOf(',');
      resolve(comma >= 0 ? String(result).slice(comma + 1) : String(result));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function downloadBlobAsFile(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

// --- Public API -------------------------------------------------------------

// Share a link (no image attached). Returns true if a share UI was actually
// presented; false if we fell back to copying to the clipboard.
export async function shareLink({ title, text, url }) {
  if (isNativeApp()) {
    const { Share } = await import('@capacitor/share');
    try {
      await Share.share({ title, text, url, dialogTitle: title || 'Share' });
      return true;
    } catch (err) {
      if (err?.message?.toLowerCase?.().includes('canceled')) return false;
      throw err;
    }
  }
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return true;
    } catch (err) {
      if (err.name === 'AbortError') return false;
      // Fall through to clipboard
    }
  }
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    /* swallow — caller decides whether to show "copied" UI */
  }
  return false;
}

// Save / share an image. On native we write to the cache dir then invoke the
// native share sheet (iOS users pick "Save Image" to put it in Photos). On web
// we trigger the standard download anchor.
export async function shareOrDownloadImage({ blob, filename, title, text }) {
  if (isNativeApp()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ]);
    const data = await blobToBase64(blob);
    const writeRes = await Filesystem.writeFile({
      path: filename,
      data,
      directory: Directory.Cache,
    });
    try {
      await Share.share({
        title,
        text,
        url: writeRes.uri,
        dialogTitle: title || 'Share image',
      });
      return 'shared';
    } catch (err) {
      if (err?.message?.toLowerCase?.().includes('canceled')) return 'cancelled';
      throw err;
    }
  }
  downloadBlobAsFile(blob, filename);
  return 'downloaded';
}
