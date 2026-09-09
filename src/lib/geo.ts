// ============================================================
// checkIn - Geographic Utilities
// ============================================================
// Nigeria geographic bounding box (approximate, generous bounds).
// Latitude: 4°N (Gulf of Guinea) to 14°N (Niger border)
// Longitude: 2°E (Benin border) to 15°E (Cameroon border)
// Shared by start-session and check-in routes so they stay in sync.
export const NIGERIA_LAT_MIN = 4;
export const NIGERIA_LAT_MAX = 14;
export const NIGERIA_LNG_MIN = 2;
export const NIGERIA_LNG_MAX = 15;

export function isWithinNigeria(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= NIGERIA_LAT_MIN &&
    lat <= NIGERIA_LAT_MAX &&
    lng >= NIGERIA_LNG_MIN &&
    lng <= NIGERIA_LNG_MAX
  );
}

import type { GeoPosition } from './types';

/**
 * Calculate the distance between two geographic points using the Haversine formula.
 * Returns distance in meters.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Check if a student's position is within the allowed radius of the lecturer's position.
 */
export function isWithinRadius(
  studentPos: GeoPosition,
  lecturerPos: GeoPosition,
  maxRadiusMeters: number
): { within: boolean; distance: number } {
  const distance = haversineDistance(
    studentPos.latitude,
    studentPos.longitude,
    lecturerPos.latitude,
    lecturerPos.longitude
  );
  return {
    within: distance <= maxRadiusMeters,
    distance: Math.round(distance * 100) / 100,
  };
}

/**
 * Calculate effective distance considering GPS measurement accuracy margin.
 * Subtracts student GPS accuracy (up to a max discount limit) so indoor
 * GPS attenuation does not cause false rejections.
 */
export function calculateEffectiveDistance(
  studentLat: number,
  studentLng: number,
  studentAccuracy: number | undefined,
  targetLat: number,
  targetLng: number
): { rawDistance: number; effectiveDistance: number; accuracyDiscount: number } {
  const rawDistance = haversineDistance(studentLat, studentLng, targetLat, targetLng);
  // Cap accuracy discount at 35m to prevent extreme location spoofing
  const accuracyDiscount = Math.min(35, Math.max(0, studentAccuracy ?? 0));
  const effectiveDistance = Math.max(0, rawDistance - accuracyDiscount);

  return {
    rawDistance: Math.round(rawDistance * 100) / 100,
    effectiveDistance: Math.round(effectiveDistance * 100) / 100,
    accuracyDiscount: Math.round(accuracyDiscount * 100) / 100,
  };
}

/**
 * Dual-anchor geofence check: validates student position against BOTH the
 * lecturer's live GPS coordinates AND the venue's static physical center.
 * Validation succeeds if student is within threshold of EITHER anchor.
 */
export function isWithinVenueOrLecturer(
  studentLat: number,
  studentLng: number,
  studentAccuracy: number | undefined,
  lecturerPos: { lat: number | null; lng: number | null } | null,
  venuePos: { lat: number | null; lng: number | null } | null,
  maxRadiusMeters: number
): {
  within: boolean;
  bestDistance: number;
  rawDistance: number;
  accuracyDiscount: number;
  anchorUsed: 'lecturer' | 'venue' | 'none';
  message: string;
} {
  let bestEffective = Infinity;
  let bestRaw = Infinity;
  let bestDiscount = 0;
  let bestAnchor: 'lecturer' | 'venue' | 'none' = 'none';

  if (lecturerPos && Number.isFinite(lecturerPos.lat) && Number.isFinite(lecturerPos.lng)) {
    const calc = calculateEffectiveDistance(
      studentLat,
      studentLng,
      studentAccuracy,
      lecturerPos.lat!,
      lecturerPos.lng!
    );
    if (calc.effectiveDistance < bestEffective) {
      bestEffective = calc.effectiveDistance;
      bestRaw = calc.rawDistance;
      bestDiscount = calc.accuracyDiscount;
      bestAnchor = 'lecturer';
    }
  }

  if (venuePos && Number.isFinite(venuePos.lat) && Number.isFinite(venuePos.lng)) {
    const calc = calculateEffectiveDistance(
      studentLat,
      studentLng,
      studentAccuracy,
      venuePos.lat!,
      venuePos.lng!
    );
    if (calc.effectiveDistance < bestEffective) {
      bestEffective = calc.effectiveDistance;
      bestRaw = calc.rawDistance;
      bestDiscount = calc.accuracyDiscount;
      bestAnchor = 'venue';
    }
  }

  const within = bestEffective <= maxRadiusMeters;

  let message = '';
  if (within) {
    message = `Location verified (${bestEffective}m away from ${bestAnchor === 'lecturer' ? 'lecturer' : 'venue'}).`;
  } else if (bestAnchor !== 'none') {
    message = `Too far from session location (${bestEffective}m vs ${maxRadiusMeters}m required).`;
  } else {
    message = 'Session location unavailable. Lecturer must start session with GPS or select a valid venue.';
  }

  return {
    within,
    bestDistance: bestEffective === Infinity ? 0 : bestEffective,
    rawDistance: bestRaw === Infinity ? 0 : bestRaw,
    accuracyDiscount: bestDiscount,
    anchorUsed: bestAnchor,
    message,
  };
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters.toFixed(0)}m`;
  }
  return `${(meters / 1000).toFixed(2)}km`;
}
