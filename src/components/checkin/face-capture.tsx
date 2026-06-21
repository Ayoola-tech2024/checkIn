// ============================================================
// checkIn - Face Capture Component (Google MediaPipe FaceMesh)
// ============================================================
// SECURITY: Live camera ONLY — no photo upload mode.
// This prevents activation/check-in with a static photo of
// another person.

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, AlertTriangle, CheckCircle2, Loader2, RotateCcw, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MAX_SELFIE_SIZE_KB } from '@/lib/constants';
import { landmarksToDescriptor, compressCanvasImage } from '@/lib/face-utils';

// ============================================================
// MediaPipe script loading
// ----------------------------------------------------------------
// The `@mediapipe/face_mesh` and `@mediapipe/camera_utils` packages
// ship UMD bundles that Turbopack cannot load as ESM async chunks
// (throws ChunkLoadError at runtime). We therefore load the same
// self-hosted files from /public/wasm/ via plain <script> tags and
// access the constructors from the global scope. This is also how
// MediaPipe is designed to be consumed in browser environments.
// ============================================================
declare global {
  interface Window {
    FaceMesh?: new (config: { locateFile: (file: string) => string }) => {
      setOptions: (opts: Record<string, unknown>) => void;
      onResults: (cb: (results: any) => void) => void;
      send: (input: { image: HTMLVideoElement }) => Promise<void>;
      close: () => void;
    };
    Camera?: new (
      video: HTMLVideoElement,
      config: { onFrame: () => Promise<void>; width: number; height: number }
    ) => { start: () => Promise<void>; stop: () => void };
  }
}

const loadedScripts = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  if (loadedScripts.has(src)) return loadedScripts.get(src)!;
  const promise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)));
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
  loadedScripts.set(src, promise);
  return promise;
}

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

// ============================================================
// Anti-spoofing: Eye Aspect Ratio (EAR) blink detection
// (Soukupova & Cech, 2016 — "Real-Time Eye Blink Detection using
// Facial Landmarks").
//
// MediaPipe FaceMesh landmark indices for the two eye contours.
// Ordering per the EAR paper: [p1, p2, p3, p4, p5, p6] where
//   p1 = outer eye corner
//   p2, p3 = upper eyelid
//   p4 = inner eye corner
//   p5, p6 = lower eyelid
// Right eye = subject's right (image left); Left eye = subject's left (image right).
// ============================================================
const RIGHT_EYE_IDX = [33, 160, 158, 133, 153, 144];
const LEFT_EYE_IDX  = [362, 385, 387, 263, 373, 380];

const EAR_THRESHOLD    = 0.20; // EAR below this = eye closed (open ~0.30, closed ~0.10)
const BLINK_MIN_MS     = 50;   // reject micro-flickers shorter than this
const BLINK_MAX_MS     = 400;  // reject long holds longer than this
const BLINK_TIMEOUT_MS = 5000; // reset blink count after 5s with no blink
const REQUIRED_BLINKS  = 2;    // natural blinks required to prove liveness

// Compute the Eye Aspect Ratio for a single eye from its 6 contour
// landmarks. Uses 2D coordinates only (z is unreliable for EAR).
// Returns -1 if any required landmark is missing.
// No array allocations — direct index access only, so this is safe
// to call every video frame.
function computeEar(landmarks: any, idx: number[]): number {
  const p1 = landmarks[idx[0]];
  const p2 = landmarks[idx[1]];
  const p3 = landmarks[idx[2]];
  const p4 = landmarks[idx[3]];
  const p5 = landmarks[idx[4]];
  const p6 = landmarks[idx[5]];
  if (!p1 || !p2 || !p3 || !p4 || !p5 || !p6) return -1;

  // Vertical distances: ||p2-p6|| and ||p3-p5||
  const dx26 = p2.x - p6.x;
  const dy26 = p2.y - p6.y;
  const dx35 = p3.x - p5.x;
  const dy35 = p3.y - p5.y;
  // Horizontal distance: ||p1-p4||
  const dx14 = p1.x - p4.x;
  const dy14 = p1.y - p4.y;

  const v1 = Math.sqrt(dx26 * dx26 + dy26 * dy26);
  const v2 = Math.sqrt(dx35 * dx35 + dy35 * dy35);
  const h  = Math.sqrt(dx14 * dx14 + dy14 * dy14);
  if (h < 1e-6) return -1;
  return (v1 + v2) / (2 * h);
}

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

  // Anti-spoofing blink state.
  // Refs are the source of truth for the per-frame state machine so
  // `onResults` (which is memoised with `[]` deps) never sees stale
  // closures. `blinkCount` state mirrors the ref purely to trigger UI
  // re-renders when a blink completes.
  const [blinkCount, setBlinkCount] = useState(0);
  const blinkCountRef = useRef(0);
  const isEyeClosedRef = useRef(false);
  const eyeClosedAtRef = useRef<number | null>(null);
  const lastBlinkTimeRef = useRef<number>(0);

  // Load MediaPipe FaceMesh (via self-hosted script tags — see header)
  const loadFaceMesh = useCallback(async (): Promise<any> => {
    if (faceMeshRef.current) return faceMeshRef.current;

    try {
      setStatus('loading-model');

      // Load the UMD solution script; it assigns window.FaceMesh.
      await loadScript('/wasm/face_mesh.js');
      const FaceMeshCtor = window.FaceMesh;
      if (!FaceMeshCtor) {
        throw new Error('FaceMesh global not found after script load');
      }

      const faceMesh = new FaceMeshCtor({
        locateFile: (file: string) => {
          // SELF-HOSTED: serve MediaPipe WASM + model binaries from /wasm/
          // instead of the jsdelivr CDN. Eliminates the runtime external-
          // network dependency — biometric capture works in air-gapped
          // deployments and is not affected by CDN outages.
          return `/wasm/${file}`;
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
      setErrorMessage('Failed to load face detection model. Please refresh the page and try again.');
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

      // ---- Anti-spoofing: EAR blink detection state machine ----
      const earR = computeEar(landmarks, RIGHT_EYE_IDX);
      const earL = computeEar(landmarks, LEFT_EYE_IDX);
      if (earR >= 0 && earL >= 0) {
        const ear = (earR + earL) / 2;
        const now = performance.now();

        // 5-second inactivity reset — only fires BEFORE liveness is
        // reached, so a verified user isn't penalised for pausing.
        if (
          blinkCountRef.current < REQUIRED_BLINKS &&
          lastBlinkTimeRef.current > 0 &&
          now - lastBlinkTimeRef.current > BLINK_TIMEOUT_MS
        ) {
          blinkCountRef.current = 0;
          setBlinkCount(0);
          isEyeClosedRef.current = false;
          eyeClosedAtRef.current = null;
        }

        if (ear < EAR_THRESHOLD) {
          // Eye is (or remains) closed — record the close timestamp on
          // the open→closed transition only.
          if (!isEyeClosedRef.current) {
            isEyeClosedRef.current = true;
            eyeClosedAtRef.current = now;
          }
        } else if (isEyeClosedRef.current) {
          // Eye just reopened — evaluate whether the closed phase was a
          // valid natural blink (50–400 ms) or a rejectable flicker/hold.
          const closedAt = eyeClosedAtRef.current;
          if (closedAt !== null) {
            const dur = now - closedAt;
            if (dur >= BLINK_MIN_MS && dur <= BLINK_MAX_MS) {
              blinkCountRef.current += 1;
              setBlinkCount(blinkCountRef.current);
              lastBlinkTimeRef.current = now;
            }
          }
          isEyeClosedRef.current = false;
          eyeClosedAtRef.current = null;
        }
      }
      // ---- end EAR blink detection ----
    } else {
      setStatus('no-face');
      setLastLandmarks(null);
      // Reset eye-closed tracking so a stale close→open transition
      // isn't miscounted when the face reappears.
      isEyeClosedRef.current = false;
      eyeClosedAtRef.current = null;
    }
  }, []);

  // Start camera with MediaPipe
  const startCamera = useCallback(async () => {
    try {
      const faceMesh = await loadFaceMesh();
      if (!faceMesh) return;

      faceMesh.onResults(onResults);
      setStatus('camera-starting');

      // Load the camera-utils UMD script; it assigns window.Camera.
      await loadScript('/wasm/camera_utils.js');
      const MPCamera = window.Camera;
      if (!MPCamera) {
        throw new Error('Camera utils global not found after script load');
      }

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
    // Reset anti-spoofing blink state so a re-capture requires fresh
    // blinks (prevents replay of a previously-verified liveness session).
    blinkCountRef.current = 0;
    isEyeClosedRef.current = false;
    eyeClosedAtRef.current = null;
    lastBlinkTimeRef.current = 0;
    setBlinkCount(0);
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

      {/* Anti-spoofing liveness check indicator */}
      {!capturedSelfie && (status === 'detecting' || status === 'face-found' || status === 'no-face') && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          {blinkCount >= REQUIRED_BLINKS ? (
            <>
              <Eye className="size-4 shrink-0 text-emerald-600" />
              <span className="font-medium text-emerald-700">
                Liveness verified — you may capture your face.
              </span>
            </>
          ) : (
            <>
              <EyeOff className="size-4 shrink-0 text-amber-600" />
              <span className="text-muted-foreground">
                Blink twice to verify you are real{' '}
                <span className="font-medium">
                  ({Math.min(blinkCount, REQUIRED_BLINKS)}/{REQUIRED_BLINKS} blinks detected)
                </span>
              </span>
            </>
          )}
        </div>
      )}

      {/* Camera Capture Button — disabled (grayed out, not clickable)
          until liveness is verified via 2 natural blinks. */}
      {!capturedSelfie && status === 'face-found' && blinkCount < REQUIRED_BLINKS && (
        <Button disabled className="w-full opacity-60" size="lg">
          <Camera className="size-4 mr-2" />
          Capture Face (blink to enable)
        </Button>
      )}
      {!capturedSelfie && status === 'face-found' && blinkCount >= REQUIRED_BLINKS && (
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
            <li>Blink naturally twice to verify you are real</li>
          </ul>
        </div>
      )}
    </div>
  );
}
