// ============================================================
// checkIn - Facial Recognition Utilities (MediaPipe FaceMesh)
// ============================================================

import type { FacialLandmarkData } from './types';
import { SIMILARITY_ACCEPT, SIMILARITY_REVIEW } from './constants';

/**
 * Expected descriptor length produced by `landmarksToDescriptor`.
 * 91 key points × 153 pairs × 3 (dx, dy, dz) = 4185 floats.
 * The backend validates against this exact length to prevent silent
 * similarity=0 routing on shape mismatch.
 */
export const EXPECTED_DESCRIPTOR_LENGTH = 4185;

/**
 * Validate that a value is a usable facial descriptor: an array of exactly
 * EXPECTED_DESCRIPTOR_LENGTH finite numbers. Returns an error string on
 * failure, or null on success.
 *
 * Range check: descriptors are normalized to unit magnitude, so individual
 * values are typically in [-1, 1]. We allow a generous [-2, 2] window to
 * accommodate float precision.
 */
export function validateDescriptor(descriptor: unknown): string | null {
  if (!Array.isArray(descriptor)) {
    return 'Facial descriptor must be an array.';
  }
  if (descriptor.length !== EXPECTED_DESCRIPTOR_LENGTH) {
    return `Facial descriptor must contain exactly ${EXPECTED_DESCRIPTOR_LENGTH} numbers (received ${descriptor.length}). Please recapture your face.`;
  }
  for (let i = 0; i < descriptor.length; i++) {
    const v = descriptor[i];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      return `Facial descriptor contains a non-finite value at index ${i}. Please recapture your face.`;
    }
    if (v < -2 || v > 2) {
      return `Facial descriptor contains an out-of-range value at index ${i} (${v}). Please recapture your face.`;
    }
  }
  return null;
}

/**
 * Calculate cosine similarity between two facial descriptor vectors.
 * Returns a similarity score from 0 to 100 (100 = identical).
 * 
 * Works with MediaPipe FaceMesh landmark descriptors.
 */
export function calculateSimilarity(
  descriptor1: number[],
  descriptor2: number[]
): number {
  if (descriptor1.length !== descriptor2.length || descriptor1.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;

  for (let i = 0; i < descriptor1.length; i++) {
    dotProduct += descriptor1[i] * descriptor2[i];
    mag1 += descriptor1[i] * descriptor1[i];
    mag2 += descriptor2[i] * descriptor2[i];
  }

  mag1 = Math.sqrt(mag1);
  mag2 = Math.sqrt(mag2);

  if (mag1 === 0 || mag2 === 0) {
    return 0;
  }

  const cosineSim = dotProduct / (mag1 * mag2);
  const similarity = Math.max(0, Math.min(100, (cosineSim + 1) * 50));

  return Math.round(similarity * 100) / 100;
}

/**
 * Determine attendance status based on similarity score.
 * > 50: accepted (present)
 * 40-50: pending review
 * < 40: rejected (identity fraud)
 */
export function getAttendanceStatusFromSimilarity(score: number): {
  status: 'present' | 'pending_review' | 'rejected_identity';
  label: string;
  color: string;
} {
  if (score > SIMILARITY_ACCEPT) {
    return { status: 'present', label: 'Verified', color: 'text-emerald-500' };
  } else if (score >= SIMILARITY_REVIEW) {
    return { status: 'pending_review', label: 'Pending Review', color: 'text-amber-500' };
  } else {
    return { status: 'rejected_identity', label: 'Identity Rejected', color: 'text-red-500' };
  }
}

/**
 * Compress a canvas image to under maxSizeKB.
 * Returns a base64 data URL.
 */
export function compressCanvasImage(
  canvas: HTMLCanvasElement,
  maxSizeKB: number = 150
): string {
  let quality = 0.8;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  
  while (dataUrl.length * 0.75 > maxSizeKB * 1024 && quality > 0.1) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  
  if (dataUrl.length * 0.75 > maxSizeKB * 1024) {
    const scale = 0.5;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width * scale;
    tempCanvas.height = canvas.height * scale;
    const ctx = tempCanvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);
      dataUrl = tempCanvas.toDataURL('image/jpeg', 0.6);
    }
  }
  
  return dataUrl;
}

/**
 * Serialize facial landmark data for storage.
 */
export function serializeFacialData(data: FacialLandmarkData): string {
  return JSON.stringify(data);
}

/**
 * Deserialize facial landmark data from storage.
 */
export function deserializeFacialData(json: string): FacialLandmarkData | null {
  try {
    return JSON.parse(json) as FacialLandmarkData;
  } catch {
    return null;
  }
}

/**
 * Calculate Euclidean distance between two descriptor arrays
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

/**
 * Convert MediaPipe FaceMesh landmarks to a compact descriptor vector.
 * Takes the 468 face landmarks and produces a normalized descriptor
 * by computing relative distances between key facial feature points.
 * 
 * MediaPipe FaceMesh provides 468 3D landmarks with x, y, z coordinates.
 * We extract key geometric relationships to form a compact descriptor.
 */
export function landmarksToDescriptor(
  landmarks: Array<{ x: number; y: number; z: number }>
): number[] {
  if (!landmarks || landmarks.length < 468) {
    return [];
  }

  const descriptor: number[] = [];
  
  // Key landmark indices for facial features
  const keyPoints = [
    // Face outline
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
    397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
    172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
    // Eyes
    33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158,
    362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387,
    // Nose
    1, 2, 98, 327, 168, 6, 197, 195, 5,
    // Mouth
    61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308,
    // Eyebrows
    70, 63, 105, 66, 107, 336, 296, 334, 293, 300,
  ];

  // Compute relative distances between pairs of key points
  // This creates a compact, position-invariant descriptor
  for (let i = 0; i < keyPoints.length; i++) {
    for (let j = i + 1; j < keyPoints.length; j += 3) { // Skip some pairs to reduce dimensionality
      const p1 = landmarks[keyPoints[i]];
      const p2 = landmarks[keyPoints[j]];
      if (p1 && p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dz = (p2.z || 0) - (p1.z || 0);
        descriptor.push(dx, dy, dz);
      }
    }
  }

  // Normalize the descriptor
  let mag = 0;
  for (const v of descriptor) {
    mag += v * v;
  }
  mag = Math.sqrt(mag);
  if (mag > 0) {
    for (let i = 0; i < descriptor.length; i++) {
      descriptor[i] = descriptor[i] / mag;
    }
  }

  return descriptor;
}
