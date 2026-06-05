// Camera capture and image processing utilities
import { isNativeApp } from './platform-service.js';

// Web fallback picker — a hidden <input type="file"> appended to the DOM
// (iOS WKWebView won't fire `change` on a detached input). `capture` forces
// the rear camera; omit it to open the file/photo picker. Resolves a Blob,
// or null if the user cancels (so callers never await forever).
function webFilePick({ capture = false } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (capture) input.capture = 'environment';
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    const cleanup = () => { try { input.remove(); } catch { /* ignore */ } };
    input.onchange = () => { const f = input.files?.[0] || null; cleanup(); resolve(f); };
    input.oncancel = () => { cleanup(); resolve(null); };
    document.body.appendChild(input);
    input.click();
  });
}

export const CameraService = {
  // Open the system camera. Native: Capacitor Camera forced to the CAMERA
  // source (so it never shows the Photo Library / Take Photo / Choose File
  // menu). Web: hidden file input with capture=environment. Returns a Blob.
  async takePhoto() {
    if (isNativeApp()) {
      try {
        const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
        const photo = await Camera.getPhoto({
          quality: 85,
          resultType: CameraResultType.Base64,
          allowEditing: false,
          source: CameraSource.Camera,
        });
        const res = await fetch(`data:image/jpeg;base64,${photo.base64String}`);
        return await res.blob();
      } catch (e) {
        // User cancelled the native camera → no blob, don't fall through to a
        // file input (that would re-open a picker). Only fall back if the
        // plugin itself is unavailable.
        if (/cancel/i.test(e?.message || '')) return null;
      }
    }
    return webFilePick({ capture: true });
  },

  // Pick an existing photo. Native: Capacitor Camera forced to the PHOTOS
  // source, so it opens the photo library DIRECTLY (no intermediate menu).
  // Web: hidden file input (no capture) → the browser's file/photo picker.
  // Returns a Blob, or null if cancelled.
  async pickFromLibrary() {
    if (isNativeApp()) {
      try {
        const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
        const photo = await Camera.getPhoto({
          quality: 90,
          resultType: CameraResultType.Base64,
          allowEditing: false,
          source: CameraSource.Photos,
        });
        const res = await fetch(`data:image/jpeg;base64,${photo.base64String}`);
        return await res.blob();
      } catch (e) {
        if (/cancel/i.test(e?.message || '')) return null;
      }
    }
    return webFilePick({ capture: false });
  },

  // Image compression settings
  compressionSettings: {
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 0.85,
    format: 'image/jpeg'
  },

  // Compress image before processing
  compressImage(file, options = {}) {
    return new Promise((resolve, reject) => {
      const settings = { ...this.compressionSettings, ...options };

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        let { width, height } = img;

        if (width > height) {
          if (width > settings.maxWidth) {
            height = (height * settings.maxWidth) / width;
            width = settings.maxWidth;
          }
        } else {
          if (height > settings.maxHeight) {
            width = (width * settings.maxHeight) / height;
            height = settings.maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Image compression failed'));
          },
          settings.format,
          settings.quality
        );
      };

      img.onerror = () => reject(new Error('Failed to load image. Please try a JPEG, PNG, or WebP file.'));
      img.src = URL.createObjectURL(file);
    });
  },

  // Compress a Blob (e.g. from camera capture)
  compressBlob(blob, options = {}) {
    return new Promise((resolve, reject) => {
      const settings = { ...this.compressionSettings, ...options };
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      const url = URL.createObjectURL(blob);

      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width > settings.maxWidth) {
          height = (height * settings.maxWidth) / width;
          width = settings.maxWidth;
        }
        if (height > settings.maxHeight) {
          width = (width * settings.maxHeight) / height;
          height = settings.maxHeight;
        }
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (out) => { if (out) resolve(out); else reject(new Error('Compression failed')); },
          settings.format,
          settings.quality
        );
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to read image')); };
      img.src = url;
    });
  },

  // Get camera stream
  async getCameraStream(constraints = { video: { facingMode: 'environment' } }) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      return stream;
    } catch (error) {
      console.error('Camera access failed:', error);
      throw new Error('Cannot access camera.');
    }
  },

  // Capture photo from video stream
  capturePhoto(videoElement) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    context.drawImage(videoElement, 0, 0);
    return new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.85);
    });
  },

  // Convert blob to base64 (strips the data URL prefix)
  blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  },

  // Validate image file
  validateImageFile(file) {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    const maxSize = 20 * 1024 * 1024; // 20MB (we compress before sending)

    if (!validTypes.includes(file.type.toLowerCase())) {
      throw new Error('Unsupported file type. Please upload a JPEG, PNG, or WebP image.');
    }
    if (file.size > maxSize) {
      throw new Error('File is too large. Please upload an image under 20MB.');
    }
    return true;
  }
};
