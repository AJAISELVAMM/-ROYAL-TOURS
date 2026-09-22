import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useLiveLocation } from '../hooks/useLiveLocation.js';
import { useAuth } from './AuthContext.jsx';
import { getSocket } from '../services/socket.js';
import { distanceMeters } from '../utils/geoUtils.js';
import { api } from '../services/api.js';

const LocationContext = createContext(null);

export function LocationProvider({ children }) {
  const live = useLiveLocation({
    enableHighAccuracy: true,
    maximumAge: 5000,
    timeout: 10000,
    autoStart: true
  });

  const auth = useAuth();
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [discoverLocation, setDiscoverLocation] = useState(null);
  const lastSyncRef = useRef({ lat: null, lon: null, time: 0 });

  // Throttle backend & socket update: sync if moved > 5m or > 5 seconds have passed
  const syncWithBackend = useCallback(async (lat, lon, accuracy, heading, speed, timestamp) => {
    if (!auth?.isAuthenticated || !auth?.user?.id || !lat || !lon) return;

    const now = Date.now();
    const last = lastSyncRef.current;
    const movedMeters = last.lat && last.lon ? distanceMeters(last.lat, last.lon, lat, lon) : Infinity;
    const elapsed = now - last.time;

    if (movedMeters < 5 && elapsed < 5000) {
      return; // Throttled
    }

    lastSyncRef.current = { lat, lon, time: now };

    const payload = {
      latitude: lat,
      longitude: lon,
      accuracy: accuracy || null,
      heading: heading || null,
      speed: speed || null,
      timestamp: timestamp || new Date().toISOString()
    };

    // 1. Send via HTTP API
    try {
      await api.post('/location/update', payload);
    } catch {
      // Best effort sync
    }

    // 2. Stream via Socket.IO
    try {
      const socket = getSocket();
      if (socket && socket.connected) {
        socket.emit('location:update', payload);
      }
    } catch {
      // Socket not ready yet
    }
  }, [auth?.isAuthenticated, auth?.user?.id]);

  useEffect(() => {
    if (live.latitude != null && live.longitude != null) {
      syncWithBackend(
        live.latitude,
        live.longitude,
        live.accuracy,
        live.heading,
        live.speed,
        live.timestamp
      );
    }
  }, [live.latitude, live.longitude, live.accuracy, live.heading, live.speed, live.timestamp, syncWithBackend]);

  const value = {
    // Current live device position (Single Source of Truth)
    currentLocation: {
      latitude: live.latitude,
      longitude: live.longitude,
      accuracy: live.accuracy,
      altitude: live.altitude,
      heading: live.heading,
      speed: live.speed,
      timestamp: live.timestamp
    },
    // Selected destination/place (kept separate from currentLocation)
    selectedLocation,
    setSelectedLocation,
    // Discover center location (defaults to live GPS when null)
    discoverLocation,
    setDiscoverLocation,
    // Status & controls
    loading: live.loading,
    error: live.error,
    permissionStatus: live.permissionStatus,
    isTracking: live.isTracking,
    startTracking: live.startTracking,
    stopTracking: live.stopTracking
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return ctx;
}

export default LocationContext;
