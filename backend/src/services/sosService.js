// =============================================================================
// sosService.js — individual + group SOS, status lifecycle, notifications.
// Identity is ALWAYS derived from the authenticated user (JWT), never trusted
// from the client.
// =============================================================================

import prisma from '../config/database.js';
import { badRequest, notFound, forbidden } from '../utils/errors.js';
import { send, buildSOSMessage } from './smsService.js';
import config from '../config/env.js';
import { emitNewSOS, emitSOSUpdate } from '../realtime/sosSocket.js';

const VALID_TYPES = ['MEDICAL', 'POLICE', 'FIRE', 'HOSPITAL'];

export async function createSOS(user, { emergencyType, latitude, longitude, accuracy, locationText, tripId }) {
  const normType = String(emergencyType || '').toUpperCase();
  if (!VALID_TYPES.includes(normType)) throw badRequest('A valid emergency type is required.');

  let lat = latitude != null ? Number(latitude) : null;
  let lon = longitude != null ? Number(longitude) : null;
  if (lat == null || lon == null) {
    const loc = await prisma.currentLocation.findUnique({ where: { userId: user.id } }).catch(() => null);
    lat = loc?.latitude ?? 11.0168;
    lon = loc?.longitude ?? 76.9558;
  }

  let resolvedTripId = tripId;
  if (!resolvedTripId) {
    const userTrip = await prisma.trip.findFirst({
      where: {
        OR: [
          { userId: user.id },
          { members: { some: { userId: user.id } } }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });
    if (userTrip) resolvedTripId = userTrip.id;
  }

  const sos = await prisma.sOSRequest.create({
    data: {
      userId: user.id,
      tripId: resolvedTripId || null,
      emergencyType: normType,
      latitude: lat,
      longitude: lon,
      accuracy: accuracy ? Number(accuracy) : null,
      locationText,
      groupSOS: Boolean(resolvedTripId),
      memberCount: 1,
      status: 'ACTIVE'
    }
  });

  await notifyAdminSOS(user, sos);

  emitNewSOS({ ...sos, user: { name: user.name, phone: user.phone } }, resolvedTripId);

  return sos;
}

export async function createGroupSOS(user, { tripId, emergencyType, latitude, longitude, accuracy, locationText }) {
  const normType = String(emergencyType || '').toUpperCase();
  if (!VALID_TYPES.includes(normType)) throw badRequest('A valid emergency type is required.');

  const trip = await prisma.trip.findUnique({ where: { id: tripId }, include: { members: true } });
  if (!trip) throw notFound('Trip/group not found.');

  const cleanPhone = user?.phone ? user.phone.replace(/\D/g, '').slice(-10) : '';
  const userMembers = trip.members.filter((m) =>
    (m.userId && m.userId === user.id) ||
    (cleanPhone && m.phone && m.phone.replace(/\D/g, '').slice(-10) === cleanPhone)
  );
  const hasLeft = userMembers.some((m) => m.status === 'LEFT');
  if (hasLeft) {
    throw forbidden('You are no longer an active member of this group.');
  }

  const activeMembers = trip.members.filter(
    (m) => !['LEFT', 'INACTIVE', 'REMOVED', 'EXPIRED'].includes(m.status)
  );
  const isMember = activeMembers.some((m) =>
    (m.userId && m.userId === user.id) ||
    (cleanPhone && m.phone && m.phone.replace(/\D/g, '').slice(-10) === cleanPhone)
  );
  const isOwner = trip.userId === user.id && !hasLeft;
  if (!isOwner && !isMember) throw forbidden('You are not an active member of this group.');

  let lat = latitude != null ? Number(latitude) : null;
  let lon = longitude != null ? Number(longitude) : null;
  if (lat == null || lon == null) {
    const loc = await prisma.currentLocation.findUnique({ where: { userId: user.id } }).catch(() => null);
    lat = loc?.latitude ?? trip.latitude ?? 11.0168;
    lon = loc?.longitude ?? trip.longitude ?? 76.9558;
  }

  const sos = await prisma.sOSRequest.create({
    data: {
      userId: user.id,
      tripId,
      emergencyType: normType,
      latitude: lat,
      longitude: lon,
      accuracy: accuracy ? Number(accuracy) : null,
      locationText,
      groupSOS: true,
      memberCount: activeMembers.length,
      status: 'ACTIVE'
    }
  });

  await notifyAdminSOS(user, sos, trip);

  emitNewSOS({ ...sos, user: { name: user.name, phone: user.phone } });

  return { sos, members: activeMembers };
}

async function notifyAdminSOS(user, sos, trip) {
  // Build the SMS and send to active emergency contacts (ADMIN type).
  const message = buildSOSMessage({
    touristName: user.name,
    phone: user.phone,
    emergencyType: sos.emergencyType,
    locationText: sos.locationText,
    latitude: sos.latitude,
    longitude: sos.longitude,
    groupSOS: sos.groupSOS,
    memberCount: sos.memberCount,
    sosId: sos.id
  });

  const contacts = await prisma.emergencyContact.findMany({ where: { active: true, type: 'ADMIN' } });
  const results = [];
  for (const c of contacts) {
    results.push(await send(c.phone, message));
  }

  // Record SMS delivery status on the SOS.
  const allFailed = results.length > 0 && results.every((r) => !r.success);
  const allSent = results.length > 0 && results.every((r) => r.success);
  await prisma.sOSRequest.update({
    where: { id: sos.id },
    data: {
      smsStatus: allFailed ? 'FAILED' : allSent ? 'SENT' : results.length === 0 ? 'FAILED' : 'SENT'
    }
  });

  // Record notifications for the group members (group SOS) — EXCLUDING LEFT/INACTIVE MEMBERS
  if (trip) {
    const activeTripMembers = trip.members.filter(
      (m) => m.userId && m.userId !== user.id && !['LEFT', 'INACTIVE', 'REMOVED', 'EXPIRED'].includes(m.status)
    );
    if (activeTripMembers.length > 0) {
      await prisma.notification.createMany({
        data: activeTripMembers.map((m) => ({
          userId: m.userId,
          type: 'GROUP_SOS',
          channel: 'IN_APP',
          status: 'PENDING',
          content: `Group SOS (${sos.emergencyType}) triggered by ${user.name}.`,
          payload: JSON.stringify({ sosId: sos.id, tripId: sos.tripId, userId: user.id, userName: user.name, latitude: sos.latitude, longitude: sos.longitude })
        }))
      });
    }
  }
}

export async function listActive() {
  return prisma.sOSRequest.findMany({
    where: { status: { in: ['ACTIVE', 'ACKNOWLEDGED', 'ESCALATED'] } },
    include: { user: { select: { id: true, name: true, phone: true } } },
    orderBy: { createdAt: 'desc' }
  });
}

export async function listHistory(userId) {
  return prisma.sOSRequest.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getSOS(id) {
  const sos = await prisma.sOSRequest.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, phone: true } } }
  });
  if (!sos) throw notFound('SOS request not found.');
  return sos;
}

const ADMIN_TRANSITIONS = ['ACKNOWLEDGED', 'ESCALATED', 'RESOLVED'];
const TOURIST_TRANSITIONS = ['CANCELLED'];

export async function transitionSOS(id, status, actor) {
  const sos = await prisma.sOSRequest.findUnique({ where: { id } });
  if (!sos) throw notFound('SOS request not found.');

  const upperStatus = String(status || '').toUpperCase();

  if (ADMIN_TRANSITIONS.includes(upperStatus) && actor.role !== 'ADMIN') {
    throw forbidden('Only an administrator can perform this action.');
  }
  if (TOURIST_TRANSITIONS.includes(upperStatus)) {
    // Tourist may only cancel their own active SOS.
    if (actor.id !== sos.userId) throw forbidden('You can only cancel your own SOS.');
    if (!['ACTIVE', 'ACKNOWLEDGED', 'ESCALATED'].includes(sos.status)) throw badRequest('This SOS cannot be cancelled.');
  }

  const updated = await prisma.sOSRequest.update({ where: { id }, data: { status: upperStatus } });
  emitSOSUpdate(updated);
  return updated;
}

export async function updateSOSLocation(id, { latitude, longitude, accuracy }) {
  return prisma.sOSRequest.update({
    where: { id },
    data: { latitude, longitude, accuracy }
  });
}
