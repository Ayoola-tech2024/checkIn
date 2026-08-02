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
 * Format distance for display
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters.toFixed(0)}m`;
  }
  return `${(meters / 1000).toFixed(2)}km`;
}
