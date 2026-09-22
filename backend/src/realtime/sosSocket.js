// =============================================================================
// sosSocket.js — broadcasts SOS events to the admin safety room.
// =============================================================================

import { getIO } from './socket.js';

export function emitNewSOS(sos, tripId = null) {
  const io = getIO();
  if (!io) return;

  const payload = {
    id: sos.id,
    tripId: sos.tripId || tripId,
    touristName: sos.user?.name || sos.touristName || 'Group Member',
    userName: sos.user?.name || sos.touristName || 'Group Member',
    phone: sos.user?.phone || sos.phone,
    emergencyType: sos.emergencyType,
    groupSOS: sos.groupSOS,
    memberCount: sos.memberCount,
    latitude: sos.latitude,
    longitude: sos.longitude,
    accuracy: sos.accuracy,
    locationText: sos.locationText,
    timestamp: sos.createdAt || new Date().toISOString(),
    status: sos.status,
    smsStatus: sos.smsStatus
  };

  // Broadcast to Admin command center
  io.to('admin:safety').emit('admin:sos:new', payload);
  io.to('admin:dashboard').emit('admin:dashboard:update', { type: 'sos' });

  // Broadcast to Group Room if part of a group trip
  const targetTripId = sos.tripId || tripId;
  if (targetTripId) {
    io.to(`group:${targetTripId}`).emit('group:sos:alert', payload);
    io.to(`group:${targetTripId}`).emit('group:notification', {
      id: `sos-${sos.id}`,
      tripId: targetTripId,
      title: '🚨 EMERGENCY SOS ALERT',
      message: `Emergency SOS (${sos.emergencyType}) triggered by ${payload.touristName}!`,
      type: 'sos_alert',
      sosId: sos.id,
      timestamp: new Date().toISOString()
    });
  }
}

export function emitSOSUpdate(sos) {
  const io = getIO();
  io?.to('admin:safety').emit('admin:sos:update', {
    id: sos.id,
    status: sos.status
  });
  io?.to('admin:dashboard').emit('admin:dashboard:update', { type: 'sos' });
  if (sos.tripId) {
    io?.to(`group:${sos.tripId}`).emit('group:sos:update', { sosId: sos.id, status: sos.status });
  }
}

export function emitSOSLocation(sosId, userId, { latitude, longitude, accuracy }) {
  getIO()?.to('admin:safety').emit('admin:sos:location:update', {
    sosId,
    userId,
    latitude,
    longitude,
    accuracy,
    timestamp: new Date().toISOString()
  });
}
