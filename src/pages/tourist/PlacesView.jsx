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

const CATEGORIES = ['All', 'Attractions', 'Museums', 'Temples', 'Parks', 'Viewpoints', 'Historical'];

export default function PlacesView() {
  const { currentLocation, discoverLocation, setSelectedLocation } = useLocation();

  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [navigatingPlace, setNavigatingPlace] = useState(null);
  const [detailPlace, setDetailPlace] = useState(null);

  const effectiveLat = discoverLocation?.latitude ?? currentLocation.latitude;
  const effectiveLon = discoverLocation?.longitude ?? currentLocation.longitude;

  // Immediately clear stale results when location changes
  useEffect(() => {
    setPlaces([]);
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
        .list('places', {
          latitude: effectiveLat,
          longitude: effectiveLon,
          search: query.trim() || undefined,
          category: category === 'All' ? null : category,
          limit: 50
        }, { signal: abortCtrl.signal })
        .then((items) => {
          if (!active) return;
          setPlaces(items || []);
          setLoading(false);
        })
        .catch((err) => {
          if (!active || err.name === 'AbortError') return;
          setError(err.message || 'Could not load nearby places.');
          setLoading(false);
        });
    }, 200);

    return () => {
      active = false;
      clearTimeout(handler);
      abortCtrl.abort();
    };
  }, [effectiveLat, effectiveLon, category, query]);

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
      {/* Search & Filter Toolbar */}
      <div className="catalog-toolbar">
        <LocationAutocomplete
          value={query}
          onChange={setQuery}
          onSelect={handleSelectSuggestion}
          placeholder="Search nearby places, temples, monuments…"
        />
        <div className="filter-row">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className={`filter-chip ${category === c ? 'active' : ''}`}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingState label="Finding real nearby places with live GPS…" />
      ) : error ? (
        <EmptyState title="Could not load places" message={error} />
      ) : places.length === 0 ? (
        <EmptyState title="No places found" message="Try adjusting your search or category filter." />
      ) : (
        <div className="place-grid">
          {places.map((p) => (
            <Card key={p.id} className="place-card" hover onClick={() => setDetailPlace(p)}>
              <div className="place-image" style={{ height: '160px', overflow: 'hidden', position: 'relative' }}>
                <ImageWithFallback
                  src={p.image}
                  alt={p.name}
                  category={p.category || category}
                  type="places"
                  iconFallback={
                    <span className="place-image-icon">
                      <Icon name={p.category === 'temple' ? 'sun' : p.category === 'museum' ? 'landmark' : 'map-pin'} size={32} />
                    </span>
                  }
                />
                {p.distanceKm != null && (
                  <span className="place-distance-tag">
                    <Icon name="navigation" size={12} /> {formatDistance(p.distanceKm)}
                  </span>
                )}
              </div>

              <div className="place-body">
                <div className="place-meta">
                  <span className="place-category">{p.category || 'Attraction'}</span>
                  {p.rating != null ? (
                    <span className="place-rating">⭐ {p.rating.toFixed(1)}</span>
                  ) : (
                    <span className="place-source-tag">Verified POI</span>
                  )}
                </div>

                <h3 className="place-name">{p.name}</h3>
                <p className="place-address">
                  <Icon name="map-pin" size={13} /> {p.address || 'Address information unavailable'}
                </p>

                {p.description && (
                  <p className="place-desc">
                    {p.description.length > 100 ? `${p.description.slice(0, 100)}…` : p.description}
                  </p>
                )}

                <div className="place-card-actions" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    variant="outline"
                    icon="eye"
                    onClick={() => setDetailPlace(p)}
                  >
                    View Details
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    icon="navigation"
                    onClick={() => setNavigatingPlace(p)}
                  >
                    Navigate
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Place Details Modal (NO MAP) */}
      <PlaceDetailModal
        isOpen={!!detailPlace}
        onClose={() => setDetailPlace(null)}
        item={detailPlace}
        type="places"
        onStartNavigation={(item) => setNavigatingPlace(item)}
      />

      {/* In-App Satellite Navigation Modal (MAP ONLY ON NAVIGATE) */}
      <NavigationModal
        isOpen={!!navigatingPlace}
        onClose={() => setNavigatingPlace(null)}
        destination={navigatingPlace}
        initialMode="driving-car"
      />
    </div>
  );
}
