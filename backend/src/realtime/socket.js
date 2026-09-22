// =============================================================================
// socket.js — Socket.IO bootstrap: JWT auth, rooms, connection lifecycle.
// =============================================================================

import { Server } from 'socket.io';
import config from '../config/env.js';
import { authenticateSocket } from '../middleware/authMiddleware.js';
import prisma from '../config/database.js';
import logger from '../utils/logger.js';
import { registerGroupLocationHandlers } from './groupLocationSocket.js';
import * as locationService from '../services/locationService.js';

let io = null;

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => callback(null, true),
      credentials: true
    }
  });

  io.use(authenticateSocket);

  io.on('connection', async (socket) => {
    const user = socket.user;
    socket.join(`user:${user.id}`);
    logger.info('Socket connected', { userId: user.id, role: user.role });

    // Admins join the safety + dashboard rooms automatically.
    if (user.role === 'ADMIN') {
      socket.join('admin:safety');
      socket.join('admin:dashboard');
    }

    // Automatically join active trip rooms so real-time updates are received across all pages/dashboards
    try {
      const cleanPhone = user.phone ? user.phone.replace(/\D/g, '').slice(-10) : '';
      const userTrips = await prisma.trip.findMany({
        where: {
          status: 'active',
          OR: [
            { userId: user.id },
            {
              members: {
                some: {
                  status: 'ACCEPTED',
                  OR: [
                    { userId: user.id },
                    ...(cleanPhone ? [{ phone: { contains: cleanPhone } }] : [])
                  ]
                }
              }
            }
          ]
        },
        select: { id: true }
      });
      userTrips.forEach((t) => socket.join(`group:${t.id}`));
    } catch {}

    // Direct live location update event from tourist
    socket.on('location:update', async (data) => {
      if (!data || data.latitude == null || data.longitude == null) return;
      try {
        await locationService.saveCurrentLocation(user.id, data, user);
      } catch (err) {
        logger.warn('Error handling socket location:update', { error: err.message });
      }
    });

    // Group room join/leave + real-time location.
    registerGroupLocationHandlers(io, socket);

    socket.on('disconnect', () => {
      logger.info('Socket disconnected', { userId: user.id });
    });
  });

  return io;
}

export function getIO() {
  return io;
}

export async function isGroupMember(tripId, userId) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const cleanPhone = user?.phone ? user.phone.replace(/\D/g, '').slice(-10) : '';

    const leftMember = await prisma.tripMember.findFirst({
      where: {
        tripId,
        status: 'LEFT',
        OR: [
          { userId },
          ...(cleanPhone ? [{ phone: { contains: cleanPhone } }] : [])
        ]
      }
    });
    if (leftMember) return false;

    const member = await prisma.tripMember.findFirst({
      where: {
        tripId,
        status: { notIn: ['LEFT', 'INACTIVE', 'REMOVED', 'EXPIRED'] },
        OR: [
          { userId },
          ...(cleanPhone ? [{ phone: { contains: cleanPhone } }] : [])
        ]
      }
    });
    if (member) return true;
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { userId: true }
    });
    return trip?.userId === userId;
  } catch (err) {
    return false;
  }
}
