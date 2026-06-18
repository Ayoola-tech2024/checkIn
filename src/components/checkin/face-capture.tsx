// ============================================================
// checkIn - Face Capture Component (Google MediaPipe FaceMesh)
// ============================================================
// SECURITY: Live camera ONLY — no photo upload mode.
// This prevents activation/check-in with a static photo of
// another person.

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, AlertTriangle, CheckCircle2, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MAX_SELFIE_SIZE_KB } from '@/lib/constants';
import { landmarksToDescriptor, compressCanvasImage } from '@/lib/face-utils';

interface FaceCaptureProps {
  onCapture: (data: { selfieData: string; facialDescriptor: number[] }) => void;
  mode: 'activation' | 'checkin';
  onError: (error: string) => void;
}

type DetectionStatus =
  | 'idle'
  | 'loading-model'
  | 'camera-starting'
  | 'detecting'
  | 'face-found'
  | 'no-face'
  | 'error';

export function FaceCapture({ onCapture, mode: _mode, onError }: FaceCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceMeshRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);

  const [status, setStatus] = useState<DetectionStatus>('idle');
  const [capturedSelfie, setCapturedSelfie] = useState<string | null>(null);
  const [capturedDescriptor, setCapturedDescriptor] = useState<number[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [lastLandmarks, setLastLandmarks] = useState<any>(null);

  // Load MediaPipe FaceMesh
  const loadFaceMesh = useCallback(async (): Promise<any> => {
    if (faceMeshRef.current) return faceMeshRef.current;

    try {
      setStatus('loading-model');

      const { FaceMesh } = await import('@mediapipe/face_mesh');

      const faceMesh = new FaceMesh({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        },
      });

      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      faceMeshRef.current = faceMesh;
      return faceMesh;
    } catch (error) {
      console.error('Failed to load MediaPipe FaceMesh:', error);
      setErrorMessage('Failed to load face detection model. Please try again.');
      setStatus('error');
      return null;
    }
  }, []);

  // Process face mesh results
  const onResults = useCallback((results: any) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = videoRef.current?.videoWidth || 640;
    canvas.height = videoRef.current?.videoHeight || 480;
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      const landmarks = results.multiFaceLandmarks[0];
      setLastLandmarks(landmarks);
      setStatus('face-found');

      // Draw face mesh overlay (subtle)
      ctx.strokeStyle = 'rgba(0, 200, 100, 0.3)';
      ctx.lineWidth = 1;

      const faceOval = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10];
      ctx.beginPath();
      for (let i = 0; i < faceOval.length; i++) {
        const idx = faceOval[i];
        if (landmarks[idx]) {
          const x = landmarks[idx].x * canvas.width;
          const y = landmarks[idx].y * canvas.height;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      ctx.fillStyle = 'rgba(0, 200, 100, 0.8)';
      ctx.font = '24px sans-serif';
      ctx.fillText('✓ Face Detected', 10, 30);
    } else {
      setStatus('no-face');
      setLastLandmarks(null);
    }
  }, []);

  // Start camera with MediaPipe
  const startCamera = useCallback(async () => {
    try {
      const faceMesh = await loadFaceMesh();
      if (!faceMesh) return;

      faceMesh.onResults(onResults);
      setStatus('camera-starting');

      const { Camera: MPCamera } = await import('@mediapipe/camera_utils');

      if (videoRef.current) {
        const camera = new MPCamera(videoRef.current, {
          onFrame: async () => {
            if (videoRef.current && faceMesh) {
              await faceMesh.send({ image: videoRef.current });
            }
          },
          width: 640,
          height: 480,
        });

        cameraRef.current = camera;
        await camera.start();
        setStatus('detecting');
      }
    } catch (error) {
      console.error('Camera start error:', error);
      setErrorMessage('Could not access camera. Please grant camera permission and try again.');
      setStatus('error');
      onError('Camera access denied or unavailable');
    }
  }, [loadFaceMesh, onResults, onError]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (cameraRef.current) {
      cameraRef.current.stop();
      cameraRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Capture the current face
  const handleCapture = useCallback(() => {
    if (!canvasRef.current) return;
    if (!lastLandmarks) {
      setErrorMessage('No face detected. Please position your face in the camera.');
      return;
    }

    const canvas = canvasRef.current;
    const selfieData = compressCanvasImage(canvas, MAX_SELFIE_SIZE_KB);
    const descriptor = landmarksToDescriptor(lastLandmarks);

    if (descriptor.length === 0) {
      setErrorMessage('Failed to process facial data. Please try again.');
      return;
    }

    setCapturedSelfie(selfieData);
    setCapturedDescriptor(descriptor);
    stopCamera();
  }, [lastLandmarks, stopCamera]);

  // Confirm capture
  const handleConfirm = useCallback(() => {
    if (capturedSelfie && capturedDescriptor) {
      onCapture({
        selfieData: capturedSelfie,
        facialDescriptor: capturedDescriptor,
      });
    }
  }, [capturedSelfie, capturedDescriptor, onCapture]);

  // Reset
  const handleReset = useCallback(() => {
    setCapturedSelfie(null);
    setCapturedDescriptor(null);
    setLastLandmarks(null);
    setErrorMessage('');
    setStatus('idle');
    startCamera();
  }, [startCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Auto-start camera on mount
  useEffect(() => {
    if (status === 'idle') {
      startCamera();
    }
  }, [startCamera, status]);

  return (
    <div className="space-y-4">
      {/* Camera View */}
      {!capturedSelfie && (
        <div className="relative rounded-lg overflow-hidden border bg-black">
          <video
            ref={videoRef}
            className="w-full max-h-80 object-contain"
            autoPlay
            playsInline
            muted
            style={{ display: 'none' }}
          />
          <canvas
            ref={canvasRef}
            className="w-full max-h-80 object-contain"
          />

          {/* Status overlay */}
          <div className="absolute top-2 left-2">
            {status === 'loading-model' && (
              <div className="bg-black/60 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                <Loader2 className="size-3 animate-spin" />
                Loading face detection...
              </div>
            )}
            {status === 'camera-starting' && (
              <div className="bg-black/60 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                <Loader2 className="size-3 animate-spin" />
                Starting camera...
              </div>
            )}
            {status === 'detecting' && (
              <div className="bg-amber-500/80 text-white text-xs px-2 py-1 rounded">
                Looking for face...
              </div>
            )}
            {status === 'face-found' && (
              <div className="bg-emerald-500/80 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                <CheckCircle2 className="size-3" />
                Face detected
              </div>
            )}
            {status === 'no-face' && (
              <div className="bg-amber-500/80 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                <AlertTriangle className="size-3" />
                No face detected
              </div>
            )}
          </div>
        </div>
      )}

      {/* Captured Preview */}
      {capturedSelfie && (
        <div className="space-y-3">
          <div className="relative rounded-lg overflow-hidden border bg-black">
            <img
              src={capturedSelfie}
              alt="Captured face"
              className="w-full max-h-80 object-contain"
            />
            <div className="absolute top-2 left-2">
              <div className="bg-emerald-500/80 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                <CheckCircle2 className="size-3" />
                Face captured
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleReset}
              className="flex-1"
            >
              <RotateCcw className="size-4 mr-2" />
              Retake
            </Button>
            <Button
              onClick={handleConfirm}
              className="flex-1"
            >
              <CheckCircle2 className="size-4 mr-2" />
              Confirm
            </Button>
          </div>
        </div>
      )}

      {/* Camera Capture Button */}
      {!capturedSelfie && status === 'face-found' && (
        <Button onClick={handleCapture} className="w-full" size="lg">
          <Camera className="size-4 mr-2" />
          Capture Face
        </Button>
      )}

      {/* Error Display */}
      {errorMessage && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* Instructions */}
      {!capturedSelfie && (
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-medium">Live camera is required for verification:</p>
          <ul className="list-disc list-inside space-y-0.5 ml-1">
            <li>Ensure good lighting on your face</li>
            <li>Face the camera directly (frontal view)</li>
            <li>Remove sunglasses or face coverings</li>
            <li>Keep a neutral expression</li>
          </ul>
        </div>
      )}
    </div>
  );
}
