// =============================================================================
// smsProvider.js — SMS provider abstraction + demo fallback provider.
// Business logic calls smsService, never a concrete provider.
// =============================================================================

import config from '../../config/env.js';
import { serviceUnavailable } from '../../utils/errors.js';
import { twilioSendSMS, twilioConfigured } from './twilioProvider.js';

const providers = {
  twilio: { configured: twilioConfigured, send: twilioSendSMS }
};

export function smsConfigured() {
  const p = providers[config.sms.provider];
  return !!p && p.configured();
}

export async function sendSMS(to, message) {
  const p = providers[config.sms.provider];
  if (p && p.configured()) {
    return p.send(to, message);
  }

  if (config.mockExternalServices) {
    // Development-only demo: log instead of sending a real SMS.
    // eslint-disable-next-line no-console
    console.log(`[SMS:mock] to=${to} message=${message}`);
    return { success: true, provider: 'mock', messageId: `mock-${Date.now()}` };
  }

  throw serviceUnavailable('SMS service is not configured.', 'SMS_NOT_CONFIGURED');
}
