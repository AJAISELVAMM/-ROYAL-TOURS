// =============================================================================
// adminController.js — admin dashboard, users, catalog, analytics, safety,
// service status, account + activity logs.
// =============================================================================

import asyncHandler from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { badRequest } from '../utils/errors.js';
import bcrypt from 'bcryptjs';
import prisma from '../config/database.js';
import * as adminService from '../services/adminService.js';

export const overview = asyncHandler(async (_req, res) => {
  const data = await adminService.getOverview();
  ok(res, data);
});

export const analytics = asyncHandler(async (req, res) => {
  const data = await adminService.getAnalytics(req.query.section);
  ok(res, data);
});

export const listUsers = asyncHandler(async (req, res) => {
  const data = await adminService.listUsers(req.query);
  ok(res, data);
});

export const userDetail = asyncHandler(async (req, res) => {
  const data = await adminService.getUserDetail(req.params.id);
  ok(res, data);
});

export const updateUserStatus = asyncHandler(async (req, res) => {
  const { status } = req.body || {};
  if (!['ACTIVE', 'PENDING', 'BLOCKED'].includes(status)) throw badRequest('Invalid status.');
  const data = await adminService.updateUserStatus(req.params.id, status, req.user);
  ok(res, data);
});

// --- Catalog CRUD ---

export const createCatalog = asyncHandler(async (req, res) => {
  const item = await adminService.adminCreateCatalog(req.params.type, req.body || {});
  await adminService.logActivity(req.user.id, `Created ${req.params.type} entry`, req.params.type, item.id);
  ok(res, item, 201);
});

export const updateCatalog = asyncHandler(async (req, res) => {
  const item = await adminService.adminUpdateCatalog(req.params.type, req.params.id, req.body || {});
  await adminService.logActivity(req.user.id, `Edited ${req.params.type} entry`, req.params.type, item.id);
  ok(res, item);
});

export const deleteCatalog = asyncHandler(async (req, res) => {
  const result = await adminService.adminDeleteCatalog(req.params.type, req.params.id);
  await adminService.logActivity(req.user.id, `Removed ${req.params.type} entry`, req.params.type, req.params.id);
  ok(res, result);
});

export const verifyCatalog = asyncHandler(async (req, res) => {
  const { verified } = req.body || {};
  const item = await adminService.adminVerifyCatalog(req.params.type, req.params.id, !!verified);
  await adminService.logActivity(req.user.id, `${verified ? 'Verified' : 'Unverified'} ${req.params.type} entry`, req.params.type, item.id);
  ok(res, item);
});

// --- Safety center ---

export const safetyCenter = asyncHandler(async (_req, res) => {
  const [sos, alerts, reports] = await Promise.all([
    prisma.sOSRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true, phone: true } } },
      take: 50
    }),
    prisma.safetyAlert.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.travelReport.findMany({ orderBy: { createdAt: 'desc' }, take: 50 })
  ]);
  ok(res, { sos, alerts, reports });
});

export const listEmergencyContacts = asyncHandler(async (_req, res) => {
  const contacts = await prisma.emergencyContact.findMany({ orderBy: { type: 'asc' } });
  ok(res, contacts);
});

export const createEmergencyContact = asyncHandler(async (req, res) => {
  const { name, phone, type } = req.body || {};
  if (!name || !phone || !type) throw badRequest('Name, phone and type are required.');
  const contact = await prisma.emergencyContact.create({ data: { name, phone, type, active: true } });
  await adminService.logActivity(req.user.id, 'Added emergency contact', 'emergency_contact', contact.id);
  ok(res, contact, 201);
});

export const updateEmergencyContact = asyncHandler(async (req, res) => {
  const contact = await prisma.emergencyContact.update({ where: { id: req.params.id }, data: req.body || {} });
  await adminService.logActivity(req.user.id, 'Updated emergency contact', 'emergency_contact', contact.id);
  ok(res, contact);
});

export const deleteEmergencyContact = asyncHandler(async (req, res) => {
  await prisma.emergencyContact.delete({ where: { id: req.params.id } });
  ok(res, { success: true });
});

// --- Service status (admin only) ---

export const serviceStatus = asyncHandler(async (_req, res) => {
  const data = await adminService.getServiceStatus();
  ok(res, data);
});

// --- Account ---

export const account = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  ok(res, { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword || newPassword.length < 6) throw badRequest('A valid new password (6+ chars) is required.');

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!bcrypt.compareSync(currentPassword, user.passwordHash)) throw badRequest('Current password is incorrect.', 'INVALID_PASSWORD');

  await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash: bcrypt.hashSync(newPassword, 10) } });
  await adminService.logActivity(req.user.id, 'Changed own password', 'account', req.user.id);
  ok(res, { success: true });
});

export const activityLogs = asyncHandler(async (_req, res) => {
  const logs = await adminService.getActivityLogs();
  ok(res, logs);
});
