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

export default function HotelsView() {
  const { currentLocation, discoverLocation, setSelectedLocation } = useLocation();

  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [navigatingHotel, setNavigatingHotel] = useState(null);
  const [detailHotel, setDetailHotel] = useState(null);

  const effectiveLat = discoverLocation?.latitude ?? currentLocation.latitude;
  const effectiveLon = discoverLocation?.longitude ?? currentLocation.longitude;

  // Immediately clear stale results when location changes
  useEffect(() => {
    setHotels([]);
    setError(null);
    setLoading(true);
  }, [effectiveLat, effectiveLon]);

  useEffect(() => {
    let active = true;
    const abortCtrl = new AbortController();

    const handler = setTimeout(() => {
      if (effectiveLat == null || effectiveLon == null) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      catalogService
        .list('hotels', {
          latitude: effectiveLat,
          longitude: effectiveLon,
          search: query.trim() || undefined,
          limit: 50
        }, { signal: abortCtrl.signal })
        .then((items) => {
          if (!active) return;
          setHotels(items || []);
          setLoading(false);
        })
        .catch((err) => {
          if (!active || err.name === 'AbortError') return;
          setError(err.message || 'Could not load nearby hotels.');
          setLoading(false);
        });
    }, 200);

    return () => {
      active = false;
      clearTimeout(handler);
      abortCtrl.abort();
    };
  }, [effectiveLat, effectiveLon, query]);

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
          placeholder="Search nearby hotels, resorts, lodges…"
        />
      </div>

      {loading ? (
        <LoadingState label="Finding verified hotels near your location…" />
      ) : error ? (
        <EmptyState title="Could not load hotels" message={error} />
      ) : hotels.length === 0 ? (
        <EmptyState title="No hotels found" message="Try searching for a different hotel name or location." />
      ) : (
        <div className="place-grid">
          {hotels.map((h) => (
            <Card key={h.id} className="place-card" hover onClick={() => setDetailHotel(h)}>
              <div className="place-image" style={{ height: '160px', overflow: 'hidden', position: 'relative' }}>
                <ImageWithFallback
                  src={h.image}
                  alt={h.name}
                  category={h.category || 'hotel'}
                  type="hotels"
                  iconFallback={
                    <span className="place-image-icon">
                      <Icon name="bed" size={32} />
                    </span>
                  }
                />
                {h.distanceKm != null && (
                  <span className="place-distance-tag">
                    <Icon name="navigation" size={12} /> {formatDistance(h.distanceKm)}
                  </span>
                )}
              </div>

              <div className="place-body">
                <div className="place-meta">
                  <span className="place-category">{h.category || 'Hotel'}</span>
                  {h.priceRange && <span className="place-price">{h.priceRange}</span>}
                  {h.rating != null ? (
                    <span className="place-rating">⭐ {h.rating.toFixed(1)}</span>
                  ) : (
                    <span className="place-source-tag">Verified</span>
                  )}
                </div>

                <h3 className="place-name">{h.name}</h3>
                <p className="place-address">
                  <Icon name="map-pin" size={13} /> {h.address || 'Address information unavailable'}
                </p>

                {h.phone && (
                  <p className="place-phone">
                    <Icon name="phone" size={12} /> {h.phone}
                  </p>
                )}

                <div className="place-card-actions" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    variant="outline"
                    icon="eye"
                    onClick={() => setDetailHotel(h)}
                  >
                    View Details
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    icon="navigation"
                    onClick={() => setNavigatingHotel(h)}
                  >
                    Navigate
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Hotel Details Modal (NO MAP) */}
      <PlaceDetailModal
        isOpen={!!detailHotel}
        onClose={() => setDetailHotel(null)}
        item={detailHotel}
        type="hotels"
        onStartNavigation={(item) => setNavigatingHotel(item)}
      />

      {/* In-App Satellite Navigation Modal (MAP ON NAVIGATE) */}
      <NavigationModal
        isOpen={!!navigatingHotel}
        onClose={() => setNavigatingHotel(null)}
        destination={navigatingHotel}
        initialMode="driving-car"
      />
    </div>
  );
}
