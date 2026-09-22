// =============================================================================
// weatherController.js — live weather API handler.
// =============================================================================

import asyncHandler from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import * as weatherService from '../services/weatherService.js';

export const getWeather = asyncHandler(async (req, res) => {
  const { latitude, longitude, lat, lon, lng, city, location, q } = req.query;
  const result = await weatherService.getWeather({
    latitude: latitude ?? lat,
    longitude: longitude ?? lon ?? lng,
    city: city ?? location ?? q
  });
  ok(res, result);
});
