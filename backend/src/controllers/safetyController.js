// =============================================================================
// safetyController.js — safety map, "I'm Lost" guidance, nearest emergency help.
// =============================================================================

import asyncHandler from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import * as safetyService from '../services/safetyService.js';

export const safetyMap = asyncHandler(async (req, res) => {
  const { latitude, longitude, lat, lon, lng, radius } = req.query || {};
  const result = await safetyService.getSafetyMap({
    latitude: latitude ?? lat,
    longitude: longitude ?? lon ?? lng,
    radius
  });
  ok(res, result);
});

export const guide = asyncHandler(async (req, res) => {
  const { currentLatitude, currentLongitude, destinationType } = req.body || {};
  const result = await safetyService.guide({ currentLatitude, currentLongitude, destinationType });
  ok(res, result);
});

export const nearest = asyncHandler(async (req, res) => {
  const { latitude, longitude, type } = req.query;
  const result = await safetyService.findNearestHelp({
    latitude: latitude != null ? Number(latitude) : null,
    longitude: longitude != null ? Number(longitude) : null,
    type
  });
  ok(res, result);
});
