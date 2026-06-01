import { useEffect, useRef, useState } from 'react';
import { X, Camera as CameraIcon, RefreshCw, Check } from 'lucide-react';
import { useLocale } from '../hooks/useLocale.jsx';

// In-page webcam capture for desktop browsers (and as a fallback when
// the native flow isn't available). Uses navigator.mediaDevices.
// Returns a JPEG Blob via the onCapture callback. Requires HTTPS — the
// site is served over HTTPS so this is safe in production; on localhost
// dev it works because browsers treat localhost as a secure context.
//
// `burst`: when true the camera stays open after each shot and captures
// accumulate as thumbnails — snap several items in a row, then tap Done to
// return all of them at once via onDone(blobs[]). onCapture still fires per
// shot so callers that want streaming can use it; single-shot callers leave
// burst off and get the original close-on-capture behaviour.
export function CameraCaptureModal({ open, onClose, onCapture, burst = false, onDone }) {
  const { t } = useLocale();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  // Default to the rear camera for burst (shooting clothes laid out); the
  // single-shot flow keeps front-facing as before.
  const [facingMode, setFacingMode] = useState(burst ? 'environment' : 'user');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  // Burst-mode accumulator: { url, blob }[]. Reset whenever the modal opens.
  const [shots, setShots] = useState([]);

  useEffect(() => {
    if (!open) return;
    setShots([]);
  }, [open]);

  // Revoke thumbnail object URLs on unmount to avoid leaking them.
  useEffect(() => () => { shots.forEach(s => URL.revokeObjectURL(s.url)); }, [shots]);

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
      if (!blob) return;
      if (burst) {
        // Keep shooting — stash a thumbnail + blob and leave the camera live.
        setShots(prev => [...prev, { url: URL.createObjectURL(blob), blob }]);
        onCapture?.(blob);
      } else {
        onCapture?.(blob);
      }
    }, 'image/jpeg', 0.9);
  };

  const finishBurst = () => {
    const blobs = shots.map(s => s.blob);
    // Hand back the blobs first; let the parent close + the unmount cleanup
    // revoke the URLs.
    onDone?.(blobs);
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

      {!error && burst && shots.length > 0 && (
        <div className="camera-filmstrip">
          {shots.map((s, i) => (
            <div key={i} className="camera-filmstrip-thumb">
              <img src={s.url} alt="" />
              <button
                type="button"
                className="camera-filmstrip-rm"
                onClick={() => setShots(prev => {
                  const next = [...prev];
                  const [removed] = next.splice(i, 1);
                  if (removed) URL.revokeObjectURL(removed.url);
                  return next;
                })}
                aria-label={t('remove')}
              >
                <X size={12} strokeWidth={2.4} />
              </button>
            </div>
          ))}
        </div>
      )}

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
          {burst ? (
            <button
              type="button"
              className="camera-done"
              onClick={finishBurst}
              disabled={shots.length === 0}
              aria-label={t('done')}
            >
              <Check size={20} strokeWidth={2} />
              {shots.length > 0 && <span className="camera-done-count">{shots.length}</span>}
            </button>
          ) : (
            <span className="camera-spacer" />
          )}
        </div>
      )}
    </div>
  );
}

export default CameraCaptureModal;
