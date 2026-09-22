// =============================================================================
// otpService.js — secure OTP generation, hashing, expiry and verification.
// Raw OTPs are NEVER stored — only salted SHA-256 digests.
// =============================================================================

import crypto from 'crypto';
import prisma from '../config/database.js';
import { otpExpired, otpInvalid, tooManyRequests, badRequest } from '../utils/errors.js';

const MAX_ATTEMPTS = 5;
const TTL_MS = 60 * 1000; // 60 seconds (demo countdown)
const RESEND_COOLDOWN_MS = 30 * 1000; // 30 seconds

function generateOTP() {
  // Always generate a truly random 6-digit code. This is a demo system —
  // the raw OTP is returned to the frontend to display in the popup.
  return crypto.randomInt(100000, 999999).toString();
}

function hashOTP(otp, salt) {
  return crypto.createHash('sha256').update(`${salt}:${otp}`).digest('hex');
}

export function createOTPForTesting(phone) {
  return generateOTP();
}

export async function issueOTP(phone, purpose = 'REGISTER') {
  const otp = generateOTP();
  const salt = crypto.randomBytes(16).toString('hex');
  const otpHash = hashOTP(otp, salt);

  // Invalidate any previous OTP for this phone.
  await prisma.oTPVerification.deleteMany({ where: { phone, purpose } });

  // Resend cooldown is enforced by the controller via rate limiting; here we
  // simply persist the fresh OTP.
  await prisma.oTPVerification.create({
    data: {
      phone,
      purpose,
      otpHash: `${salt}.${otpHash}`,
      expiresAt: new Date(Date.now() + TTL_MS)
    }
  });

  // Return the raw OTP so the calling service can surface it in the demo popup.
  return { otp, expiresAt: new Date(Date.now() + TTL_MS), expiresInSeconds: Math.floor(TTL_MS / 1000) };
}

export async function verifyOTP(phone, otp, purpose = 'REGISTER') {
  if (!/^\d{6}$/.test(otp || '')) throw badRequest('Please enter the 6-digit code.', 'OTP_INCOMPLETE');

  const record = await prisma.oTPVerification.findFirst({
    where: { phone, purpose },
    orderBy: { createdAt: 'desc' }
  });
  if (!record) throw otpExpired();

  if (Date.now() > record.expiresAt.getTime()) {
    await prisma.oTPVerification.delete({ where: { id: record.id } });
    throw otpExpired();
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    await prisma.oTPVerification.delete({ where: { id: record.id } });
    throw tooManyRequests('Too many incorrect attempts. Please request a new code.', 'OTP_ATTEMPTS_EXCEEDED');
  }

  const [salt, storedHash] = record.otpHash.split('.');
  const inputHash = hashOTP(otp, salt);

  if (inputHash !== storedHash) {
    await prisma.oTPVerification.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } }
    });
    throw otpInvalid();
  }

  await prisma.oTPVerification.delete({ where: { id: record.id } });
  return { success: true };
}

export { RESEND_COOLDOWN_MS, MAX_ATTEMPTS };
