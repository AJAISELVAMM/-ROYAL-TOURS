import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/common/Icon.jsx';
import Button from '../../components/common/Button.jsx';
import RealMap from '../../components/maps/RealMap.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLocation } from '../../context/LocationContext.jsx';
import useStore from '../../useStore.js';
import useLoad from '../../hooks/useLoad.js';
import * as tripService from '../../services/tripService.js';
import * as weatherService from '../../services/weatherService.js';
import * as catalogService from '../../services/catalogService.js';
import * as safetyService from '../../services/safetyService.js';
import * as locationService from '../../services/locationService.js';
import { getFallbackImageForPoi } from '../../utils/imageUtils.js';
import { haversineDistanceKm, formatDistance, distanceMeters } from '../../utils/geoUtils.js';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export default function Dashboard() {
  const { user } = useAuth();
  const { currentLocation, permissionStatus } = useLocation();
  const store = useStore();
  const navigate = useNavigate();

  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [nearbyPlaces, setNearbyPlaces] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [emergencyFacilities, setEmergencyFacilities] = useState([]);
  const [mapCategory, setMapCategory] = useState('attractions');
  const [liveDestination, setLiveDestination] = useState(null);

  const lastCatalogCoordRef = useRef({ lat: null, lon: null });
  const lastGeocodedCoordRef = useRef({ lat: null, lon: null });

  // Load trips for the logged-in user
  useLoad(() => tripService.getTrips(user?.id), [user?.id]);

  // Real user trips breakdown
  const userTrips = useMemo(() => {
    return (store.trips || []).filter(
      (t) => !user?.id || t.touristId === user?.id || t.members?.some((m) => m.userId === user?.id)
    );
  }, [store.trips, user?.id]);

  const activeTrips = useMemo(() => {
    return userTrips.filter((t) => {
      if (t.hasLeft) return false;
      if (t.status !== 'active' || tripService.isTripExpired(t)) return false;
      const myMember = t.members?.find((m) => m.userId === user?.id || m.id === user?.id);
      if (myMember) return myMember.memberStatus !== 'LEFT' && myMember.status !== 'LEFT';
      return t.touristId === user?.id;
    });
  }, [userTrips, user?.id]);

  const completedTrips = useMemo(() => {
    return userTrips.filter((t) => t.status === 'completed' || tripService.isTripExpired(t));
  }, [userTrips]);

  const upcomingTrip = activeTrips[0] || null;

  // Dynamic live location destination with robust fallbacks
  const featuredDestination = useMemo(() => {
    if (liveDestination) return liveDestination;
    if (currentLocation?.latitude != null && currentLocation?.longitude != null) {
      return upcomingTrip?.destination || 'Current Location';
    }
    if (permissionStatus === 'denied') {
      return upcomingTrip?.destination || 'Location unavailable';
    }
    if (permissionStatus === 'prompt' || !permissionStatus) {
      return upcomingTrip?.destination || 'Locating…';
    }
    return upcomingTrip?.destination || 'Location unavailable';
  }, [liveDestination, permissionStatus, currentLocation?.latitude, currentLocation?.longitude, upcomingTrip?.destination]);

  // Dynamic reverse geocoding for live location based explore
  useEffect(() => {
    const lat = currentLocation?.latitude;
    const lon = currentLocation?.longitude;
    if (lat == null || lon == null) return;

    const last = lastGeocodedCoordRef.current;
    if (last.lat != null && last.lon != null) {
      const movedM = distanceMeters(last.lat, last.lon, lat, lon);
      if (movedM < 400 && liveDestination) {
        return;
      }
    }

    lastGeocodedCoordRef.current = { lat, lon };

    locationService
      .reverseGeocode(lat, lon)
      .then((res) => {
        if (res && res.destination) {
          setLiveDestination(res.destination);
        } else if (res && (res.locality || res.city || res.district)) {
          setLiveDestination(res.locality || res.city || res.district);
        } else if (res && res.displayName) {
          setLiveDestination(res.displayName.split(',')[0].trim());
        }
      })
      .catch(() => {
        // Graceful fallback handled in featuredDestination
      });
  }, [currentLocation?.latitude, currentLocation?.longitude, liveDestination]);

  // Saved places from localStorage
  const savedPlacesCount = useMemo(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('tourguard_saved_places') || '[]');
      return Array.isArray(saved) ? saved.length : 0;
    } catch {
      return 0;
    }
  }, []);

  // Today's journey activities from the upcoming trip
  const todaysActivities = useMemo(() => {
    if (!upcomingTrip || !upcomingTrip.itinerary) return [];
    let list = [];
    if (typeof upcomingTrip.itinerary === 'object') {
      const day1 = upcomingTrip.itinerary.day1 || Object.values(upcomingTrip.itinerary)[0];
      if (Array.isArray(day1)) {
        list = day1;
      }
    }
    return list;
  }, [upcomingTrip]);

  // Load weather, places, hotels, restaurants, emergency facilities
  useEffect(() => {
    const hasRealGps = currentLocation?.latitude != null && currentLocation?.longitude != null;
    const lat = hasRealGps ? currentLocation.latitude : 11.0168;
    const lon = hasRealGps ? currentLocation.longitude : 76.9558;

    const last = lastCatalogCoordRef.current;
    if (last.lat != null && last.lon != null) {
      const movedM = distanceMeters(last.lat, last.lon, lat, lon);
      // If we previously loaded with default coords and now have real GPS, always reload
      if (last.isRealGps === hasRealGps && movedM < 500 && nearbyPlaces.length > 0) {
        return;
      }
    }
    lastCatalogCoordRef.current = { lat, lon, isRealGps: hasRealGps };

    setWeatherLoading(true);
    weatherService
      .getLiveWeather(lat, lon)
      .then((data) => {
        setWeather(data);
        setWeatherLoading(false);
      })
      .catch(() => {
        setWeather(null);
        setWeatherLoading(false);
      });

    catalogService
      .list('places', { latitude: lat, longitude: lon, limit: 12 })
      .then((items) => {
        if (Array.isArray(items)) setNearbyPlaces(items);
      })
      .catch(() => {});

    catalogService
      .list('hotels', { latitude: lat, longitude: lon, limit: 10 })
      .then((items) => {
        if (Array.isArray(items)) setHotels(items);
      })
      .catch(() => {});

    catalogService
      .list('restaurants', { latitude: lat, longitude: lon, limit: 10 })
      .then((items) => {
        if (Array.isArray(items)) setRestaurants(items);
      })
      .catch(() => {});

    safetyService
      .getNearestEmergency(lat, lon, 'all')
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.facilities || res?.items || []);
        if (Array.isArray(list)) setEmergencyFacilities(list);
      })
      .catch(() => {});
  }, [currentLocation?.latitude, currentLocation?.longitude]);


  // Combined Map Markers for Nearby Map based on active filter
  const mapMarkers = useMemo(() => {
    const markers = [];
    const lat = currentLocation?.latitude;
    const lon = currentLocation?.longitude;

    if (mapCategory === 'attractions') {
      const sortedPlaces = nearbyPlaces
        .map((p) => {
          const d = lat != null && lon != null && p.latitude != null && p.longitude != null
            ? haversineDistanceKm(lat, lon, p.latitude, p.longitude)
            : (p.distanceKm ?? 9999);
          return { ...p, calculatedDistance: d };
        })
        .filter((p) => lat == null || p.calculatedDistance <= 75)
        .sort((a, b) => a.calculatedDistance - b.calculatedDistance);

      sortedPlaces.forEach((p) => {
        if (p.latitude != null && p.longitude != null) {
          markers.push({
            id: `place-${p.id}`,
            latitude: Number(p.latitude),
            longitude: Number(p.longitude),
            name: p.name,
            category: p.category || 'ATTRACTION',
            address: p.address || p.location,
            rating: p.rating
          });
        }
      });
    } else if (mapCategory === 'hospitals') {
      emergencyFacilities
        .filter((f) => {
          const cat = (f.type || f.category || '').toLowerCase();
          return cat.includes('hospital') || cat.includes('clinic') || cat.includes('medical');
        })
        .forEach((f) => {
          if (f.latitude != null && f.longitude != null) {
            markers.push({
              id: `emergency-${f.id}`,
              latitude: Number(f.latitude),
              longitude: Number(f.longitude),
              name: f.name,
              category: 'HOSPITAL',
              address: f.address,
              phone: f.phone
            });
          }
        });
    } else if (mapCategory === 'police') {
      emergencyFacilities
        .filter((f) => (f.type || f.category || '').toLowerCase().includes('police'))
        .forEach((f) => {
          if (f.latitude != null && f.longitude != null) {
            markers.push({
              id: `emergency-${f.id}`,
              latitude: Number(f.latitude),
              longitude: Number(f.longitude),
              name: f.name,
              category: 'POLICE',
              address: f.address,
              phone: f.phone
            });
          }
        });
    } else if (mapCategory === 'hotels') {
      hotels.forEach((h) => {
        if (h.latitude != null && h.longitude != null) {
          markers.push({
            id: `hotel-${h.id}`,
            latitude: Number(h.latitude),
            longitude: Number(h.longitude),
            name: h.name,
            category: 'HOTEL',
            address: h.location,
            rating: h.rating
          });
        }
      });
    } else if (mapCategory === 'restaurants') {
      restaurants.forEach((r) => {
        if (r.latitude != null && r.longitude != null) {
          markers.push({
            id: `restaurant-${r.id}`,
            latitude: Number(r.latitude),
            longitude: Number(r.longitude),
            name: r.name,
            category: 'RESTAURANT',
            address: r.location,
            rating: r.rating
          });
        }
      });
    }

    return markers;
  }, [mapCategory, nearbyPlaces, emergencyFacilities, hotels, restaurants, currentLocation?.latitude, currentLocation?.longitude]);

  // Map center coordinates
  const mapCenter = useMemo(() => {
    if (currentLocation?.latitude != null && currentLocation?.longitude != null) {
      return [currentLocation.latitude, currentLocation.longitude];
    }
    return [11.0168, 76.9558];
  }, [currentLocation?.latitude, currentLocation?.longitude]);

  // Top Attractions sorted strictly by distance from current live location
  const sortedNearbyAttractions = useMemo(() => {
    const lat = currentLocation?.latitude;
    const lon = currentLocation?.longitude;
    if (lat == null || lon == null) return nearbyPlaces.slice(0, 4);

    const withDist = nearbyPlaces.map((p) => {
      const d = p.latitude != null && p.longitude != null
        ? haversineDistanceKm(lat, lon, p.latitude, p.longitude)
        : (p.distanceKm ?? 9999);
      return { ...p, calculatedDistance: d };
    });

    const nearby = withDist.filter((p) => p.calculatedDistance <= 50);
    const sorted = (nearby.length > 0 ? nearby : withDist).sort(
      (a, b) => a.calculatedDistance - b.calculatedDistance
    );
    return sorted.slice(0, 4);
  }, [nearbyPlaces, currentLocation?.latitude, currentLocation?.longitude]);

  // Recent Activity from real user actions
  const recentActivities = useMemo(() => {
    const acts = [];

    // Real trips
    userTrips.slice(0, 2).forEach((t) => {
      acts.push({
        id: `trip-${t.id}`,
        icon: 'calendar',
        title: `Trip plan created: ${t.destination}`,
        desc: t.status === 'active' ? `Active Journey • ${t.duration || '2 Days'}` : 'Completed Journey',
        date: t.startDate ? new Date(t.startDate).toLocaleDateString() : 'Recent'
      });
    });

    // Stored searches or actions from localStorage
    try {
      const stored = JSON.parse(localStorage.getItem('tourguard_recent_activity') || '[]');
      if (Array.isArray(stored)) {
        stored.slice(0, 2).forEach((item) => {
          if (!acts.some((a) => a.title === item.title)) {
            acts.push(item);
          }
        });
      }
    } catch {
      // ignore
    }

    return acts;
  }, [userTrips]);

  // Formatted date for upcoming trip
  const upcomingTripFormattedDate = useMemo(() => {
    if (!upcomingTrip?.startDate) return 'Upcoming Schedule';
    try {
      return new Date(upcomingTrip.startDate).toLocaleDateString(undefined, {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return upcomingTrip.startDate;
    }
  }, [upcomingTrip]);

  // Upcoming trip tags
  const upcomingTripTags = useMemo(() => {
    if (upcomingTrip?.tags && Array.isArray(upcomingTrip.tags) && upcomingTrip.tags.length > 0) {
      return upcomingTrip.tags;
    }
    return ['Spiritual', 'Temple', 'Nature'];
  }, [upcomingTrip]);

  return (
    <div className="page-inner tourist-dashboard-root">
      {/* =========================================================================
          ROW 1: GREETING & SEARCH (LEFT) + DESTINATION HERO BANNER (RIGHT)
          ========================================================================= */}
      <div className="dash-row-1">
        {/* LEFT: Greeting & Search */}
        <div className="dash-greeting-box">
          <div className="dash-greeting-header">
            <h1 className="dash-greeting-title">
              {getGreeting()}, {user?.name?.toUpperCase() || 'TRAVELER'} 👋
            </h1>
            <p className="dash-greeting-subtitle">
              "Explore the world safely, plan smarter, travel happier!"
            </p>
            <p className="dash-greeting-subtext">
              <span
                className="dash-status-dot"
                style={{
                  backgroundColor: currentLocation?.latitude != null ? '#10b981' : '#f59e0b'
                }}
              />
              {currentLocation?.latitude != null
                ? `Live GPS Active • ${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}`
                : permissionStatus === 'denied'
                ? 'Device GPS disabled — enable location for optimal live safety guidance'
                : 'Acquiring your live device GPS location…'}
            </p>
          </div>
        </div>

        {/* RIGHT: Destination Hero Banner */}
        <div className="dash-hero-banner">
          <div className="dash-hero-overlay" />
          <div className="dash-hero-content">
            <div className="dash-hero-eyebrow">
              <Icon name="sparkles" size={13} /> Featured Destination
            </div>
            <div className="dash-hero-heading-block">
              <span className="dash-hero-small">Explore</span>
              <h2 className="dash-hero-city">{featuredDestination}</h2>
            </div>
            <div className="dash-hero-pill-tags">
              Nature • Culture • Adventure • Safety
            </div>
            <div className="dash-hero-btn-group">
              <button
                type="button"
                className="dash-hero-btn-primary"
                onClick={() => navigate('/discover/places')}
              >
                Explore Now →
              </button>
              <button
                type="button"
                className="dash-hero-btn-plan"
                onClick={() => navigate('/my-journey/trip?create=true')}
              >
                ✈ Plan a New Trip →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          ROW 2: QUICK STATISTICS + WEATHER + SAFETY (6 CARDS IN 1 ROW)
          ========================================================================= */}
      <div className="dash-row-2">
        {/* 1. Upcoming Trips */}
        <div className="dash-stat-compact-card">
          <div className="dash-stat-compact-icon purple">
            <Icon name="calendar" size={19} />
          </div>
          <div className="dash-stat-compact-info">
            <span className="dash-stat-compact-label">Upcoming Trips</span>
            <span className="dash-stat-compact-val">{activeTrips.length}</span>
            <span className="dash-stat-compact-sub">
              {activeTrips.length > 0 ? (activeTrips.length === 1 ? '1 scheduled' : `${activeTrips.length} scheduled`) : 'No trips yet'}
            </span>
          </div>
        </div>

        {/* 2. Places Saved */}
        <div className="dash-stat-compact-card">
          <div className="dash-stat-compact-icon green">
            <Icon name="bookmark" size={19} />
          </div>
          <div className="dash-stat-compact-info">
            <span className="dash-stat-compact-label">Places Saved</span>
            <span className="dash-stat-compact-val">{savedPlacesCount}</span>
            <span className="dash-stat-compact-sub">
              {savedPlacesCount > 0 ? `${savedPlacesCount} saved` : '0 saved places'}
            </span>
          </div>
        </div>

        {/* 3. Journeys Completed */}
        <div className="dash-stat-compact-card">
          <div className="dash-stat-compact-icon amber">
            <Icon name="check-circle" size={19} />
          </div>
          <div className="dash-stat-compact-info">
            <span className="dash-stat-compact-label">Journeys Completed</span>
            <span className="dash-stat-compact-val">{completedTrips.length}</span>
            <span className="dash-stat-compact-sub">
              {completedTrips.length > 0 ? `${completedTrips.length} journeys` : '0 completed journeys'}
            </span>
          </div>
        </div>

        {/* 4. User Rating */}
        <div className="dash-stat-compact-card">
          <div className="dash-stat-compact-icon blue">
            <Icon name="star" size={19} />
          </div>
          <div className="dash-stat-compact-info">
            <span className="dash-stat-compact-label">User Rating</span>
            <span className="dash-stat-compact-val">
              {user?.rating != null ? `${Number(user.rating).toFixed(1)} ★` : '4.8 ★'}
            </span>
            <span className="dash-stat-compact-sub">Verified Tourist</span>
          </div>
        </div>

        {/* 5. Current Weather */}
        <div
          className="dash-stat-compact-card interactive"
          onClick={() => navigate('/smart-travel/weather')}
          title="Click to view detailed weather forecast"
        >
          <div className="dash-stat-compact-icon amber">
            <Icon name={weather?.icon || 'cloud-sun'} size={19} />
          </div>
          <div className="dash-stat-compact-info">
            <span className="dash-stat-compact-label">Current Weather</span>
            <span className="dash-stat-compact-val">
              {weather ? `${weather.temperature}°C` : weatherLoading ? '...' : 'Weather unavailable'}
            </span>
            <span className="dash-stat-compact-sub">
              {weather ? weather.condition : weatherLoading ? 'Updating' : 'Try again'}
            </span>
          </div>
        </div>

        {/* 6. Safety Status */}
        <div
          className="dash-stat-compact-card interactive"
          onClick={() => navigate('/safety/map')}
          title="Click to view live 24/7 safety radar"
        >
          <div className="dash-stat-compact-icon green">
            <Icon name="shield-check" size={19} />
          </div>
          <div className="dash-stat-compact-info">
            <span className="dash-stat-compact-label">Safety Status</span>
            <span className="dash-stat-compact-val" style={{ color: '#10b981' }}>
              You're Safe
            </span>
            <span className="dash-stat-compact-sub">All Clear</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          ROW 3: UPCOMING TRIP + TODAY'S JOURNEY PLAN + NEARBY MAP (3 COLUMNS)
          ========================================================================= */}
      <div className="dash-row-3">
        {/* COL 1: YOUR UPCOMING TRIP */}
        <div className="dash-box dash-upcoming-col">
          <div className="dash-box-header">
            <h2 className="dash-box-title">
              <Icon name="map-pin" size={18} className="dash-title-icon" /> YOUR UPCOMING TRIP
            </h2>
          </div>

          {upcomingTrip ? (
            <div className="dash-trip-detail-wrap">
              <div className="dash-trip-cover-img-wrap">
                <img
                  src={
                    upcomingTrip.imageUrl ||
                    getFallbackImageForPoi('attraction', 'place', upcomingTrip.destination)
                  }
                  alt={upcomingTrip.destination}
                  className="dash-trip-cover-img"
                />
              </div>

              <div className="dash-trip-content">
                <h3 className="dash-trip-dest-name">{upcomingTrip.destination}</h3>
                <p className="dash-trip-location-text">
                  <Icon name="map-pin" size={13} />{' '}
                  {upcomingTrip.location || `${upcomingTrip.destination}, Tamil Nadu, India`}
                </p>
                <p className="dash-trip-date-text">
                  <Icon name="calendar" size={13} /> {upcomingTripFormattedDate}
                </p>

                <div className="dash-trip-tags-wrap">
                  {upcomingTripTags.map((tag, idx) => (
                    <span key={idx} className="dash-trip-tag-pill">
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="dash-trip-btn-row">
                  <Button
                    variant="primary"
                    size="sm"
                    icon="eye"
                    onClick={() => navigate('/my-journey/trip')}
                  >
                    View Details
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    icon="navigation"
                    onClick={() =>
                      navigate(
                        `/safety/map?focusLat=${upcomingTrip.latitude || 11.0168}&focusLon=${
                          upcomingTrip.longitude || 76.9558
                        }&focusName=${encodeURIComponent(upcomingTrip.destination)}`
                      )
                    }
                  >
                    Get Directions
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="dash-empty-box">
              <div className="dash-empty-icon-wrap">
                <Icon name="calendar" size={28} />
              </div>
              <h4 className="dash-empty-title">No upcoming trips scheduled</h4>
              <p className="dash-empty-msg">Ready for your next adventure?</p>
              <Button
                variant="primary"
                size="sm"
                icon="plus"
                onClick={() => navigate('/my-journey/trip?create=true')}
              >
                Plan a New Trip
              </Button>
            </div>
          )}
        </div>

        {/* COL 2: TODAY'S JOURNEY PLAN */}
        <div className="dash-box dash-journey-col">
          <div className="dash-box-header">
            <h2 className="dash-box-title">
              <Icon name="clock" size={18} className="dash-title-icon" /> Today's Journey Plan
            </h2>
            {todaysActivities.length > 0 && (
              <span className="dash-header-chip">{todaysActivities.length} activities</span>
            )}
          </div>

          {todaysActivities.length > 0 ? (
            <div className="dash-journey-timeline">
              {todaysActivities.map((activity, idx) => (
                <div key={idx} className="dash-journey-item">
                  <div className="dash-journey-time">
                    {activity.time || `0${9 + idx * 2}:00`.slice(-5)}
                  </div>
                  <div className="dash-journey-marker">
                    <span className="dash-journey-dot" />
                    {idx < todaysActivities.length - 1 && <span className="dash-journey-line" />}
                  </div>
                  <div className="dash-journey-info">
                    <div className="dash-journey-title">
                      {activity.title || activity.name || 'Activity Item'}
                    </div>
                    <div className="dash-journey-type">
                      {activity.type || activity.category || 'Sightseeing'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="dash-empty-box">
              <div className="dash-empty-icon-wrap">
                <Icon name="clock" size={28} />
              </div>
              <h4 className="dash-empty-title">No journey plan yet.</h4>
              <p className="dash-empty-msg">Add stops & activities to your itinerary</p>
              <Button
                variant="outline"
                size="sm"
                icon="plus"
                onClick={() => navigate('/my-journey/trip')}
              >
                Add Activities
              </Button>
            </div>
          )}
        </div>

        {/* COL 3: NEARBY MAP */}
        <div className="dash-box dash-map-col">
          <div className="dash-box-header dash-map-header">
            <h2 className="dash-box-title">
              <Icon name="map" size={18} className="dash-title-icon" /> Nearby Map
            </h2>

            {/* Filter Buttons */}
            <div className="dash-map-filter-group">
              <button
                type="button"
                className={`dash-map-filter-btn ${mapCategory === 'attractions' ? 'active' : ''}`}
                onClick={() => setMapCategory('attractions')}
              >
                Attractions
              </button>
              <button
                type="button"
                className={`dash-map-filter-btn ${mapCategory === 'hospitals' ? 'active' : ''}`}
                onClick={() => setMapCategory('hospitals')}
              >
                Hospitals
              </button>
              <button
                type="button"
                className={`dash-map-filter-btn ${mapCategory === 'police' ? 'active' : ''}`}
                onClick={() => setMapCategory('police')}
              >
                Police Stations
              </button>
              <button
                type="button"
                className={`dash-map-filter-btn ${mapCategory === 'hotels' ? 'active' : ''}`}
                onClick={() => setMapCategory('hotels')}
              >
                Hotels
              </button>
              <button
                type="button"
                className={`dash-map-filter-btn ${mapCategory === 'restaurants' ? 'active' : ''}`}
                onClick={() => setMapCategory('restaurants')}
              >
                Restaurants
              </button>
            </div>
          </div>

          <div className="dash-map-container-wrap">
            <RealMap
              center={mapCenter}
              zoom={13}
              markers={mapMarkers}
              height="285px"
              currentLocation={currentLocation?.latitude != null ? currentLocation : null}
              interactive={true}
            />
          </div>
        </div>
      </div>

      {/* =========================================================================
          ROW 4: TOP ATTRACTIONS + QUICK ACTIONS + RECENT ACTIVITY (3 COLUMNS)
          ========================================================================= */}
      <div className="dash-row-4">
        {/* COL 1: TOP ATTRACTIONS IN [DESTINATION] */}
        <div className="dash-box dash-attractions-col">
          <div className="dash-box-header">
            <h2 className="dash-box-title">
              <Icon name="compass" size={18} className="dash-title-icon" /> Top Attractions in{' '}
              {featuredDestination}
            </h2>
            <button
              type="button"
              className="dash-link-text-btn"
              onClick={() => navigate('/discover/places')}
            >
              View All →
            </button>
          </div>

          {sortedNearbyAttractions.length > 0 ? (
            <div className="dash-attractions-card-grid">
              {sortedNearbyAttractions.map((place) => {
                const placeDist =
                  currentLocation?.latitude != null && place.latitude != null
                    ? haversineDistanceKm(
                        currentLocation.latitude,
                        currentLocation.longitude,
                        place.latitude,
                        place.longitude
                      )
                    : null;

                return (
                  <div
                    key={place.id}
                    className="dash-attraction-mini-card"
                    onClick={() => navigate(`/discover/places/${place.id}`)}
                  >
                    <img
                      src={
                        place.imageUrl ||
                        getFallbackImageForPoi(place.category, place.type, place.name)
                      }
                      alt={place.name}
                      className="dash-attraction-mini-img"
                    />
                    <div className="dash-attraction-mini-body">
                      <div className="dash-attraction-mini-title" title={place.name}>
                        {place.name}
                      </div>
                      <div className="dash-attraction-mini-meta">
                        <span className="dash-attraction-star">
                          ⭐ {place.rating ? Number(place.rating).toFixed(1) : '4.6'}
                        </span>
                        <span className="dash-attraction-dist">
                          📍 {placeDist != null ? formatDistance(placeDist) : `${place.distanceKm || 5} km`}
                        </span>
                      </div>
                      <span className="dash-attraction-cat-badge">
                        {place.category || 'Sightseeing'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="dash-empty-box">
              <div className="dash-empty-icon-wrap">
                <Icon name="compass" size={28} />
              </div>
              <h4 className="dash-empty-title">Loading attractions…</h4>
              <p className="dash-empty-msg">Exploring top sights in {featuredDestination}</p>
            </div>
          )}
        </div>

        {/* COL 2: QUICK ACTIONS */}
        <div className="dash-box dash-quick-col">
          <div className="dash-box-header">
            <h2 className="dash-box-title">
              <Icon name="zap" size={18} className="dash-title-icon" /> Quick Actions
            </h2>
          </div>

          <div className="dash-quick-actions-vlist">
            <div
              className="dash-quick-item highlight"
              onClick={() => navigate('/my-journey/trip?create=true')}
            >
              <div className="dash-quick-icon-wrap purple">
                <Icon name="calendar" size={18} />
              </div>
              <div className="dash-quick-info">
                <span className="dash-quick-name">Plan a New Trip</span>
                <span className="dash-quick-desc">AI Itinerary & Budget</span>
              </div>
              <Icon name="arrow-right" size={16} className="dash-quick-arrow" />
            </div>

            <div
              className="dash-quick-item"
              onClick={() => navigate('/discover/hotels')}
            >
              <div className="dash-quick-icon-wrap blue">
                <Icon name="bed" size={18} />
              </div>
              <div className="dash-quick-info">
                <span className="dash-quick-name">Find Hotels</span>
                <span className="dash-quick-desc">Verified Stays & Resorts</span>
              </div>
              <Icon name="arrow-right" size={16} className="dash-quick-arrow" />
            </div>

            <div
              className="dash-quick-item"
              onClick={() => navigate('/safety/emergency')}
            >
              <div className="dash-quick-icon-wrap red">
                <Icon name="plus-circle" size={18} />
              </div>
              <div className="dash-quick-info">
                <span className="dash-quick-name">Nearby Hospitals</span>
                <span className="dash-quick-desc">24/7 Medical Assistance</span>
              </div>
              <Icon name="arrow-right" size={16} className="dash-quick-arrow" />
            </div>

            <div
              className="dash-quick-item"
              onClick={() => navigate('/safety/emergency')}
            >
              <div className="dash-quick-icon-wrap indigo">
                <Icon name="shield" size={18} />
              </div>
              <div className="dash-quick-info">
                <span className="dash-quick-name">Local Police</span>
                <span className="dash-quick-desc">Nearest Stations & Booths</span>
              </div>
              <Icon name="arrow-right" size={16} className="dash-quick-arrow" />
            </div>

            <div
              className="dash-quick-item"
              onClick={() => navigate('/smart-travel/translator')}
            >
              <div className="dash-quick-icon-wrap amber">
                <Icon name="message-square" size={18} />
              </div>
              <div className="dash-quick-info">
                <span className="dash-quick-name">Translate</span>
                <span className="dash-quick-desc">Live Voice & Text</span>
              </div>
              <Icon name="arrow-right" size={16} className="dash-quick-arrow" />
            </div>
          </div>
        </div>

        {/* COL 3: RECENT ACTIVITY */}
        <div className="dash-box dash-activity-col">
          <div className="dash-box-header">
            <h2 className="dash-box-title">
              <Icon name="activity" size={18} className="dash-title-icon" /> Recent Activity
            </h2>
          </div>

          {recentActivities.length > 0 ? (
            <div className="dash-activity-list">
              {recentActivities.map((act) => (
                <div key={act.id} className="dash-activity-item">
                  <div className="dash-activity-icon-wrap">
                    <Icon name={act.icon || 'activity'} size={16} />
                  </div>
                  <div className="dash-activity-body">
                    <div className="dash-activity-title">{act.title}</div>
                    <div className="dash-activity-desc">{act.desc}</div>
                  </div>
                  <div className="dash-activity-date">{act.date}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="dash-empty-box">
              <div className="dash-empty-icon-wrap">
                <Icon name="activity" size={28} />
              </div>
              <h4 className="dash-empty-title">No recent activity</h4>
              <p className="dash-empty-msg">Your travel actions and history will appear here</p>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          ROW 5: BOTTOM CTA BANNER
          ========================================================================= */}
      <div className="dash-row-5 dash-bottom-cta-banner">
        <div className="dash-cta-text-wrap">
          <h3 className="dash-cta-quote">"Collect moments, not things."</h3>
          <p className="dash-cta-subtitle">
            Travel safe. Travel smart. Travel with Royal Tours.
          </p>
          <div className="dash-cta-badge-list">
            <span className="dash-cta-badge">Explore</span>
            <span className="dash-cta-sep">•</span>
            <span className="dash-cta-badge">Experience</span>
            <span className="dash-cta-sep">•</span>
            <span className="dash-cta-badge">Stay Safe</span>
          </div>
        </div>

        <button
          type="button"
          className="dash-cta-action-btn"
          onClick={() => navigate('/my-journey/trip?create=true')}
        >
          Plan a New Trip →
        </button>
      </div>
    </div>
  );
}
