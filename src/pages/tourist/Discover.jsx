import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, Navigate, useLocation as useRouterLocation } from 'react-router-dom';
import Icon from '../../components/common/Icon.jsx';
import LocationAutocomplete from '../../components/common/LocationAutocomplete.jsx';
import { useLocation } from '../../context/LocationContext.jsx';

const TABS = [
  { to: '/discover/places', label: 'Places', icon: 'map-pin' },
  { to: '/discover/hotels', label: 'Hotels', icon: 'bed' },
  { to: '/discover/restaurants', label: 'Restaurants', icon: 'utensils' },
  { to: '/discover/theatres', label: 'Theatres', icon: 'film' },
  { to: '/discover/shopping', label: 'Shopping', icon: 'bag' }
];

export default function Discover() {
  const routerLocation = useRouterLocation();
  const { currentLocation, discoverLocation, setDiscoverLocation } = useLocation();
  const [searchInput, setSearchInput] = useState(discoverLocation?.name || '');

  // Sync search bar text when discoverLocation changes externally (e.g. GPS reset)
  useEffect(() => {
    if (discoverLocation?.name) {
      setSearchInput(discoverLocation.name);
    } else if (!discoverLocation) {
      setSearchInput('');
    }
  }, [discoverLocation]);

  if (routerLocation.pathname === '/discover') {
    return <Navigate to="/discover/places" replace />;
  }

  function handleSelect(sug) {
    setSearchInput(sug.name);
    setDiscoverLocation({
      name: sug.name,
      address: sug.address || sug.label,
      latitude: sug.latitude,
      longitude: sug.longitude
    });
  }

  function handleResetToGPS() {
    setSearchInput('');
    setDiscoverLocation(null);
  }

  return (
    <div className="page-inner">
      <div className="page-header" style={{ marginBottom: '16px' }}>
        <div>
          <h1 className="page-title">Discover</h1>
          <p className="page-sub">Explore verified places, hotels, restaurants, theatres and shopping around your chosen location.</p>
        </div>
      </div>

      {/* Location Selector Bar */}
      <div className="discover-location-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>
          <Icon name="map-pin" size={17} style={{ color: 'var(--purple)' }} />
          <span>Location:</span>
        </div>
        <div className="location-autocomplete-wrap" style={{ flex: 1 }}>
          <LocationAutocomplete
            value={searchInput}
            onChange={(val) => {
              setSearchInput(val);
              if (!val) setDiscoverLocation(null);
            }}
            onSelect={handleSelect}
            placeholder="Search city or area (e.g. Coimbatore, Ooty, Chennai) or default to Live GPS"
          />
        </div>
        {discoverLocation ? (
          <button
            type="button"
            className="filter-chip"
            onClick={handleResetToGPS}
            style={{ color: 'var(--purple)', borderColor: 'var(--purple)', background: 'var(--purple-50)', fontWeight: 600 }}
            title="Reset to live GPS location"
          >
            <Icon name="crosshair" size={14} />
            <span>Use Live GPS</span>
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--success, #16a34a)', fontWeight: 600, padding: '6px 12px', background: 'rgba(22,163,74,0.08)', borderRadius: '999px', whiteSpace: 'nowrap' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--success, #16a34a)' }}></span>
            <span>Live Device GPS Active</span>
          </div>
        )}
      </div>

      <div className="sub-tabs">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} className={({ isActive }) => `sub-tab ${isActive ? 'active' : ''}`}>
            <Icon name={t.icon} size={17} />
            {t.label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  );
}
