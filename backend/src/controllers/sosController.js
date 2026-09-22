// =============================================================================
// sosController.js — SOS creation, listing, status transitions.
// =============================================================================

import asyncHandler from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import * as sosService from '../services/sosService.js';

export const create = asyncHandler(async (req, res) => {
  const sos = await sosService.createSOS(req.user, req.body || {});
  created(res, { id: sos.id, status: sos.status, smsStatus: sos.smsStatus, request: sos, ...sos });
});

export const createGroup = asyncHandler(async (req, res) => {
  const { sos, members } = await sosService.createGroupSOS(req.user, req.body || {});
  created(res, { id: sos.id, status: sos.status, memberCount: members.length });
});

export const listActive = asyncHandler(async (_req, res) => {
  const list = await sosService.listActive();
  ok(res, list);
});

export const listHistory = asyncHandler(async (req, res) => {
  const list = await sosService.listHistory(req.user.id);
  ok(res, list);
});

export const transition = asyncHandler(async (req, res) => {
  const sos = await sosService.transitionSOS(req.params.id, req.body?.status, req.user);
  ok(res, { id: sos.id, status: sos.status });
});
