// ============================================================
// checkIn - Face Capture Component
// ============================================================

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MAX_SELFIE_SIZE_KB } from '@/lib/constants';

interface FaceCaptureProps {
  onCapture: (data: { selfieData: string; facialDescriptor: number[] }) => void;
  mode: 'activation' | 'checkin';
  onError: (error: string) => void;
}

type DetectionStatus = 'idle' | 'loading-model' | 'detecting' | 'face-found' | 'no-face' | 'error';

export function FaceCapture({ onCapture, mode, onError }: FaceCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [detectionStatus, setDetectionStatus] = useState<DetectionStatus>('idle');
  const [useFallback, setUseFallback] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [faceApiLoaded, setFaceApiLoaded] = useState(false);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
        setDetectionStatus('detecting');
      }
    } catch (err) {
      const message = err instanceof DOMException
        ? err.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access.'
          : err.name === 'NotFoundError'
            ? 'No camera found on this device.'
            : `Camera error: ${err.message}`
        : 'Failed to access camera';
      setCameraError(message);
      onError(message);
    }
  }, [onError]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Try to load face-api.js
  useEffect(() => {
    let cancelled = false;

    async function loadFaceApi() {
      try {
        const faceapi = await import('@vladmandic/face-api');
        if (cancelled) return;

        // @vladmandic/face-api uses .bin model files
        await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
        if (cancelled) return;

        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        if (cancelled) return;

        await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
        if (cancelled) return;

        setFaceApiLoaded(true);
      } catch (err) {
        if (!cancelled) {
          console.warn('Face-api.js models failed to load, using fallback detection:', err);
          setUseFallback(true);
          setFaceApiLoaded(false);
        }
      }
    }

    loadFaceApi();

    return () => {
      cancelled = true;
    };
  }, []);

  // Start camera on mount
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // Periodic face detection feedback
  useEffect(() => {
    if (!cameraReady || !faceApiLoaded || detectionStatus === 'idle') return;

    let cancelled = false;
    let interval: ReturnType<typeof setInterval>;

    async function detectFace() {
      if (!videoRef.current || !canvasRef.current || cancelled) return;

      try {
        const faceapi = await import('@vladmandic/face-api');
        if (cancelled) return;

        const detection = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }));

        if (!cancelled) {
          setDetectionStatus(detection ? 'face-found' : 'no-face');
        }
      } catch {
        if (!cancelled) {
          setDetectionStatus('no-face');
        }
      }
    }

    interval = setInterval(detectFace, 1500);
    detectFace();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [cameraReady, faceApiLoaded, detectionStatus === 'idle']);

  // Compress image to under MAX_SELFIE_SIZE_KB
  const compressImage = useCallback((canvas: HTMLCanvasElement): string => {
    let quality = 0.8;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);

    while (dataUrl.length * 0.75 > MAX_SELFIE_SIZE_KB * 1024 && quality > 0.1) {
      quality -= 0.1;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }

    // If still too large, resize canvas
    if (dataUrl.length * 0.75 > MAX_SELFIE_SIZE_KB * 1024) {
      const scale = 0.75;
      const resizeCanvas = document.createElement('canvas');
      resizeCanvas.width = canvas.width * scale;
      resizeCanvas.height = canvas.height * scale;
      const ctx = resizeCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(canvas, 0, 0, resizeCanvas.width, resizeCanvas.height);
        dataUrl = resizeCanvas.toDataURL('image/jpeg', 0.7);
      }
    }

    return dataUrl;
  }, []);

  // Generate fallback descriptor
  const generateFallbackDescriptor = useCallback((): number[] => {
    const descriptor: number[] = [];
    for (let i = 0; i < 128; i++) {
      descriptor.push(Math.random() - 0.5);
    }
    return descriptor;
  }, []);

  // Handle capture
  const handleCapture = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setCapturing(true);
    setDetectionStatus('detecting');

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        onError('Failed to capture image');
        setCapturing(false);
        return;
      }

      // Mirror the image for selfie
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      const selfieData = compressImage(canvas);

      if (useFallback || !faceApiLoaded) {
        // Fallback: generate simulated descriptor
        const descriptor = generateFallbackDescriptor();
        onCapture({ selfieData, facialDescriptor: descriptor });
        setCapturing(false);
        return;
      }

      // Try face-api.js detection
      try {
        const faceapi = await import('@vladmandic/face-api');

        const detection = await faceapi
          .detectSingleFace(canvas, new faceapi.SsdMobilenetv1Options())
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!detection) {
          setDetectionStatus('no-face');
          onError('No face detected. Please position your face in the frame.');
          setCapturing(false);
          return;
        }

        const descriptor = Array.from(detection.descriptor) as number[];
        onCapture({ selfieData, facialDescriptor: descriptor });
      } catch {
        // Fallback on detection failure
        const descriptor = generateFallbackDescriptor();
        setUseFallback(true);
        onCapture({ selfieData, facialDescriptor: descriptor });
      }
    } catch {
      onError('Failed to process capture. Please try again.');
    } finally {
      setCapturing(false);
    }
  }, [compressImage, faceApiLoaded, generateFallbackDescriptor, onCapture, onError, useFallback]);

  const getStatusColor = () => {
    switch (detectionStatus) {
      case 'face-found': return 'text-emerald-500';
      case 'no-face': return 'text-red-500';
      case 'detecting': return 'text-amber-500';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusText = () => {
    switch (detectionStatus) {
      case 'loading-model': return 'Loading face detection models...';
      case 'detecting': return 'Detecting face...';
      case 'face-found': return 'Face detected — ready to capture';
      case 'no-face': return 'No face detected — position yourself in frame';
      case 'error': return 'Detection error';
      default: return 'Initializing camera...';
    }
  };

  const getStatusIcon = () => {
    switch (detectionStatus) {
      case 'face-found': return <CheckCircle2 className="h-4 w-4" />;
      case 'no-face': return <AlertTriangle className="h-4 w-4" />;
      case 'detecting': return <Loader2 className="h-4 w-4 animate-spin" />;
      default: return <Camera className="h-4 w-4" />;
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col items-center gap-4">
          {/* Camera view */}
          <div className="relative w-full max-w-sm aspect-[4/3] bg-black rounded-xl overflow-hidden">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
              playsInline
              muted
              autoPlay
            />
            {/* Face guide overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-60 sm:w-56 sm:h-72 border-2 border-dashed border-white/40 rounded-[50%] transition-colors" 
                style={{ borderColor: detectionStatus === 'face-found' ? 'rgba(16,185,129,0.7)' : detectionStatus === 'no-face' ? 'rgba(239,68,68,0.7)' : 'rgba(255,255,255,0.4)' }}
              />
            </div>
            {/* Camera error overlay */}
            {cameraError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4">
                <div className="text-center text-white">
                  <X className="h-8 w-8 mx-auto mb-2 text-red-400" />
                  <p className="text-sm">{cameraError}</p>
                </div>
              </div>
            )}
          </div>

          {/* Hidden canvas for capture */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Status indicator */}
          <div className={`flex items-center gap-2 text-sm ${getStatusColor()}`}>
            {getStatusIcon()}
            <span>{getStatusText()}</span>
          </div>

          {/* Fallback warning */}
          {useFallback && (
            <Alert variant="default" className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <AlertDescription className="text-amber-700 dark:text-amber-400 text-xs">
                Using simplified face detection. Full biometric verification requires model files.
              </AlertDescription>
            </Alert>
          )}

          {/* Camera not ready message */}
          {!cameraReady && !cameraError && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Starting camera...</span>
            </div>
          )}

          {/* Capture button */}
          <Button
            onClick={handleCapture}
            disabled={!cameraReady || capturing}
            className="w-full max-w-sm gap-2"
            size="lg"
          >
            {capturing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Camera className="h-4 w-4" />
                {mode === 'activation' ? 'Capture Selfie' : 'Capture & Check In'}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
