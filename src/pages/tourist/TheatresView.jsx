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

export default function TheatresView() {
  const { currentLocation, discoverLocation, setSelectedLocation } = useLocation();

  const [theatres, setTheatres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [navigatingTheatre, setNavigatingTheatre] = useState(null);
  const [detailTheatre, setDetailTheatre] = useState(null);

  const effectiveLat = discoverLocation?.latitude ?? currentLocation.latitude;
  const effectiveLon = discoverLocation?.longitude ?? currentLocation.longitude;

  // Immediately clear stale results when location changes
  useEffect(() => {
    setTheatres([]);
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
        .list('theatres', {
          latitude: effectiveLat,
          longitude: effectiveLon,
          search: query.trim() || undefined,
          limit: 30
        }, { signal: abortCtrl.signal })
        .then((items) => {
          if (!active) return;
          setTheatres(items || []);
          setLoading(false);
        })
        .catch((err) => {
          if (!active || err.name === 'AbortError') return;
          setError(err.message || 'Could not load nearby theatres.');
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
          placeholder="Search nearby cinemas, theatres, multiplexes…"
        />
      </div>

      {loading ? (
        <LoadingState label="Finding real cinemas and theatres near you…" />
      ) : error ? (
        <EmptyState title="Could not load theatres" message={error} />
      ) : theatres.length === 0 ? (
        <EmptyState title="No theatres found" message="Try searching for a different cinema name or location." />
      ) : (
        <div className="place-grid">
          {theatres.map((t) => (
            <Card key={t.id} className="place-card" hover onClick={() => setDetailTheatre(t)}>
              <div className="place-image" style={{ height: '160px', overflow: 'hidden', position: 'relative' }}>
                <ImageWithFallback
                  src={t.image}
                  alt={t.name}
                  category={t.category || 'theatre'}
                  type="theatres"
                  iconFallback={
                    <span className="place-image-icon">
                      <Icon name="film" size={32} />
                    </span>
                  }
                />
                {t.distanceKm != null && (
                  <span className="place-distance-tag">
                    <Icon name="navigation" size={12} /> {formatDistance(t.distanceKm)}
                  </span>
                )}
              </div>

              <div className="place-body">
                <div className="place-meta">
                  <span className="place-category">{t.category || 'Cinema'}</span>
                  {t.screens && <span className="place-screens">{t.screens} Screens</span>}
                  {t.rating != null ? (
                    <span className="place-rating">⭐ {t.rating.toFixed(1)}</span>
                  ) : (
                    <span className="place-source-tag">Verified</span>
                  )}
                </div>

                <h3 className="place-name">{t.name}</h3>
                <p className="place-address">
                  <Icon name="map-pin" size={13} /> {t.address || 'Address information unavailable'}
                </p>

                {t.phone && (
                  <p className="place-phone">
                    <Icon name="phone" size={12} /> {t.phone}
                  </p>
                )}

                <div className="place-card-actions" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    variant="outline"
                    icon="eye"
                    onClick={() => setDetailTheatre(t)}
                  >
                    View Details
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    icon="navigation"
                    onClick={() => setNavigatingTheatre(t)}
                  >
                    Navigate
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Theatre Details Modal (NO MAP) */}
      <PlaceDetailModal
        isOpen={!!detailTheatre}
        onClose={() => setDetailTheatre(null)}
        item={detailTheatre}
        type="theatres"
        onStartNavigation={(item) => setNavigatingTheatre(item)}
      />

      {/* In-App Satellite Navigation Modal (MAP ON NAVIGATE) */}
      <NavigationModal
        isOpen={!!navigatingTheatre}
        onClose={() => setNavigatingTheatre(null)}
        destination={navigatingTheatre}
        initialMode="driving-car"
      />
    </div>
  );
}
