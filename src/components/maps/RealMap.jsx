import React, { useEffect, useRef, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Icon from '../common/Icon.jsx';
import { TILE_LAYERS, getTileLayerConfig } from './satelliteMapProvider.js';
import MapLoadingOverlay from './MapLoadingOverlay.jsx';

// Fix default Leaflet icon paths in Vite / bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

// Custom SVG-based DivIcons for distinct POI categories
function createCustomIcon(category, color = '#7c3aed', size = 32) {
  let svgIcon = '';
  switch ((category || '').toUpperCase()) {
    case 'YOU':
      return L.divIcon({
        className: 'custom-leaflet-pin you-pin',
        html: `
          <div class="pin-pulse-wrap">
            <div class="pin-pulse"></div>
            <div class="pin-core" style="background: ${color};">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
              </svg>
            </div>
          </div>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2]
      });

    case 'DESTINATION':
      svgIcon = '<circle cx="12" cy="12" r="8" fill="#ffffff"></circle><circle cx="12" cy="12" r="4" fill="#ef4444"></circle>';
      color = '#ef4444';
      break;

    case 'HOSPITAL':
      svgIcon = '<path d="M12 6v12M6 12h12" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>';
      color = '#dc2626';
      break;

    case 'POLICE':
      svgIcon = '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="#ffffff" fill-opacity="0.9"/>';
      color = '#2563eb';
      break;

    case 'PHARMACY':
      svgIcon = '<path d="M12 7v10M7 12h10" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>';
      color = '#10b981';
      break;

    case 'HOTEL':
      svgIcon = '<path d="M3 7h18M3 12h18M3 17h18" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"/>';
      color = '#f59e0b';
      break;

    case 'RESTAURANT':
      svgIcon = '<path d="M18 8v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8" stroke="#ffffff" stroke-width="2"/>';
      color = '#ea580c';
      break;

    case 'SHOPPING':
      svgIcon = '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" stroke="#ffffff" stroke-width="2" fill="none"/>';
      color = '#6366f1';
      break;

    case 'SOS':
      svgIcon = '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" fill="#ffffff"/>';
      color = '#dc2626';
      break;

    default: // Places / Attractions
      svgIcon = '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="#ffffff" fill-opacity="0.85"/>';
      color = color || '#7c3aed';
  }

  return L.divIcon({
    className: 'custom-leaflet-pin',
    html: `
      <div class="custom-pin-marker" style="background: ${color}; border-color: #ffffff;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          ${svgIcon}
        </svg>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28]
  });
}

// Controller component to auto-pan and fit bounds (only on initial load or route change)
function MapViewController({ center, zoom, bounds, autoFit = false, locateTrigger = 0, onUserInteraction }) {
  const map = useMap();
  const hasInitialFitRef = useRef(false);
  const userInteractedRef = useRef(false);
  const lastBoundsKeyRef = useRef('');

  // Listen for user manual drag/zoom on the map to prevent fighting the user
  useEffect(() => {
    if (!map) return;
    const handleInteraction = () => {
      userInteractedRef.current = true;
      if (onUserInteraction) onUserInteraction();
    };

    map.on('dragstart', handleInteraction);
    map.on('zoomstart', handleInteraction);
    map.on('touchstart', handleInteraction);

    return () => {
      map.off('dragstart', handleInteraction);
      map.off('zoomstart', handleInteraction);
      map.off('touchstart', handleInteraction);
    };
  }, [map, onUserInteraction]);

  // Initial fit or route change fit
  useEffect(() => {
    if (!map) return;

    const boundsKey = bounds && bounds.length >= 2
      ? bounds.map(([lat, lon]) => `${Number(lat).toFixed(3)},${Number(lon).toFixed(3)}`).join('|')
      : '';

    const isFirstTime = !hasInitialFitRef.current;
    const isNewRouteOrBounds = boundsKey && boundsKey !== lastBoundsKeyRef.current && !isFirstTime;

    if (isFirstTime) {
      if (bounds && bounds.length >= 2 && autoFit) {
        try {
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
          hasInitialFitRef.current = true;
          lastBoundsKeyRef.current = boundsKey;
        } catch {
          // fallback
        }
      } else if (center && center[0] != null && center[1] != null) {
        map.setView(center, zoom || 14);
        hasInitialFitRef.current = true;
      }
    } else if (isNewRouteOrBounds && !userInteractedRef.current && autoFit) {
      try {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
        lastBoundsKeyRef.current = boundsKey;
      } catch {
        // fallback
      }
    }
  }, [map, center, zoom, bounds, autoFit]);

  // Smoothly center on user when locateTrigger is fired
  useEffect(() => {
    if (locateTrigger > 0 && center && center[0] != null && center[1] != null && map) {
      userInteractedRef.current = false;
      map.flyTo(center, Math.max(map.getZoom(), 15), { duration: 0.6 });
    }
  }, [locateTrigger, center, map]);

  // Handle map invalidation / recalculating size on responsive resize & drawer change
  useEffect(() => {
    if (!map) return;

    // Invalidate immediately and after transitions (modal/drawer opening/closing, initial render)
    const t0 = setTimeout(() => map.invalidateSize(), 50);
    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const t2 = setTimeout(() => map.invalidateSize(), 350);
    const t3 = setTimeout(() => map.invalidateSize(), 650);

    const onResize = () => {
      map.invalidateSize();
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);

    let ro = null;
    try {
      const container = map.getContainer();
      if (container && typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(() => {
          map.invalidateSize();
        });
        ro.observe(container);
      }
    } catch {}

    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      if (ro) ro.disconnect();
    };
  }, [map]);

  return null;
}

export default function RealMap({
  currentLocation = null, // { latitude, longitude, accuracy, timestamp }
  userLocation = null, // Alias for currentLocation
  center = null, // Optional explicit center [lat, lon]
  selectedLocation = null, // { latitude, longitude, name, address }
  markers = [], // Array of { id, latitude, longitude, name, category, address, type }
  route = null, // { geometry: { coordinates: [[lon, lat]...] } } or Array of [lat, lon]
  height = '360px',
  zoom = 14,
  autoFit = true,
  showAccuracyCircle = true,
  interactive = true,
  isLoading = false,
  loadingLabel = null,
  loadingTitle = null,
  loadingSubtitle = null,
  loadingBottomText = 'Please wait a moment...',
  isOffRoute = false,
  onRecalculateRoute = null,
  layer = null, // 'satellite' | 'streets'
  showLayerSwitcher = true,
  className = ''
}) {
  const activeLocation = currentLocation || userLocation;
  const [userInteracted, setUserInteracted] = useState(false);
  const [locateTrigger, setLocateTrigger] = useState(0);
  const [selectedLayer, setSelectedLayer] = useState(layer || (route ? 'satellite' : 'streets'));

  useEffect(() => {
    if (layer) setSelectedLayer(layer);
  }, [layer]);

  const tileConfig = getTileLayerConfig(selectedLayer);

  // Convert GeoJSON route coordinates [lon, lat] -> Leaflet [lat, lon]
  const polylineCoords = useMemo(() => {
    if (!route) return null;
    let coords = [];
    if (Array.isArray(route)) {
      coords = route;
    } else if (route.geometry?.coordinates) {
      coords = route.geometry.coordinates;
    } else if (route.coordinates) {
      coords = route.coordinates;
    }

    if (!Array.isArray(coords) || coords.length === 0) return null;

    // Detect if coords are [lon, lat] (GeoJSON) or [lat, lon]
    return coords.map((pt) => {
      if (Array.isArray(pt)) {
        // In India, lat is 8-37, lon is 68-98. If pt[0] > 50 and pt[1] < 40, pt is [lon, lat].
        if (pt[0] > pt[1] && pt[0] > 45) {
          return [pt[1], pt[0]];
        }
        return [pt[0], pt[1]];
      }
      if (pt.latitude != null && pt.longitude != null) {
        return [pt.latitude, pt.longitude];
      }
      if (pt.lat != null && pt.lon != null) {
        return [pt.lat, pt.lon];
      }
      return pt;
    });
  }, [route]);

  // Compute map center stably without re-centering on every tick
  const centerCoord = useMemo(() => {
    if (center && Array.isArray(center) && center[0] != null && center[1] != null) {
      return center;
    }
    if (activeLocation?.latitude != null && activeLocation?.longitude != null) {
      return [activeLocation.latitude, activeLocation.longitude];
    }
    if (selectedLocation?.latitude != null && selectedLocation?.longitude != null) {
      return [selectedLocation.latitude, selectedLocation.longitude];
    }
    if (markers.length > 0 && markers[0].latitude != null) {
      return [markers[0].latitude, markers[0].longitude];
    }
    // Default center if no coordinates available yet (will auto-adjust once GPS locks)
    return [11.0168, 76.9558];
  }, [
    center ? `${center[0]},${center[1]}` : null,
    activeLocation?.latitude != null ? activeLocation.latitude.toFixed(4) : null,
    activeLocation?.longitude != null ? activeLocation.longitude.toFixed(4) : null,
    selectedLocation?.latitude != null ? selectedLocation.latitude.toFixed(4) : null,
    selectedLocation?.longitude != null ? selectedLocation.longitude.toFixed(4) : null,
    markers.length > 0 ? `${markers[0].latitude?.toFixed(4)},${markers[0].longitude?.toFixed(4)}` : null
  ]);

  const markerCoordsKey = useMemo(() => {
    return markers.map((m) => `${m.id || ''}:${Number(m.latitude || 0).toFixed(3)},${Number(m.longitude || 0).toFixed(3)}`).join('|');
  }, [markers]);

  // Compute all points for auto-fit bounds stably
  const mapBounds = useMemo(() => {
    const points = [];
    if (activeLocation?.latitude != null && activeLocation?.longitude != null) {
      points.push([activeLocation.latitude, activeLocation.longitude]);
    }
    if (selectedLocation?.latitude != null && selectedLocation?.longitude != null) {
      points.push([selectedLocation.latitude, selectedLocation.longitude]);
    }
    markers.forEach((m) => {
      if (m.latitude != null && m.longitude != null) {
        points.push([m.latitude, m.longitude]);
      }
    });
    if (polylineCoords && polylineCoords.length > 0) {
      points.push(...polylineCoords);
    }
    return points.length >= 2 ? points : null;
  }, [
    activeLocation?.latitude != null ? activeLocation.latitude.toFixed(3) : null,
    activeLocation?.longitude != null ? activeLocation.longitude.toFixed(3) : null,
    selectedLocation?.latitude != null ? selectedLocation.latitude.toFixed(3) : null,
    selectedLocation?.longitude != null ? selectedLocation.longitude.toFixed(3) : null,
    markerCoordsKey,
    polylineCoords
  ]);

  const hasGps = Boolean(activeLocation?.latitude != null && activeLocation?.longitude != null);

  const youIcon = useMemo(() => createCustomIcon('YOU', '#7c3aed', 34), []);
  const destIcon = useMemo(() => createCustomIcon('DESTINATION', '#ef4444', 30), []);

  return (
    <div className={`real-map-container ${className}`} style={{ position: 'relative', height, width: '100%', borderRadius: '14px', overflow: 'hidden' }}>
      {showLayerSwitcher && (
        <div
          className="map-layer-toggle"
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            zIndex: 1000,
            display: 'flex',
            gap: '4px',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(6px)',
            padding: '3px',
            borderRadius: '9px',
            boxShadow: '0 3px 10px rgba(0,0,0,0.15)',
            border: '1px solid rgba(0,0,0,0.08)'
          }}
        >
          <button
            type="button"
            onClick={() => setSelectedLayer('satellite')}
            style={{
              padding: '4px 9px',
              fontSize: '11.5px',
              fontWeight: 650,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: selectedLayer === 'satellite' ? 'var(--purple)' : 'transparent',
              color: selectedLayer === 'satellite' ? '#ffffff' : 'var(--text)',
              transition: 'all 0.15s ease'
            }}
          >
            <span>🛰️</span> Satellite
          </button>
          <button
            type="button"
            onClick={() => setSelectedLayer('streets')}
            style={{
              padding: '4px 9px',
              fontSize: '11.5px',
              fontWeight: 650,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: selectedLayer === 'streets' ? 'var(--purple)' : 'transparent',
              color: selectedLayer === 'streets' ? '#ffffff' : 'var(--text)',
              transition: 'all 0.15s ease'
            }}
          >
            <span>🗺️</span> Street
          </button>
        </div>
      )}

      <MapContainer
        center={centerCoord}
        zoom={zoom}
        scrollWheelZoom={interactive}
        dragging={interactive}
        zoomControl={interactive}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          key={tileConfig.id}
          attribution={tileConfig.attribution}
          url={tileConfig.url}
          maxZoom={tileConfig.maxZoom}
        />

        <MapViewController
          center={centerCoord}
          zoom={zoom}
          bounds={mapBounds}
          autoFit={autoFit && !userInteracted}
          locateTrigger={locateTrigger}
          onUserInteraction={() => setUserInteracted(true)}
        />

        {/* Live Tourist Marker + Accuracy Circle */}
        {hasGps && (
          <>
            {showAccuracyCircle && activeLocation.accuracy && (
              <Circle
                center={[activeLocation.latitude, activeLocation.longitude]}
                radius={Math.min(Math.max(activeLocation.accuracy, 10), 500)}
                pathOptions={{
                  color: '#7c3aed',
                  fillColor: '#7c3aed',
                  fillOpacity: 0.12,
                  weight: 1.5
                }}
              />
            )}
            <Marker
              position={[activeLocation.latitude, activeLocation.longitude]}
              icon={youIcon}
              zIndexOffset={1000}
            >
              <Popup className="real-map-popup">
                <div className="map-popup-inner">
                  <strong><Icon name="navigation" size={13} /> You Are Here</strong>
                  <span className="popup-coords">
                    {activeLocation.latitude.toFixed(5)}, {activeLocation.longitude.toFixed(5)}
                  </span>
                  {activeLocation.accuracy != null && (
                    <span className="popup-accuracy">GPS accuracy: ±{activeLocation.accuracy} m</span>
                  )}
                  {activeLocation.timestamp && (
                    <span className="popup-time">
                      Updated: {new Date(activeLocation.timestamp).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </Popup>
            </Marker>
          </>
        )}

        {/* Selected Destination Marker */}
        {selectedLocation?.latitude != null && selectedLocation?.longitude != null && (
          <Marker
            position={[selectedLocation.latitude, selectedLocation.longitude]}
            icon={destIcon}
            zIndexOffset={900}
          >
            <Popup className="real-map-popup">
              <div className="map-popup-inner">
                <strong><Icon name="map-pin" size={13} /> {selectedLocation.name || 'Destination'}</strong>
                {selectedLocation.address && <span>{selectedLocation.address}</span>}
                <span className="popup-coords">
                  {selectedLocation.latitude.toFixed(5)}, {selectedLocation.longitude.toFixed(5)}
                </span>
              </div>
            </Popup>
          </Marker>
        )}

        {/* POI / Facility Markers */}
        {markers.map((m, idx) => {
          if (m.latitude == null || m.longitude == null) return null;
          const markerIcon = createCustomIcon(m.type || m.category, m.color);
          return (
            <Marker
              key={m.id || `marker-${idx}`}
              position={[m.latitude, m.longitude]}
              icon={markerIcon}
            >
              <Popup className="real-map-popup">
                <div className="map-popup-inner">
                  <strong>{m.name || m.title || 'Location'}</strong>
                  {m.category && <span className="popup-badge">{m.category}</span>}
                  {m.address && <span>{m.address}</span>}
                  {m.phone && <span>📞 {m.phone}</span>}
                  {m.distanceKm != null && <span>📍 {m.distanceKm} km away</span>}
                  <span className="popup-coords">{m.latitude.toFixed(4)}, {m.longitude.toFixed(4)}</span>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Real Road Route Polyline */}
        {polylineCoords && polylineCoords.length > 0 && (
          <>
            {/* Subtle glow border */}
            <Polyline
              positions={polylineCoords}
              pathOptions={{
                color: '#4c1d95',
                weight: 7,
                opacity: 0.35,
                lineCap: 'round',
                lineJoin: 'round'
              }}
            />
            {/* Active route line */}
            <Polyline
              positions={polylineCoords}
              pathOptions={{
                color: '#7c3aed',
                weight: 4.5,
                opacity: 0.95,
                lineCap: 'round',
                lineJoin: 'round'
              }}
            />
          </>
        )}
      </MapContainer>

      {/* Floating Locate-Me / Center Button */}
      {hasGps && interactive && (
        <button
          type="button"
          className="map-locate-btn"
          title="Center on my location"
          onClick={() => {
            setUserInteracted(false);
            setLocateTrigger((prev) => prev + 1);
          }}
        >
          <Icon name="crosshair" size={17} />
        </button>
      )}

      {/* Centered Map Loading Overlay Matching Reference */}
      {isLoading && (
        <MapLoadingOverlay
          title={loadingTitle || (route ? 'Calculating road route…' : 'Finding nearby safety facilities...')}
          subtitle={loadingLabel || loadingSubtitle || (route ? 'Connecting to live road network…' : 'Searching hospitals, police stations, pharmacies and other emergency services around you.')}
          bottomText={loadingBottomText}
        />
      )}

      {/* Off Route Banner */}
      {isOffRoute && (
        <div className="map-reroute-banner">
          <Icon name="alert-triangle" size={16} />
          <span>Off route detected. Recalculating route…</span>
          {onRecalculateRoute && (
            <button className="btn btn-sm btn-outline" onClick={onRecalculateRoute}>Reroute</button>
          )}
        </div>
      )}

      {/* Poor GPS Accuracy Notice */}
      {hasGps && currentLocation.accuracy != null && currentLocation.accuracy > 75 && (
        <div className="map-accuracy-notice">
          <Icon name="info" size={13} /> GPS accuracy is low (±{Math.round(currentLocation.accuracy)}m)
        </div>
      )}
    </div>
  );
}
