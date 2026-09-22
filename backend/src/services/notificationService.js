// =============================================================================
// notificationService.js — notifications to users + emergency contacts.
// =============================================================================

import prisma from '../config/database.js';
import { send } from './smsService.js';

export async function notifyAdminsBySMS(message) {
  const contacts = await prisma.emergencyContact.findMany({ where: { active: true, type: 'ADMIN' } });
  const results = [];
  for (const c of contacts) {
    results.push(await send(c.phone, message));
  }
  return results;
}

export async function createNotification({ userId, type, channel, content }) {
  return prisma.notification.create({
    data: { userId, type, channel, status: 'PENDING', content }
  });
}

export async function listNotifications(userId) {
  return prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 });
}
