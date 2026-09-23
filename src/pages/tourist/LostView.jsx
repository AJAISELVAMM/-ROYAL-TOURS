import React, { useState, useEffect, useRef, useMemo } from 'react';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Icon from '../../components/common/Icon.jsx';
import RealMap from '../../components/maps/RealMap.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useLocation } from '../../context/LocationContext.jsx';
import * as safetyService from '../../services/safetyService.js';
import * as transportService from '../../services/transportService.js';
import { checkOffRoute, formatDistance, formatDuration, distanceMeters, haversineDistanceKm } from '../../utils/geoUtils.js';

export default function LostView() {
  const { push } = useToast();
  const { currentLocation, setSelectedLocation, permissionStatus } = useLocation();

  const [safePoints, setSafePoints] = useState([]);
  const [selectedSafePoint, setSelectedSafePoint] = useState(null);
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isOffRoute, setIsOffRoute] = useState(false);
  const lastSafePointsFetchRef = useRef({ lat: null, lon: null, time: 0 });

  const userLat = currentLocation?.latitude;
  const userLon = currentLocation?.longitude;

  // Fetch nearest safe emergency points based on current live GPS
  useEffect(() => {
    const lat = currentLocation?.latitude;
    const lon = currentLocation?.longitude;

    if (lat == null || lon == null) {
      return;
    }

    const now = Date.now();
    const last = lastSafePointsFetchRef.current;

    let shouldFetch = false;
    if (last.lat == null || last.lon == null) {
      shouldFetch = true;
    } else {
      const moved = distanceMeters(last.lat, last.lon, lat, lon);
      const elapsed = now - last.time;
      if (moved != null && (moved > 200 || (elapsed > 45000 && moved > 30))) {
        shouldFetch = true;
      }
    }

    if (!shouldFetch) return;
    lastSafePointsFetchRef.current = { lat, lon, time: now };
    setLoading(true);

    safetyService
      .getNearestEmergency(lat, lon, 'all')
      .then((data) => {
        let list = Array.isArray(data)
          ? data
          : (data?.facilities || data?.items || (data?.facility ? [data.facility] : []));
        if (!list || list.length === 0) {
          return safetyService.getSafetyMap(lat, lon).then((sData) => {
            if (sData?.facilities?.length) setSafePoints(sData.facilities);
          });
        } else {
          setSafePoints(list);
        }
      })
      .catch(() => {
        return safetyService.getSafetyMap(lat, lon).then((sData) => {
          if (sData?.facilities?.length) setSafePoints(sData.facilities);
        }).catch(() => {});
      })
      .finally(() => {
        setLoading(false);
      });
  }, [currentLocation?.latitude, currentLocation?.longitude, permissionStatus]);

  const requestLockRef = useRef(false);
  const abortCtrlRef = useRef(null);

  useEffect(() => {
    return () => {
      if (abortCtrlRef.current) abortCtrlRef.current.abort();
    };
  }, []);

  async function guideToSafePoint(point, isRecalc = false) {
    if (currentLocation?.latitude == null || currentLocation?.longitude == null) {
      push('Live GPS location is required to calculate exit route.', 'error', { id: 'gps-needed' });
      return;
    }

    if (point?.latitude == null || point?.longitude == null) {
      push('Coordinates are not available for this safe zone.', 'error', { id: 'coords-needed' });
      return;
    }

    if (requestLockRef.current) return;
    requestLockRef.current = true;

    if (abortCtrlRef.current) abortCtrlRef.current.abort();
    const abortCtrl = new AbortController();
    abortCtrlRef.current = abortCtrl;

    setSelectedSafePoint(point);
    setLoading(true);
    setIsOffRoute(false);

    try {
      const calculatedRoute = await transportService.getRoute({
        from: `${currentLocation.latitude},${currentLocation.longitude}`,
        to: `${point.latitude},${point.longitude}`,
        mode: 'walking',
        signal: abortCtrl.signal
      });
      setRoute(calculatedRoute);
      if (isRecalc) {
        push('Route updated', 'success', { id: 'lost-guide', duration: 2500 });
      } else {
        push(`Guidance active to ${point.name}`, 'success', { id: 'lost-guide', duration: 3000 });
      }
    } catch (err) {
      if (err.name === 'AbortError' || abortCtrl.signal.aborted) return;
      push(err?.message || 'Could not calculate safe route.', 'error', { id: 'lost-guide' });
    } finally {
      requestLockRef.current = false;
      setLoading(false);
    }
  }

  const lastRecalcTimeRef = useRef(0);

  // Off-route detection with cooldown
  useEffect(() => {
    if (selectedSafePoint && route && currentLocation?.latitude && currentLocation?.longitude && !requestLockRef.current) {
      const now = Date.now();
      if (now - lastRecalcTimeRef.current < 6000) return; // 6 second cooldown
      const coords = route.geometry?.coordinates || [];
      if (coords.length > 0) {
        const off = checkOffRoute(currentLocation.latitude, currentLocation.longitude, coords, 60, true);
        if (off.isOffRoute) {
          lastRecalcTimeRef.current = now;
          guideToSafePoint(selectedSafePoint, true);
        }
      }
    }
  }, [currentLocation?.latitude, currentLocation?.longitude, selectedSafePoint, route]);

  const normalizedSafePoints = useMemo(() => {
    return (safePoints || [])
      .filter((p) => p && p.latitude != null && p.longitude != null && !isNaN(p.latitude) && !isNaN(p.longitude))
      .map((p, idx) => {
        const dKm =
          userLat != null && userLon != null
            ? haversineDistanceKm(userLat, userLon, p.latitude, p.longitude)
            : p.distanceKm != null
            ? Number(p.distanceKm)
            : null;
        const dMeters = dKm != null ? Math.round(dKm * 1000) : null;
        const typeStr = (p.type || p.category || '').toUpperCase();
        const normType = typeStr.includes('POLICE') ? 'POLICE' : 'HOSPITAL';

        return {
          id: p.id || `safe-${idx}`,
          name: p.name || 'Safe Zone',
          category: p.type || p.category || 'Safe Point',
          address: p.address || '',
          phone: p.phone || '',
          latitude: Number(p.latitude),
          longitude: Number(p.longitude),
          distanceKm: dKm,
          distanceMeters: dMeters,
          type: normType,
          color: normType === 'POLICE' ? '#2563eb' : '#dc2626'
        };
      })
      .sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity));
  }, [safePoints, userLat, userLon]);

  const mapMarkers = useMemo(() => {
    return normalizedSafePoints;
  }, [normalizedSafePoints]);

  return (
    <div className="lost-view">
      <div className="lost-grid">
        <div className="lost-map-col">
          <Card padded={false} style={{ overflow: 'hidden', height: '100%', minHeight: '440px' }}>
            <RealMap
              currentLocation={currentLocation}
              selectedLocation={selectedSafePoint ? { latitude: selectedSafePoint.latitude, longitude: selectedSafePoint.longitude, name: selectedSafePoint.name } : null}
              markers={mapMarkers}
              route={route}
              layer="satellite"
              height="100%"
              isLoading={false}
              isOffRoute={isOffRoute}
              onRecalculateRoute={() => selectedSafePoint && guideToSafePoint(selectedSafePoint)}
            />
          </Card>
        </div>

        <div className="lost-options-col">
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ background: '#fee2e2', color: '#dc2626', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="compass" size={20} />
              </span>
              <div>
                <h2>I'm Lost — Guide Me Out</h2>
                <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                  {currentLocation?.latitude != null
                    ? `GPS Locked: ${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}`
                    : 'Acquiring GPS location…'}
                </span>
              </div>
            </div>

            {permissionStatus === 'denied' && (
              <div style={{ marginTop: '12px', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '10px', color: '#b91c1c', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon name="alert-circle" size={16} />
                <span>Location permission is required to show your live location.</span>
              </div>
            )}

            <p className="section-sub" style={{ marginTop: '12px' }}>
              Select a nearby verified safe point. The system will guide you along well-lit roads with continuous live GPS tracking.
            </p>

            <div className="safe-points-list" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {safePoints.length > 0 ? (
                safePoints.slice(0, 5).map((point, idx) => (
                  <div
                    key={point.id || idx}
                    className={`guide-destination ${selectedSafePoint?.id === point.id ? 'active-dest' : ''}`}
                    style={{
                      cursor: 'pointer',
                      border: selectedSafePoint?.id === point.id ? '2px solid var(--purple)' : '1px solid var(--border)',
                      borderRadius: '12px',
                      padding: '12px'
                    }}
                    onClick={() => guideToSafePoint(point)}
                  >
                    <Icon
                      name={(point.type || point.category || '').toUpperCase().includes('POLICE') ? 'shield' : 'plus-circle'}
                      size={20}
                      style={{ color: (point.type || point.category || '').toUpperCase().includes('POLICE') ? 'var(--blue)' : 'var(--red)', marginTop: '2px' }}
                    />
                    <div style={{ flex: 1 }}>
                      <strong>{point.name}</strong>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {point.distanceKm != null ? `${formatDistance(point.distanceKm)} away` : 'Nearby'} • {point.address || 'Emergency Safe Point'}
                      </span>
                    </div>
                    <Button size="sm" variant={selectedSafePoint?.id === point.id ? 'primary' : 'outline'}>
                      Guide
                    </Button>
                  </div>
                ))
              ) : loading ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  Loading nearby safe zones…
                </div>
              ) : permissionStatus === 'denied' ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  Please enable device location permission to discover nearby safe zones.
                </div>
              ) : (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No safe zones found in immediate area. Dial 100 (Police) or 108 (Ambulance) for instant assistance.
                </div>
              )}
            </div>

            {route && (
              <div style={{ marginTop: '18px', padding: '14px', background: 'var(--purple-50)', borderRadius: '12px' }}>
                <strong style={{ fontSize: '14px', color: 'var(--purple-deep)' }}>Safe Walking Guidance Active</strong>
                <div style={{ display: 'flex', gap: '14px', marginTop: '6px', fontSize: '13px', color: 'var(--text)' }}>
                  <span>📍 {formatDistance(route.distanceKm)}</span>
                  <span>⏱️ ~{formatDuration(route.durationMinutes)}</span>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
