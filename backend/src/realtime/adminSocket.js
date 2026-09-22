// =============================================================================
// adminSocket.js — broadcasts report/dashboard events.
// =============================================================================

import { getIO } from './socket.js';

export function emitNewReport(report) {
  getIO()?.to('admin:safety').emit('admin:report:new', {
    id: report.id,
    touristName: report.user?.name,
    category: report.category,
    location: report.location,
    status: report.status,
    createdAt: report.createdAt
  });
  getIO()?.to('admin:dashboard').emit('admin:dashboard:update', { type: 'report' });
}

export function emitReportUpdated(report) {
  getIO()?.to(`user:${report.userId}`).emit('tourist:report:updated', {
    id: report.id,
    status: report.status
  });
}

export function emitDashboardUpdate(type) {
  getIO()?.to('admin:dashboard').emit('admin:dashboard:update', { type });
}
