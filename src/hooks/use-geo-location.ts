// ============================================================
// checkIn - Geo Location Hook
// ============================================================

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { GeoPosition } from '@/lib/types';
import { GPS_ACCURACY_THRESHOLD } from '@/lib/constants';

interface UseGeoLocationReturn {
  position: GeoPosition | null;
  error: string | null;
  loading: boolean;
  getCurrentPosition: () => Promise<GeoPosition>;
  supported: boolean;
}

export function useGeoLocation(): UseGeoLocationReturn {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator;

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Resolve a single position with the given options. Rejects on failure.
  const resolvePosition = useCallback(
    (opts: PositionOptions): Promise<GeoPosition> => {
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const geoPos: GeoPosition = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            };
            if (mountedRef.current) {
              setPosition(geoPos);
              // Low accuracy is a soft warning, not a failure — the
              // coordinates are still usable for the Haversine check.
              if (pos.coords.accuracy > GPS_ACCURACY_THRESHOLD * 3) {
                setError(
                  `GPS accuracy is low (${Math.round(pos.coords.accuracy)}m). Results may be affected.`
                );
              }
            }
            resolve(geoPos);
          },
          (err) => reject(err),
          opts
        );
      });
    },
    []
  );

  const getCurrentPosition = useCallback((): Promise<GeoPosition> => {
    return new Promise((resolve, reject) => {
      if (!supported) {
        const err = 'Geolocation is not supported by this browser';
        setError(err);
        reject(new Error(err));
        return;
      }

      setLoading(true);
      setError(null);

      // Two-phase acquisition. Laptops (used by lecturers to start sessions)
      // frequently cannot lock a high-accuracy GPS fix within a short window,
      // which previously caused start-session to fail and left the session
      // with no coordinates — breaking every downstream student check-in.
      // Phase 1 asks for high accuracy with a generous timeout; if that
      // errors or times out, phase 2 falls back to low accuracy (Wi-Fi/IP
      // geolocation) so we still obtain coordinates instead of hard-failing.
      const HIGH_ACC_TIMEOUT = 12000;
      const LOW_ACC_TIMEOUT = 10000;

      const fail = (err: GeolocationPositionError) => {
        let message = 'Failed to get location';
        switch (err.code) {
          case err.PERMISSION_DENIED:
            message = 'Location permission denied. Please enable GPS in your browser settings.';
            break;
          case err.POSITION_UNAVAILABLE:
            message = 'Location information unavailable. Check your GPS/network and try again.';
            break;
          case err.TIMEOUT:
            message = 'Location request timed out. Move to an open area or check your connection and try again.';
            break;
        }
        if (mountedRef.current) {
          setError(message);
          setLoading(false);
        }
        reject(new Error(message));
      };

      resolvePosition({
        enableHighAccuracy: true,
        timeout: HIGH_ACC_TIMEOUT,
        maximumAge: 60000,
      })
        .then((pos) => {
          if (mountedRef.current) setLoading(false);
          resolve(pos);
        })
        .catch((highErr: GeolocationPositionError) => {
          // Permission denied is fatal — don't retry, surface immediately.
          if (highErr.code === highErr.PERMISSION_DENIED) {
            fail(highErr);
            return;
          }
          // Phase 2: low-accuracy fallback.
          resolvePosition({
            enableHighAccuracy: false,
            timeout: LOW_ACC_TIMEOUT,
            maximumAge: 60000,
          })
            .then((pos) => {
              if (mountedRef.current) {
                setLoading(false);
                setError(
                  `Using approximate location (accuracy ${Math.round(pos.accuracy)}m). For best results, enable high-accuracy GPS.`
                );
              }
              resolve(pos);
            })
            .catch((lowErr: GeolocationPositionError) => {
              // Both phases failed — report the more informative of the two.
              fail(lowErr.code === lowErr.TIMEOUT ? highErr : lowErr);
            });
        });
    });
  }, [supported, resolvePosition]);

  return { position, error, loading, getCurrentPosition, supported };
}
