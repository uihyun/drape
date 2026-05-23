import { useEffect, useRef, useState } from 'react';
import { X, Camera as CameraIcon, RefreshCw } from 'lucide-react';
import { useLocale } from '../hooks/useLocale.jsx';

// In-page webcam capture for desktop browsers (and as a fallback when
// the native flow isn't available). Uses navigator.mediaDevices.
// Returns a JPEG Blob via the onCapture callback. Requires HTTPS — the
// site is served over HTTPS so this is safe in production; on localhost
// dev it works because browsers treat localhost as a secure context.
export function CameraCaptureModal({ open, onClose, onCapture }) {
  const { t } = useLocale();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState('user'); // user = front, environment = rear
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let current = null;
    setError(null);

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error(t('cameraUnsupported'));
        }
        current = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 1280 } },
          audio: false,
        });
        if (cancelled) {
          current.getTracks().forEach(t => t.stop());
          return;
        }
        setStream(current);
        if (videoRef.current) {
          videoRef.current.srcObject = current;
          // play() can reject if the user navigates away mid-load — swallow.
          videoRef.current.play().catch(() => {});
        }
      } catch (e) {
        setError(e.message || t('cameraPermissionDenied'));
      }
    })();

    return () => {
      cancelled = true;
      if (current) current.getTracks().forEach(t => t.stop());
    };
  }, [open, facingMode, t]);

  // Stop the stream when the modal closes for real (not just on facing flip).
  useEffect(() => {
    if (open) return;
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const capture = () => {
    if (!videoRef.current || !canvasRef.current || busy) return;
    setBusy(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) { setBusy(false); return; }
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob((blob) => {
      setBusy(false);
      if (blob) onCapture?.(blob);
    }, 'image/jpeg', 0.9);
  };

  // Hide the flip button when there's only one camera (typical on desktops).
  const supportsMultipleCameras = typeof navigator !== 'undefined'
    && navigator.userAgent
    && /iPhone|iPad|iPod|Android/.test(navigator.userAgent);

  return (
    <div className="camera-overlay" role="dialog" aria-modal="true">
      <button
        type="button"
        className="camera-close"
        onClick={onClose}
        aria-label={t('close')}
      >
        <X size={22} strokeWidth={1.8} />
      </button>

      <div className="camera-stage">
        {error ? (
          <div className="camera-error">
            <p>{error}</p>
            <button type="button" className="btn btn-secondary" onClick={onClose}>{t('close')}</button>
          </div>
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            className="camera-preview"
          />
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {!error && (
        <div className="camera-controls">
          {supportsMultipleCameras && (
            <button
              type="button"
              className="camera-flip"
              onClick={() => setFacingMode(m => m === 'user' ? 'environment' : 'user')}
              aria-label={t('flipCamera')}
            >
              <RefreshCw size={20} strokeWidth={1.8} />
            </button>
          )}
          <button
            type="button"
            className="camera-shutter"
            onClick={capture}
            disabled={busy || !stream}
            aria-label={t('capture')}
          >
            <CameraIcon size={24} strokeWidth={1.6} />
          </button>
          <span className="camera-spacer" />
        </div>
      )}
    </div>
  );
}

export default CameraCaptureModal;
