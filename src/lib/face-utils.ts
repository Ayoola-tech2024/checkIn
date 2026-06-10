// ============================================================
// checkIn - Facial Recognition Utilities
// ============================================================

import type { FacialLandmarkData } from './types';

/**
 * Calculate cosine similarity between two facial descriptor vectors.
 * Returns a similarity score from 0 to 100 (100 = identical).
 * 
 * Uses cosine similarity which works better for both:
 * - Real face-api.js descriptors (128-float vectors)
 * - Image-hash descriptors (normalized luminance-based vectors)
 */
export function calculateSimilarity(
  descriptor1: number[],
  descriptor2: number[]
): number {
  if (descriptor1.length !== descriptor2.length || descriptor1.length === 0) {
    return 0;
  }

  // Compute dot product and magnitudes
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

  // Cosine similarity: -1 to 1 (1 = identical direction)
  const cosineSim = dotProduct / (mag1 * mag2);

  // Map cosine similarity from [-1, 1] to [0, 100]
  // cosineSim = 1 → 100% (same person)
  // cosineSim = 0 → 50% (unrelated)
  // cosineSim = -1 → 0% (opposite)
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
  if (score > 50) {
    return { status: 'present', label: 'Verified', color: 'text-emerald-500' };
  } else if (score >= 40) {
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
  
  // Reduce quality until size is under limit
  while (dataUrl.length * 0.75 > maxSizeKB * 1024 && quality > 0.1) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  
  // If still too large, reduce canvas dimensions
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
 * (server-side version without face-api.js dependency)
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}
