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

export default function ShoppingView() {
  const { currentLocation, discoverLocation, setSelectedLocation } = useLocation();

  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [navigatingShop, setNavigatingShop] = useState(null);
  const [detailShop, setDetailShop] = useState(null);

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
        .list('shopping', {
          latitude: effectiveLat,
          longitude: effectiveLon,
          search: query.trim() || undefined,
          limit: 50
        }, { signal: abortCtrl.signal })
        .then((items) => {
          if (!active) return;
          setShops(items || []);
        })
        .catch((err) => {
          if (!active || err.name === 'AbortError') return;
          setError(err.message || 'Could not load nearby shopping locations.');
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
          placeholder="Search nearby malls, silk shops, markets…"
        />
      </div>

      {loading ? (
        <LoadingState label="Finding verified shopping destinations near you…" />
      ) : error ? (
        <EmptyState title="Could not load shopping" message={error} />
      ) : shops.length === 0 ? (
        <EmptyState title="No shopping destinations found" message="Try searching for a different mall or market." />
      ) : (
        <div className="place-grid">
          {shops.map((s) => (
            <Card key={s.id} className="place-card" hover onClick={() => setDetailShop(s)}>
              <div className="place-image" style={{ height: '160px', overflow: 'hidden', position: 'relative' }}>
                <ImageWithFallback
                  src={s.image}
                  alt={s.name}
                  category={s.category || 'shopping'}
                  type="shopping"
                  iconFallback={
                    <span className="place-image-icon">
                      <Icon name="bag" size={32} />
                    </span>
                  }
                />
                {s.distanceKm != null && (
                  <span className="place-distance-tag">
                    <Icon name="navigation" size={12} /> {formatDistance(s.distanceKm)}
                  </span>
                )}
              </div>

              <div className="place-body">
                <div className="place-meta">
                  <span className="place-category">{s.category || 'Shopping'}</span>
                  {s.rating != null ? (
                    <span className="place-rating">⭐ {s.rating.toFixed(1)}</span>
                  ) : (
                    <span className="place-source-tag">Verified</span>
                  )}
                </div>

                <h3 className="place-name">{s.name}</h3>
                <p className="place-address">
                  <Icon name="map-pin" size={13} /> {s.address || 'Address information unavailable'}
                </p>

                {s.phone && (
                  <p className="place-phone">
                    <Icon name="phone" size={12} /> {s.phone}
                  </p>
                )}

                <div className="place-card-actions" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    variant="outline"
                    icon="eye"
                    onClick={() => setDetailShop(s)}
                  >
                    View Details
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    icon="navigation"
                    onClick={() => setNavigatingShop(s)}
                  >
                    Navigate
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Shopping Details Modal (NO MAP) */}
      <PlaceDetailModal
        isOpen={!!detailShop}
        onClose={() => setDetailShop(null)}
        item={detailShop}
        type="shopping"
        onStartNavigation={(item) => setNavigatingShop(item)}
      />

      {/* In-App Satellite Navigation Modal (MAP ON NAVIGATE) */}
      <NavigationModal
        isOpen={!!navigatingShop}
        onClose={() => setNavigatingShop(null)}
        destination={navigatingShop}
        initialMode="driving-car"
      />
    </div>
  );
}
