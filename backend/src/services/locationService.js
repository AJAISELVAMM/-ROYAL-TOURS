// =============================================================================
// locationService.js — Real-time live GPS persistence & synchronization.
// =============================================================================

import prisma from '../config/database.js';
import { notFound, forbidden } from '../utils/errors.js';
import { getIO } from '../realtime/socket.js';

// In-memory live location store for sub-second socket lookups
const liveLocations = new Map(); // key: userId -> position
const groupLiveLocations = new Map(); // key: `${tripId}:${userId}` -> position

export async function getCurrentLocation(userId) {
  const mem = liveLocations.get(userId);
  if (mem) return mem;

  try {
    const record = await prisma.currentLocation.findUnique({
      where: { userId },
      include: { user: { select: { id: true, name: true, phone: true } } }
    });
    if (record) {
      const pos = {
        userId: record.userId,
        userName: record.user?.name,
        latitude: record.latitude,
        longitude: record.longitude,
        accuracy: record.accuracy,
        heading: record.heading,
        speed: record.speed,
        timestamp: record.timestamp.toISOString()
      };
      liveLocations.set(userId, pos);
      return pos;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[locationService] DB query failed: ${err.message}`);
  }
  return null;
}

export async function saveCurrentLocation(userId, { latitude, longitude, accuracy, heading, speed, timestamp }, userObj = null) {
  const ts = timestamp ? new Date(timestamp) : new Date();

  const pos = {
    userId,
    userName: userObj?.name || 'Tourist',
    latitude,
    longitude,
    accuracy: accuracy || null,
    heading: heading || null,
    speed: speed || null,
    timestamp: ts.toISOString()
  };

  liveLocations.set(userId, pos);

  // 1. Upsert CurrentLocation in PostgreSQL
  try {
    await prisma.currentLocation.upsert({
      where: { userId },
      update: { latitude, longitude, accuracy, heading, speed, timestamp: ts },
      create: { userId, latitude, longitude, accuracy, heading, speed, timestamp: ts }
    });

    // 2. Throttled history insertion (every 30 seconds max to prevent unbounded growth)
    const recent = await prisma.locationHistory.findFirst({
      where: { userId },
      orderBy: { timestamp: 'desc' }
    });

    const shouldRecordHistory = !recent || (ts.getTime() - recent.timestamp.getTime() > 30000);
    if (shouldRecordHistory) {
      await prisma.locationHistory.create({
        data: { userId, latitude, longitude, accuracy, heading, speed, timestamp: ts }
      });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[locationService] Persistence failed: ${err.message}`);
  }

  // 3. Stream to Admin Dashboard & Safety Room over Socket.IO
  const io = getIO();
  if (io) {
    io.to('admin:safety').emit('admin:tourist:location', pos);
    io.to('admin:dashboard').emit('admin:tourist:location', pos);

    // If tourist has active SOS, broadcast SOS location update
    prisma.sOSRequest.findFirst({
      where: { userId, status: { in: ['ACTIVE', 'ACKNOWLEDGED', 'ESCALATED'] } }
    }).then((activeSOS) => {
      if (activeSOS) {
        io.to('admin:safety').emit('admin:sos:location:update', {
          sosId: activeSOS.id,
          userId,
          latitude,
          longitude,
          accuracy,
          timestamp: ts.toISOString()
        });
      }
    }).catch(() => {});
  }

  return pos;
}

export async function getLocationHistory(userId, limit = 50) {
  try {
    const history = await prisma.locationHistory.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: limit
    });
    return history;
  } catch {
    return [];
  }
}

export function getLiveLocationsForTrip(tripId) {
  const out = [];
  for (const [key, pos] of groupLiveLocations.entries()) {
    if (key.startsWith(`${tripId}:`)) {
      out.push({ userId: key.slice(tripId.length + 1), ...pos });
    }
  }
  return out;
}

export async function startSharing(tripId, userId, { latitude, longitude, accuracy }) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, include: { members: true } });
  if (!trip) throw notFound('Trip/group not found.');

  const cleanPhone = (await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } }))?.phone?.replace(/\D/g, '').slice(-10) || '';

  const member = trip.members.find(
    (m) => (m.userId === userId) || (cleanPhone && m.phone && m.phone.replace(/\D/g, '').slice(-10) === cleanPhone)
  );
  const isOwner = trip.userId === userId;

  // A left member or non-member cannot share location
  if (member && ['LEFT', 'INACTIVE', 'REMOVED', 'EXPIRED'].includes(member.status)) {
    throw forbidden('You are no longer an active member of this group.');
  }
  if (!isOwner && !member) {
    throw forbidden('You are not a member of this group.');
  }
  if (member && !['ACCEPTED', 'ACTIVE'].includes(member.status)) {
    throw forbidden('You are not an active member of this group.');
  }

  groupLiveLocations.set(`${tripId}:${userId}`, {
    latitude,
    longitude,
    accuracy: accuracy || null,
    updatedAt: new Date().toISOString()
  });

  try {
    await prisma.locationShare.upsert({
      where: { id: `${tripId}:${userId}` },
      update: { latitude, longitude, accuracy, active: true, startedAt: new Date() },
      create: { id: `${tripId}:${userId}`, userId, tripId, latitude, longitude, accuracy, active: true }
    });
  } catch {}

  return { success: true, sharing: true };
}

export async function updateLocation(tripId, userId, { latitude, longitude, accuracy }) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, include: { members: true } });
  if (!trip) return null;
  const isOwner = trip.userId === userId;
  const member = trip.members.find((m) => m.userId === userId);
  if (!isOwner && !member) return null;

  const pos = { latitude, longitude, accuracy: accuracy || null, updatedAt: new Date().toISOString() };
  groupLiveLocations.set(`${tripId}:${userId}`, pos);

  try {
    await prisma.locationShare.updateMany({
      where: { tripId, userId, active: true },
      data: { latitude, longitude, accuracy }
    });
  } catch {}

  return pos;
}

export async function stopSharing(tripId, userId) {
  groupLiveLocations.delete(`${tripId}:${userId}`);
  try {
    await prisma.locationShare.updateMany({
      where: { tripId, userId, active: true },
      data: { active: false, stoppedAt: new Date() }
    });
  } catch {}
  return { success: true, sharing: false };
}

export async function isSharing(tripId, userId) {
  return groupLiveLocations.has(`${tripId}:${userId}`);
}
