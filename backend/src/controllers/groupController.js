// =============================================================================
// groupController.js — travel group endpoints.
// =============================================================================

import asyncHandler from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import * as groupService from '../services/groupService.js';
import * as callService from '../services/callService.js';

export const joinGroup = asyncHandler(async (req, res) => {
  const { code, groupCode } = req.body || {};
  const trip = await groupService.joinGroupByCode(req.user, code || groupCode);
  ok(res, { trip, group: trip, members: trip.members, alreadyMember: Boolean(trip.alreadyMember) });
});

export const getGroup = asyncHandler(async (req, res) => {
  const group = await groupService.getGroup(req.params.groupId, req.user.id);
  ok(res, group);
});

export const getMembers = asyncHandler(async (req, res) => {
  const members = await groupService.getMembers(req.params.groupId, req.user.id);
  ok(res, members);
});

export const callMember = asyncHandler(async (req, res) => {
  const { memberId } = req.body || {};
  const result = await callService.callMember(req.params.groupId, req.user.id, memberId);
  // Best-effort SMS notification to the receiver (never blocks the call).
  if (result.call.phone && result.call.mode === 'tel') {
    callService.sendCallAttemptNotification(result.call.phone, result.call.caller.name).catch(() => {});
  }
  ok(res, result);
});

export const leaveGroup = asyncHandler(async (req, res) => {
  const groupId = req.params.groupId || req.params.id;
  const result = await groupService.leaveGroup(groupId, req.user.id);
  ok(res, result);
});

export const createGroup = asyncHandler(async (req, res) => {
  const result = await groupService.createGroup(req.user, req.body || {});
  ok(res, { group: result, trip: result }, 201);
});

export const listActiveGroups = asyncHandler(async (req, res) => {
  const groups = await groupService.listActiveGroups(req.user.id);
  ok(res, groups);
});
