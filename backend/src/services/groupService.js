// =============================================================================
// groupService.js — travel group membership + call initiation.
// =============================================================================

import prisma from '../config/database.js';
import { notFound, forbidden, badRequest } from '../utils/errors.js';
import { send } from './smsService.js';
import { isTripExpired, checkAndExpireTrips, generateJoinCode, listTrips } from './tripService.js';
import { formatDateInIST } from '../utils/timeZone.js';
import * as locationService from './locationService.js';

export function formatGroupCode(tripId) {
  if (!tripId) return '';
  return `TG-${tripId.slice(-6).toUpperCase()}`;
}

const GROUP_LIMITS = {
  Solo: 1,
  Couple: 2,
  Family: 10,
  Friends: 10
};

export async function findTripByCode(code) {
  if (!code || typeof code !== 'string') return null;
  const raw = code.trim();
  const normalized = raw.toUpperCase().replace(/^TG-/, '').trim();

  // 1. Try exact joinCode (case-insensitive)
  let trip = await prisma.trip.findFirst({
    where: {
      OR: [
        { joinCode: { equals: raw, mode: 'insensitive' } },
        { joinCode: { equals: normalized, mode: 'insensitive' } }
      ]
    },
    include: {
      members: true,
      places: { include: { place: true } },
      itinerary: { orderBy: { day: 'asc' }, include: { activities: { orderBy: { time: 'asc' } } } },
      packing: { orderBy: { day: 'asc' }, include: { items: true } },
      budgetBreakdown: true
    }
  });

  // 2. Try exact ID
  if (!trip) {
    trip = await prisma.trip.findUnique({
      where: { id: raw },
      include: {
        members: true,
        places: { include: { place: true } },
        itinerary: { orderBy: { day: 'asc' }, include: { activities: { orderBy: { time: 'asc' } } } },
        packing: { orderBy: { day: 'asc' }, include: { items: true } },
        budgetBreakdown: true
      }
    });
  }

  // 3. Try ID suffix match fallback
  if (!trip && normalized.length >= 4) {
    const candidateTrips = await prisma.trip.findMany({
      where: {
        id: {
          endsWith: normalized.toLowerCase()
        }
      },
      include: {
        members: true,
        places: { include: { place: true } },
        itinerary: { orderBy: { day: 'asc' }, include: { activities: { orderBy: { time: 'asc' } } } },
        packing: { orderBy: { day: 'asc' }, include: { items: true } },
        budgetBreakdown: true
      },
      take: 1
    });
    if (candidateTrips.length > 0) {
      trip = candidateTrips[0];
    }
  }

  return trip;
}

export async function joinGroupByCode(user, code) {
  if (!code || !code.trim()) {
    throw badRequest('Invalid group code.');
  }

  const trip = await findTripByCode(code);
  if (!trip) {
    throw notFound('Invalid group code.');
  }

  if (isTripExpired(trip)) {
    throw badRequest('This travel group is no longer active.');
  }

  const userCleanPhone = user.phone ? user.phone.replace(/\D/g, '').slice(-10) : '';
  const isOwner = trip.userId === user.id;

  // Check if already an active accepted member
  const existingActiveMember = trip.members.find(
    (m) =>
      m.status === 'ACCEPTED' &&
      (m.userId === user.id || (userCleanPhone && m.phone && m.phone.replace(/\D/g, '').slice(-10) === userCleanPhone))
  );

  // If caller is owner or already an accepted member, DO NOT treat as error:
  // resolve and return the existing group immediately.
  if (isOwner || existingActiveMember) {
    if (isOwner && !existingActiveMember) {
      const existingOwnerRecord = trip.members.find(
        (m) =>
          m.userId === user.id ||
          (userCleanPhone && m.phone && m.phone.replace(/\D/g, '').slice(-10) === userCleanPhone)
      );
      if (existingOwnerRecord) {
        await prisma.tripMember.update({
          where: { id: existingOwnerRecord.id },
          data: {
            userId: user.id,
            status: 'ACCEPTED',
            role: 'Owner',
            online: true,
            lastSeenAt: new Date()
          }
        });
      } else {
        await prisma.tripMember.create({
          data: {
            tripId: trip.id,
            userId: user.id,
            name: user.name || 'Organizer',
            phone: user.phone || '—',
            role: 'Owner',
            status: 'ACCEPTED',
            online: true,
            lastSeenAt: new Date()
          }
        });
      }
    }

    const resolved = await prisma.trip.findUnique({
      where: { id: trip.id },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, phone: true, avatarUrl: true } } },
          orderBy: { createdAt: 'asc' }
        },
        places: { include: { place: true } },
        itinerary: { orderBy: { day: 'asc' }, include: { activities: { orderBy: { time: 'asc' } } } },
        packing: { orderBy: { day: 'asc' }, include: { items: true } },
        budgetBreakdown: true
      }
    });

    return {
      ...resolved,
      name: resolved.destination,
      tripName: resolved.destination,
      joinCode: resolved.joinCode,
      groupCode: resolved.joinCode || formatGroupCode(resolved.id),
      alreadyMember: true
    };
  }

  // Enforce existing group / member limits (allow joining up to 10 members via valid code)
  const maxLimit = Math.max(10, GROUP_LIMITS[trip.groupType] || 10);
  const currentActiveMembers = trip.members.filter((m) => m.status === 'ACCEPTED');
  if (currentActiveMembers.length >= maxLimit) {
    throw badRequest('This travel group is already full.');
  }

  // Check if user previously left and is re-joining, OR has an unassigned slot
  const previouslyLeftMember = trip.members.find(
    (m) =>
      m.status === 'LEFT' &&
      (m.userId === user.id || (userCleanPhone && m.phone && m.phone.replace(/\D/g, '').slice(-10) === userCleanPhone))
  );

  const unassignedSlot = !previouslyLeftMember && trip.members.find(
    (m) => !m.userId && userCleanPhone && m.phone && m.phone.replace(/\D/g, '').slice(-10) === userCleanPhone
  );

  let memberRecord;
  if (previouslyLeftMember) {
    memberRecord = await prisma.tripMember.update({
      where: { id: previouslyLeftMember.id },
      data: {
        userId: user.id,
        name: user.name || previouslyLeftMember.name,
        phone: user.phone || previouslyLeftMember.phone,
        status: 'ACCEPTED',
        online: true,
        lastSeenAt: new Date()
      }
    });
  } else if (unassignedSlot) {
    memberRecord = await prisma.tripMember.update({
      where: { id: unassignedSlot.id },
      data: {
        userId: user.id,
        name: user.name || unassignedSlot.name,
        phone: user.phone || unassignedSlot.phone,
        status: 'ACCEPTED',
        online: true,
        lastSeenAt: new Date()
      }
    });
  } else {
    // Add user as new TripMember
    memberRecord = await prisma.tripMember.create({
      data: {
        tripId: trip.id,
        userId: user.id,
        name: user.name || 'Member',
        phone: user.phone || '—',
        role: 'Member',
        status: 'ACCEPTED',
        online: true,
        lastSeenAt: new Date()
      }
    });
  }

  // Recalculate member count from database
  const activeCount = await prisma.tripMember.count({
    where: {
      tripId: trip.id,
      status: 'ACCEPTED'
    }
  });

  await prisma.trip.update({
    where: { id: trip.id },
    data: { memberCount: activeCount }
  });

  // Notify other members
  const notifyUserIds = trip.members
    .filter((m) => m.userId && m.userId !== user.id && m.status === 'ACCEPTED')
    .map((m) => m.userId);
  if (trip.userId && trip.userId !== user.id && !notifyUserIds.includes(trip.userId)) {
    notifyUserIds.push(trip.userId);
  }

  if (notifyUserIds.length > 0) {
    await prisma.notification.createMany({
      data: notifyUserIds.map((uId) => ({
        userId: uId,
        type: 'TRIP_UPDATE',
        channel: 'IN_APP',
        status: 'PENDING',
        content: `${user.name || 'A new member'} joined your travel group (${trip.destination}).`
      }))
    }).catch(() => {});
  }

  // Broadcast real-time Socket.IO event to group room and personal rooms
  try {
    const { getIO } = await import('../realtime/socket.js');
    const io = getIO();
    if (io) {
      io.to(`group:${trip.id}`).emit('group:member:joined', {
        tripId: trip.id,
        member: memberRecord,
        userId: user.id,
        name: user.name,
        phone: user.phone
      });
      io.to(`group:${trip.id}`).emit('group:refresh', {
        tripId: trip.id,
        reason: 'member_joined',
        userId: user.id
      });
      notifyUserIds.forEach((uid) => {
        io.to(`user:${uid}`).emit('group:notification', {
          id: `notif-${Date.now()}`,
          tripId: trip.id,
          title: 'New Member Joined',
          message: `${user.name || 'A new member'} joined your travel group (${trip.destination}).`,
          type: 'member_joined',
          timestamp: new Date().toISOString()
        });
      });
    }
  } catch {
    // non-fatal socket broadcast
  }

  const updated = await prisma.trip.findUnique({
    where: { id: trip.id },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, phone: true, avatarUrl: true } } },
        orderBy: { createdAt: 'asc' }
      },
      places: { include: { place: true } },
      itinerary: { orderBy: { day: 'asc' }, include: { activities: { orderBy: { time: 'asc' } } } },
      packing: { orderBy: { day: 'asc' }, include: { items: true } },
      budgetBreakdown: true
    }
  });

  return {
    ...updated,
    joinCode: updated.joinCode,
    groupCode: updated.joinCode || formatGroupCode(trip.id),
    alreadyMember: false
  };
}

export async function getGroup(tripId, userId) {
  await checkAndExpireTrips();
  let trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      members: {
        where: {
          status: {
            notIn: ['LEFT', 'INACTIVE', 'REMOVED', 'EXPIRED']
          }
        },
        include: { user: { select: { id: true, name: true, phone: true, avatarUrl: true } } },
        orderBy: { createdAt: 'asc' }
      }
    }
  });
  if (!trip) {
    trip = await findTripByCode(tripId);
  }
  if (!trip) throw notFound('Trip/group not found.');

  // Only the owner or an active member may view the group.
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const cleanPhone = user?.phone ? user.phone.replace(/\D/g, '').slice(-10) : '';

  const isOwner = trip.userId === userId;

  // Check if current user was explicitly marked LEFT in DB for this trip
  const leftRecord = await prisma.tripMember.findFirst({
    where: {
      tripId: trip.id,
      status: 'LEFT',
      OR: [
        { userId },
        ...(cleanPhone ? [{ phone: { contains: cleanPhone } }] : [])
      ]
    }
  });
  if (leftRecord && !isOwner) {
    throw forbidden("You are no longer a member of this group.");
  }

  const myRecords = trip.members.filter((m) =>
    (m.userId && m.userId === userId) ||
    (cleanPhone && m.phone && m.phone.replace(/\D/g, '').slice(-10) === cleanPhone)
  );

  if (!isOwner && myRecords.length === 0) {
    throw forbidden('You are not a member of this group.');
  }

  const expired = isTripExpired(trip);
  return { ...trip, joinCode: trip.joinCode, groupCode: trip.joinCode || formatGroupCode(trip.id), isExpired: expired, active: !expired };
}

export async function getMembers(tripId, userId) {
  await checkAndExpireTrips();
  let trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { id: true, userId: true, status: true, startDate: true, endDate: true }
  });
  if (!trip) {
    trip = await findTripByCode(tripId);
  }
  if (!trip) throw notFound('Trip/group not found.');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const cleanPhone = user?.phone ? user.phone.replace(/\D/g, '').slice(-10) : '';

  const callerMember = await prisma.tripMember.findFirst({
    where: {
      tripId: trip.id,
      OR: [
        { userId },
        ...(cleanPhone ? [{ phone: { contains: cleanPhone } }] : [])
      ]
    }
  });

  const isOwner = trip.userId === userId;
  if (!isOwner && (!callerMember || ['LEFT', 'INACTIVE', 'REMOVED', 'EXPIRED'].includes(callerMember.status))) {
    throw forbidden('You are no longer an active member of this group.');
  }

  // Active query directly from PostgreSQL:
  // Must NOT return members whose membership is LEFT, INACTIVE, REMOVED, EXPIRED
  const activeMembers = await prisma.tripMember.findMany({
    where: {
      tripId: trip.id,
      status: {
        notIn: ['LEFT', 'INACTIVE', 'REMOVED', 'EXPIRED']
      }
    },
    include: {
      user: {
        select: { id: true, name: true, phone: true, avatarUrl: true }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  const liveLocations = locationService.getLiveLocationsForTrip(trip.id);
  const liveMap = new Map(liveLocations.map((l) => [l.userId, l]));

  return activeMembers.map((m) => {
    const memberUserId = m.userId || m.user?.id || null;
    const loc = memberUserId ? liveMap.get(memberUserId) : null;
    return {
      id: m.id,
      userId: memberUserId,
      name: m.user?.name || m.name,
      phone: m.user?.phone || m.phone,
      avatarUrl: m.user?.avatarUrl || null,
      role: m.role,
      status: m.online ? 'online' : 'offline',
      memberStatus: m.status,
      isLive: Boolean(loc),
      latitude: loc?.latitude ?? null,
      longitude: loc?.longitude ?? null,
      lastSeen: loc ? 'Live' : (m.online ? 'Online' : 'Offline')
    };
  });
}

export async function initiateCall(tripId, userId, memberId) {
  const trip = await getGroup(tripId, userId);

  const member = trip.members.find((m) => m.id === memberId || m.userId === memberId);
  if (!member) throw notFound('Member not found.');
  if (member.userId === userId) throw forbidden('You cannot call yourself.');

  // Sanitized phone for tel: action — never expose arbitrary injected numbers.
  const phone = member.phone;
  const caller = await prisma.user.findUnique({ where: { id: userId } });

  return {
    success: true,
    call: {
      id: memberId,
      caller: caller ? { id: caller.id, name: caller.name } : { name: 'You' },
      receiver: { id: member.id, name: member.name },
      phone,
      mode: 'tel',
      status: 'INITIATED',
      timestamp: new Date().toISOString()
    }
  };
}

// Notify a member by SMS that a group call was attempted (optional, best effort).
export async function notifyCallAttempt(receiverPhone, callerName) {
  return send(receiverPhone, `ROYAL TOURS: ${callerName} is trying to reach you via your travel group.`);
}

export async function leaveGroup(tripId, userId) {
  let trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { members: true }
  });
  if (!trip) {
    trip = await findTripByCode(tripId);
  }
  if (!trip) throw notFound('Travel group not found.');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const cleanPhone = user?.phone ? user.phone.replace(/\D/g, '').slice(-10) : '';

  // Find all membership records matching the user or phone
  const userMembers = trip.members.filter((m) =>
    (m.userId && m.userId === userId) ||
    (cleanPhone && m.phone && m.phone.replace(/\D/g, '').slice(-10) === cleanPhone)
  );

  const isOwner = trip.userId === userId;

  if (userMembers.length === 0 && !isOwner) {
    throw badRequest("You are no longer a member of this group.");
  }

  if (userMembers.length > 0 && userMembers.every((m) => m.status === 'LEFT')) {
    throw badRequest("You are no longer a member of this group.");
  }

  // Deactivate ALL matching membership records for this user/phone
  const memberOrConditions = [
    { userId },
    ...(cleanPhone ? [{ phone: { contains: cleanPhone } }] : []),
    ...(isOwner ? [{ role: 'Owner' }] : [])
  ];
  if (userMembers.length > 0) {
    memberOrConditions.push({ id: { in: userMembers.map((m) => m.id) } });
  }
  if (user?.name) {
    memberOrConditions.push({ name: user.name });
  }

  await prisma.tripMember.updateMany({
    where: {
      tripId: trip.id,
      OR: memberOrConditions
    },
    data: {
      status: 'LEFT',
      online: false
    }
  });

  if (isOwner && userMembers.length === 0) {
    await prisma.tripMember.create({
      data: {
        tripId: trip.id,
        userId: userId,
        name: user?.name || 'Owner',
        phone: user?.phone || '—',
        role: 'Owner',
        status: 'LEFT',
        online: false
      }
    }).catch(() => {});
  }

  // Stop live location sharing immediately for this user in this group
  await locationService.stopSharing(trip.id, userId).catch(() => {});

  // Update trip member count
  const remainingCount = await prisma.tripMember.count({
    where: {
      tripId: trip.id,
      status: 'ACCEPTED'
    }
  });
  await prisma.trip.update({
    where: { id: trip.id },
    data: { memberCount: Math.max(0, remainingCount) }
  });

  const member = userMembers[0] || null;

  // Real-time broadcast to group room AND individual user rooms via Socket.IO
  try {
    const { getIO } = await import('../realtime/socket.js');
    const io = getIO();
    if (io) {
      // Find remaining active members
      const activeMembers = await prisma.tripMember.findMany({
        where: {
          tripId: trip.id,
          status: { notIn: ['LEFT', 'INACTIVE', 'REMOVED', 'EXPIRED'] }
        },
        select: { userId: true, id: true }
      });

      const memberIdsToNotify = new Set(activeMembers.map((m) => m.userId).filter(Boolean));
      if (trip.userId && trip.userId !== userId) {
        memberIdsToNotify.add(trip.userId);
      }

      const leavePayload = {
        tripId: trip.id,
        userId: user?.id || userId,
        cleanPhone,
        memberId: member?.id,
        name: user?.name || member?.name || 'A member'
      };

      // 1. Broadcast to group room
      io.to(`group:${trip.id}`).emit('group:member:left', leavePayload);
      io.to(`group:${trip.id}`).emit('group:location:stopped', {
        tripId: trip.id,
        userId: user?.id || userId
      });
      io.to(`group:${trip.id}`).emit('group:refresh', {
        tripId: trip.id,
        reason: 'member_left',
        userId: user?.id || userId
      });

      // 2. Broadcast directly to each remaining active member's personal room
      // This guarantees members on Dashboard, My Journey, or other tabs receive it instantly
      memberIdsToNotify.forEach((uid) => {
        io.to(`user:${uid}`).emit('group:member:left', leavePayload);
        io.to(`user:${uid}`).emit('group:location:stopped', {
          tripId: trip.id,
          userId: user?.id || userId
        });
        io.to(`user:${uid}`).emit('group:refresh', {
          tripId: trip.id,
          reason: 'member_left',
          userId: user?.id || userId
        });
        io.to(`user:${uid}`).emit('group:notification', {
          id: `notif-${Date.now()}`,
          tripId: trip.id,
          title: 'Member Left',
          message: `${user?.name || member?.name || 'A member'} left the travel group.`,
          type: 'member_left',
          timestamp: new Date().toISOString()
        });
      });

      // 3. Emit directly to the user who left to instantly clear active group UI
      io.to(`user:${userId}`).emit('user:group:left', { tripId: trip.id });

      // 4. Remove leaving user's sockets from the group room
      const leavingSockets = await io.in(`user:${userId}`).fetchSockets().catch(() => []);
      leavingSockets.forEach((s) => s.leave(`group:${trip.id}`));
    }
  } catch {
    // non-fatal socket broadcast
  }

  return {
    success: true,
    tripId: trip.id,
    message: 'Successfully left the travel group.'
  };
}

export async function createGroup(user, input) {
  const groupName = (input.name || input.destination || '').trim();
  if (!groupName) {
    throw badRequest('Group name is required.');
  }

  const destination = (input.destination || groupName).trim();

  // Determine dates
  let startDate = input.startDate ? new Date(input.startDate) : new Date();
  if (isNaN(startDate.getTime())) startDate = new Date();

  let endDate = input.endDate ? new Date(input.endDate) : new Date(startDate.getTime() + 2 * 24 * 60 * 60 * 1000);
  if (isNaN(endDate.getTime())) endDate = new Date(startDate.getTime() + 2 * 24 * 60 * 60 * 1000);

  const durationDays = input.durationDays || Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))) || 2;
  const duration = input.duration || `${durationDays} Days`;
  const formattedDates = input.dates || `${formatDateInIST(startDate)} to ${formatDateInIST(endDate)}`;

  // Generate a unique join code server-side
  let joinCode = '';
  let attempts = 0;
  while (!joinCode && attempts < 30) {
    const candidate = generateJoinCode(destination);
    const existing = await prisma.trip.findUnique({ where: { joinCode: candidate } });
    if (!existing) {
      joinCode = candidate;
    }
    attempts++;
  }
  if (!joinCode) {
    joinCode = `ROYAL${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  }

  const trip = await prisma.$transaction(async (tx) => {
    const t = await tx.trip.create({
      data: {
        userId: user.id,
        destination,
        startDate,
        endDate,
        dates: formattedDates,
        duration,
        durationDays,
        groupType: input.groupType || 'Friends',
        memberCount: 1,
        budget: Number(input.budget) || 0,
        status: 'active',
        joinCode
      }
    });

    await tx.tripMember.create({
      data: {
        tripId: t.id,
        userId: user.id,
        name: user.name || 'Organizer',
        phone: user.phone || '—',
        role: 'Owner',
        status: 'ACCEPTED',
        online: true,
        lastSeenAt: new Date()
      }
    });

    return t;
  });

  const created = await prisma.trip.findUnique({
    where: { id: trip.id },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, phone: true, avatarUrl: true } } }
      }
    }
  });

  return {
    ...created,
    name: created.destination,
    tripName: created.destination,
    joinCode: created.joinCode,
    groupCode: created.joinCode || formatGroupCode(created.id),
    active: true
  };
}

export async function listActiveGroups(userId) {
  await checkAndExpireTrips();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const cleanPhone = user?.phone ? user.phone.replace(/\D/g, '').slice(-10) : '';
  const allTrips = await listTrips(userId);

  // Filter only active trips/groups
  const activeTrips = allTrips.filter((t) => {
    if (t.userHasLeft) return false;
    if (t.status !== 'active' || isTripExpired(t)) return false;
    const activeMember = t.members?.some(
      (m) =>
        m.status === 'ACCEPTED' &&
        (m.userId === userId || m.id === userId || (cleanPhone && m.phone && m.phone.replace(/\D/g, '').slice(-10) === cleanPhone))
    );
    const isOwner = t.userId === userId;
    return isOwner || activeMember;
  });

  return activeTrips.map((t) => ({
    id: t.id,
    tripId: t.id,
    name: t.destination,
    tripName: t.destination,
    destination: t.destination,
    destinationAddress: t.destinationAddress,
    dates: t.dates,
    startDate: t.startDate,
    endDate: t.endDate,
    duration: t.duration,
    durationDays: t.durationDays,
    groupType: t.groupType,
    memberCount: t.members?.filter((m) => m.status === 'ACCEPTED').length || t.memberCount || 1,
    joinCode: t.joinCode || formatGroupCode(t.id),
    groupCode: t.joinCode || formatGroupCode(t.id),
    members: t.members || []
  }));
}

