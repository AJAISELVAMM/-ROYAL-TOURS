import React, { useState, useEffect } from 'react';
import Card from '../../components/common/Card.jsx';
import Icon from '../../components/common/Icon.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import LoadingState from '../../components/common/LoadingState.jsx';
import { useLocation } from '../../context/LocationContext.jsx';
import * as weatherService from '../../services/weatherService.js';

export default function WeatherView() {
  const { currentLocation, discoverLocation, selectedLocation, permissionStatus } = useLocation();

  const effectiveLat = discoverLocation?.latitude ?? selectedLocation?.latitude ?? currentLocation.latitude;
  const effectiveLon = discoverLocation?.longitude ?? selectedLocation?.longitude ?? currentLocation.longitude;
  const locationName = discoverLocation?.name || selectedLocation?.name || null;

  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (effectiveLat == null || effectiveLon == null) {
      if (permissionStatus === 'denied' && !discoverLocation && !selectedLocation) {
        setError('Location permission is denied. Please enable device location access in your browser or select a location in Discover to fetch live weather.');
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    setError(null);
    weatherService
      .getLiveWeather(effectiveLat, effectiveLon)
      .then((data) => {
        setWeather(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Live weather data is temporarily unavailable.');
        setLoading(false);
      });
  }, [effectiveLat, effectiveLon, permissionStatus, discoverLocation, selectedLocation]);

  if (loading) {
    return <LoadingState label="Fetching live atmospheric metrics for your location…" />;
  }

  if (error || !weather) {
    return (
      <EmptyState
        title="Weather Unavailable"
        message={error || 'Could not retrieve live weather information.'}
      />
    );
  }

  return (
    <div className="weather-view">
      {/* Current Conditions Hero Card */}
      <Card className="weather-hero">
        <div className="weather-main-row">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="popup-badge" style={{ background: 'rgba(255,255,255,0.25)', color: '#ffffff' }}>
                {locationName ? `${locationName.toUpperCase()} WEATHER` : 'LIVE GPS WEATHER'}
              </span>
              <span style={{ fontSize: '12px', opacity: 0.85 }}>
                {effectiveLat?.toFixed(4)}, {effectiveLon?.toFixed(4)}
              </span>
            </div>
            <h1 className="weather-temp" style={{ marginTop: '8px' }}>{weather.temperature}°C</h1>
            <p className="weather-cond" style={{ fontSize: '18px', fontWeight: 600 }}>{weather.condition}</p>
            <p className="weather-feels" style={{ opacity: 0.9, fontSize: '13.5px' }}>
              Feels like {weather.feelsLike}°C • {weather.isDay ? 'Daytime' : 'Night'}
            </p>
          </div>
          <div className="weather-big-icon">
            <Icon name={weather.icon || 'sun'} size={80} />
          </div>
        </div>

        <div className="weather-stats-grid">
          <div className="wstat">
            <span className="wstat-icon"><Icon name="droplets" size={18} /></span>
            <div>
              <span className="wstat-label">Humidity</span>
              <strong>{weather.humidity}%</strong>
            </div>
          </div>
          <div className="wstat">
            <span className="wstat-icon"><Icon name="wind" size={18} /></span>
            <div>
              <span className="wstat-label">Wind Speed</span>
              <strong>{weather.windSpeedKm} km/h</strong>
            </div>
          </div>
          <div className="wstat">
            <span className="wstat-icon"><Icon name="sun" size={18} /></span>
            <div>
              <span className="wstat-label">UV Index</span>
              <strong>{weather.uvIndex?.toFixed(1)} ({weather.uvDescription})</strong>
            </div>
          </div>
          <div className="wstat">
            <span className="wstat-icon"><Icon name="cloud-rain" size={18} /></span>
            <div>
              <span className="wstat-label">Precipitation</span>
              <strong>{weather.precipitation} mm</strong>
            </div>
          </div>
        </div>
      </Card>

      {/* 5-Day Forecast */}
      {Array.isArray(weather.forecast) && weather.forecast.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <h2 className="section-title">5-Day Live Forecast</h2>
          <div className="forecast-grid">
            {weather.forecast.map((f) => (
              <Card key={f.date} className="forecast-card">
                <span className="forecast-day">{f.day}</span>
                <span className="forecast-icon"><Icon name={f.icon} size={28} /></span>
                <span className="forecast-cond">{f.cond}</span>
                <div className="forecast-temps">
                  <span className="f-high">{f.high}°</span>
                  <span className="f-low">{f.low}°</span>
                </div>
                {f.rainProbability != null && (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    💧 {f.rainProbability}% rain
                  </span>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* AI Travel & Weather Recommendations */}
      {Array.isArray(weather.recommendations) && weather.recommendations.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <h2 className="section-title">AI Travel Recommendations</h2>
          <div className="weather-recs">
            {weather.recommendations.map((r, i) => (
              <Card key={i} className="rec-card">
                <span className="rec-icon"><Icon name={r.icon} size={22} /></span>
                <div className="rec-body">
                  <strong>{r.title}</strong>
                  <p>{r.description}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
