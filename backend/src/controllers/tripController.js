// =============================================================================
// tripController.js — trip creation, listing, detail, packing.
// =============================================================================

import { z } from 'zod';
import asyncHandler from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import { validationError } from '../utils/errors.js';
import * as tripService from '../services/tripService.js';

const memberSchema = z.union([
  z.object({
    name: z.string().optional(),
    phone: z.string().regex(/^\d{10}$/, 'Valid 10-digit phone number is required')
  }),
  z.string().regex(/^\d{10}$/, 'Valid 10-digit phone number is required')
]);

const createTripSchema = z.object({
  destination: z.string().min(1, 'Destination is required'),
  destinationAddress: z.string().optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  dates: z.string().optional(),
  duration: z.string().optional().default('2 Days'),
  durationDays: z.number().int().min(1).max(7).optional().default(2),
  budget: z.coerce.number().positive('A valid budget is required'),
  group: z.string().optional().default('Friends'),
  memberCount: z.number().int().min(1).optional().default(1),
  members: z.array(memberSchema).optional().default([]),
  selectedPlaceIds: z.array(z.string()).optional().default([])
});

export const createTrip = asyncHandler(async (req, res) => {
  const r = createTripSchema.safeParse(req.body);
  if (!r.success) throw validationError(r.error.issues[0].message, r.error.issues);

  const trip = await tripService.createTrip(req.user.id, r.data);
  created(res, { id: trip.id, destination: trip.destination, message: 'Trip created successfully.' });
});

export const listTrips = asyncHandler(async (req, res) => {
  const trips = await tripService.listTrips(req.user.id);
  ok(res, trips);
});

export const getTrip = asyncHandler(async (req, res) => {
  const trip = await tripService.getTrip(req.params.id);
  ok(res, trip);
});

export const getPacking = asyncHandler(async (req, res) => {
  const trip = await tripService.getTrip(req.params.id);
  ok(res, { packing: trip.packing });
});

export const togglePackingItem = asyncHandler(async (req, res) => {
  const item = await tripService.togglePackingItem(req.params.id, req.params.itemId);
  ok(res, item);
});

export const replanTrip = asyncHandler(async (req, res) => {
  const trip = await tripService.replanTrip(req.params.id, req.user.id, req.body || {});
  ok(res, trip);
});

export const addActivity = asyncHandler(async (req, res) => {
  const activity = await tripService.addItineraryActivity(req.params.id, req.user.id, req.body || {});
  created(res, activity);
});

export const acceptInvitation = asyncHandler(async (req, res) => {
  const trip = await tripService.acceptInvitation(req.params.id, req.user.id);
  ok(res, { success: true, trip, message: 'Invitation accepted successfully.' });
});

export const rejectInvitation = asyncHandler(async (req, res) => {
  const result = await tripService.rejectInvitation(req.params.id, req.user.id);
  ok(res, { success: true, ...result, message: 'Invitation declined.' });
});

