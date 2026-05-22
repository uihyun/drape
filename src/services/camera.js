// Camera capture and image processing utilities

export const CameraService = {
  // Open the system camera (native via Capacitor when available, falls back
  // to hidden file input with capture attribute on web). Returns a Blob.
  async takePhoto() {
    // Native Capacitor: lazy-load @capacitor/camera to avoid pulling it
    // into the web bundle. We don't depend on it directly.
    try {
      // Dynamic-string import — vite leaves it alone (no static resolution).
      // @capacitor/camera is not in deps yet; the web fallback below covers
      // the dev / web build.
      const mod = '@capacitor/camera';
      const { Camera, CameraResultType } = await import(/* @vite-ignore */ mod);
      const photo = await Camera.getPhoto({
        quality: 85,
        resultType: CameraResultType.Base64,
        allowEditing: false,
      });
      const res = await fetch(`data:image/jpeg;base64,${photo.base64String}`);
      return await res.blob();
    } catch {
      // Web fallback — synthesize an <input capture=environment>.
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';
        input.onchange = () => resolve(input.files?.[0] || null);
        input.click();
      });
    }
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
