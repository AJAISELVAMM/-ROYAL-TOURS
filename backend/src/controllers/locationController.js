// =============================================================================
// locationController.js — live location tracking & persistence endpoints.
// =============================================================================

import asyncHandler from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { badRequest } from '../utils/errors.js';
import * as locationService from '../services/locationService.js';
import prisma from '../config/database.js';

export const getCurrentLocation = asyncHandler(async (req, res) => {
  const requestedUserId = req.query.userId;
  let targetUserId = req.user.id;
  if (requestedUserId && requestedUserId !== req.user.id) {
    const sharedTrip = await prisma.trip.findFirst({
      where: {
        OR: [
          { userId: req.user.id, members: { some: { userId: requestedUserId, status: 'ACCEPTED' } } },
          { userId: requestedUserId, members: { some: { userId: req.user.id, status: 'ACCEPTED' } } },
          { members: { some: { userId: req.user.id, status: 'ACCEPTED' } }, AND: { members: { some: { userId: requestedUserId, status: 'ACCEPTED' } } } }
        ]
      },
      select: { id: true }
    });
    if (!sharedTrip && req.user.role !== 'ADMIN') throw badRequest('You do not share a travel group with this user.');
    targetUserId = requestedUserId;
  }
  const location = await locationService.getCurrentLocation(targetUserId);
  ok(res, location);
});

export const updateCurrentLocation = asyncHandler(async (req, res) => {
  const { latitude, longitude, accuracy, heading, speed, timestamp } = req.body || {};

  if (latitude == null || longitude == null) {
    throw badRequest('Latitude and longitude coordinates are required.');
  }

  const lat = Number(latitude);
  const lon = Number(longitude);

  if (Number.isNaN(lat) || Number.isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw badRequest('Invalid coordinates: latitude must be between -90 and 90, longitude between -180 and 180.');
  }

  const result = await locationService.saveCurrentLocation(req.user.id, {
    latitude: lat,
    longitude: lon,
    accuracy: accuracy != null ? Number(accuracy) : null,
    heading: heading != null ? Number(heading) : null,
    speed: speed != null ? Number(speed) : null,
    timestamp: timestamp ? new Date(timestamp) : new Date()
  }, req.user);

  ok(res, result);
});

export const getLocationHistory = asyncHandler(async (req, res) => {
  const targetUserId = req.user.role === 'ADMIN' && req.query.userId ? req.query.userId : req.user.id;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const history = await locationService.getLocationHistory(targetUserId, limit);
  ok(res, history);
});

export const startSharing = asyncHandler(async (req, res) => {
  const { latitude, longitude, accuracy } = req.body || {};
  if (latitude == null || longitude == null) throw badRequest('Location coordinates are required.');
  const result = await locationService.startSharing(req.params.groupId, req.user.id, { latitude, longitude, accuracy });
  ok(res, result);
});

export const stopSharing = asyncHandler(async (req, res) => {
  const result = await locationService.stopSharing(req.params.groupId, req.user.id);
  ok(res, result);
});
