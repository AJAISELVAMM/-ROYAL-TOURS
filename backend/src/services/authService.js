// =============================================================================
// authService.js — registration, login (tourist + admin via SAME endpoint),
// token refresh and logout.
// =============================================================================

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../config/database.js';
import config from '../config/env.js';
import { signAccessToken, signRefreshToken } from '../middleware/authMiddleware.js';
import { issueOTP, verifyOTP } from './otpService.js';
import { badRequest, conflict, unauthorized, forbidden } from '../utils/errors.js';

const SALT_ROUNDS = 10;

// Development mail store for local preview without third-party email API
const devMailStore = [];

function recordDevMail({ to, subject, resetUrl }) {
  devMailStore.unshift({
    to,
    subject,
    resetUrl,
    createdAt: new Date().toISOString()
  });
  if (devMailStore.length > 20) devMailStore.pop();
}

export function getLatestDevMail() {
  if (config.nodeEnv === 'production') {
    throw forbidden('Development mail preview is unavailable in production.');
  }
  return devMailStore[0] || null;
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    phoneVerified: user.phoneVerified,
    avatarUrl: user.avatarUrl || null
  };
}

async function storeRefreshToken(userId, token) {
  // Store only a hash of the refresh token, never the raw token.
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await prisma.refreshToken.create({
    data: { userId, tokenHash, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
  });
}

// --- Registration (tourist only) -------------------------------------------

export async function requestRegistrationOTP({ name, email, phone, password }) {
  if (!name?.trim()) throw badRequest('Full name is required.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email || '')) throw badRequest('Please enter a valid email address.');
  if (!/^\d{10}$/.test((phone || '').replace(/\D/g, ''))) throw badRequest('Please enter a valid 10-digit phone number.');
  if (!password || password.length < 6) throw badRequest('Password must be at least 6 characters.');

  const normalizedPhone = phone.replace(/\D/g, '');
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: email.toLowerCase() }, { phone: normalizedPhone }] }
  });
  if (existing) throw conflict('An account with this email or phone already exists.');

  const { otp, expiresInSeconds } = await issueOTP(normalizedPhone, 'REGISTER');

  // DEMO SYSTEM: Return the OTP directly to the frontend popup.
  // No SMS is sent — this is intentional for a college project demo.
  return {
    success: true,
    message: 'OTP generated successfully.',
    otp,
    expiresIn: expiresInSeconds || 60
  };
}

export async function verifyRegistrationOTP({ phone, otp, name, email, password }) {
  const normalizedPhone = (phone || '').replace(/\D/g, '');
  await verifyOTP(normalizedPhone, otp, 'REGISTER');

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: email.toLowerCase() }, { phone: normalizedPhone }] }
  });
  if (existing) throw conflict('An account with this email or phone already exists.');

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: email.toLowerCase(),
      phone: normalizedPhone,
      passwordHash: bcrypt.hashSync(password, SALT_ROUNDS),
      role: 'TOURIST',
      status: 'ACTIVE',
      phoneVerified: true
    }
  });

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  await storeRefreshToken(user.id, refreshToken);

  return {
    success: true,
    user: sanitizeUser(user),
    accessToken,
    refreshToken
  };
}

export async function registerUser({ name, email, phone, password }) {
  if (!name?.trim()) throw badRequest('Full name is required.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email || '')) throw badRequest('Please enter a valid email address.');
  if (!password || password.length < 6) throw badRequest('Password must be at least 6 characters.');

  const normalizedPhone = (phone || '').replace(/\D/g, '');
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: email.toLowerCase() }, ...(normalizedPhone ? [{ phone: normalizedPhone }] : [])] }
  });
  if (existing) throw conflict('An account with this email or phone already exists.');

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: email.toLowerCase(),
      phone: normalizedPhone || null,
      passwordHash: bcrypt.hashSync(password, SALT_ROUNDS),
      role: 'TOURIST',
      status: 'ACTIVE',
      phoneVerified: true
    }
  });

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  await storeRefreshToken(user.id, refreshToken);

  return {
    success: true,
    user: sanitizeUser(user),
    accessToken,
    refreshToken
  };
}

// --- Login (tourist + admin, same endpoint) --------------------------------

export async function login({ email, password }) {
  if (!email || !password) throw badRequest('Please enter your email and password.');

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    throw unauthorized('Incorrect email or password.', 'INVALID_CREDENTIALS');
  }
  if (user.status === 'BLOCKED') {
    throw unauthorized('This account has been suspended.', 'ACCOUNT_BLOCKED');
  }
  if (user.status === 'PENDING') {
    throw unauthorized('Please verify your phone number first.', 'ACCOUNT_PENDING');
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  await storeRefreshToken(user.id, refreshToken);

  return {
    success: true,
    user: sanitizeUser(user),
    accessToken,
    refreshToken
  };
}

export async function refreshTokens(refreshToken) {
  if (!refreshToken) throw unauthorized('Refresh token required.');
  const { verifyRefreshToken } = await import('../middleware/authMiddleware.js');
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw unauthorized('Invalid refresh token.');
  }

  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!stored || stored.revoked || stored.expiresAt < new Date()) {
    throw unauthorized('Refresh token expired or revoked.');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.status === 'BLOCKED') throw unauthorized('Account unavailable.');

  // Rotate: revoke old, issue new.
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });
  const accessToken = signAccessToken(user);
  const newRefresh = signRefreshToken(user);
  await storeRefreshToken(user.id, newRefresh);

  return { success: true, accessToken, refreshToken: newRefresh, user: sanitizeUser(user) };
}

export async function logout(refreshToken) {
  if (refreshToken) {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await prisma.refreshToken.updateMany({ where: { tokenHash }, data: { revoked: true } });
  }
  return { success: true };
}

export async function updateAvatar(userId, avatarUrl) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl }
  });
  return sanitizeUser(user);
}

export async function removeAvatar(userId) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl: null }
  });
  return sanitizeUser(user);
}

export async function getUserNotifications(userId) {
  const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const records = await prisma.notification.findMany({
    where: {
      userId,
      createdAt: { gte: cutoff24h },
      OR: [
        { type: { not: 'TRIP_INVITE' } },
        { type: 'TRIP_INVITE', status: 'PENDING' }
      ]
    },
    orderBy: { createdAt: 'desc' },
    take: 30
  });

  return records.map((n) => {
    let parsedPayload = null;
    try {
      if (n.payload) parsedPayload = JSON.parse(n.payload);
    } catch {
      // ignore
    }

    const title = parsedPayload?.title || (
      n.type === 'TRIP_INVITE' ? 'Trip Invitation' :
      n.type === 'GROUP_SOS' ? 'Emergency SOS Alert' :
      n.type === 'LOCATION_SHARE' ? 'Live Location' : 'Notification'
    );

    return {
      id: n.id,
      type: n.type,
      title,
      message: n.content,
      content: n.content,
      payload: parsedPayload,
      tripId: parsedPayload?.tripId || null,
      destination: parsedPayload?.destination || null,
      creatorName: parsedPayload?.creatorName || null,
      dates: parsedPayload?.dates || null,
      status: n.status,
      createdAt: n.createdAt
    };
  });
}

// --- Password Reset Flow ----------------------------------------------------

export async function requestPasswordReset(email, originBaseUrl) {
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
    throw badRequest('Please enter a valid email address.');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const genericResponse = {
    success: true,
    message: 'If an account exists for this email, password reset instructions have been sent.'
  };

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user || user.status === 'BLOCKED') {
    // Prevent account enumeration by always returning the identical generic message
    return genericResponse;
  }

  // Generate cryptographically secure random reset token
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  // Invalidate any previous active reset tokens for this user
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

  // Store hashed token with 20 minutes expiration
  const expiresAt = new Date(Date.now() + 20 * 60 * 1000);
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt
    }
  });

  // Determine frontend base URL safely
  const baseUrl = originBaseUrl || config.frontendUrl || 'http://localhost:5173';
  const resetUrl = `${baseUrl.replace(/\/+$/, '')}/reset-password?token=${rawToken}`;

  // In development, store reset email preview for local testing without external APIs
  if (config.nodeEnv !== 'production') {
    recordDevMail({
      to: user.email,
      subject: 'Royal Tours - Password Reset',
      resetUrl
    });
  }

  // Never return raw token in normal production response
  return genericResponse;
}

export async function verifyResetToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') {
    throw badRequest('This password reset link is invalid or has expired.', 'INVALID_OR_EXPIRED_TOKEN');
  }

  const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw badRequest('This password reset link is invalid or has expired.', 'INVALID_OR_EXPIRED_TOKEN');
  }

  return { valid: true };
}

export async function resetPassword({ token: rawToken, password }) {
  if (!rawToken || typeof rawToken !== 'string') {
    throw badRequest('This password reset link is invalid or has expired.', 'INVALID_OR_EXPIRED_TOKEN');
  }
  if (!password || password.length < 6) {
    throw badRequest('Password must be at least 6 characters.', 'INVALID_PASSWORD');
  }

  const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true }
  });

  if (!record || record.usedAt || record.expiresAt < new Date() || !record.user) {
    throw badRequest('This password reset link is invalid or has expired.', 'INVALID_OR_EXPIRED_TOKEN');
  }

  // Hash new password using the existing bcrypt implementation
  const passwordHash = bcrypt.hashSync(password, SALT_ROUNDS);

  // Update password in database
  await prisma.user.update({
    where: { id: record.userId },
    data: { passwordHash }
  });

  // Mark token as used
  await prisma.passwordResetToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() }
  });

  // Invalidate any remaining reset tokens for this user
  await prisma.passwordResetToken.deleteMany({
    where: { userId: record.userId, id: { not: record.id } }
  });

  // Revoke active refresh tokens to force re-login
  await prisma.refreshToken.updateMany({
    where: { userId: record.userId },
    data: { revoked: true }
  });

  return {
    success: true,
    message: 'Password has been reset successfully. Please log in with your new password.'
  };
}

export async function changePassword(userId, currentPassword, newPassword) {
  if (!currentPassword) {
    throw badRequest('Current password is required.', 'MISSING_CURRENT_PASSWORD');
  }
  if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 8) {
    throw badRequest('New password must be at least 8 characters long.', 'INVALID_PASSWORD');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status === 'BLOCKED') {
    throw unauthorized('Account is unavailable.');
  }

  const isCurrentPasswordValid = bcrypt.compareSync(currentPassword, user.passwordHash);
  if (!isCurrentPasswordValid) {
    throw badRequest('The current password you entered is incorrect.', 'INCORRECT_CURRENT_PASSWORD');
  }

  const passwordHash = bcrypt.hashSync(newPassword, SALT_ROUNDS);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash }
  });

  return {
    success: true,
    message: 'Password changed successfully.'
  };
}


