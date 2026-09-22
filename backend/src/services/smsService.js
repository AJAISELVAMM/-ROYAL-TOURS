// =============================================================================
// smsService.js — business logic for outbound SMS (calls smsProvider).
// =============================================================================

import { sendSMS, smsConfigured } from '../providers/sms/smsProvider.js';
import config from '../config/env.js';
import logger from '../utils/logger.js';

export function isConfigured() {
  return smsConfigured();
}

export async function send(to, message) {
  try {
    const result = await sendSMS(to, message);
    return { success: true, ...result };
  } catch (err) {
    // SMS failure must never break the calling flow (e.g. an SOS).
    logger.warn('SMS send failed', { to, message: err.message });
    return { success: false, code: err.code || 'SMS_FAILED', message: err.message };
  }
}

export function buildSOSMessage({ touristName, phone, emergencyType, locationText, latitude, longitude, groupSOS, memberCount, sosId }) {
  const lines = [
    'TOURGUARD AI EMERGENCY ALERT',
    '',
    `Tourist: ${touristName}`,
    `Phone: ${phone}`,
    `Emergency: ${emergencyType}`,
    `Location: ${locationText || 'Unknown'}`,
    `Coordinates: ${latitude}, ${longitude}`,
    `Time: ${new Date().toISOString()}`
  ];
  if (groupSOS) lines.push(`Group SOS — members: ${memberCount}`);
  lines.push('', `SOS ID: ${sosId}`);
  return lines.join('\n');
}
