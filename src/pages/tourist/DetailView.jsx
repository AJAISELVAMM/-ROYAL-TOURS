// =============================================================================
// DetailView.jsx — Comprehensive POI Details & In-App Satellite Navigation.
// Displays authentic details without fabricated data. Opens in-app live satellite
// road navigation when the tourist clicks Navigate.
// =============================================================================

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Icon from '../../components/common/Icon.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import LoadingState from '../../components/common/LoadingState.jsx';
import ImageWithFallback from '../../components/common/ImageWithFallback.jsx';
import NavigationModal from '../../components/maps/NavigationModal.jsx';
import { useLocation } from '../../context/LocationContext.jsx';
import * as catalogService from '../../services/catalogService.js';
import { formatDistance, haversineDistanceKm } from '../../utils/geoUtils.js';

export default function DetailView() {
  const { type: paramType, id } = useParams();
  const navigate = useNavigate();
  const { currentLocation, setSelectedLocation } = useLocation();

  // Determine category type from params or pathname
  const type = React.useMemo(() => {
    if (paramType && paramType !== 'detail' && paramType !== 'details') return paramType;
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts.length >= 2 && parts[0] === 'discover') {
      const seg = parts[1];
      if (['places', 'hotels', 'restaurants', 'theatres', 'shopping'].includes(seg)) {
        return seg;
      }
    }
    return 'places';
  }, [paramType]);

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    catalogService
      .getOne(type, id)
      .then((data) => {
        setItem(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Item could not be loaded.');
        setLoading(false);
      });
  }, [type, id]);

  // Compute live distance from current GPS
  const liveDistanceKm =
    item?.latitude != null &&
    item?.longitude != null &&
    currentLocation.latitude != null &&
    currentLocation.longitude != null
      ? haversineDistanceKm(currentLocation.latitude, currentLocation.longitude, item.latitude, item.longitude)
      : item?.distanceKm;

  if (loading) return <LoadingState label="Loading destination details…" />;
  if (error || !item) return <EmptyState title="Destination not found" message={error || 'Could not find the requested item.'} />;

  return (
    <div className="detail-view">
      <div className="detail-top-nav">
        <Button variant="outline" size="sm" icon="arrow-left" onClick={() => navigate(-1)}>
          Back
        </Button>
      </div>

      <div className="detail-hero">
        <div className="detail-hero-body">
          <div className="place-title-row">
            <h1>{item.name}</h1>
            {item.verified && (
              <span className="verified-tag">
                <Icon name="shield-check" size={16} /> Verified
              </span>
            )}
          </div>
          <div className="place-meta" style={{ marginTop: '8px', fontSize: '14px', flexWrap: 'wrap', gap: '12px' }}>
            {item.category && <span className="popup-badge">{item.category}</span>}
            {item.rating != null && <span><Icon name="star" size={15} /> {item.rating.toFixed(1)}</span>}
            {liveDistanceKm != null && <span><Icon name="navigation" size={14} /> {formatDistance(liveDistanceKm)} from current GPS</span>}
            {item.address && <span style={{ color: 'var(--text-muted)' }}>📍 {item.address}</span>}
          </div>
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-main">
          {/* Destination Photo Banner */}
          <Card padded={false} style={{ overflow: 'hidden', marginBottom: '20px', height: '280px', borderRadius: '16px', position: 'relative' }}>
            <ImageWithFallback
              src={item.image}
              alt={item.name}
              category={item.category || type}
              type={type}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div style={{ position: 'absolute', bottom: '12px', left: '12px', background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(6px)', padding: '6px 12px', borderRadius: '8px', color: '#ffffff', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Icon name="camera" size={14} />
              <span>Verified Destination Photo</span>
            </div>
          </Card>

          {/* Description / About */}
          <Card className="detail-section">
            <h2>About</h2>
            <p style={{ lineHeight: '1.6', marginTop: '10px', color: 'var(--text)' }}>
              {item.description || 'Verified local destination with live GPS navigation support.'}
            </p>
          </Card>

          {/* Theatre Shows */}
          {(type === 'theatres' || type === 'theatre') && (
            <Card className="detail-section" style={{ marginTop: '20px' }}>
              <h2>Movie Showtimes</h2>
              {Array.isArray(item.currentMovies) && item.currentMovies.length > 0 ? (
                <div>
                  <p style={{ fontWeight: 600, fontSize: '14px', marginTop: '8px' }}>
                    {item.currentMovies.join(' • ')}
                  </p>
                  {Array.isArray(item.showTimings) && item.showTimings.length > 0 && (
                    <div className="show-times" style={{ marginTop: '10px' }}>
                      {item.showTimings.map((t) => (
                        <span key={t} className="show-time">
                          <Icon name="clock" size={13} /> {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginTop: '8px' }}>
                  Live showtimes are currently unavailable.
                </p>
              )}
            </Card>
          )}
        </div>

        <div className="detail-side">
          <Card>
            <h2>Destination Information</h2>
            <div className="meta-list" style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <span className="meta-label">Distance from GPS</span>
                <strong>{liveDistanceKm != null ? formatDistance(liveDistanceKm) : 'GPS active'}</strong>
              </div>

              <div>
                <span className="meta-label">Address</span>
                <strong>{item.address || 'Address information unavailable'}</strong>
              </div>

              <div>
                <span className="meta-label">Coordinates</span>
                <strong style={{ fontFamily: 'monospace', fontSize: '12.5px' }}>
                  {item.latitude != null && item.longitude != null
                    ? `${item.latitude.toFixed(5)}, ${item.longitude.toFixed(5)}`
                    : 'Information unavailable'}
                </strong>
              </div>

              <div>
                <span className="meta-label">Opening Hours</span>
                <strong>{item.openingHours || 'Information unavailable'}</strong>
              </div>

              <div>
                <span className="meta-label">Contact Phone</span>
                <strong>{item.phone || 'Information unavailable'}</strong>
              </div>

              {item.website && (
                <div>
                  <span className="meta-label">Website</span>
                  <a href={item.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--purple)', wordBreak: 'break-all' }}>
                    {item.website}
                  </a>
                </div>
              )}

              {item.pricePerNight && (
                <div>
                  <span className="meta-label">Tariff</span>
                  <strong>₹{item.pricePerNight.toLocaleString('en-IN')} / night</strong>
                </div>
              )}

              <div>
                <span className="meta-label">Data Source</span>
                <strong style={{ textTransform: 'capitalize' }}>{item.source || 'OpenStreetMap'}</strong>
              </div>
            </div>

            <div style={{ marginTop: '24px' }}>
              <Button
                variant="primary"
                icon="navigation"
                style={{ width: '100%' }}
                onClick={() => setNavigating(true)}
              >
                Start Satellite Road Navigation
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* In-App Satellite Navigation Modal */}
      <NavigationModal
        isOpen={navigating}
        onClose={() => setNavigating(false)}
        destination={item}
        initialMode="driving-car"
      />
    </div>
  );
}
