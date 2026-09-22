// ============================================================================
// socket.js — Socket.IO client for ROYAL TOURS realtime events.
// Connects with JWT auth; provides group room helpers, reconnection, and listeners.
// ============================================================================

import { io } from 'socket.io-client';
import { getAccessToken } from './api.js';

let socket = null;

function getSocketUrl() {
  if (typeof window === 'undefined') return '/';
  const customSocketUrl = import.meta.env?.VITE_SOCKET_URL?.trim();
  if (customSocketUrl) return customSocketUrl;
  const envApiUrl = import.meta.env?.VITE_API_URL?.trim();
  if (envApiUrl) {
    return envApiUrl.replace(/\/api\/?$/, '');
  }
  return '/';
}

export function connectSocket() {
  const token = getAccessToken();
  if (!token) return null;

  if (socket) {
    if (socket.connected) return socket;
    socket.auth = { token };
    return socket;
  }

  const socketUrl = getSocketUrl();
  socket = io(socketUrl, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 15,
    reconnectionDelay: 1000,
    timeout: 10000
  });

  socket.on('connect', () => {
    // Connected to server
  });

  socket.on('connect_error', (err) => {
    // Safe non-blocking connection error handling
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    try {
      socket.disconnect();
    } catch {
      // ignore
    }
    socket = null;
  }
}

export function getSocket() {
  return socket;
}

// Join a group room (call once when a group trip is being viewed).
export function joinGroup(tripId) {
  const s = connectSocket();
  if (s && tripId) {
    if (s.connected) {
      s.emit('group:join', { tripId });
    } else {
      s.once('connect', () => {
        s.emit('group:join', { tripId });
      });
    }
  }
  return s;
}

export function leaveGroup(tripId) {
  if (socket && tripId && socket.connected) {
    socket.emit('group:leave', { tripId });
  }
}

// Share the caller's location with the rest of the group (explicit consent).
export function startGroupLocation(tripId, { latitude, longitude }) {
  const s = connectSocket();
  if (s && tripId) {
    s.emit('group:location:started', { tripId, latitude, longitude });
  }
}

export function shareGroupLocation(tripId, { latitude, longitude, accuracy }) {
  const s = connectSocket();
  if (s && tripId && latitude != null && longitude != null) {
    s.emit('group:location:update', { tripId, latitude, longitude, accuracy });
  }
}

export function stopGroupLocation(tripId) {
  if (socket && tripId && socket.connected) {
    socket.emit('group:location:stopped', { tripId });
  }
}

// Realtime event subscriber with automatic cleanup
export function onSocketEvent(event, handler) {
  const s = connectSocket();
  if (!s) return () => {};
  s.on(event, handler);
  return () => {
    try {
      s.off(event, handler);
    } catch {
      // ignore
    }
  };
}

