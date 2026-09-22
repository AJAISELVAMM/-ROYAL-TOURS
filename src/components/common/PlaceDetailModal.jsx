// =============================================================================
// PlaceDetailModal.jsx — Rich In-Place Details Modal for Discover Items.
// Displays detailed information, photos, showtimes, amenities, and contact info.
// Does NOT start navigation or open maps automatically.
// =============================================================================

import React, { useEffect } from 'react';
import Icon from './Icon.jsx';
import Button from './Button.jsx';
import ImageWithFallback from './ImageWithFallback.jsx';
import { formatDistance, haversineDistanceKm } from '../../utils/geoUtils.js';
import { useLocation } from '../../context/LocationContext.jsx';

export default function PlaceDetailModal({
  isOpen,
  onClose,
  item,
  type = 'places',
  onStartNavigation
}) {
  const { currentLocation } = useLocation();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !item) return null;

  const liveDistanceKm =
    item.latitude != null &&
    item.longitude != null &&
    currentLocation.latitude != null &&
    currentLocation.longitude != null
      ? haversineDistanceKm(currentLocation.latitude, currentLocation.longitude, item.latitude, item.longitude)
      : item.distanceKm;

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(6px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="place-detail-modal"
        style={{
          background: 'var(--bg-card, #ffffff)',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-xl, 0 20px 40px rgba(0,0,0,0.2))',
          border: '1px solid var(--border)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out'
        }}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Image Banner with Close Button */}
        <div style={{ position: 'relative', width: '100%', height: '220px', flexShrink: 0, background: 'var(--purple-50)' }}>
          <ImageWithFallback
            src={item.image}
            alt={item.name}
            category={item.category || type}
            type={type}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            iconFallback={
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--purple)' }}>
                <Icon name={type === 'theatres' ? 'film' : type === 'restaurants' ? 'utensils' : type === 'hotels' ? 'bed' : type === 'shopping' ? 'bag' : 'map-pin'} size={48} />
                <span style={{ fontSize: '13px', fontWeight: 600, marginTop: '8px' }}>{item.name}</span>
              </div>
            }
          />
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close"
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              background: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(6px)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
            }}
          >
            <Icon name="x" size={18} />
          </button>

          <div
            style={{
              position: 'absolute',
              bottom: '12px',
              left: '12px',
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap'
            }}
          >
            <span
              style={{
                padding: '4px 10px',
                borderRadius: '999px',
                background: 'rgba(124, 58, 237, 0.9)',
                backdropFilter: 'blur(6px)',
                color: '#ffffff',
                fontSize: '11.5px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
            >
              {item.category || type}
            </span>
            {item.verified && (
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: '999px',
                  background: 'rgba(22, 163, 74, 0.9)',
                  backdropFilter: 'blur(6px)',
                  color: '#ffffff',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Icon name="shield-check" size={13} /> Verified
              </span>
            )}
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', margin: '0 0 6px 0', lineHeight: 1.3 }}>
              {item.name}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', fontSize: '13px', color: 'var(--text-muted)' }}>
              {item.rating != null && (
                <span style={{ color: 'var(--amber-deep, #d97706)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                  ⭐ {item.rating.toFixed(1)} {item.reviews ? `(${item.reviews} reviews)` : ''}
                </span>
              )}
              {liveDistanceKm != null && (
                <span style={{ color: 'var(--purple)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Icon name="navigation" size={13} /> {formatDistance(liveDistanceKm)} away
                </span>
              )}
              {item.openingHours && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Icon name="clock" size={13} /> {item.openingHours}
                </span>
              )}
            </div>
          </div>

          {/* Address */}
          {item.address && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13.5px', color: 'var(--text)', background: 'var(--bg-main, #f8fafc)', padding: '10px 14px', borderRadius: '10px' }}>
              <Icon name="map-pin" size={16} style={{ color: 'var(--purple)', flexShrink: 0, marginTop: '2px' }} />
              <span style={{ lineHeight: 1.4 }}>{item.address}</span>
            </div>
          )}

          {/* Description */}
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>About</h4>
            <p style={{ fontSize: '13.5px', color: 'var(--text)', lineHeight: 1.6, margin: 0 }}>
              {item.description || `Verified local ${item.category || type} destination with genuine location coordinates.`}
            </p>
          </div>

          {/* Category-Specific Info: Theatres */}
          {(type === 'theatres' || type === 'theatre') && (
            <div style={{ background: 'var(--purple-50)', padding: '14px', borderRadius: '12px' }}>
              <h4 style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--purple-deep)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Icon name="film" size={16} /> Movie Showtimes
              </h4>
              {Array.isArray(item.currentMovies) && item.currentMovies.length > 0 ? (
                <div>
                  <p style={{ fontWeight: 600, fontSize: '13.5px', margin: '0 0 8px 0', color: 'var(--text)' }}>
                    Now Showing: {item.currentMovies.join(' • ')}
                  </p>
                  {Array.isArray(item.showTimings) && item.showTimings.length > 0 && (
                    <div className="show-times" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {item.showTimings.map((t) => (
                        <span key={t} className="show-time" style={{ padding: '4px 10px', background: '#ffffff', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12px', fontWeight: 600, color: 'var(--purple-deep)' }}>
                          <Icon name="clock" size={12} /> {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                  Live showtimes are updated at theater box office.
                </p>
              )}
            </div>
          )}

          {/* Category-Specific Info: Hotels */}
          {(type === 'hotels' || type === 'hotel') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--bg-main, #f8fafc)', padding: '12px 16px', borderRadius: '12px' }}>
              {item.pricePerNight != null && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Estimated Tariff</span>
                  <strong style={{ color: 'var(--purple)' }}>₹{item.pricePerNight.toLocaleString('en-IN')} / night</strong>
                </div>
              )}
              {Array.isArray(item.amenities) && item.amenities.length > 0 && (
                <div>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Amenities:</span>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {item.amenities.map((a) => (
                      <span key={a} style={{ padding: '3px 8px', borderRadius: '6px', background: '#ffffff', border: '1px solid var(--border)', fontSize: '12px' }}>
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Category-Specific Info: Restaurants */}
          {(type === 'restaurants' || type === 'restaurant') && item.cuisine && (
            <div style={{ background: 'var(--bg-main, #f8fafc)', padding: '10px 14px', borderRadius: '10px', fontSize: '13.5px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Cuisine: </span>
              <strong>{item.cuisine}</strong>
            </div>
          )}

          {/* Contact Details */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', fontSize: '13px' }}>
            {item.phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon name="phone" size={15} style={{ color: 'var(--purple)' }} />
                <a href={`tel:${item.phone}`} style={{ color: 'var(--purple)', fontWeight: 600, textDecoration: 'none' }}>
                  {item.phone}
                </a>
              </div>
            )}
            {item.website && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon name="globe" size={15} style={{ color: 'var(--purple)' }} />
                <a href={item.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--purple)', fontWeight: 600, textDecoration: 'underline', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Visit Website
                </a>
              </div>
            )}
            {item.latitude != null && item.longitude != null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-faint)', fontFamily: 'monospace', fontSize: '12px' }}>
                <Icon name="crosshair" size={14} />
                <span>{item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-card, #ffffff)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px'
          }}
        >
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {onStartNavigation && (
            <Button
              variant="primary"
              icon="navigation"
              onClick={() => {
                onClose?.();
                onStartNavigation(item);
              }}
            >
              Navigate
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
