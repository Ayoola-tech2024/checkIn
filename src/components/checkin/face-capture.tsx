// ============================================================
// checkIn - Face Capture Component (Robust with Multiple Input Methods)
// ============================================================

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, AlertTriangle, CheckCircle2, Loader2, X, RotateCcw, Upload, ImagePlus, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { MAX_SELFIE_SIZE_KB } from '@/lib/constants';

interface FaceCaptureProps {
  onCapture: (data: { selfieData: string; facialDescriptor: number[] }) => void;
  mode: 'activation' | 'checkin';
  onError: (error: string) => void;
}

type CaptureMethod = 'camera' | 'upload' | 'demo';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [captureMethod, setCaptureMethod] = useState<CaptureMethod>('camera');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [detectionStatus, setDetectionStatus] = useState<DetectionStatus>('idle');
  const [faceApiLoaded, setFaceApiLoaded] = useState(false);
  const [useImageHash, setUseImageHash] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [modelLoadingMsg, setModelLoadingMsg] = useState('Initializing...');
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);

  // ─── Load face-api.js models ────────────────────────────────
  const loadModels = useCallback(async (): Promise<boolean> => {
    if (modelsLoaded && faceApiModule) {
      setFaceApiLoaded(true);
      setUseImageHash(false);
      return true;
    }

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
      // Load models regardless of method (needed for processing uploaded photos too)
      await loadModels();

      if (cancelled) return;

      // Only start camera if camera method is selected
      if (captureMethod === 'camera') {
        await startCamera();
      }
    }

    init();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, []);

  // ─── Switch capture method ─────────────────────────────────
  useEffect(() => {
    if (captureMethod === 'camera' && !cameraReady && !cameraError) {
      startCamera();
    } else if (captureMethod !== 'camera') {
      stopCamera();
    }
  }, [captureMethod]);

  // ─── Periodic face detection (only when camera & models ready) ──
  useEffect(() => {
    if (!cameraReady || !faceApiLoaded || !faceApiModule || captureMethod !== 'camera') return;

    let cancelled = false;

    async function detectFace() {
      if (!videoRef.current || cancelled || !faceApiModule) return;

      try {
        const faceapi = faceApiModule;
        const video = videoRef.current;

        if (video.videoWidth === 0 || video.videoHeight === 0) return;

        let detection;

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

    detectFace();
    detectionIntervalRef.current = setInterval(detectFace, 1500);

    return () => {
      cancelled = true;
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
    };
  }, [cameraReady, faceApiLoaded, captureMethod]);

  // ─── Compress image to under MAX_SELFIE_SIZE_KB ──────────
  const compressImage = useCallback((canvas: HTMLCanvasElement): string => {
    let quality = 0.8;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);

    while (dataUrl.length * 0.75 > MAX_SELFIE_SIZE_KB * 1024 && quality > 0.1) {
      quality -= 0.1;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }

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
  const generateImageHashDescriptor = useCallback((canvas: HTMLCanvasElement, faceBox?: { x: number; y: number; width: number; height: number }): number[] => {
    const thumbW = 8;
    const thumbH = 16;
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = thumbW;
    thumbCanvas.height = thumbH;
    const thumbCtx = thumbCanvas.getContext('2d');

    if (!thumbCtx) return Array.from({ length: 128 }, () => 0);

    let sx: number, sy: number, sw: number, sh: number;
    if (faceBox) {
      const pad = Math.max(faceBox.width, faceBox.height) * 0.2;
      sx = Math.max(0, faceBox.x - pad);
      sy = Math.max(0, faceBox.y - pad);
      sw = Math.min(canvas.width - sx, faceBox.width + pad * 2);
      sh = Math.min(canvas.height - sy, faceBox.height + pad * 2);
    } else {
      sx = Math.floor(canvas.width * 0.25);
      sy = Math.floor(canvas.height * 0.1);
      sw = Math.floor(canvas.width * 0.5);
      sh = Math.floor(canvas.height * 0.65);
    }

    thumbCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, thumbW, thumbH);

    const imageData = thumbCtx.getImageData(0, 0, thumbW, thumbH);
    const pixels = imageData.data;

    const descriptor: number[] = [];
    for (let i = 0; i < 128; i++) {
      const offset = i * 4;
      if (offset + 2 < pixels.length) {
        const r = pixels[offset] / 255;
        const g = pixels[offset + 1] / 255;
        const b = pixels[offset + 2] / 255;
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
        descriptor.push(luminance * 2 - 1);
      } else {
        descriptor.push(0);
      }
    }

    const transformed: number[] = [];
    for (let k = 0; k < 128; k++) {
      let sum = 0;
      for (let n = 0; n < 128; n++) {
        sum += descriptor[n] * Math.cos((Math.PI * k * (n + 0.5)) / 128);
      }
      transformed.push(sum / 128);
    }

    const magnitude = Math.sqrt(transformed.reduce((sum, v) => sum + v * v, 0));
    if (magnitude > 0) {
      for (let i = 0; i < transformed.length; i++) {
        transformed[i] = transformed[i] / magnitude;
      }
    }

    return transformed;
  }, []);

  // ─── Process an image (from camera or upload) through face-api ───
  const processImage = useCallback(async (imageSource: HTMLCanvasElement | HTMLImageElement): Promise<{ selfieData: string; facialDescriptor: number[] } | null> => {
    const canvas = document.createElement('canvas');
    const width = imageSource instanceof HTMLVideoElement ? (imageSource.videoWidth || 640) :
                  imageSource instanceof HTMLCanvasElement ? imageSource.width :
                  imageSource.naturalWidth || imageSource.width;
    const height = imageSource instanceof HTMLVideoElement ? (imageSource.videoHeight || 480) :
                   imageSource instanceof HTMLCanvasElement ? imageSource.height :
                   imageSource.naturalHeight || imageSource.height;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Draw image to canvas
    if (imageSource instanceof HTMLVideoElement) {
      // Mirror for selfie
      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(imageSource, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    } else {
      ctx.drawImage(imageSource, 0, 0, canvas.width, canvas.height);
    }

    const selfieData = compressImage(canvas);

    // Try face-api.js detection
    let detectedFaceBox: { x: number; y: number; width: number; height: number } | undefined;

    if (faceApiLoaded && faceApiModule) {
      try {
        console.log('[FaceCapture] Running face detection on image...');
        const faceapi = faceApiModule;

        let fullDetection;
        if (faceapi.nets.tinyFaceDetector.isLoaded && faceapi.nets.faceRecognitionNet.isLoaded) {
          try {
            fullDetection = await faceapi
              .detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 }))
              .withFaceLandmarks()
              .withFaceDescriptor();
          } catch (e) {
            console.warn('[FaceCapture] TinyFaceDetector + descriptor failed:', e);
          }
        }

        if (!fullDetection && faceapi.nets.ssdMobilenetv1.isLoaded && faceapi.nets.faceRecognitionNet.isLoaded) {
          try {
            fullDetection = await faceapi
              .detectSingleFace(canvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }))
              .withFaceLandmarks()
              .withFaceDescriptor();
          } catch (e) {
            console.warn('[FaceCapture] SsdMobilenetv1 + descriptor failed:', e);
          }
        }

        if (fullDetection) {
          const descriptor = Array.from(fullDetection.descriptor) as number[];
          console.log('[FaceCapture] Face detected with descriptor! Length:', descriptor.length);
          return { selfieData, facialDescriptor: descriptor };
        }

        // Try detection only for face box
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
          console.warn('[FaceCapture] No face detected. Using image hash with center crop.');
        }
      } catch (detectErr) {
        console.error('[FaceCapture] Face detection error:', detectErr);
      }
    }

    // Fallback: image-hash-based descriptor
    console.log('[FaceCapture] Using image-hash descriptor', detectedFaceBox ? '(with face crop)' : '(center crop)');
    const descriptor = generateImageHashDescriptor(canvas, detectedFaceBox);
    return { selfieData, facialDescriptor: descriptor };
  }, [compressImage, faceApiLoaded, generateImageHashDescriptor]);

  // ─── Handle camera capture ──────────────────────────────────
  const handleCameraCapture = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setCapturing(true);
    setDetectionStatus('detecting');

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
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

      // Process through face-api
      let detectedFaceBox: { x: number; y: number; width: number; height: number } | undefined;

      if (faceApiLoaded && faceApiModule) {
        try {
          console.log('[FaceCapture] Running face detection on captured image...');
          const faceapi = faceApiModule;

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

          // Try face detection only
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
          }
        } catch (detectErr) {
          console.error('[FaceCapture] Face detection error on capture:', detectErr);
        }
      }

      // Fallback: image-hash-based descriptor
      const descriptor = generateImageHashDescriptor(canvas, detectedFaceBox);
      onCapture({ selfieData, facialDescriptor: descriptor });
    } catch (err) {
      console.error('[FaceCapture] Capture error:', err);
      onError('Failed to process capture. Please try again.');
    } finally {
      setCapturing(false);
    }
  }, [compressImage, faceApiLoaded, generateImageHashDescriptor, onCapture, onError]);

  // ─── Handle file upload ──────────────────────────────────
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onError('Please select an image file (JPEG, PNG, etc.)');
      return;
    }

    setCapturing(true);

    try {
      // Read the file as data URL for preview
      const reader = new FileReader();
      const loadDataUrl = new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      const dataUrl = await loadDataUrl;
      setUploadedPreview(dataUrl);

      // Load into an Image element for processing
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = dataUrl;
      });

      // Process through face-api
      const result = await processImage(img);
      if (result) {
        setCapturedImage(result.selfieData);
        onCapture(result);
      } else {
        onError('Failed to process the uploaded image.');
      }
    } catch (err) {
      console.error('[FaceCapture] Upload error:', err);
      onError('Failed to process uploaded image. Please try another photo.');
    } finally {
      setCapturing(false);
    }
  }, [onCapture, onError, processImage]);

  // ─── Retake photo ──────────────────────────────────────
  const handleRetake = useCallback(() => {
    setCapturedImage(null);
    setUploadedPreview(null);
    setDetectionStatus(cameraReady ? 'detecting' : 'idle');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [cameraReady]);

  // ─── Skip camera (demo mode) ──────────────────────────
  const handleSkipCamera = useCallback(() => {
    const placeholderCanvas = document.createElement('canvas');
    placeholderCanvas.width = 200;
    placeholderCanvas.height = 200;
    const ctx = placeholderCanvas.getContext('2d');
    if (ctx) {
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
    setCapturedImage(selfieData);
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
          {/* Capture Method Selector */}
          {!capturedImage && (
            <div className="flex gap-2 w-full max-w-sm">
              <Button
                variant={captureMethod === 'camera' ? 'default' : 'outline'}
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => setCaptureMethod('camera')}
              >
                <Camera className="h-3.5 w-3.5" />
                Camera
              </Button>
              <Button
                variant={captureMethod === 'upload' ? 'default' : 'outline'}
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => setCaptureMethod('upload')}
              >
                <Upload className="h-3.5 w-3.5" />
                Upload
              </Button>
              <Button
                variant={captureMethod === 'demo' ? 'default' : 'outline'}
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => setCaptureMethod('demo')}
              >
                <UserCircle className="h-3.5 w-3.5" />
                Demo
              </Button>
            </div>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />

          {/* ===== Camera Mode ===== */}
          {captureMethod === 'camera' && (
            <>
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
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={() => setCaptureMethod('upload')}
                        >
                          <Upload className="h-3.5 w-3.5 mr-1.5" />
                          Upload Photo Instead
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
                  onClick={handleCameraCapture}
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
            </>
          )}

          {/* ===== Upload Mode ===== */}
          {captureMethod === 'upload' && (
            <>
              <div className="relative w-full max-w-sm aspect-[4/3] bg-muted rounded-xl overflow-hidden flex items-center justify-center">
                {uploadedPreview ? (
                  <img
                    src={uploadedPreview}
                    alt="Uploaded photo"
                    className="w-full h-full object-cover"
                  />
                ) : capturedImage ? (
                  <img
                    src={capturedImage}
                    alt="Processed photo"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-muted-foreground p-4">
                    <ImagePlus className="h-12 w-12 opacity-40" />
                    <p className="text-sm text-center">Select a clear photo of your face</p>
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      Choose Photo
                    </Button>
                  </div>
                )}
              </div>

              {capturing && (
                <div className="flex items-center gap-2 text-sm text-blue-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing photo...</span>
                </div>
              )}

              {!capturedImage && !capturing && (
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full max-w-sm gap-2 bg-primary hover:bg-primary/90"
                  size="lg"
                  disabled={capturing}
                >
                  {capturing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Select Photo
                </Button>
              )}

              {capturedImage && (
                <div className="flex gap-3 w-full max-w-sm">
                  <Button
                    variant="outline"
                    onClick={handleRetake}
                    className="flex-1 gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Choose Different Photo
                  </Button>
                </div>
              )}

              <Alert variant="default" className="border-blue-500/30 bg-blue-50/30 dark:bg-blue-950/10 w-full max-w-sm">
                <AlertDescription className="text-xs text-muted-foreground">
                  Upload a clear, well-lit photo showing your face. The photo will be used for identity verification during check-in.
                </AlertDescription>
              </Alert>
            </>
          )}

          {/* ===== Demo Mode ===== */}
          {captureMethod === 'demo' && (
            <>
              <div className="relative w-full max-w-sm aspect-[4/3] bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-950/30 dark:to-blue-900/30 rounded-xl overflow-hidden flex items-center justify-center">
                {capturedImage ? (
                  <img
                    src={capturedImage}
                    alt="Demo photo"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 p-4">
                    <UserCircle className="h-16 w-16 text-blue-400 dark:text-blue-500" />
                    <p className="text-sm text-center text-blue-700 dark:text-blue-300 font-medium">
                      Demo Mode
                    </p>
                    <p className="text-xs text-center text-muted-foreground max-w-[240px]">
                      A placeholder profile will be created. Face verification will use image analysis instead of AI detection.
                    </p>
                  </div>
                )}
              </div>

              {!capturedImage ? (
                <Button
                  onClick={handleSkipCamera}
                  className="w-full max-w-sm gap-2"
                  size="lg"
                  disabled={capturing}
                >
                  <UserCircle className="h-4 w-4" />
                  Continue with Demo Profile
                </Button>
              ) : (
                <div className="flex gap-3 w-full max-w-sm">
                  <Button
                    variant="outline"
                    onClick={handleRetake}
                    className="flex-1 gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset
                  </Button>
                </div>
              )}

              <Alert variant="default" className="border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/10 w-full max-w-sm">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <AlertDescription className="text-xs text-amber-700 dark:text-amber-400">
                  Demo mode is for testing only. Face verification accuracy will be limited. Use a real photo for the best experience.
                </AlertDescription>
              </Alert>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
