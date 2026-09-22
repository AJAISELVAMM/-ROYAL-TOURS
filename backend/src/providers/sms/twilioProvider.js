// =============================================================================
// twilioProvider.js — Twilio SMS via REST API (no SDK dependency).
// Credentials come from environment variables only.
// =============================================================================

import config from '../../config/env.js';

export function twilioConfigured() {
  return !!(
    config.sms.twilioAccountSid &&
    config.sms.twilioAuthToken &&
    config.sms.twilioPhoneNumber
  );
}

export async function twilioSendSMS(to, message) {
  const { twilioAccountSid, twilioAuthToken, twilioPhoneNumber } = config.sms;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
  const body = new URLSearchParams();
  body.append('To', to);
  body.append('From', twilioPhoneNumber);
  body.append('Body', message);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Twilio SMS failed (${res.status}): ${text.slice(0, 200)}`);
    err.status = 502;
    throw err;
  }

  const json = await res.json();
  return { success: true, provider: 'twilio', messageId: json.sid };
}
