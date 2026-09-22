// =============================================================================
// discoverController.js — catalog listing/detail + theatre shows.
// =============================================================================

import asyncHandler from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import * as discoverService from '../services/discoverService.js';

export const list = asyncHandler(async (req, res) => {
  const result = await discoverService.listCollection(req.params.type, req.query);
  ok(res, result);
});

export const detail = asyncHandler(async (req, res) => {
  const item = await discoverService.getItem(req.params.type, req.params.id);
  ok(res, item);
});

export const shows = asyncHandler(async (req, res) => {
  const result = await discoverService.getTheatreShows(req.params.id);
  ok(res, result);
});
