// =============================================================================
// LiveMap.jsx — Reusable Standard Interactive Map Component.
// Built with Leaflet + OpenStreetMap tiles (100% Free, NO Google Maps API key required).
// Supports:
//  - Current live tourist GPS marker + animated pulse ring + accuracy circle
//  - Destination marker with category badge & popup
//  - OSRM / OpenRouteService road polyline route with auto-fit bounds
//  - Recenter on live GPS button
//  - Street / Satellite tile layer toggle
// =============================================================================

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Icon from '../common/Icon.jsx';

// Fix Leaflet default marker icon assets for bundlers (Vite)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

// Map tile layers
const TILE_LAYERS = {
  streets: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 18
  }
};

// Create custom category SVG icons
function createCategoryIcon(type, color = '#7c3aed') {
  const norm = String(type || '').toUpperCase();
  let svg = '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="#ffffff" fill-opacity="0.9"/>';

  if (norm.includes('HOSPITAL') || norm.includes('MEDICAL')) {
    svg = '<path d="M12 6v12M6 12h12" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>';
    color = '#dc2626';
  } else if (norm.includes('POLICE')) {
    svg = '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="#ffffff" fill-opacity="0.9"/>';
    color = '#2563eb';
  } else if (norm.includes('HOTEL')) {
    svg = '<path d="M3 7h18M3 12h18M3 17h18" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>';
    color = '#f59e0b';
  } else if (norm.includes('RESTAURANT') || norm.includes('FOOD')) {
    svg = '<path d="M18 8v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8" stroke="#ffffff" stroke-width="2"/>';
    color = '#ea580c';
  } else if (norm.includes('THEATRE') || norm.includes('CINEMA')) {
    svg = '<rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" stroke="#ffffff" stroke-width="2"/><line x1="7" y1="2" x2="7" y2="22" stroke="#ffffff" stroke-width="1.5"/><line x1="17" y1="2" x2="17" y2="22" stroke="#ffffff" stroke-width="1.5"/><line x1="2" y1="12" x2="22" y2="12" stroke="#ffffff" stroke-width="1.5"/>';
    color = '#ec4899';
  } else if (norm.includes('SHOPPING') || norm.includes('MALL')) {
    svg = '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" stroke="#ffffff" stroke-width="2" fill="none"/>';
    color = '#6366f1';
  } else if (norm.includes('DESTINATION')) {
    svg = '<circle cx="12" cy="12" r="8" fill="#ffffff"></circle><circle cx="12" cy="12" r="4" fill="#ef4444"></circle>';
    color = '#ef4444';
  }

  return L.divIcon({
    className: 'custom-leaflet-pin',
    html: `
      <div class="custom-pin-marker" style="background: ${color}; border: 2px solid #ffffff; box-shadow: 0 3px 8px rgba(0,0,0,0.25); width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          ${svg}
        </svg>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28]
  });
}

// User live location icon
const userIcon = L.divIcon({
  className: 'custom-leaflet-pin you-pin',
  html: `
    <div class="pin-pulse-wrap" style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
      <div class="pin-pulse" style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background: rgba(124, 58, 237, 0.35); animation: pulse 2s infinite;"></div>
      <div class="pin-core" style="width: 16px; height: 16px; border-radius: 50%; background: #7c3aed; border: 2.5px solid #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.3); z-index: 2;"></div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16]
});

// Map Controller for auto-centering and bounds fitting (only on initial load or route change)
function MapBoundsController({ center, bounds, autoFit }) {
  const map = useMap();
  const hasInitialFitRef = useRef(false);
  const lastBoundsKeyRef = useRef('');

  useEffect(() => {
    if (!map) return;

    const boundsKey = bounds ? bounds.toBBoxString() : '';
    const isFirstTime = !hasInitialFitRef.current;
    const isNewRouteOrBounds = boundsKey && boundsKey !== lastBoundsKeyRef.current && !isFirstTime;

    if (isFirstTime) {
      if (bounds && bounds.isValid && bounds.isValid() && autoFit) {
        try {
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16, animate: true });
          hasInitialFitRef.current = true;
          lastBoundsKeyRef.current = boundsKey;
        } catch {
          // fallback
        }
      } else if (center && autoFit) {
        map.setView(center, map.getZoom() || 14, { animate: true });
        hasInitialFitRef.current = true;
      }
    } else if (isNewRouteOrBounds && autoFit) {
      try {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16, animate: true });
        lastBoundsKeyRef.current = boundsKey;
      } catch {
        // fallback
      }
    }
  }, [map, center, bounds, autoFit]);

  // Handle map invalidation / recalculating size on responsive resize & drawer change
  useEffect(() => {
    if (!map) return;

    const t1 = setTimeout(() => map.invalidateSize(), 100);
    const t2 = setTimeout(() => map.invalidateSize(), 350);

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
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      if (ro) ro.disconnect();
    };
  }, [map]);

  return null;
}

export default function LiveMap({
  userLocation,
  destination,
  route,
  markers = [],
  showUserLocation = true,
  showDestination = true,
  height = '400px',
  layer: initialLayer = 'streets',
  autoFit = true,
  className = '',
  style = {}
}) {
  const [activeLayer, setActiveLayer] = useState(initialLayer);
  const mapRef = useRef(null);

  // Normalize user coordinates
  const userCoords = useMemo(() => {
    if (!userLocation) return null;
    const lat = userLocation.latitude ?? userLocation.lat;
    const lon = userLocation.longitude ?? userLocation.lon ?? userLocation.lng;
    return lat != null && lon != null ? [Number(lat), Number(lon)] : null;
  }, [userLocation]);

  // Normalize destination coordinates
  const destCoords = useMemo(() => {
    if (!destination) return null;
    const lat = destination.latitude ?? destination.lat;
    const lon = destination.longitude ?? destination.lon ?? destination.lng;
    return lat != null && lon != null ? [Number(lat), Number(lon)] : null;
  }, [destination]);

  // Parse route polyline coordinates
  const routePolyline = useMemo(() => {
    if (!route) return [];
    if (Array.isArray(route.geometry?.coordinates)) {
      // GeoJSON is [lon, lat] -> Leaflet expects [lat, lon]
      return route.geometry.coordinates.map((c) => [c[1], c[0]]);
    }
    if (Array.isArray(route.polyline)) {
      return route.polyline;
    }
    return [];
  }, [route]);

  // Default center
  const centerCoords = userCoords || destCoords || [11.0168, 76.9558];

  // Calculate bounding box if multiple points exist
  const bounds = useMemo(() => {
    const points = [];
    if (userCoords && showUserLocation) points.push(userCoords);
    if (destCoords && showDestination) points.push(destCoords);
    if (routePolyline.length > 0) {
      points.push(...routePolyline);
    }
    (markers || []).forEach((m) => {
      const lat = m.latitude ?? m.lat;
      const lon = m.longitude ?? m.lon ?? m.lng;
      if (lat != null && lon != null) points.push([Number(lat), Number(lon)]);
    });

    if (points.length >= 2) {
      return L.latLngBounds(points);
    }
    return null;
  }, [userCoords, destCoords, routePolyline, markers, showUserLocation, showDestination]);

  function recenterOnUser() {
    if (mapRef.current && userCoords) {
      mapRef.current.setView(userCoords, 15, { animate: true });
    }
  }

  const currentTileConfig = TILE_LAYERS[activeLayer] || TILE_LAYERS.streets;

  return (
    <div className={`live-map-wrapper ${className}`} style={{ position: 'relative', width: '100%', height, ...style }}>
      <MapContainer
        center={centerCoords}
        zoom={14}
        style={{ width: '100%', height: '100%', borderRadius: 'inherit' }}
        ref={mapRef}
        attributionControl={false}
      >
        <TileLayer url={currentTileConfig.url} attribution={currentTileConfig.attribution} maxZoom={currentTileConfig.maxZoom} />

        <MapBoundsController center={centerCoords} bounds={bounds} autoFit={autoFit} />

        {/* User GPS location marker + Accuracy Circle */}
        {showUserLocation && userCoords && (
          <>
            <Marker position={userCoords} icon={userIcon}>
              <Popup>
                <div style={{ textAlign: 'center', padding: '4px' }}>
                  <strong style={{ color: 'var(--purple)' }}>📍 Your Live GPS Location</strong>
                  <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '3px' }}>
                    Accuracy: ±{Math.round(userLocation?.accuracy || 15)}m
                  </div>
                </div>
              </Popup>
            </Marker>
            {userLocation?.accuracy && userLocation.accuracy < 2000 && (
              <Circle
                center={userCoords}
                radius={userLocation.accuracy}
                pathOptions={{
                  fillColor: '#7c3aed',
                  fillOpacity: 0.1,
                  color: '#7c3aed',
                  weight: 1,
                  dashArray: '3, 6'
                }}
              />
            )}
          </>
        )}

        {/* Destination marker */}
        {showDestination && destCoords && (
          <Marker position={destCoords} icon={createCategoryIcon(destination?.type || destination?.category || 'DESTINATION', '#ef4444')}>
            <Popup>
              <div style={{ padding: '4px' }}>
                <strong>{destination?.name || 'Destination'}</strong>
                {destination?.address && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{destination.address}</div>}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Custom POI markers */}
        {(markers || []).map((m, idx) => {
          const lat = m.latitude ?? m.lat;
          const lon = m.longitude ?? m.lon ?? m.lng;
          if (lat == null || lon == null) return null;
          return (
            <Marker key={m.id || `marker-${idx}`} position={[Number(lat), Number(lon)]} icon={createCategoryIcon(m.type || m.category, m.color)}>
              <Popup>
                <div style={{ padding: '4px' }}>
                  <strong>{m.name}</strong>
                  {m.address && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{m.address}</div>}
                  {m.phone && <div style={{ fontSize: '12px', color: 'var(--purple)', marginTop: '2px' }}>📞 {m.phone}</div>}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* OSRM Route Polyline */}
        {routePolyline.length > 0 && (
          <Polyline
            positions={routePolyline}
            pathOptions={{
              color: '#7c3aed',
              weight: 5,
              opacity: 0.85,
              lineJoin: 'round',
              lineCap: 'round'
            }}
          />
        )}
      </MapContainer>

      {/* Floating Map Controls */}
      <div className="map-floating-controls" style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Layer Switcher */}
        <button
          type="button"
          className="map-ctrl-btn"
          onClick={() => setActiveLayer((l) => (l === 'streets' ? 'satellite' : 'streets'))}
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '7px 11px',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--text)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer'
          }}
        >
          <Icon name={activeLayer === 'streets' ? 'map' : 'layers'} size={14} />
          {activeLayer === 'streets' ? 'Satellite' : 'Streets'}
        </button>

        {/* Recenter on GPS */}
        {userCoords && (
          <button
            type="button"
            className="map-ctrl-btn"
            onClick={recenterOnUser}
            title="Recenter on live GPS location"
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '7px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--purple)',
              cursor: 'pointer'
            }}
          >
            <Icon name="crosshair" size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
