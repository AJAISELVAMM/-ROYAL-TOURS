// =============================================================================
// authController.js — registration, OTP, login (tourist + admin same endpoint),
// refresh and logout.
// =============================================================================

import { z } from 'zod';
import asyncHandler from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import { validationError } from '../utils/errors.js';
import * as authService from '../services/authService.js';

const requestOtpSchema = z.object({
  name: z.string().min(1, 'Full name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().regex(/^\d{10}$/, 'Valid 10-digit phone number is required'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

const verifyOtpSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, 'Valid 10-digit phone number is required'),
  otp: z.string().regex(/^\d{6}$/, '6-digit OTP is required'),
  name: z.string().min(1, 'Full name is required'),
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

const loginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(1, 'Password is required')
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Valid email is required')
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters')
});

function parse(schema, body) {
  const r = schema.safeParse(body);
  if (!r.success) {
    throw validationError(r.error.issues[0].message, r.error.issues);
  }
  return r.data;
}

export const requestOTP = asyncHandler(async (req, res) => {
  const data = parse(requestOtpSchema, req.body);
  const result = await authService.requestRegistrationOTP(data);
  ok(res, result);
});

export const register = asyncHandler(async (req, res) => {
  const data = parse(requestOtpSchema, req.body);
  const result = await authService.registerUser(data);
  created(res, result);
});

export const verifyOTP = asyncHandler(async (req, res) => {
  const data = parse(verifyOtpSchema, req.body);
  const result = await authService.verifyRegistrationOTP(data);
  created(res, result);
});

export const login = asyncHandler(async (req, res) => {
  const data = parse(loginSchema, req.body);
  const result = await authService.login(data);
  ok(res, result);
});

export const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body || {};
  const result = await authService.refreshTokens(refreshToken);
  ok(res, result);
});

export const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body || {};
  const result = await authService.logout(refreshToken);
  ok(res, result);
});

export const me = asyncHandler(async (req, res) => {
  ok(res, { user: req.user });
});

export const updateAvatar = asyncHandler(async (req, res) => {
  const { avatarUrl } = req.body || {};
  if (!avatarUrl || typeof avatarUrl !== 'string') {
    throw validationError('A valid avatar image string is required.');
  }
  const updatedUser = await authService.updateAvatar(req.user.id, avatarUrl);
  ok(res, { user: updatedUser, message: 'Profile photo updated successfully.' });
});

export const removeAvatar = asyncHandler(async (req, res) => {
  const updatedUser = await authService.removeAvatar(req.user.id);
  ok(res, { user: updatedUser, message: 'Profile photo removed.' });
});

export const getNotifications = asyncHandler(async (req, res) => {
  const notifications = await authService.getUserNotifications(req.user.id);
  ok(res, notifications);
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const data = parse(forgotPasswordSchema, req.body);
  let origin = req.headers.origin;
  if (!origin && req.headers.referer) {
    try {
      origin = new URL(req.headers.referer).origin;
    } catch {
      origin = null;
    }
  }
  const result = await authService.requestPasswordReset(data.email, origin);
  ok(res, result);
});

export const verifyResetToken = asyncHandler(async (req, res) => {
  const token = req.query.token;
  const result = await authService.verifyResetToken(token);
  ok(res, result);
});

export const resetPassword = asyncHandler(async (req, res) => {
  const data = parse(resetPasswordSchema, req.body);
  const result = await authService.resetPassword(data);
  ok(res, result);
});

export const getDevMailPreview = asyncHandler(async (req, res) => {
  const mail = authService.getLatestDevMail();
  ok(res, { mail });
});

export const changePassword = asyncHandler(async (req, res) => {
  const data = parse(changePasswordSchema, req.body);
  const result = await authService.changePassword(req.user.id, data.currentPassword, data.newPassword);
  ok(res, result);
});


