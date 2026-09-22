import { useState, useEffect, useCallback, useRef } from 'react';

const CACHE_KEY = 'tourguard_last_known_location';

function getCachedLocation() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number') {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * useLiveLocation — Continuous live GPS tracking using the browser Geolocation API.
 * Uses navigator.geolocation.watchPosition() with cached location fallback for instant rendering.
 */
export function useLiveLocation(options = {}) {
  const {
    enableHighAccuracy = true,
    maximumAge = 30000,
    timeout = 8000,
    autoStart = true
  } = options;

  const [location, setLocation] = useState(() => {
    const cached = getCachedLocation();
    if (cached) {
      return {
        latitude: cached.latitude,
        longitude: cached.longitude,
        accuracy: cached.accuracy || null,
        altitude: cached.altitude || null,
        heading: cached.heading || null,
        speed: cached.speed || null,
        timestamp: cached.timestamp || null
      };
    }
    return {
      latitude: null,
      longitude: null,
      accuracy: null,
      altitude: null,
      heading: null,
      speed: null,
      timestamp: null
    };
  });

  const [loading, setLoading] = useState(() => !getCachedLocation());
  const [error, setError] = useState(null);
  const [permissionStatus, setPermissionStatus] = useState('prompt'); // 'prompt' | 'granted' | 'denied' | 'unavailable'
  const [isTracking, setIsTracking] = useState(false);

  const watchIdRef = useRef(null);
  const mountedRef = useRef(true);

  // Check permission status if navigator.permissions is available
  useEffect(() => {
    mountedRef.current = true;
    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((status) => {
          if (mountedRef.current) {
            setPermissionStatus(status.state);
            status.onchange = () => {
              if (mountedRef.current) {
                setPermissionStatus(status.state);
              }
            };
          }
        })
        .catch(() => {});
    }
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleSuccess = useCallback((position) => {
    if (!mountedRef.current) return;
    const { coords, timestamp } = position;
    const fresh = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy != null ? Math.round(coords.accuracy * 10) / 10 : null,
      altitude: coords.altitude,
      heading: coords.heading,
      speed: coords.speed,
      timestamp: new Date(timestamp || Date.now()).toISOString()
    };
    setLocation(fresh);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(fresh));
    } catch {}
    setLoading(false);
    setError(null);
    setPermissionStatus('granted');
  }, []);

  const handleError = useCallback((err) => {
    if (!mountedRef.current) return;
    setLoading(false);
    let message = 'Unable to access your current location.';

    if (err.code === 1) { // PERMISSION_DENIED
      message = 'Location permission is required to show your live location and nearby places.';
      setPermissionStatus('denied');
    } else if (err.code === 2) { // POSITION_UNAVAILABLE
      message = 'Unable to access your current location. Please enable device location services.';
      setPermissionStatus('unavailable');
    } else if (err.code === 3) { // TIMEOUT
      message = 'Location request timed out. Trying again...';
    }

    setError(message);
  }, []);

  const startTracking = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      setPermissionStatus('unavailable');
      setLoading(false);
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setLoading(true);
    setError(null);
    setIsTracking(true);

    // Initial position attempt for instant feedback
    navigator.geolocation.getCurrentPosition(handleSuccess, () => {}, {
      enableHighAccuracy,
      maximumAge,
      timeout: 5000
    });

    // Continuous real-time watching
    const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy,
      maximumAge,
      timeout
    });

    watchIdRef.current = watchId;
  }, [enableHighAccuracy, maximumAge, timeout, handleSuccess, handleError]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
  }, []);

  useEffect(() => {
    if (autoStart) {
      startTracking();
    }
    return () => {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [autoStart, startTracking]);

  return {
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracy,
    altitude: location.altitude,
    heading: location.heading,
    speed: location.speed,
    timestamp: location.timestamp,
    loading,
    error,
    permissionStatus,
    isTracking,
    startTracking,
    stopTracking
  };
}

export default useLiveLocation;
