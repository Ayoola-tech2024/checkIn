// ============================================================
// checkIn - Face Capture Component (Robust with Multiple Fallbacks)
// ============================================================

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, AlertTriangle, CheckCircle2, Loader2, X, RotateCcw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MAX_SELFIE_SIZE_KB } from '@/lib/constants';

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

// Module-level cache for face-api to avoid re-importing
let faceApiModule: typeof import('@vladmandic/face-api') | null = null;
let modelsLoaded = false;
let modelLoadPromise: Promise<boolean> | null = null;

export function FaceCapture({ onCapture, mode, onError }: FaceCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [detectionStatus, setDetectionStatus] = useState<DetectionStatus>('idle');
  const [faceApiLoaded, setFaceApiLoaded] = useState(false);
  const [useImageHash, setUseImageHash] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [modelLoadingMsg, setModelLoadingMsg] = useState('Initializing...');

  // ─── Load face-api.js models ────────────────────────────────
  const loadModels = useCallback(async (): Promise<boolean> => {
    // If already loaded, return immediately
    if (modelsLoaded && faceApiModule) {
      setFaceApiLoaded(true);
      setUseImageHash(false);
      return true;
    }

    // If already loading, wait for that promise
    if (modelLoadPromise) {
      return modelLoadPromise;
    }

    modelLoadPromise = (async () => {
      try {
        setDetectionStatus('loading-model');
        setModelLoadingMsg('Loading face detection library...');

        console.log('[FaceCapture] Importing @vladmandic/face-api...');
        const faceapi = await import('@vladmandic/face-api');
        faceApiModule = faceapi;

        setModelLoadingMsg('Loading face detection model (attempt 1)...');
        console.log('[FaceCapture] Loading TinyFaceDetector model...');

        // Try TinyFaceDetector first (much smaller ~200KB vs ~5MB for ssd)
        try {
          await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
          console.log('[FaceCapture] TinyFaceDetector loaded successfully');
        } catch (tinyErr) {
          console.warn('[FaceCapture] TinyFaceDetector failed, trying SsdMobilenetv1...', tinyErr);
          setModelLoadingMsg('Loading alternative face model (attempt 2)...');
          try {
            await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
            console.log('[FaceCapture] SsdMobilenetv1 loaded successfully');
          } catch (ssdErr) {
            console.error('[FaceCapture] Both face detector models failed to load', ssdErr);
            throw new Error('Face detector models could not be loaded');
          }
        }

        setModelLoadingMsg('Loading landmark model...');
        try {
          await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
          console.log('[FaceCapture] FaceLandmark68Net loaded successfully');
        } catch (lmErr) {
          console.warn('[FaceCapture] FaceLandmark68Net failed, trying tiny variant...', lmErr);
          try {
            await faceapi.nets.faceLandmark68TinyNet.loadFromUri('/models');
            console.log('[FaceCapture] FaceLandmark68TinyNet loaded successfully');
          } catch (lmTinyErr) {
            console.error('[FaceCapture] All landmark models failed', lmTinyErr);
            // Continue without landmarks - we just need detection + recognition
          }
        }

        setModelLoadingMsg('Loading face recognition model...');
        await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
        console.log('[FaceCapture] FaceRecognitionNet loaded successfully');

        modelsLoaded = true;
        setFaceApiLoaded(true);
        setUseImageHash(false);
        return true;
      } catch (err) {
        console.error('[FaceCapture] Face-api.js models failed to load completely:', err);
        faceApiModule = null;
        modelsLoaded = false;
        setFaceApiLoaded(false);
        setUseImageHash(true);
        return false;
      }
    })();

    const result = await modelLoadPromise;
    // Reset the promise so future calls can retry if it failed
    if (!result) {
      modelLoadPromise = null;
    }
    return result;
  }, []);

  // ─── Start camera ──────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      setDetectionStatus('camera-starting');
      setCameraReady(false);

      console.log('[FaceCapture] Requesting camera access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        console.error('[FaceCapture] Video element not found');
        setCameraError('Video element not ready. Please refresh the page.');
        setDetectionStatus('error');
        return;
      }

      video.srcObject = stream;

      // Wait for video to actually be playing
      await new Promise<void>((resolve, reject) => {
        const onCanPlay = () => {
          video.removeEventListener('canplay', onCanPlay);
          video.removeEventListener('loadeddata', onLoadedData);
          resolve();
        };
        const onLoadedData = () => {
          video.removeEventListener('canplay', onCanPlay);
          video.removeEventListener('loadeddata', onLoadedData);
          resolve();
        };
        const onError = () => {
          video.removeEventListener('error', onError);
          reject(new Error('Video element error'));
        };
        video.addEventListener('canplay', onCanPlay);
        video.addEventListener('loadeddata', onLoadedData);
        video.addEventListener('error', onError);

        // Fallback timeout - if video doesn't fire events in 5s, try play anyway
        setTimeout(() => {
          video.removeEventListener('canplay', onCanPlay);
          video.removeEventListener('loadeddata', onLoadedData);
          video.removeEventListener('error', onError);
          resolve();
        }, 5000);
      });

      await video.play();
      console.log('[FaceCapture] Camera started successfully, video dimensions:', video.videoWidth, 'x', video.videoHeight);

      setCameraReady(true);
      setDetectionStatus('detecting');
    } catch (err) {
      console.error('[FaceCapture] Camera error:', err);
      const message =
        err instanceof DOMException
          ? err.name === 'NotAllowedError'
            ? 'Camera permission denied. Please allow camera access in your browser settings and reload.'
            : err.name === 'NotFoundError'
              ? 'No camera found on this device.'
              : err.name === 'NotReadableError'
                ? 'Camera is already in use by another application.'
                : `Camera error: ${err.message}`
          : 'Failed to access camera. Please check permissions.';
      setCameraError(message);
      setDetectionStatus('error');
      onError(message);
    }
  }, [onError]);

  // ─── Stop camera ──────────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  // ─── Initialize on mount ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Load models and start camera in parallel
      const [,] = await Promise.all([
        loadModels(),
        startCamera(),
      ]);

      if (cancelled) return;
    }

    init();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, []);

  // ─── Periodic face detection (only when camera & models ready) ──
  useEffect(() => {
    if (!cameraReady || !faceApiLoaded || !faceApiModule) return;

    let cancelled = false;

    async function detectFace() {
      if (!videoRef.current || cancelled || !faceApiModule) return;

      try {
        const faceapi = faceApiModule;
        const video = videoRef.current;

        // Ensure video has valid dimensions
        if (video.videoWidth === 0 || video.videoHeight === 0) return;

        let detection;

        // Try TinyFaceDetector first (faster), fall back to SsdMobilenetv1
        if (faceapi.nets.tinyFaceDetector.isLoaded) {
          detection = await faceapi
            .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 }));
        } else if (faceapi.nets.ssdMobilenetv1.isLoaded) {
          detection = await faceapi
            .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }));
        }

        if (!cancelled) {
          if (detection) {
            setDetectionStatus('face-found');
          } else {
            setDetectionStatus('no-face');
          }
        }
      } catch (err) {
        console.warn('[FaceCapture] Detection error:', err);
        if (!cancelled) {
          setDetectionStatus('no-face');
        }
      }
    }

    // Run detection every 1.5 seconds
    detectFace();
    detectionIntervalRef.current = setInterval(detectFace, 1500);

    return () => {
      cancelled = true;
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
    };
  }, [cameraReady, faceApiLoaded]);

  // ─── Compress image to under MAX_SELFIE_SIZE_KB ──────────
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

  // ─── Generate deterministic descriptor from image data ────
  // This fallback creates a consistent descriptor from the actual pixel data
  // by creating a small thumbnail of the face region and computing a perceptual hash.
  // Same person = similar thumbnail = similar descriptor
  const generateImageHashDescriptor = useCallback((canvas: HTMLCanvasElement, faceBox?: { x: number; y: number; width: number; height: number }): number[] => {
    // Create a small 8x16 thumbnail of the face region
    // This normalizes position/scale, making the hash robust to small movements
    const thumbW = 8;
    const thumbH = 16;
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = thumbW;
    thumbCanvas.height = thumbH;
    const thumbCtx = thumbCanvas.getContext('2d');

    if (!thumbCtx) return Array.from({ length: 128 }, () => 0);

    // Determine source region - use face box if available, otherwise center crop
    let sx: number, sy: number, sw: number, sh: number;
    if (faceBox) {
      // Add 20% padding around the detected face
      const pad = Math.max(faceBox.width, faceBox.height) * 0.2;
      sx = Math.max(0, faceBox.x - pad);
      sy = Math.max(0, faceBox.y - pad);
      sw = Math.min(canvas.width - sx, faceBox.width + pad * 2);
      sh = Math.min(canvas.height - sy, faceBox.height + pad * 2);
    } else {
      // Center crop focusing on the face region (top 60% of image, center 50%)
      sx = Math.floor(canvas.width * 0.25);
      sy = Math.floor(canvas.height * 0.1);
      sw = Math.floor(canvas.width * 0.5);
      sh = Math.floor(canvas.height * 0.65);
    }

    // Draw the face region as a small thumbnail
    thumbCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, thumbW, thumbH);

    // Get the thumbnail pixel data
    const imageData = thumbCtx.getImageData(0, 0, thumbW, thumbH);
    const pixels = imageData.data;

    // Create 128-float descriptor from thumbnail pixels
    // thumbW * thumbH = 128 pixels, each contributes one luminance value
    const descriptor: number[] = [];
    for (let i = 0; i < 128; i++) {
      const offset = i * 4;
      if (offset + 2 < pixels.length) {
        // Compute luminance and normalize to [-1, 1]
        const r = pixels[offset] / 255;
        const g = pixels[offset + 1] / 255;
        const b = pixels[offset + 2] / 255;
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
        descriptor.push(luminance * 2 - 1);
      } else {
        descriptor.push(0);
      }
    }

    // Apply DCT-like transformation for better perceptual hashing
    // This makes the descriptor more robust to small pixel changes
    const transformed: number[] = [];
    for (let k = 0; k < 128; k++) {
      let sum = 0;
      for (let n = 0; n < 128; n++) {
        sum += descriptor[n] * Math.cos((Math.PI * k * (n + 0.5)) / 128);
      }
      transformed.push(sum / 128);
    }

    // Normalize the descriptor to unit length
    const magnitude = Math.sqrt(transformed.reduce((sum, v) => sum + v * v, 0));
    if (magnitude > 0) {
      for (let i = 0; i < transformed.length; i++) {
        transformed[i] = transformed[i] / magnitude;
      }
    }

    return transformed;
  }, []);

  // ─── Handle capture ──────────────────────────────────────
  const handleCapture = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setCapturing(true);
    setDetectionStatus('detecting');

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      // Ensure valid video dimensions
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 480;
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        onError('Failed to capture image - canvas context error');
        setCapturing(false);
        return;
      }

      // Mirror the image for selfie
      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      const selfieData = compressImage(canvas);
      setCapturedImage(selfieData);

      // ─── Try face-api.js detection on the captured canvas ───
      let detectedFaceBox: { x: number; y: number; width: number; height: number } | undefined;

      if (faceApiLoaded && faceApiModule) {
        try {
          console.log('[FaceCapture] Running face detection on captured image...');
          const faceapi = faceApiModule;

          // Try full pipeline: detect → landmarks → descriptor
          let fullDetection;
          if (faceapi.nets.tinyFaceDetector.isLoaded && faceapi.nets.faceRecognitionNet.isLoaded) {
            try {
              fullDetection = await faceapi
                .detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 }))
                .withFaceLandmarks()
                .withFaceDescriptor();
            } catch (e) {
              console.warn('[FaceCapture] TinyFaceDetector + landmarks + descriptor failed:', e);
            }
          }

          if (!fullDetection && faceapi.nets.ssdMobilenetv1.isLoaded && faceapi.nets.faceRecognitionNet.isLoaded) {
            try {
              fullDetection = await faceapi
                .detectSingleFace(canvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }))
                .withFaceLandmarks()
                .withFaceDescriptor();
            } catch (e) {
              console.warn('[FaceCapture] SsdMobilenetv1 + landmarks + descriptor failed:', e);
            }
          }

          if (fullDetection) {
            const descriptor = Array.from(fullDetection.descriptor) as number[];
            console.log('[FaceCapture] Face detected with descriptor! Length:', descriptor.length);
            onCapture({ selfieData, facialDescriptor: descriptor });
            setCapturing(false);
            return;
          }

          // Try face detection only (without descriptor) to get face box for image hash
          console.log('[FaceCapture] Full pipeline failed, trying face detection only...');
          let simpleDetection;
          if (faceapi.nets.tinyFaceDetector.isLoaded) {
            simpleDetection = await faceapi
              .detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.2 }));
          }
          if (!simpleDetection && faceapi.nets.ssdMobilenetv1.isLoaded) {
            simpleDetection = await faceapi
              .detectSingleFace(canvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.2 }));
          }

          if (simpleDetection) {
            const box = simpleDetection.box;
            detectedFaceBox = { x: box.x, y: box.y, width: box.width, height: box.height };
            console.log('[FaceCapture] Face box detected (no descriptor). Using image hash with face crop.');
          } else {
            console.warn('[FaceCapture] No face detected at all. Using image hash with center crop.');
          }
        } catch (detectErr) {
          console.error('[FaceCapture] Face detection error on capture:', detectErr);
        }
      } else {
        // face-api not loaded - try detection-only to find face box for better hash
        console.log('[FaceCapture] face-api not loaded, capturing with image hash.');
      }

      // ─── Fallback: image-hash-based descriptor ───
      // This is deterministic - same face produces similar descriptor
      console.log('[FaceCapture] Using image-hash descriptor', detectedFaceBox ? '(with face crop)' : '(center crop)');
      const descriptor = generateImageHashDescriptor(canvas, detectedFaceBox);
      onCapture({ selfieData, facialDescriptor: descriptor });
    } catch (err) {
      console.error('[FaceCapture] Capture error:', err);
      onError('Failed to process capture. Please try again.');
    } finally {
      setCapturing(false);
    }
  }, [compressImage, faceApiLoaded, generateImageHashDescriptor, onCapture, onError]);

  // ─── Retake photo ──────────────────────────────────────
  const handleRetake = useCallback(() => {
    setCapturedImage(null);
    setDetectionStatus(cameraReady ? 'detecting' : 'idle');
  }, [cameraReady]);

  // ─── Skip camera (demo mode) ──────────────────────────
  const handleSkipCamera = useCallback(() => {
    // Create a placeholder canvas
    const placeholderCanvas = document.createElement('canvas');
    placeholderCanvas.width = 200;
    placeholderCanvas.height = 200;
    const ctx = placeholderCanvas.getContext('2d');
    if (ctx) {
      // Create a gradient placeholder
      const gradient = ctx.createLinearGradient(0, 0, 200, 200);
      gradient.addColorStop(0, '#3b82f6');
      gradient.addColorStop(1, '#1e40af');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 200, 200);
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Demo Photo', 100, 100);
    }
    const selfieData = placeholderCanvas.toDataURL('image/jpeg', 0.5);
    const descriptor = generateImageHashDescriptor(placeholderCanvas);
    onCapture({ selfieData, facialDescriptor: descriptor });
  }, [generateImageHashDescriptor, onCapture]);

  const getStatusColor = () => {
    switch (detectionStatus) {
      case 'face-found':
        return 'text-emerald-500';
      case 'no-face':
        return 'text-amber-500';
      case 'detecting':
      case 'camera-starting':
      case 'loading-model':
        return 'text-blue-500';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-muted-foreground';
    }
  };

  const getStatusText = () => {
    switch (detectionStatus) {
      case 'loading-model':
        return modelLoadingMsg || 'Loading face detection models...';
      case 'camera-starting':
        return 'Starting camera...';
      case 'detecting':
        return useImageHash
          ? 'Camera ready — position your face in the frame'
          : 'Looking for your face...';
      case 'face-found':
        return 'Face detected — ready to capture!';
      case 'no-face':
        return 'No face detected — adjust your position';
      case 'error':
        return 'Camera error';
      default:
        return 'Initializing...';
    }
  };

  const getStatusIcon = () => {
    switch (detectionStatus) {
      case 'face-found':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'no-face':
        return <AlertTriangle className="h-4 w-4" />;
      case 'detecting':
      case 'camera-starting':
      case 'loading-model':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'error':
        return <X className="h-4 w-4" />;
      default:
        return <Camera className="h-4 w-4" />;
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col items-center gap-4">
          {/* Camera view / Captured preview */}
          <div className="relative w-full max-w-sm aspect-[4/3] bg-black rounded-xl overflow-hidden">
            {capturedImage ? (
              <img
                src={capturedImage}
                alt="Captured selfie"
                className="w-full h-full object-cover"
              />
            ) : (
              <>
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
                  <div
                    className="w-48 h-60 sm:w-56 sm:h-72 border-2 border-dashed rounded-[50%] transition-colors duration-300"
                    style={{
                      borderColor:
                        detectionStatus === 'face-found'
                          ? 'rgba(16,185,129,0.8)'
                          : detectionStatus === 'no-face'
                            ? 'rgba(239,68,68,0.6)'
                            : 'rgba(255,255,255,0.4)',
                    }}
                  />
                </div>
              </>
            )}

            {/* Camera error overlay */}
            {cameraError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4">
                <div className="text-center text-white space-y-3">
                  <X className="h-8 w-8 mx-auto mb-2 text-red-400" />
                  <p className="text-sm">{cameraError}</p>
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-white border-white/30"
                      onClick={() => {
                        setCameraError(null);
                        startCamera();
                      }}
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                      Retry Camera
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                      onClick={handleSkipCamera}
                    >
                      <WifiOff className="h-3.5 w-3.5 mr-1.5" />
                      Continue Without Camera (Demo)
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Hidden canvas for capture */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Status indicator */}
          {!capturedImage && (
            <div className={`flex items-center gap-2 text-sm ${getStatusColor()}`}>
              {getStatusIcon()}
              <span>{getStatusText()}</span>
            </div>
          )}

          {/* Image-hash mode notice */}
          {useImageHash && !capturedImage && cameraReady && (
            <Alert variant="default" className="border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/20 w-full max-w-sm">
              <AlertTriangle className="h-4 w-4 text-blue-500" />
              <AlertDescription className="text-blue-700 dark:text-blue-400 text-xs">
                Simplified mode — AI face models unavailable. Your selfie will be captured and compared using image analysis for verification.
              </AlertDescription>
            </Alert>
          )}

          {/* Camera not ready message */}
          {!cameraReady && !cameraError && !capturedImage && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{detectionStatus === 'loading-model' ? modelLoadingMsg : 'Starting camera...'}</span>
            </div>
          )}

          {/* Capture / Retake buttons */}
          {capturedImage ? (
            <div className="flex gap-3 w-full max-w-sm">
              <Button
                variant="outline"
                onClick={handleRetake}
                className="flex-1 gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Retake
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleCapture}
              disabled={!cameraReady || capturing}
              className="w-full max-w-sm gap-2 bg-primary hover:bg-primary/90"
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
          )}
        </div>
      </CardContent>
    </Card>
  );
}
