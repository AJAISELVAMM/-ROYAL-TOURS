// =============================================================================
// groupLocationSocket.js — real-time group presence + location sharing.
// =============================================================================

import { isGroupMember, getIO } from './socket.js';
import * as locationService from '../services/locationService.js';
import prisma from '../config/database.js';

export function registerGroupLocationHandlers(io, socket) {
  const user = socket.user;

  socket.on('group:join', async ({ tripId }) => {
    try {
      if (!tripId) return;
      if (!(await isGroupMember(tripId, user.id))) return;
      socket.join(`group:${tripId}`);
      socket.to(`group:${tripId}`).emit('group:member:online', { userId: user.id, name: user.name });

      // Mark member online in DB (best effort).
      await prisma.tripMember.updateMany({
        where: { tripId, userId: user.id },
        data: { online: true, lastSeenAt: new Date() }
      }).catch(() => {});
    } catch {
      // non-fatal
    }
  });

  socket.on('group:leave', async ({ tripId }) => {
    try {
      if (!tripId) return;
      socket.leave(`group:${tripId}`);
      socket.to(`group:${tripId}`).emit('group:member:offline', { userId: user.id, name: user.name });
      await prisma.tripMember.updateMany({
        where: { tripId, userId: user.id },
        data: { online: false, lastSeenAt: new Date() }
      }).catch(() => {});
    } catch {
      // non-fatal
    }
  });

  socket.on('group:location:update', async ({ tripId, latitude, longitude, accuracy }) => {
    try {
      if (!tripId || latitude == null || longitude == null) return;
      if (!(await isGroupMember(tripId, user.id))) return;

      await locationService.updateLocation(tripId, user.id, { latitude, longitude, accuracy }).catch(() => {});

      // Broadcast ONLY to other members of the same group (not the sender).
      socket.to(`group:${tripId}`).emit('group:location:update', {
        userId: user.id,
        name: user.name,
        latitude,
        longitude,
        accuracy,
        timestamp: new Date().toISOString()
      });

      // If this tourist has an ACTIVE SOS, stream the location to admins too.
      const activeSOS = await prisma.sOSRequest.findFirst({
        where: { userId: user.id, status: { in: ['ACTIVE', 'ACKNOWLEDGED', 'ESCALATED'] } }
      }).catch(() => null);

      if (activeSOS) {
        getIO()?.to('admin:safety').emit('admin:sos:location:update', {
          sosId: activeSOS.id,
          userId: user.id,
          latitude,
          longitude,
          accuracy,
          timestamp: new Date().toISOString()
        });
      }
    } catch {
      // non-fatal
    }
  });

  socket.on('group:location:started', async ({ tripId, latitude, longitude }) => {
    try {
      if (!tripId) return;
      socket.to(`group:${tripId}`).emit('group:location:started', {
        userId: user.id,
        name: user.name,
        tripId,
        latitude,
        longitude,
        timestamp: new Date().toISOString()
      });
      socket.to(`group:${tripId}`).emit('group:notification', {
        id: `loc-${user.id}-${Date.now()}`,
        title: 'Live Location Sharing',
        message: `${user.name} started sharing live location.`,
        type: 'LOCATION_SHARE',
        tripId,
        userId: user.id,
        userName: user.name,
        latitude,
        longitude,
        createdAt: new Date().toISOString()
      });
    } catch {
      // non-fatal
    }
  });

  socket.on('group:location:stopped', async ({ tripId }) => {
    try {
      if (!tripId) return;
      await locationService.stopSharing(tripId, user.id).catch(() => {});
      socket.to(`group:${tripId}`).emit('group:location:stopped', { userId: user.id, name: user.name });
      socket.to(`group:${tripId}`).emit('group:notification', {
        id: `loc-stop-${user.id}-${Date.now()}`,
        title: 'Location Sharing Stopped',
        message: `${user.name} stopped sharing live location.`,
        type: 'LOCATION_STOPPED',
        tripId,
        userId: user.id,
        userName: user.name,
        createdAt: new Date().toISOString()
      });
    } catch {
      // non-fatal
    }
  });
}
