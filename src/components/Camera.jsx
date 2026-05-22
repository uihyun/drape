import { useRef, useEffect, useState } from 'react';
import { CameraService } from '../services/camera.js';

export const CameraComponent = ({ onCapture, onClose, onError }) => {
  const videoRef = useRef();
  const [stream, setStream] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureError, setCaptureError] = useState(null);

  useEffect(() => {
    initCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const initCamera = async () => {
    try {
      const cameraStream = await CameraService.getCameraStream();
      setStream(cameraStream);
      if (videoRef.current) {
        videoRef.current.srcObject = cameraStream;
      }
    } catch (error) {
      onError?.(error.message);
      onClose();
    }
  };

  const handleCapture = async () => {
    if (!videoRef.current || isCapturing) return;
    setCaptureError(null);
    setIsCapturing(true);
    try {
      const blob = await CameraService.capturePhoto(videoRef.current);
      const compressedBlob = await CameraService.compressImage(blob);
      onCapture(compressedBlob);
    } catch (error) {
      console.error('Photo capture failed:', error);
      setCaptureError('Failed to capture photo. Please try again.');
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: '#000',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column'
    }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{
          flex: 1,
          width: '100%',
          objectFit: 'cover'
        }}
      />
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '1.25rem 2rem 2rem',
        gap: '1rem',
        background: 'rgba(0,0,0,0.8)'
      }}>
        {captureError && (
          <p style={{ color: '#fca5a5', fontSize: '0.875rem', margin: 0 }}>{captureError}</p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
        <button
          onClick={onClose}
          className="btn btn-secondary"
          style={{ 
            color: 'white', 
            background: 'rgba(255,255,255,0.2)' 
          }}
        >
          <i className="material-icons">close</i>
          닫기
        </button>
        <button
          onClick={handleCapture}
          disabled={isCapturing}
          className="btn btn-primary"
          style={{
            background: 'white',
            color: '#000',
            borderRadius: '50%',
            width: '64px',
            height: '64px',
            minHeight: '64px',
            padding: 0
          }}
        >
          <i 
            className="material-icons"
            style={{ fontSize: '2rem' }}
          >
            {isCapturing ? 'hourglass_empty' : 'camera_alt'}
          </i>
        </button>
        </div>
      </div>
    </div>
  );
};