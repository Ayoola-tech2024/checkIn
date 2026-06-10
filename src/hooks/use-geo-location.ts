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

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const geoPos: GeoPosition = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          };
          
          if (mountedRef.current) {
            setPosition(geoPos);
            setLoading(false);
            
            if (pos.coords.accuracy > GPS_ACCURACY_THRESHOLD * 3) {
              setError(`GPS accuracy is low (${Math.round(pos.coords.accuracy)}m). Results may be affected.`);
            }
          }
          resolve(geoPos);
        },
        (err) => {
          let message = 'Failed to get location';
          switch (err.code) {
            case err.PERMISSION_DENIED:
              message = 'Location permission denied. Please enable GPS.';
              break;
            case err.POSITION_UNAVAILABLE:
              message = 'Location information unavailable.';
              break;
            case err.TIMEOUT:
              message = 'Location request timed out.';
              break;
          }
          if (mountedRef.current) {
            setError(message);
            setLoading(false);
          }
          reject(new Error(message));
        },
        {
          enableHighAccuracy: true,
          timeout: 8000, // Reduced from 15s for faster demo fallback
          maximumAge: 60000, // Allow cached position up to 60s for demo
        }
      );
    });
  }, [supported]);

  return { position, error, loading, getCurrentPosition, supported };
}
