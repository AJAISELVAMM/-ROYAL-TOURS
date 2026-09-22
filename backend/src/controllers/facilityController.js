// =============================================================================
// facilityController.js — Unified controller for 14-category provider searches.
// =============================================================================

import asyncHandler from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { badRequest } from '../utils/errors.js';
import { searchByCategory, getAvailableCategories, getProviderStatus } from '../providers/index.js';

export const nearby = asyncHandler(async (req, res) => {
  const { category = 'facilities', lat, lon, latitude, longitude, radius, search, limit } = req.query;

  const userLat = lat != null ? Number(lat) : latitude != null ? Number(latitude) : 11.0046;
  const userLon = lon != null ? Number(lon) : longitude != null ? Number(longitude) : 76.9659;

  if (isNaN(userLat) || isNaN(userLon)) {
    throw badRequest('Valid latitude and longitude coordinates are required.');
  }

  const items = await searchByCategory(category, {
    latitude: userLat,
    longitude: userLon,
    radius: radius ? Number(radius) : undefined,
    search: search || '',
    limit: limit ? Number(limit) : 25
  });

  ok(res, {
    category,
    latitude: userLat,
    longitude: userLon,
    count: items.length,
    items
  });
});

export const categories = asyncHandler(async (_req, res) => {
  const list = getAvailableCategories();
  ok(res, list);
});

export const status = asyncHandler(async (_req, res) => {
  const s = getProviderStatus();
  ok(res, s);
});
