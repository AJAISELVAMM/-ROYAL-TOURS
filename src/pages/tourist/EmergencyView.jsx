// =============================================================================
// EmergencyView.jsx — Real nearby hospitals, police stations & pharmacies.
// Live distance calculation from GPS. Direct in-app satellite road navigation.
// =============================================================================

import React, { useState, useEffect } from 'react';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Icon from '../../components/common/Icon.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import LoadingState from '../../components/common/LoadingState.jsx';
import NavigationModal from '../../components/maps/NavigationModal.jsx';
import RealMap from '../../components/maps/RealMap.jsx';
import { useLocation } from '../../context/LocationContext.jsx';
import * as safetyService from '../../services/safetyService.js';
import { formatDistance, haversineDistanceKm } from '../../utils/geoUtils.js';

const EMERGENCY_TABS = [
  { id: 'all', label: 'All Emergency', icon: 'shield' },
  { id: 'hospital', label: 'Hospitals', icon: 'plus-circle' },
  { id: 'police', label: 'Police Stations', icon: 'shield' },
  { id: 'pharmacy', label: 'Pharmacies', icon: 'crosshair' }
];

export default function EmergencyView() {
  const { currentLocation, loading: locationLoading, error: locationError } = useLocation();

  const [activeTab, setActiveTab] = useState('all');
  const [rawFacilities, setRawFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [navigatingFacility, setNavigatingFacility] = useState(null);

  const userLat = currentLocation?.latitude;
  const userLon = currentLocation?.longitude;

  const facilities = React.useMemo(() => {
    return (rawFacilities || [])
      .filter((f) => f.latitude != null && f.longitude != null && !isNaN(f.latitude) && !isNaN(f.longitude))
      .map((f, i) => {
        const dKm =
          userLat != null && userLon != null
            ? haversineDistanceKm(userLat, userLon, f.latitude, f.longitude)
            : f.distanceKm != null
            ? Number(f.distanceKm)
            : null;
        const dMeters = dKm != null ? Math.round(dKm * 1000) : null;
        const typeStr = (f.type || f.category || '').toLowerCase();
        const normType = typeStr.includes('police')
          ? 'POLICE'
          : typeStr.includes('pharmacy')
          ? 'PHARMACY'
          : typeStr.includes('fire')
          ? 'FIRE_STATION'
          : 'HOSPITAL';

        return {
          id: f.id || `emerg-fac-${i}`,
          name: f.name || 'Emergency Facility',
          category: f.type || f.category || normType,
          type: normType,
          address: f.address,
          phone: f.phone,
          latitude: Number(f.latitude),
          longitude: Number(f.longitude),
          distanceKm: dKm,
          distanceMeters: dMeters,
          color: normType === 'POLICE' ? '#2563eb' : normType === 'PHARMACY' ? '#10b981' : '#dc2626'
        };
      })
      .sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity));
  }, [rawFacilities, userLat, userLon]);

  const mapMarkers = React.useMemo(() => {
    return facilities.map((f) => ({
      ...f,
      category: f.type
    }));
  }, [facilities]);

  useEffect(() => {
    if (currentLocation.latitude == null || currentLocation.longitude == null) {
      if (!locationLoading) {
        setLoading(false);
        setError(locationError || 'Location permission is required to find nearest emergency services.');
      }
      return;
    }

    setLoading(true);
    setError(null);

    safetyService
      .getNearestEmergency(currentLocation.latitude, currentLocation.longitude, activeTab)
      .then((data) => {
        const list = Array.isArray(data) ? data : (data.facilities || data.items || []);
        setRawFacilities(list);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Could not load emergency facilities.');
        setLoading(false);
      });
  }, [currentLocation.latitude, currentLocation.longitude, activeTab, locationLoading, locationError]);

  return (
    <div className="emergency-view">
      {/* Emergency Header Card */}
      <Card style={{ marginBottom: '20px', background: 'linear-gradient(135deg, #fef2f2, #fff)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="siren" size={24} />
          </div>
          <div>
            <h2 style={{ color: '#991b1b', fontSize: '18px', margin: 0 }}>Emergency Assistance & Verified Services</h2>
            <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#7f1d1d' }}>
              Real hospitals, police stations, and 24/7 pharmacies located closest to your live device GPS.
            </p>
          </div>
        </div>
      </Card>

      {/* Real Interactive Leaflet Emergency Map with Unblocked Instant Rendering */}
      <Card padded={false} style={{ overflow: 'hidden', height: '320px', marginBottom: '20px' }}>
        <RealMap
          currentLocation={currentLocation}
          markers={mapMarkers}
          height="100%"
          isLoading={false}
        />
      </Card>

      {/* Emergency Filter Tabs */}
      <div className="sub-tabs" style={{ marginBottom: '20px' }}>
        {EMERGENCY_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`sub-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <Icon name={tab.icon} size={16} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {error ? (
        <EmptyState title="Could not load emergency facilities" message={error} />
      ) : !loading && facilities.length === 0 ? (
        <EmptyState title="No facilities found" message="No emergency facilities found within the current radius." />
      ) : (
        <div className="emergency-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {facilities.map((fac) => (
            <Card key={fac.id} className="emergency-card" hover>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span className="popup-badge" style={{ marginBottom: '6px' }}>
                    {fac.type || fac.category || 'Emergency Service'}
                  </span>
                  <h3 style={{ fontSize: '15px', marginTop: '2px', color: 'var(--text)' }}>{fac.name}</h3>
                </div>
                {fac.phone && (
                  <a
                    href={`tel:${fac.phone}`}
                    className="btn btn-sm btn-outline"
                    style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                  >
                    <Icon name="phone" size={14} /> Call
                  </a>
                )}
              </div>

              <div style={{ marginTop: '10px', fontSize: '13px', color: 'var(--text-muted)' }}>
                {fac.address && <p>📍 {fac.address}</p>}
                {fac.distanceKm != null && (
                  <p style={{ marginTop: '4px', fontWeight: 600, color: 'var(--purple)' }}>
                    📏 {formatDistance(fac.distanceKm)} from current GPS
                  </p>
                )}
              </div>

              <div style={{ marginTop: '14px', display: 'flex', gap: '8px' }}>
                <Button
                  size="sm"
                  variant="primary"
                  icon="navigation"
                  onClick={() => setNavigatingFacility(fac)}
                >
                  Navigate (In-App Satellite)
                </Button>
                {fac.phone && (
                  <Button size="sm" variant="outline" icon="phone" onClick={() => window.open(`tel:${fac.phone}`)}>
                    {fac.phone}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* In-App Satellite Navigation Modal */}
      <NavigationModal
        isOpen={!!navigatingFacility}
        onClose={() => setNavigatingFacility(null)}
        destination={navigatingFacility}
        initialMode="driving-car"
      />
    </div>
  );
}
