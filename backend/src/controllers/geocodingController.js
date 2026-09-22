// =============================================================================
// geocodingController.js — Free Open Geocoding & Address Suggestions.
// =============================================================================

import asyncHandler from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { badRequest } from '../utils/errors.js';
import * as geocodingProvider from '../providers/geocodingProvider.js';

export const search = asyncHandler(async (req, res) => {
  const query = (req.query.q || req.query.query || req.query.search || '').trim();
  if (!query) {
    return ok(res, []);
  }
  const limit = Math.min(Number(req.query.limit) || 5, 20);
  const results = await geocodingProvider.searchGeocode(query, limit);
  ok(res, results);
});

export const geocode = asyncHandler(async (req, res) => {
  const query = (req.query.q || req.query.query || req.query.text || '').trim();
  if (!query) {
    throw badRequest('Query parameter q is required.');
  }
  const result = await geocodingProvider.geocode(query);
  ok(res, result);
});

export const reverseGeocode = asyncHandler(async (req, res) => {
  const lat = req.query.lat ?? req.query.latitude;
  const lon = req.query.lon ?? req.query.lng ?? req.query.longitude;
  if (lat == null || lon == null) {
    throw badRequest('Latitude and longitude query parameters are required.');
  }
  const result = await geocodingProvider.reverseGeocode(lat, lon);
  ok(res, result);
});
