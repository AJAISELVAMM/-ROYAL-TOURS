// =============================================================================
// callService.js — group member call initiation.
// MODE A: normal phone call — returns a sanitized number for a tel: action.
// MODE B: in-app VoIP — a voice provider (e.g. Twilio Voice) can be added here
//         without changing the controller; provider secrets stay server-side.
// =============================================================================

import { initiateCall, notifyCallAttempt } from './groupService.js';

export async function callMember(tripId, userId, memberId) {
  return initiateCall(tripId, userId, memberId);
}

export async function sendCallAttemptNotification(receiverPhone, callerName) {
  return notifyCallAttempt(receiverPhone, callerName);
}
