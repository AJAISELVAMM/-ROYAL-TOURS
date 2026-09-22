// =============================================================================
// transportController.js — transport routes + fare estimate/check.
// =============================================================================

import asyncHandler from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import prisma from '../config/database.js';
import * as routingService from '../services/routingService.js';

export const listOptions = asyncHandler(async (_req, res) => {
  const routes = await prisma.transportRoute.findMany({ orderBy: { price: 'asc' } });
  ok(res, routes);
});

export const getRoutes = asyncHandler(async (req, res) => {
  const { from, to, mode, origin, destination } = req.query;
  const start = from || origin;
  const end = to || destination;
  const result = await routingService.getTransportRoutes({ from: start, to: end, mode });
  const coordinates = result.geometry?.coordinates || [];
  ok(res, {
    ...result,
    route: {
      coordinates,
      distance: result.distanceKm,
      duration: result.durationMinutes,
      steps: result.steps || []
    }
  });
});

export const postRoute = asyncHandler(async (req, res) => {
  const { from, to, mode, origin, destination } = req.body || {};
  const start = from || origin;
  const end = to || destination;
  const result = await routingService.getTransportRoutes({ from: start, to: end, mode });
  const coordinates = result.geometry?.coordinates || [];
  ok(res, {
    ...result,
    route: {
      coordinates,
      distance: result.distanceKm,
      duration: result.durationMinutes,
      steps: result.steps || []
    }
  });
});

export const estimateFare = asyncHandler(async (req, res) => {
  const { from, to, vehicleType } = req.query;
  const route = await routingService.getTransportRoutes({ from, to, mode: vehicleType });
  ok(res, { fare: route.fare, distanceKm: route.distanceKm, durationMinutes: route.durationMinutes });
});

export const checkFare = asyncHandler(async (req, res) => {
  const { from, to, vehicleType, quotedFare } = req.body || {};
  const result = await routingService.checkFairFare({ from, to, vehicleType, quotedFare });
  ok(res, result);
});
