// ============================================================
// checkIn - Check-In Flow Component (Two-Tier Validation)
// ============================================================

'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  MapPin,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  ArrowLeft,
  Clock,
  Building2,
  Ruler,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { FaceCapture } from '@/components/checkin/face-capture';
import { saveOfflineCheckIn, syncOfflineCheckIns } from '@/lib/offline-store';
import { useGeoLocation } from '@/hooks/use-geo-location';
import { isWithinVenueOrLecturer } from '@/lib/geo';
import { queueCheckIn } from '@/lib/offline';
import type { SessionInfo, CheckInResult, AttendanceStatus } from '@/lib/types';
import { toast } from 'sonner';

interface CheckInFlowProps {
  session: SessionInfo;
  studentId: string;
  onComplete: (result: CheckInResult) => void;
  onCancel: () => void;
}

type FlowStep = 'location' | 'biometric' | 'result';

interface LocationResult {
  passed: boolean;
  distance: number;
  threshold: number;
  lat: number;
  lng: number;
  accuracy?: number;
  message?: string;
}

export function CheckInFlow({ session, studentId, onComplete, onCancel }: CheckInFlowProps) {
  const [step, setStep] = useState<FlowStep>('location');
  const [locationResult, setLocationResult] = useState<LocationResult | null>(null);
  const [checkInResult, setCheckInResult] = useState<CheckInResult | null>(null);
  const [biometricProcessing, setBiometricProcessing] = useState(false);
  const [faceCaptureError, setFaceCaptureError] = useState<string | null>(null);

  const geo = useGeoLocation();

  const validateLocation = useCallback(
    (lat: number, lng: number, accuracy?: number) => {
      const lecturerPos = {
        lat: session.lecturerLat ?? null,
        lng: session.lecturerLng ?? null,
      };

      const geoCheck = isWithinVenueOrLecturer(
        lat,
        lng,
        accuracy,
        lecturerPos,
        null,
        session.distanceThreshold || 50
      );

      const result: LocationResult = {
        passed: geoCheck.within,
        distance: geoCheck.bestDistance,
        threshold: session.distanceThreshold || 50,
        lat,
        lng,
        accuracy,
        message: geoCheck.message,
      };

      setLocationResult(result);

      if (geoCheck.within) {
        // Small delay for visual feedback before moving to biometric step
        setTimeout(() => setStep('biometric'), 1000);
      }
    },
    [session]
  );

  // Auto-request GPS on mount
  useEffect(() => {
    geo.getCurrentPosition().catch(() => {
      // GPS failed - user can retry manually
    });
  }, []);

  // Process GPS when obtained
  useEffect(() => {
    if (geo.position && !locationResult) {
      validateLocation(geo.position.latitude, geo.position.longitude, geo.position.accuracy);
    }
  }, [geo.position, locationResult, validateLocation]);

  const handleRetryLocation = useCallback(() => {
    setLocationResult(null);
    geo.getCurrentPosition().catch(() => {});
  }, [geo]);

  const handleFaceCapture = useCallback(
    async (data: { selfieData: string; facialDescriptor: number[] }) => {
      if (!locationResult) return;

      setBiometricProcessing(true);
      setFaceCaptureError(null);

      try {
        const response = await fetch('/api/student/check-in', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId,
            sessionId: session.id,
            studentLat: locationResult.lat,
            studentLng: locationResult.lng,
            studentAccuracy: locationResult.accuracy,
            facialDescriptor: data.facialDescriptor,
            selfieData: data.selfieData,
          }),
        });

        const result = await response.json();

        if (result.data && (result.data.status === 'rejected_location')) {
          // Location rejected on server side
          const checkInRes: CheckInResult = {
            success: false,
            stage: 'location',
            message: result.error || 'Too far from venue',
            status: 'rejected_location',
          };
          setCheckInResult(checkInRes);
          setStep('result');
        } else if (result.data) {
          const status = result.data.status as AttendanceStatus;
          const score = result.data.similarityScore;
          let stage: 'location' | 'biometric' | 'complete' = 'complete';
          let message = result.data.message || '';

          if (status === 'present') {
            stage = 'complete';
          } else if (status === 'pending_review') {
            stage = 'biometric';
          } else if (status === 'rejected_identity') {
            stage = 'biometric';
          }

          const checkInRes: CheckInResult = {
            success: status === 'present' || status === 'pending_review',
            stage,
            message,
            similarityScore: score,
            status,
          };
          setCheckInResult(checkInRes);
          setStep('result');
        } else {
          // Error from API
          const checkInRes: CheckInResult = {
            success: false,
            stage: 'biometric',
            message: result.error || 'Check-in failed',
            status: 'rejected_identity',
          };
          setCheckInResult(checkInRes);
          setStep('result');
        }
      } catch {
        // Network error / slow connection path — save check-in to IndexedDB for automatic store-and-forward
        try {
          await saveOfflineCheckIn({
            sessionId: session.id,
            studentLat: locationResult.lat,
            studentLng: locationResult.lng,
            studentAccuracy: locationResult.accuracy || 10,
            facialDescriptor: data.facialDescriptor,
            selfieData: data.selfieData,
          });

          const checkInRes: CheckInResult = {
            success: true,
            stage: 'complete',
            message: 'Network offline / slow. Your check-in is saved in offline storage and will auto-sync to the server as soon as internet connects!',
            status: 'present',
          };
          setCheckInResult(checkInRes);
          setStep('result');
        } catch (saveErr) {
          console.error('Failed to save offline check-in:', saveErr);
          const errorMsg = 'Network connection failed. Please check your signal and try again.';
          setFaceCaptureError(errorMsg);
        }
      } finally {
        setBiometricProcessing(false);
      }
    },
    [session, locationResult, studentId]
  );

  // Auto-sync offline check-ins whenever network connection is restored
  useEffect(() => {
    const handleOnline = async () => {
      console.log('[CheckInFlow] Online event detected! Triggering background sync...');
      await syncOfflineCheckIns();
    };
    window.addEventListener('online', handleOnline);
    syncOfflineCheckIns(); // initial sync check on mount
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const handleFaceError = useCallback((error: string) => {
    setFaceCaptureError(error);
    toast.error(error);
  }, []);

  // Result display helpers
  const getResultConfig = () => {
    if (!checkInResult) return null;

    const status = checkInResult.status;
    if (status === 'present') {
      return {
        icon: <CheckCircle2 className="h-16 w-16 text-emerald-500" />,
        title: 'Attendance Verified!',
        description: checkInResult.message,
        color: 'text-emerald-500',
        bgColor: 'bg-emerald-50 dark:bg-emerald-950/20',
        progressColor: 'bg-emerald-500',
        badgeVariant: 'default' as const,
        badgeText: 'Present',
        badgeClass: 'bg-emerald-500 hover:bg-emerald-600',
      };
    }
    if (status === 'pending_review') {
      return {
        icon: <AlertTriangle className="h-16 w-16 text-amber-500" />,
        title: 'Submitted for Review',
        description: checkInResult.message,
        color: 'text-amber-500',
        bgColor: 'bg-amber-50 dark:bg-amber-950/20',
        progressColor: 'bg-amber-500',
        badgeVariant: 'default' as const,
        badgeText: 'Pending Review',
        badgeClass: 'bg-amber-500 hover:bg-amber-600',
      };
    }
    if (status === 'rejected_location') {
      return {
        icon: <XCircle className="h-16 w-16 text-red-500" />,
        title: 'Too Far from Venue',
        description: checkInResult.message || 'You are outside the allowed distance from the session venue.',
        color: 'text-red-500',
        bgColor: 'bg-red-50 dark:bg-red-950/20',
        progressColor: 'bg-red-500',
        badgeVariant: 'destructive' as const,
        badgeText: 'Location Rejected',
        badgeClass: '',
      };
    }
    // rejected_identity
    return {
      icon: <XCircle className="h-16 w-16 text-red-500" />,
      title: 'Identity Verification Failed',
      description: checkInResult.message || 'Your identity could not be verified.',
      color: 'text-red-500',
      bgColor: 'bg-red-50 dark:bg-red-950/20',
      progressColor: 'bg-red-500',
      badgeVariant: 'destructive' as const,
      badgeText: 'Identity Rejected',
      badgeClass: '',
    };
  };

  const formatSessionTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="w-full max-w-lg mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onCancel} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold truncate">
            {session.courseCode} — {session.courseName}
          </h2>
          <p className="text-sm text-muted-foreground truncate">{session.venueName}</p>
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2 text-sm">
        <div className={`flex items-center gap-1 ${step === 'location' ? 'text-foreground font-medium' : locationResult?.passed ? 'text-emerald-500' : 'text-muted-foreground'}`}>
          <MapPin className="h-4 w-4" />
          <span>Location</span>
        </div>
        <div className="h-px flex-1 bg-border" />
        <div className={`flex items-center gap-1 ${step === 'biometric' ? 'text-foreground font-medium' : checkInResult?.success ? 'text-emerald-500' : 'text-muted-foreground'}`}>
          <ShieldCheck className="h-4 w-4" />
          <span>Identity</span>
        </div>
        <div className="h-px flex-1 bg-border" />
        <div className={`flex items-center gap-1 ${step === 'result' ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
          <CheckCircle2 className="h-4 w-4" />
          <span>Result</span>
        </div>
      </div>

      {/* Step 1: Location Check */}
      {step === 'location' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Location Verification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Session details */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate">{session.venueName}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{formatSessionTime(session.scheduledAt)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Ruler className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>Within {session.distanceThreshold}m</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{session.durationMinutes} min session</span>
              </div>
            </div>

            <Separator />

            {/* GPS status */}
            {geo.loading && !locationResult && (
              <div className="flex flex-col items-center justify-center gap-3 py-6">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Getting your location...</span>
              </div>
            )}

            {geo.error && !locationResult && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 p-4 text-center">
                <MapPin className="h-8 w-8 mx-auto mb-2 text-amber-500" />
                <p className="text-sm text-amber-700 dark:text-amber-400">GPS unavailable</p>
                <p className="text-xs text-muted-foreground mt-1">Please ensure location services are enabled and try again</p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={handleRetryLocation}
                >
                  <MapPin className="h-3.5 w-3.5 mr-1.5" />
                  Retry GPS
                </Button>
              </div>
            )}

            {/* Location result */}
            {locationResult && !geo.loading && (
              <div className={`rounded-lg p-4 text-center ${locationResult.passed ? 'bg-emerald-50 dark:bg-emerald-950/20' : 'bg-red-50 dark:bg-red-950/20'}`}>
                {locationResult.passed ? (
                  <>
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                      You are within range
                    </p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">
                      Distance: {locationResult.distance.toFixed(1)}m (within {locationResult.threshold}m)
                    </p>
                  </>
                ) : (
                  <>
                    <XCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
                    <p className="text-sm font-medium text-red-700 dark:text-red-400">
                      Too far from venue
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                      Distance: {locationResult.distance.toFixed(1)}m (required: within {locationResult.threshold}m)
                    </p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={handleRetryLocation}>
                      Retry GPS
                    </Button>
                    <Button variant="ghost" size="sm" className="mt-3 ml-2" onClick={onCancel}>
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Biometric Check */}
      {step === 'biometric' && !biometricProcessing && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                <MapPin className="h-4 w-4" />
                <span>Location verified — {locationResult?.distance.toFixed(1)}m from venue</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Identity Verification
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Position your face in the frame and capture a selfie for identity verification.
              </p>
            </CardContent>
          </Card>

          <FaceCapture
            onCapture={handleFaceCapture}
            mode="checkin"
            onError={handleFaceError}
          />
        </div>
      )}

      {/* Biometric Processing */}
      {step === 'biometric' && biometricProcessing && (
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-medium">Verifying Identity</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Comparing facial data with your profile...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Result */}
      {step === 'result' && checkInResult && (() => {
        const config = getResultConfig();
        if (!config) return null;

        return (
          <Card>
            <CardContent className="p-6">
              <div className={`rounded-xl p-6 text-center ${config.bgColor}`}>
                <div className="flex justify-center mb-4">
                  {config.icon}
                </div>
                <h3 className={`text-xl font-bold ${config.color}`}>{config.title}</h3>
                <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
                  {config.description}
                </p>

                {/* Score & distance info */}
                <div className="mt-6 space-y-4">
                  {checkInResult.similarityScore !== undefined && (
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-muted-foreground">Similarity Score</span>
                        <span className="font-medium">{Math.round(checkInResult.similarityScore)}%</span>
                      </div>
                      <div className="relative h-3 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ${config.progressColor}`}
                          style={{ width: `${Math.min(Math.max(checkInResult.similarityScore, 0), 100)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                        <span>0%</span>
                        <span>50% (pass)</span>
                        <span>100%</span>
                      </div>
                    </div>
                  )}

                  {locationResult && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Distance from venue</span>
                      <span className="font-medium">{locationResult.distance.toFixed(1)}m</span>
                    </div>
                  )}

                  <Badge className={config.badgeClass} variant={config.badgeVariant}>
                    {config.badgeText}
                  </Badge>
                </div>
              </div>

              <Button className="w-full mt-4" onClick={() => onComplete(checkInResult)}>
                Close
              </Button>
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}
