// =============================================================================
// NavigationModal.jsx — In-App Live Satellite Road Navigation Modal.
// Displays real road routing, live GPS tracking, turn-by-turn instructions,
// and off-route recalculation without duplicate toasts or external redirects.
// =============================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import RealMap from './RealMap.jsx';
import Button from '../common/Button.jsx';
import Icon from '../common/Icon.jsx';
import { useLocation } from '../../context/LocationContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { api } from '../../services/api.js';
import * as transportService from '../../services/transportService.js';
import { checkOffRoute, distanceMeters, formatDistance, formatDuration } from '../../utils/geoUtils.js';

const MODES = [
  { id: 'driving-car', label: 'Car / Cab', icon: 'car' },
  { id: 'auto', label: 'Auto', icon: 'navigation' },
  { id: 'walking', label: 'Walking', icon: 'footprints' }
];

const ROUTE_RECALCULATION_DISTANCE = 50; // meters threshold for off-route recalculation
const RECALC_COOLDOWN_MS = 6000; // minimum interval between auto-recalculations
const ARRIVAL_THRESHOLD_METERS = 30; // meters radius to mark destination reached

function isValidCoordinate(lat, lon) {
  if (lat == null || lon == null) return false;
  const nLat = Number(lat);
  const nLon = Number(lon);
  if (isNaN(nLat) || isNaN(nLon)) return false;
  if (nLat === 0 && nLon === 0) return false;
  return nLat >= -90 && nLat <= 90 && nLon >= -180 && nLon <= 180;
}

export default function NavigationModal({
  isOpen,
  onClose,
  destination = null, // { name, address, latitude, longitude, category }
  initialMode = 'driving-car',
  initialRoute = null,
  initialOrigin = null
}) {
  const { push, dismiss } = useToast();
  const { currentLocation, setSelectedLocation } = useLocation();

  const [mode, setMode] = useState(initialMode);
  const [route, setRoute] = useState(initialRoute || null);
  const [navState, setNavState] = useState('IDLE'); // IDLE | REQUESTING_LOCATION | CALCULATING_ROUTE | NAVIGATING | RECALCULATING | ARRIVED | EXITED
  const [error, setError] = useState(null);
  const [isOffRoute, setIsOffRoute] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [liveLocation, setLiveLocation] = useState(null);
  const [safetyMarkers, setSafetyMarkers] = useState([]);

  const routeRequestInProgressRef = useRef(false);
  const abortControllerRef = useRef(null);
  const safetyAbortCtrlRef = useRef(null);
  const watchIdRef = useRef(null);
  const lastRecalcCoordRef = useRef(null);
  const lastRecalcTimeRef = useRef(0);
  const isMountedRef = useRef(true);

  // Stop GPS watcher helper
  const stopGpsWatcher = useCallback(() => {
    if (watchIdRef.current !== null) {
      if (typeof navigator !== 'undefined' && navigator.geolocation?.clearWatch) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      watchIdRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopGpsWatcher();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (safetyAbortCtrlRef.current) {
        safetyAbortCtrlRef.current.abort();
      }
      dismiss('navigation-recalculate');
      dismiss('navigation-arrival');
    };
  }, [dismiss, stopGpsWatcher]);

  // Determine best available current coordinates
  const activeUserLat = liveLocation?.latitude ?? (isValidCoordinate(currentLocation?.latitude, currentLocation?.longitude) ? currentLocation.latitude : initialOrigin?.latitude ?? initialOrigin?.lat);
  const activeUserLon = liveLocation?.longitude ?? (isValidCoordinate(currentLocation?.latitude, currentLocation?.longitude) ? currentLocation.longitude : initialOrigin?.longitude ?? initialOrigin?.lon);

  const activeUserLocation = (isValidCoordinate(activeUserLat, activeUserLon)) ? {
    latitude: Number(activeUserLat),
    longitude: Number(activeUserLon),
    accuracy: liveLocation?.accuracy ?? currentLocation?.accuracy ?? null,
    heading: liveLocation?.heading ?? currentLocation?.heading ?? null,
    speed: liveLocation?.speed ?? currentLocation?.speed ?? null,
    timestamp: liveLocation?.timestamp ?? currentLocation?.timestamp ?? Date.now()
  } : null;

  // Continuous live GPS watchPosition tracking while modal is open
  useEffect(() => {
    if (!isOpen) {
      stopGpsWatcher();
      setLiveLocation(null);
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      console.warn('[NavigationModal] Geolocation API not available in browser.');
      return;
    }

    // Start live GPS tracking with high accuracy
    stopGpsWatcher();
    try {
      const id = navigator.geolocation.watchPosition(
        (pos) => {
          if (!isMountedRef.current) return;
          const { latitude, longitude, accuracy, heading, speed } = pos.coords;
          if (isValidCoordinate(latitude, longitude)) {
            setLiveLocation({
              latitude: Number(latitude),
              longitude: Number(longitude),
              accuracy: accuracy ? Math.round(accuracy) : null,
              heading: heading ?? null,
              speed: speed ?? null,
              timestamp: pos.timestamp || Date.now()
            });
          }
        },
        (err) => {
          console.warn('[NavigationModal:watchPosition]', err?.message);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 3000,
          timeout: 10000
        }
      );
      watchIdRef.current = id;
    } catch (err) {
      console.warn('[NavigationModal] watchPosition failed to start:', err?.message);
    }

    return () => {
      stopGpsWatcher();
    };
  }, [isOpen, stopGpsWatcher]);

  // Route calculation
  const calculateRoute = useCallback(async (selectedMode = mode, isRecalculation = false) => {
    const destLat = destination?.latitude;
    const destLon = destination?.longitude;

    if (!isValidCoordinate(destLat, destLon)) {
      setError('Destination coordinates are invalid or missing.');
      return;
    }

    if (!isValidCoordinate(activeUserLat, activeUserLon)) {
      setNavState('REQUESTING_LOCATION');
      setError('Waiting for live device GPS. Please ensure location access is enabled.');
      return;
    }

    if (routeRequestInProgressRef.current) {
      return;
    }

    routeRequestInProgressRef.current = true;
    setNavState(isRecalculation ? 'RECALCULATING' : 'CALCULATING_ROUTE');
    setError(null);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;

    if (isRecalculation) {
      setIsOffRoute(true);
      push('Recalculating route from current location…', 'info', {
        id: 'navigation-recalculate',
        duration: 5000
      });
    }

    try {
      const data = await transportService.getRoute({
        from: { latitude: Number(activeUserLat), longitude: Number(activeUserLon) },
        to: { latitude: Number(destLat), longitude: Number(destLon) },
        mode: selectedMode,
        signal: abortCtrl.signal
      });

      if (!isMountedRef.current) return;

      setRoute(data);
      setCurrentStepIndex(0);
      setIsOffRoute(false);
      setNavState('NAVIGATING');

      lastRecalcCoordRef.current = { lat: Number(activeUserLat), lon: Number(activeUserLon) };
      lastRecalcTimeRef.current = Date.now();

      if (isRecalculation) {
        push('Route updated', 'success', {
          id: 'navigation-recalculate',
          duration: 2500
        });
      }
    } catch (err) {
      if (err.name === 'AbortError' || abortCtrl.signal.aborted) {
        return;
      }
      if (!isMountedRef.current) return;

      const msg = err?.message || 'Could not calculate real road route.';
      setError(msg);
      setNavState('NAVIGATING');
      if (isRecalculation) {
        push('Unable to recalculate route. Continuing with existing path.', 'warning', {
          id: 'navigation-recalculate',
          duration: 3500
        });
      } else {
        push(msg, 'error', { id: 'navigation-error' });
      }
    } finally {
      routeRequestInProgressRef.current = false;
    }
  }, [destination?.latitude, destination?.longitude, activeUserLat, activeUserLon, mode, push]);

  // Initial setup when modal opens
  useEffect(() => {
    if (isOpen && destination) {
      setSelectedLocation({
        latitude: destination.latitude,
        longitude: destination.longitude,
        name: destination.name,
        address: destination.address
      });

      // If initialRoute is provided and contains coordinates, immediately activate navigation!
      const initialCoords = initialRoute?.geometry?.coordinates;
      if (Array.isArray(initialCoords) && initialCoords.length > 0) {
        setRoute(initialRoute);
        setCurrentStepIndex(0);
        setIsOffRoute(false);
        setNavState('NAVIGATING');
        setError(null);
      } else {
        // Calculate route from live position to destination
        calculateRoute(mode, false);
      }
    } else {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (safetyAbortCtrlRef.current) {
        safetyAbortCtrlRef.current.abort();
      }
      stopGpsWatcher();
      routeRequestInProgressRef.current = false;
      setRoute(null);
      setError(null);
      setIsOffRoute(false);
      setNavState('IDLE');
      setSafetyMarkers([]);
      dismiss('navigation-recalculate');
    }
  }, [isOpen, destination, initialRoute, stopGpsWatcher, setSelectedLocation, dismiss]);

  // Non-blocking asynchronous nearby safety facility discovery
  useEffect(() => {
    if (!isOpen || navState === 'IDLE' || navState === 'CALCULATING_ROUTE') return;

    const queryLat = destination?.latitude ?? activeUserLat;
    const queryLon = destination?.longitude ?? activeUserLon;
    if (!isValidCoordinate(queryLat, queryLon)) return;

    if (safetyAbortCtrlRef.current) {
      safetyAbortCtrlRef.current.abort();
    }
    const ctrl = new AbortController();
    safetyAbortCtrlRef.current = ctrl;

    const timer = setTimeout(() => ctrl.abort(), 10000);

    (async () => {
      try {
        const res = await api.get(`/safety/map?lat=${queryLat}&lon=${queryLon}&radius=5000`, { signal: ctrl.signal });
        clearTimeout(timer);
        if (!isMountedRef.current) return;
        const facilities = res?.facilities || res?.items || (Array.isArray(res) ? res : []);
        if (Array.isArray(facilities) && facilities.length > 0) {
          const markers = facilities
            .map((f, i) => ({
              id: f.id || `safe-${i}`,
              latitude: Number(f.latitude || f.lat),
              longitude: Number(f.longitude || f.lon),
              name: f.name || f.title || 'Safety Facility',
              category: (f.category || f.type || 'HOSPITAL').toUpperCase(),
              phone: f.phone || null,
              address: f.address || null
            }))
            .filter((m) => isValidCoordinate(m.latitude, m.longitude));
          setSafetyMarkers(markers);
        }
      } catch (err) {
        clearTimeout(timer);
        // Do NOT fail navigation if safety facilities lookup fails or times out
        console.warn('[NavigationModal:SafetyFacilities] Non-blocking discovery ended:', err?.message);
      }
    })();

    return () => {
      clearTimeout(timer);
      if (safetyAbortCtrlRef.current) {
        safetyAbortCtrlRef.current.abort();
      }
    };
  }, [isOpen, navState, destination?.latitude, destination?.longitude, activeUserLat, activeUserLon]);

  // Mode change
  function handleModeChange(newMode) {
    setMode(newMode);
    calculateRoute(newMode, false);
  }

  // Off-route monitoring with deviation threshold and cooldown protection
  useEffect(() => {
    if (!isOpen || !route || !isValidCoordinate(activeUserLat, activeUserLon)) {
      return;
    }

    if (routeRequestInProgressRef.current || navState === 'CALCULATING_ROUTE' || navState === 'RECALCULATING') {
      return;
    }

    const coords = route.geometry?.coordinates || [];
    if (!coords || coords.length === 0) return;

    const off = checkOffRoute(
      Number(activeUserLat),
      Number(activeUserLon),
      coords,
      ROUTE_RECALCULATION_DISTANCE,
      true
    );

    if (off.isOffRoute) {
      const now = Date.now();
      const lastTime = lastRecalcTimeRef.current;
      const lastCoord = lastRecalcCoordRef.current;

      const movedSinceLastRecalc = lastCoord
        ? distanceMeters(lastCoord.lat, lastCoord.lon, Number(activeUserLat), Number(activeUserLon))
        : Infinity;

      if (now - lastTime > RECALC_COOLDOWN_MS && movedSinceLastRecalc > 30) {
        calculateRoute(mode, true);
      }
    } else if (isOffRoute) {
      setIsOffRoute(false);
    }
  }, [isOpen, activeUserLat, activeUserLon, route, isOffRoute, navState, mode, calculateRoute]);

  // Check arrival threshold (< 30 meters from destination)
  useEffect(() => {
    if (
      isOpen &&
      destination?.latitude != null &&
      isValidCoordinate(activeUserLat, activeUserLon) &&
      navState === 'NAVIGATING'
    ) {
      const dist = distanceMeters(
        Number(activeUserLat),
        Number(activeUserLon),
        Number(destination.latitude),
        Number(destination.longitude)
      );

      if (dist < ARRIVAL_THRESHOLD_METERS && navState !== 'ARRIVED') {
        setNavState('ARRIVED');
        stopGpsWatcher();
        push('You have arrived at your destination!', 'success', { id: 'navigation-arrival' });
      }
    }
  }, [isOpen, destination, activeUserLat, activeUserLon, navState, push, stopGpsWatcher]);

  // Clean exit handler
  const handleExitNavigation = useCallback(() => {
    stopGpsWatcher();
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (safetyAbortCtrlRef.current) {
      safetyAbortCtrlRef.current.abort();
    }
    setNavState('IDLE');
    setRoute(null);
    setSafetyMarkers([]);
    onClose();
  }, [stopGpsWatcher, onClose]);

  if (!isOpen || !destination) return null;

  const steps = Array.isArray(route?.steps) ? route.steps : [];
  const currentStep = steps[currentStepIndex] || (steps.length > 0 ? steps[0] : null);
  const nextStep = steps[currentStepIndex + 1] || null;
  const isLoading = navState === 'CALCULATING_ROUTE' || navState === 'RECALCULATING';

  // Compute live remaining distance to destination
  const liveRemainingDistKm = (isValidCoordinate(activeUserLat, activeUserLon) && isValidCoordinate(destination.latitude, destination.longitude))
    ? (distanceMeters(Number(activeUserLat), Number(activeUserLon), Number(destination.latitude), Number(destination.longitude)) / 1000)
    : (route?.distanceKm || 0);

  return (
    <div className="modal-overlay" onClick={handleExitNavigation} style={{ zIndex: 1100 }}>
      <div
        className="modal modal-lg"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '820px', width: '95%', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div className="modal-header" style={{ background: 'var(--sidebar-bg)', color: '#ffffff', borderRadius: '16px 16px 0 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="navigation" size={20} />
            </div>
            <div>
              <h2 className="modal-title" style={{ color: '#ffffff', fontSize: '17px', margin: 0 }}>
                Navigate to {destination.name}
              </h2>
              <span style={{ fontSize: '12px', color: '#c4b5fd' }}>
                {destination.address || 'Real-time satellite GPS road navigation'}
              </span>
            </div>
          </div>
          <button
            onClick={handleExitNavigation}
            style={{ background: 'none', border: 'none', color: '#e2d9f5', cursor: 'pointer', display: 'flex', padding: '6px' }}
            aria-label="Close"
          >
            <Icon name="x" size={22} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
          {/* Controls Bar: Mode selector & Route Metrics */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            {/* Mode selection */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleModeChange(m.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    border: mode === m.id ? '1.5px solid var(--purple)' : '1px solid var(--border)',
                    background: mode === m.id ? 'var(--purple)' : '#ffffff',
                    color: mode === m.id ? '#ffffff' : 'var(--text)',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Icon name={m.icon} size={15} />
                  <span>{m.label}</span>
                </button>
              ))}
            </div>

            {/* Distance & ETA */}
            {route && (
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', background: 'var(--purple-50)', padding: '6px 14px', borderRadius: '10px' }}>
                <span style={{ fontSize: '13.5px', color: 'var(--purple-deep)', fontWeight: 700 }}>
                  📍 {formatDistance(liveRemainingDistKm)}
                </span>
                <span style={{ fontSize: '13.5px', color: 'var(--purple-deep)', fontWeight: 700 }}>
                  ⏱️ ~{formatDuration(route.durationMinutes)}
                </span>
              </div>
            )}
          </div>

          {/* Satellite Map Container */}
          <div style={{ height: '380px', borderRadius: '14px', overflow: 'hidden', border: '1px solid var(--border)', position: 'relative' }}>
            <RealMap
              currentLocation={activeUserLocation || currentLocation}
              selectedLocation={{
                latitude: Number(destination.latitude),
                longitude: Number(destination.longitude),
                name: destination.name,
                address: destination.address
              }}
              markers={safetyMarkers}
              route={route}
              layer="satellite"
              height="100%"
              isLoading={isLoading}
              loadingTitle={navState === 'RECALCULATING' ? 'Recalculating route…' : 'Calculating road route (OSRM)…'}
              loadingSubtitle={navState === 'RECALCULATING' ? 'Recalculating from your current GPS position…' : 'Connecting to live road navigation network…'}
              loadingLabel={navState === 'RECALCULATING' ? 'Recalculating route from current location…' : 'Calculating real road route (OSRM)…'}
              isOffRoute={isOffRoute}
              onRecalculateRoute={() => calculateRoute(mode, true)}
            />
          </div>

          {/* Turn-by-Turn Directions Banner */}
          {route && (
            <div
              style={{
                background: '#faf5ff',
                border: '1px solid var(--purple-100, #e9d5ff)',
                borderRadius: '12px',
                padding: '12px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--purple)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>
                    {currentStepIndex + 1}
                  </span>
                  <strong style={{ fontSize: '13.5px', color: 'var(--purple-deep)' }}>
                    {typeof currentStep === 'string' ? currentStep : currentStep?.instruction || 'Follow the highlighted road route.'}
                  </strong>
                </div>

                {steps.length > 1 && (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      disabled={currentStepIndex <= 0}
                      onClick={() => setCurrentStepIndex((i) => Math.max(0, i - 1))}
                      style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: '#ffffff', cursor: 'pointer' }}
                    >
                      ◀
                    </button>
                    <button
                      type="button"
                      disabled={currentStepIndex >= steps.length - 1}
                      onClick={() => setCurrentStepIndex((i) => Math.min(steps.length - 1, i + 1))}
                      style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: '#ffffff', cursor: 'pointer' }}
                    >
                      ▶
                    </button>
                  </div>
                )}
              </div>

              {nextStep && (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', paddingLeft: '30px' }}>
                  Next: {typeof nextStep === 'string' ? nextStep : nextStep.instruction}
                </div>
              )}
            </div>
          )}

          {error && (
            <div style={{ padding: '10px 14px', background: 'var(--red-soft)', color: 'var(--red)', borderRadius: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon name="alert-circle" size={16} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🛰️ Live Satellite Guidance</span>
            <span>•</span>
            <span>🛣️ OSRM Road Routing</span>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <Button size="sm" variant="ghost" onClick={() => calculateRoute(mode, false)} icon="refresh-cw" disabled={isLoading}>
              Recalculate
            </Button>
            <Button size="sm" variant="primary" onClick={handleExitNavigation}>
              Exit Navigation
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

