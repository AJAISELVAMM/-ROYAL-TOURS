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
import * as transportService from '../../services/transportService.js';
import { checkOffRoute, distanceMeters, formatDistance, formatDuration } from '../../utils/geoUtils.js';

const MODES = [
  { id: 'driving-car', label: 'Car / Cab', icon: 'car' },
  { id: 'auto', label: 'Auto', icon: 'navigation' },
  { id: 'walking', label: 'Walking', icon: 'footprints' }
];

const ROUTE_RECALCULATION_DISTANCE = 50; // meters threshold for off-route recalculation
const RECALC_COOLDOWN_MS = 6000; // minimum interval between auto-recalculations

export default function NavigationModal({
  isOpen,
  onClose,
  destination = null, // { name, address, latitude, longitude, category }
  initialMode = 'driving-car'
}) {
  const { push, dismiss } = useToast();
  const { currentLocation, setSelectedLocation } = useLocation();

  const [mode, setMode] = useState(initialMode);
  const [route, setRoute] = useState(null);
  const [navState, setNavState] = useState('IDLE'); // IDLE | REQUESTING_LOCATION | CALCULATING_ROUTE | NAVIGATING | RECALCULATING | ARRIVED | EXITED
  const [error, setError] = useState(null);
  const [isOffRoute, setIsOffRoute] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const routeRequestInProgressRef = useRef(false);
  const abortControllerRef = useRef(null);
  const lastRecalcCoordRef = useRef(null);
  const lastRecalcTimeRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      dismiss('navigation-recalculate');
    };
  }, [dismiss]);

  const calculateRoute = useCallback(async (selectedMode = mode, isRecalculation = false) => {
    if (!destination || destination.latitude == null || destination.longitude == null) {
      setError('Destination coordinates are missing.');
      return;
    }

    if (currentLocation.latitude == null || currentLocation.longitude == null) {
      setNavState('REQUESTING_LOCATION');
      setError('Waiting for live device GPS. Please ensure location is enabled.');
      return;
    }

    // Request Lock: prevent concurrent or overlapping route requests
    if (routeRequestInProgressRef.current) {
      return;
    }

    routeRequestInProgressRef.current = true;
    setNavState(isRecalculation ? 'RECALCULATING' : 'CALCULATING_ROUTE');
    setError(null);

    // Cancel any in-flight route request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;

    if (isRecalculation) {
      setIsOffRoute(true);
      push('Recalculating route from current location…', 'info', {
        id: 'navigation-recalculate',
        duration: 8000
      });
    }

    try {
      const data = await transportService.getRoute({
        from: { latitude: currentLocation.latitude, longitude: currentLocation.longitude },
        to: { latitude: destination.latitude, longitude: destination.longitude },
        mode: selectedMode,
        signal: abortCtrl.signal
      });

      if (!isMountedRef.current) return;

      setRoute(data);
      setCurrentStepIndex(0);
      setIsOffRoute(false);
      setNavState('NAVIGATING');

      lastRecalcCoordRef.current = { lat: currentLocation.latitude, lon: currentLocation.longitude };
      lastRecalcTimeRef.current = Date.now();

      if (isRecalculation) {
        push('Route updated', 'success', {
          id: 'navigation-recalculate',
          duration: 2500
        });
      }
    } catch (err) {
      if (err.name === 'AbortError' || abortCtrl.signal.aborted) {
        return; // Request was cleanly cancelled
      }
      if (!isMountedRef.current) return;

      const msg = err?.message || 'Could not calculate real road route.';
      setError(msg);
      setNavState('NAVIGATING'); // Keep navigating with existing route if any
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
  }, [destination, currentLocation.latitude, currentLocation.longitude, mode, push]);

  // Initial route calculation when modal opens or destination changes
  useEffect(() => {
    if (isOpen && destination) {
      setSelectedLocation({
        latitude: destination.latitude,
        longitude: destination.longitude,
        name: destination.name,
        address: destination.address
      });
      calculateRoute(mode, false);
    } else {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      routeRequestInProgressRef.current = false;
      setRoute(null);
      setError(null);
      setIsOffRoute(false);
      setNavState('IDLE');
      dismiss('navigation-recalculate');
    }
  }, [isOpen, destination]);

  // Handle transport mode change
  function handleModeChange(newMode) {
    setMode(newMode);
    calculateRoute(newMode, false);
  }

  // Off-route monitoring with deviation threshold and cooldown protection
  useEffect(() => {
    if (!isOpen || !route || currentLocation.latitude == null || currentLocation.longitude == null) {
      return;
    }

    if (routeRequestInProgressRef.current || navState === 'CALCULATING_ROUTE' || navState === 'RECALCULATING') {
      return;
    }

    const coords = route.geometry?.coordinates || [];
    if (!coords || coords.length === 0) return;

    const off = checkOffRoute(
      currentLocation.latitude,
      currentLocation.longitude,
      coords,
      ROUTE_RECALCULATION_DISTANCE,
      true
    );

    if (off.isOffRoute) {
      const now = Date.now();
      const lastTime = lastRecalcTimeRef.current;
      const lastCoord = lastRecalcCoordRef.current;

      const movedSinceLastRecalc = lastCoord
        ? distanceMeters(lastCoord.lat, lastCoord.lon, currentLocation.latitude, currentLocation.longitude)
        : Infinity;

      // Only recalculate if off route AND cooldown elapsed AND moved significantly
      if (now - lastTime > RECALC_COOLDOWN_MS && movedSinceLastRecalc > 30) {
        calculateRoute(mode, true);
      }
    } else if (isOffRoute) {
      setIsOffRoute(false);
    }
  }, [isOpen, currentLocation.latitude, currentLocation.longitude, route, isOffRoute, navState, mode, calculateRoute]);

  // Check arrival threshold (< 25 meters from destination)
  useEffect(() => {
    if (isOpen && destination?.latitude != null && currentLocation.latitude != null && navState === 'NAVIGATING') {
      const dist = distanceMeters(currentLocation.latitude, currentLocation.longitude, destination.latitude, destination.longitude);
      if (dist < 25 && navState !== 'ARRIVED') {
        setNavState('ARRIVED');
        push('You have arrived at your destination!', 'success', { id: 'navigation-arrival' });
      }
    }
  }, [isOpen, destination, currentLocation.latitude, currentLocation.longitude, navState, push]);

  if (!isOpen || !destination) return null;

  const steps = Array.isArray(route?.steps) ? route.steps : [];
  const currentStep = steps[currentStepIndex] || (steps.length > 0 ? steps[0] : null);
  const nextStep = steps[currentStepIndex + 1] || null;
  const isLoading = navState === 'CALCULATING_ROUTE' || navState === 'RECALCULATING';

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
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
            onClick={onClose}
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
                  📍 {formatDistance(route.distanceKm)}
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
              currentLocation={currentLocation}
              selectedLocation={{
                latitude: destination.latitude,
                longitude: destination.longitude,
                name: destination.name,
                address: destination.address
              }}
              route={route}
              layer="satellite"
              height="100%"
              isLoading={isLoading}
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
            <Button size="sm" variant="primary" onClick={onClose}>
              Exit Navigation
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

