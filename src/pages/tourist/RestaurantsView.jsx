import React, { useState, useEffect } from 'react';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Icon from '../../components/common/Icon.jsx';
import LocationAutocomplete from '../../components/common/LocationAutocomplete.jsx';
import ImageWithFallback from '../../components/common/ImageWithFallback.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import LoadingState from '../../components/common/LoadingState.jsx';
import PlaceDetailModal from '../../components/common/PlaceDetailModal.jsx';
import NavigationModal from '../../components/maps/NavigationModal.jsx';
import { useLocation } from '../../context/LocationContext.jsx';
import * as catalogService from '../../services/catalogService.js';
import { formatDistance } from '../../utils/geoUtils.js';

export default function RestaurantsView() {
  const { currentLocation, discoverLocation, setSelectedLocation } = useLocation();

  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [navigatingRestaurant, setNavigatingRestaurant] = useState(null);
  const [detailRestaurant, setDetailRestaurant] = useState(null);

  const effectiveLat = discoverLocation?.latitude ?? currentLocation.latitude;
  const effectiveLon = discoverLocation?.longitude ?? currentLocation.longitude;

  // Stabilize coordinates to ~100m grid to prevent continuous re-fetch loops on micro GPS jitter
  const coordKey = (effectiveLat != null && effectiveLon != null)
    ? `${effectiveLat.toFixed(3)},${effectiveLon.toFixed(3)}`
    : null;

  useEffect(() => {
    let active = true;
    const abortCtrl = new AbortController();

    if (effectiveLat == null || effectiveLon == null) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const handler = setTimeout(() => {
      catalogService
        .list('restaurants', {
          latitude: effectiveLat,
          longitude: effectiveLon,
          search: query.trim() || undefined,
          limit: 50
        }, { signal: abortCtrl.signal })
        .then((items) => {
          if (!active) return;
          setRestaurants(items || []);
        })
        .catch((err) => {
          if (!active || err.name === 'AbortError') return;
          setError(err.message || 'Could not load nearby restaurants.');
        })
        .finally(() => {
          if (active) {
            setLoading(false);
          }
        });
    }, 250);

    return () => {
      active = false;
      clearTimeout(handler);
      abortCtrl.abort();
    };
  }, [coordKey, query]);

  function handleSelectSuggestion(suggestion) {
    if (suggestion.latitude && suggestion.longitude) {
      setSelectedLocation({
        latitude: suggestion.latitude,
        longitude: suggestion.longitude,
        name: suggestion.name,
        address: suggestion.address
      });
    }
  }

  return (
    <div className="catalog-view">
      <div className="catalog-toolbar">
        <LocationAutocomplete
          value={query}
          onChange={setQuery}
          onSelect={handleSelectSuggestion}
          placeholder="Search nearby restaurants, vegetarian, cafes…"
        />
      </div>

      {loading ? (
        <LoadingState label="Finding real restaurants near your location…" />
      ) : error ? (
        <EmptyState title="Could not load restaurants" message={error} />
      ) : restaurants.length === 0 ? (
        <EmptyState title="No restaurants found" message="Try searching for a different cuisine or location." />
      ) : (
        <div className="place-grid">
          {restaurants.map((r) => (
            <Card key={r.id} className="place-card" hover onClick={() => setDetailRestaurant(r)}>
              <div className="place-image" style={{ height: '160px', overflow: 'hidden', position: 'relative' }}>
                <ImageWithFallback
                  src={r.image}
                  alt={r.name}
                  category={r.cuisine || r.category || 'restaurant'}
                  type="restaurants"
                  iconFallback={
                    <span className="place-image-icon">
                      <Icon name="utensils" size={32} />
                    </span>
                  }
                />
                {r.distanceKm != null && (
                  <span className="place-distance-tag">
                    <Icon name="navigation" size={12} /> {formatDistance(r.distanceKm)}
                  </span>
                )}
              </div>

              <div className="place-body">
                <div className="place-meta">
                  <span className="place-category">{r.cuisine || r.category || 'Dining'}</span>
                  {r.isVeg && <span className="badge badge-success">Pure Veg</span>}
                  {r.rating != null ? (
                    <span className="place-rating">⭐ {r.rating.toFixed(1)}</span>
                  ) : (
                    <span className="place-source-tag">Verified</span>
                  )}
                </div>

                <h3 className="place-name">{r.name}</h3>
                <p className="place-address">
                  <Icon name="map-pin" size={13} /> {r.address || 'Address information unavailable'}
                </p>

                {r.phone && (
                  <p className="place-phone">
                    <Icon name="phone" size={12} /> {r.phone}
                  </p>
                )}

                <div className="place-card-actions" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    variant="outline"
                    icon="eye"
                    onClick={() => setDetailRestaurant(r)}
                  >
                    View Details
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    icon="navigation"
                    onClick={() => setNavigatingRestaurant(r)}
                  >
                    Navigate
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Restaurant Details Modal (NO MAP) */}
      <PlaceDetailModal
        isOpen={!!detailRestaurant}
        onClose={() => setDetailRestaurant(null)}
        item={detailRestaurant}
        type="restaurants"
        onStartNavigation={(item) => setNavigatingRestaurant(item)}
      />

      {/* In-App Satellite Navigation Modal (MAP ON NAVIGATE) */}
      <NavigationModal
        isOpen={!!navigatingRestaurant}
        onClose={() => setNavigatingRestaurant(null)}
        destination={navigatingRestaurant}
        initialMode="driving-car"
      />
    </div>
  );
}
