// =============================================================================
// reportController.js — travel reports (tourist submit + admin manage).
// =============================================================================

import asyncHandler from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import { badRequest, notFound } from '../utils/errors.js';
import prisma from '../config/database.js';
import * as adminService from '../services/adminService.js';
import { emitNewReport, emitReportUpdated } from '../realtime/adminSocket.js';

const VALID_CATEGORIES = ['FARE', 'RESTAURANT', 'SHOP', 'ATTRACTION', 'OTHER'];

export const createReport = asyncHandler(async (req, res) => {
  const { category, location, latitude, longitude, description, expectedPrice, chargedPrice, evidence } = req.body || {};
  const normCategory = String(category || '').toUpperCase().trim();
  if (!VALID_CATEGORIES.includes(normCategory)) throw badRequest('A valid report category is required.');
  if (!location) throw badRequest('Location is required.');
  if (!description) throw badRequest('Description is required.');

  // Identity is derived from the JWT, never from the request body.
  const report = await prisma.travelReport.create({
    data: {
      userId: req.user.id,
      category: normCategory,
      location,
      latitude: latitude || null,
      longitude: longitude || null,
      description,
      expectedPrice: Number(expectedPrice) || 0,
      chargedPrice: Number(chargedPrice) || 0,
      evidence: evidence || null
    }
  });

  emitNewReport({ ...report, user: { name: req.user.name } });
  created(res, { id: report.id, status: report.status });
});

export const listMyReports = asyncHandler(async (req, res) => {
  const reports = await prisma.travelReport.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' }
  });
  ok(res, reports);
});

export const adminList = asyncHandler(async (req, res) => {
  const { category, status } = req.query;
  const where = {};
  if (category && category !== 'All') where.category = category;
  if (status) where.status = status;
  const reports = await prisma.travelReport.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { id: true, name: true, phone: true } } }
  });
  ok(res, reports);
});

export const adminDetail = asyncHandler(async (req, res) => {
  const report = await prisma.travelReport.findUnique({
    where: { id: req.params.id },
    include: { user: { select: { id: true, name: true, phone: true } } }
  });
  if (!report) throw notFound('Report not found.');
  ok(res, report);
});

export const adminUpdateStatus = asyncHandler(async (req, res) => {
  const { status } = req.body || {};
  if (!['UNDER_REVIEW', 'RESOLVED', 'REJECTED'].includes(status)) throw badRequest('Invalid status.');

  const existing = await prisma.travelReport.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound('Report not found.');

  const report = await prisma.travelReport.update({
    where: { id: req.params.id },
    data: { status }
  });

  // Record admin activity + notify the tourist.
  await adminService.logActivity(req.user.id, `Updated report ${report.id} to ${status}`, 'report', report.id);
  await prisma.notification.create({
    data: {
      userId: report.userId,
      type: 'REPORT_UPDATE',
      channel: 'IN_APP',
      status: 'PENDING',
      content: `Your report ${report.id} status changed to ${status}.`
    }
  });

  emitReportUpdated(report);
  ok(res, report);
});
