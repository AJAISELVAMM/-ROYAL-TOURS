// =============================================================================
// TransportView.jsx — Real road routing, live GPS, and satellite navigation.
// No map shown initially. Opens satellite map & real turn-by-turn guidance upon
// route calculation.
// =============================================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Icon from '../../components/common/Icon.jsx';
import LocationAutocomplete from '../../components/common/LocationAutocomplete.jsx';
import RealMap from '../../components/maps/RealMap.jsx';
import NavigationModal from '../../components/maps/NavigationModal.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useLocation } from '../../context/LocationContext.jsx';
import * as transportService from '../../services/transportService.js';
import { checkOffRoute, distanceMeters, formatDistance, formatDuration } from '../../utils/geoUtils.js';

const MODES = [
  { id: 'driving-car', label: 'Car / Cab', icon: 'car' },
  { id: 'auto', label: 'Auto Rickshaw', icon: 'navigation' },
  { id: 'walking', label: 'Walking', icon: 'footprints' },
  { id: 'bus', label: 'Public Bus', icon: 'bus' }
];

function calculateModeDuration(distanceKm, baseDrivingMinutes, transportMode) {
  const dist = Number(distanceKm) || 0;
  const carMin = Number(baseDrivingMinutes) || (dist > 0 ? Math.max(1, Math.round((dist / 35) * 60)) : 0);

  switch (transportMode) {
    case 'auto':
      // Auto rickshaw: realistic city speed (~25-30 km/h), ~1.28x car duration
      return Math.max(1, Math.round(carMin * 1.28));
    case 'walking':
    case 'walking_foot':
      // Walking: average foot speed ~4.8 km/h (12.5 min/km)
      return Math.max(1, Math.round((dist / 4.8) * 60));
    case 'bus':
      // Public bus: includes passenger boarding/stop cycle and ~6 min headway wait
      return Math.max(3, Math.round(6 + (dist / 20) * 60));
    case 'driving-car':
    default:
      return Math.max(1, carMin);
  }
}

export default function TransportView() {
  const { push, dismiss } = useToast();
  const { currentLocation, selectedLocation } = useLocation();

  const [fromLocation, setFromLocation] = useState('My Current Location');
  const [fromLocationCoords, setFromLocationCoords] = useState(null);
  const [toLocation, setToLocation] = useState('');
  const [toLocationCoords, setToLocationCoords] = useState(null);
  const [mode, setMode] = useState('driving-car');
  const [loading, setLoading] = useState(false);
  const [route, setRoute] = useState(null);
  const [error, setError] = useState(null);
  const [busUnavailableMsg, setBusUnavailableMsg] = useState(null);
  const [isOffRoute, setIsOffRoute] = useState(false);
  const [isNavigatingModalOpen, setIsNavigatingModalOpen] = useState(false);

  const requestInProgressRef = useRef(false);
  const abortCtrlRef = useRef(null);
  const lastRecalcTimeRef = useRef(0);
  const lastRecalcCoordRef = useRef(null);

  useEffect(() => {
    return () => {
      if (abortCtrlRef.current) {
        abortCtrlRef.current.abort();
      }
      dismiss('transport-route-calc');
    };
  }, [dismiss]);

  // Pre-fill destination if selected from catalog/discover
  useEffect(() => {
    if (selectedLocation?.name) {
      setToLocation(selectedLocation.name);
      if (selectedLocation.latitude != null && selectedLocation.longitude != null) {
        setToLocationCoords({
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
          name: selectedLocation.name,
          address: selectedLocation.address
        });
      }
    }
  }, [selectedLocation]);

  const handleFindRoute = useCallback(async (e, isAutoReroute = false) => {
    if (e && e.preventDefault) e.preventDefault();
    setError(null);
    setBusUnavailableMsg(null);

    let origin = fromLocation.trim();
    if (origin === 'My Current Location' || !origin) {
      if (currentLocation.latitude != null && currentLocation.longitude != null) {
        origin = { latitude: currentLocation.latitude, longitude: currentLocation.longitude };
      } else {
        push('Waiting for live device GPS… please ensure location access is allowed.', 'error', { id: 'gps-needed' });
        return;
      }
    } else if (fromLocationCoords?.latitude != null && fromLocationCoords?.longitude != null) {
      origin = { latitude: fromLocationCoords.latitude, longitude: fromLocationCoords.longitude, label: fromLocationCoords.name || fromLocation };
    }

    let dest = toLocation.trim();
    if (!dest) {
      push('Please enter a destination.', 'error', { id: 'dest-needed' });
      return;
    }
    if (toLocationCoords?.latitude != null && toLocationCoords.longitude != null) {
      dest = { latitude: toLocationCoords.latitude, longitude: toLocationCoords.longitude, label: toLocationCoords.name || toLocation };
    } else if (selectedLocation?.latitude != null && selectedLocation.name === dest) {
      dest = { latitude: selectedLocation.latitude, longitude: selectedLocation.longitude, label: selectedLocation.name };
    }

    if (mode === 'bus') {
      setBusUnavailableMsg('Public bus timetable is approximate for this route. Displaying transit road corridor.');
    }

    if (requestInProgressRef.current) return;
    requestInProgressRef.current = true;

    if (abortCtrlRef.current) {
      abortCtrlRef.current.abort();
    }
    const abortCtrl = new AbortController();
    abortCtrlRef.current = abortCtrl;

    setLoading(true);
    if (isAutoReroute) {
      setIsOffRoute(true);
      push('Recalculating route from current location…', 'info', { id: 'transport-route-calc', duration: 6000 });
    }

    try {
      const routeMode = mode === 'bus' ? 'driving-car' : (mode === 'auto' ? 'driving-car' : mode);
      const data = await transportService.getRoute({
        from: origin,
        to: dest,
        mode: routeMode,
        signal: abortCtrl.signal
      });

      const baseDriving = data.baseDrivingMinutes || (routeMode === 'driving-car' ? data.durationMinutes : Math.max(1, Math.round((data.distanceKm / 35) * 60)));
      const adjustedDuration = calculateModeDuration(data.distanceKm, baseDriving, mode);

      setRoute({
        ...data,
        baseDrivingMinutes: baseDriving,
        durationMinutes: adjustedDuration,
        selectedMode: mode
      });
      setIsOffRoute(false);
      lastRecalcCoordRef.current = currentLocation.latitude != null ? { lat: currentLocation.latitude, lon: currentLocation.longitude } : null;
      lastRecalcTimeRef.current = Date.now();

      if (isAutoReroute) {
        push('Route updated', 'success', { id: 'transport-route-calc', duration: 2500 });
      } else {
        push('Route calculated successfully', 'success', { id: 'transport-route-calc', duration: 3000 });
      }
    } catch (err) {
      if (err.name === 'AbortError' || abortCtrl.signal.aborted) return;
      setError(err?.message || 'Could not calculate road route.');
      push(err?.message || 'Route calculation failed', 'error', { id: 'transport-route-calc' });
    } finally {
      requestInProgressRef.current = false;
      setLoading(false);
    }
  }, [fromLocation, fromLocationCoords, toLocation, toLocationCoords, mode, currentLocation.latitude, currentLocation.longitude, selectedLocation, push]);

  const handleModeChange = (newMode) => {
    setMode(newMode);
    if (newMode === 'bus') {
      setBusUnavailableMsg('Public bus timetable is approximate for this route. Displaying transit road corridor.');
    } else {
      setBusUnavailableMsg(null);
    }
    if (route && (route.distanceKm != null || route.baseDrivingMinutes != null)) {
      const baseDriving = route.baseDrivingMinutes || (route.distanceKm ? Math.max(1, Math.round((route.distanceKm / 35) * 60)) : route.durationMinutes);
      const updatedMinutes = calculateModeDuration(route.distanceKm, baseDriving, newMode);
      setRoute((prev) => ({
        ...prev,
        durationMinutes: updatedMinutes,
        selectedMode: newMode
      }));
    }
  };

  const handleStartNavigation = () => {
    if (!route) return;
    setIsNavigatingModalOpen(true);
  };

  // Off-route monitoring
  useEffect(() => {
    if (route && currentLocation.latitude != null && currentLocation.longitude != null && !requestInProgressRef.current) {
      const coords = route.geometry?.coordinates || [];
      if (coords.length > 0) {
        const off = checkOffRoute(currentLocation.latitude, currentLocation.longitude, coords, 60, true);
        if (off.isOffRoute) {
          const now = Date.now();
          const lastTime = lastRecalcTimeRef.current;
          const lastCoord = lastRecalcCoordRef.current;
          const moved = lastCoord ? distanceMeters(lastCoord.lat, lastCoord.lon, currentLocation.latitude, currentLocation.longitude) : Infinity;

          if (now - lastTime > 6000 && moved > 30) {
            handleFindRoute(null, true);
          }
        }
      }
    }
  }, [currentLocation.latitude, currentLocation.longitude, route, handleFindRoute]);

  return (
    <div className="page transport-view-page">
      <div className="page-header">
        <div>
          <h1>Smart Travel &amp; Transport</h1>
          <p className="subtitle">Real-time route navigation, turn-by-turn guidance, and fair fare calculator</p>
        </div>
      </div>

      <div className="transport-layout">
        {/* Left Column: Form & Route details */}
        <div className="transport-form-col">
          <Card>
            <form onSubmit={handleFindRoute}>
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ margin: 0 }}>Origin</label>
                  {fromLocation !== 'My Current Location' && (
                    <button
                      type="button"
                      onClick={() => {
                        setFromLocation('My Current Location');
                        setFromLocationCoords(null);
                      }}
                      style={{ background: 'none', border: 'none', color: 'var(--purple)', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Use Live GPS
                    </button>
                  )}
                </div>
                <LocationAutocomplete
                  value={fromLocation}
                  onChange={(val) => {
                    setFromLocation(val);
                    if (fromLocationCoords && fromLocationCoords.name !== val) {
                      setFromLocationCoords(null);
                    }
                  }}
                  onSelect={(sug) => {
                    setFromLocation(sug.name);
                    setFromLocationCoords({
                      latitude: sug.latitude,
                      longitude: sug.longitude,
                      name: sug.name,
                      address: sug.address || sug.label
                    });
                  }}
                  placeholder="Enter pickup location or 'My Current Location'"
                />
                {fromLocation === 'My Current Location' && currentLocation.latitude != null ? (
                  <span style={{ fontSize: '11.5px', color: 'var(--success, #16a34a)', marginTop: '4px', display: 'block' }}>
                    ✓ Live GPS connected ({currentLocation.latitude.toFixed(4)}, {currentLocation.longitude.toFixed(4)})
                  </span>
                ) : fromLocationCoords?.address ? (
                  <span style={{ fontSize: '11.5px', color: 'var(--purple)', marginTop: '4px', display: 'block' }}>
                    📍 {fromLocationCoords.address}
                  </span>
                ) : (
                  <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Search an origin or use live device location
                  </span>
                )}
              </div>

              <div className="form-group">
                <label>Destination</label>
                <LocationAutocomplete
                  value={toLocation}
                  onChange={(val) => {
                    setToLocation(val);
                    if (toLocationCoords && toLocationCoords.name !== val) {
                      setToLocationCoords(null);
                    }
                  }}
                  onSelect={(sug) => {
                    setToLocation(sug.name);
                    setToLocationCoords({
                      latitude: sug.latitude,
                      longitude: sug.longitude,
                      name: sug.name,
                      address: sug.address || sug.label
                    });
                  }}
                  placeholder="e.g. Marudamalai Temple, Railway Station"
                />
                {toLocationCoords?.address && (
                  <span style={{ fontSize: '11.5px', color: 'var(--purple)', marginTop: '4px', display: 'block' }}>
                    📍 {toLocationCoords.address}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label>Mode of Transport</label>
                <div className="mode-selector">
                  {MODES.map((m) => (
                    <button
                      type="button"
                      key={m.id}
                      className={`mode-btn ${mode === m.id ? 'active' : ''}`}
                      onClick={() => handleModeChange(m.id)}
                    >
                      <Icon name={m.icon} size={18} />
                      <span>{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {busUnavailableMsg && (
                <div style={{ padding: '10px 14px', background: 'var(--amber-soft)', color: '#b45309', borderRadius: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <Icon name="alert-circle" size={16} />
                  <span>{busUnavailableMsg}</span>
                </div>
              )}

              {error && (
                <div style={{ padding: '10px 14px', background: 'var(--red-soft)', color: 'var(--red)', borderRadius: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <Icon name="alert-circle" size={16} />
                  <span>{error}</span>
                </div>
              )}

              <Button type="submit" variant="primary" icon="navigation" disabled={loading} style={{ width: '100%' }}>
                {loading ? 'Calculating Real Route…' : 'Find Best Route'}
              </Button>
            </form>
          </Card>

          {route && (
            <Card style={{ marginTop: '20px' }}>
              <div className="route-stats">
                <div className="stat-box">
                  <Icon name="map-pin" size={20} />
                  <div>
                    <span className="stat-label">Road Distance</span>
                    <strong>{formatDistance(route.distanceKm)}</strong>
                  </div>
                </div>
                <div className="stat-box">
                  <Icon name="clock" size={20} />
                  <div>
                    <span className="stat-label">Estimated Time</span>
                    <strong>{formatDuration(route.durationMinutes)}</strong>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '16px' }}>
                <Button
                  variant="primary"
                  icon="navigation"
                  style={{ width: '100%' }}
                  onClick={() => setIsNavigatingModalOpen(true)}
                >
                  Start Live Satellite Navigation
                </Button>
              </div>

              <h3 style={{ marginTop: '20px', fontSize: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                Turn-by-Turn Directions
              </h3>
              <div className="directions-list" style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {Array.isArray(route.steps) && route.steps.length > 0 ? (
                  route.steps.map((step, idx) => (
                    <div key={idx} className="step-item" style={{ display: 'flex', gap: '10px', fontSize: '13px' }}>
                      <span
                        className="step-num"
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          background: 'var(--purple-50)',
                          color: 'var(--purple)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 600,
                          flexShrink: 0,
                          fontSize: '12px'
                        }}
                      >
                        {idx + 1}
                      </span>
                      <div>
                        <div>{typeof step === 'string' ? step : step.instruction}</div>
                        {step.distanceMeters ? (
                          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                            {step.distanceMeters > 1000 ? `${(step.distanceMeters / 1000).toFixed(1)} km` : `${step.distanceMeters} m`}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Follow the highlighted route on the satellite map.</p>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Map Column: Displays only when route is found or user interacts */}
        <div className="transport-map-col">
          {route ? (
            <Card padded={false} style={{ overflow: 'hidden', height: '100%', minHeight: '480px' }}>
              <RealMap
                currentLocation={currentLocation}
                selectedLocation={
                  route?.destination
                    ? { latitude: route.destination.lat, longitude: route.destination.lon, name: route.destination.label || toLocation }
                    : null
                }
                route={route}
                layer="satellite"
                height="100%"
                isLoading={loading}
                loadingLabel="Calculating real road network route…"
                isOffRoute={isOffRoute}
                onRecalculateRoute={handleFindRoute}
              />
            </Card>
          ) : (
            <Card
              style={{
                height: '100%',
                minHeight: '380px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                background: '#fafbfc'
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'var(--purple-50)',
                  color: 'var(--purple)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px'
                }}
              >
                <Icon name="map" size={28} />
              </div>
              <h3 style={{ fontSize: '17px', fontWeight: 650, marginBottom: '6px' }}>Ready to Navigate</h3>
              <p style={{ maxWidth: '340px', fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Enter your destination on the left and click <strong>Find Best Route</strong> to generate live road directions and satellite map.
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Full In-App Satellite Navigation Modal */}
      {route?.destination && (
        <NavigationModal
          isOpen={isNavigatingModalOpen}
          onClose={() => setIsNavigatingModalOpen(false)}
          destination={{
            latitude: route.destination.lat,
            longitude: route.destination.lon,
            name: route.destination.label || toLocation
          }}
          initialMode={mode}
        />
      )}
    </div>
  );
}
