// ============================================================================
// authService — authentication against the TourGuard AI backend.
// Handles login, tourist registration and phone OTP verification.
//
// Admin credentials are never stored or rendered here; admins simply sign in
// through the same /api/auth/login endpoint and the backend returns the role.
// ============================================================================

import { api, ApiError, setTokens, clearTokens, waitForBackendReady } from './api.js';

const PENDING_REG_KEY = 'tourguard_pending_registration';
const SESSION_KEY = 'tourguard_session';

function normalizePhone(phone) {
  return (phone || '').replace(/\D/g, '');
}

function validPhone(phone) {
  return /^\d{10}$/.test(normalizePhone(phone));
}

// ---------------------------------------------------------------------------
// Pending registration (survives page refresh across the OTP step)
// ---------------------------------------------------------------------------

export function savePendingRegistration(data) {
  const pending = readPending();
  writePending({ ...pending, ...data, phone: normalizePhone(data.phone || pending.phone || '') });
  return readPending();
}

export function readPending() {
  try {
    return JSON.parse(localStorage.getItem(PENDING_REG_KEY) || '{}');
  } catch {
    return {};
  }
}

export function clearPendingRegistration() {
  localStorage.removeItem(PENDING_REG_KEY);
}

function writePending(data) {
  localStorage.setItem(PENDING_REG_KEY, JSON.stringify(data));
}

export function getOtpPhone() {
  return readPending().phone || null;
}

// ---------------------------------------------------------------------------
// OTP flow (delegates to the backend; backend stores only a hashed OTP)
// ---------------------------------------------------------------------------

export async function register(formData) {
  try {
    const res = await api.post('/auth/register', {
      name: formData.name,
      email: formData.email,
      phone: normalizePhone(formData.phone),
      password: formData.password
    }, { auth: false });

    const user = res.user;
    const accessToken = res.accessToken;
    const refreshToken = res.refreshToken;
    const role = (user?.role === 'ADMIN' ? 'admin' : 'tourist');

    if (accessToken) {
      setTokens({ accessToken, refreshToken });
      saveSession({ user, role, accessToken, refreshToken });
    }
    clearPendingRegistration();
    return { success: true, user, role, accessToken, refreshToken };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function sendOTP(phone) {
  const pending = readPending();
  const normalized = normalizePhone(phone || pending.phone || '');
  if (!validPhone(normalized)) {
    return { success: false, error: 'Please enter a valid 10-digit phone number.' };
  }
  try {
    await api.post('/auth/register/request-otp', {
      name: pending.name,
      email: pending.email,
      phone: normalized,
      password: pending.password
    }, { auth: false });
    writePending({ ...pending, phone: normalized });
    return { success: true, maskedPhone: maskPhone(normalized) };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Demo OTP flow — OTP shown inside an inline popup (no SMS sent)
// ---------------------------------------------------------------------------

export async function requestDemoOTP({ name, email, phone, password }) {
  const normalized = normalizePhone(phone || '');
  try {
    const res = await api.post('/auth/register/request-otp', {
      name, email, phone: normalized, password
    }, { auth: false });
    // Save registration details so verifyDemoOTP can use them.
    writePending({ name, email, phone: normalized, password });
    return {
      success: true,
      otp: res.otp,          // Raw OTP returned from demo backend
      expiresIn: res.expiresIn || 60
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function resendDemoOTP() {
  const pending = readPending();
  if (!pending.phone || !pending.name || !pending.email || !pending.password) {
    return { success: false, error: 'Session expired. Please fill in the form again.' };
  }
  return requestDemoOTP(pending);
}

export async function verifyDemoOTP(code) {
  const pending = readPending();
  const trimmed = (code || '').replace(/\D/g, '');
  if (trimmed.length < 6) {
    return { success: false, error: 'Please enter the complete 6-digit code.' };
  }
  try {
    await api.post('/auth/register/verify-otp', {
      phone: pending.phone,
      otp: trimmed,
      name: pending.name,
      email: pending.email,
      password: pending.password
    }, { auth: false });
    clearPendingRegistration();
    return { success: true };
  } catch (err) {
    const code = err.code || '';
    return {
      success: false,
      error: err.message,
      expired: code === 'OTP_EXPIRED',
      tooManyAttempts: code === 'OTP_ATTEMPTS_EXCEEDED'
    };
  }
}

export async function resendOTP() {
  const pending = readPending();
  if (!pending.phone) {
    return { success: false, error: 'No active verification. Please start again.' };
  }
  return sendOTP(pending.phone);
}

export async function verifyOTP(code) {
  const pending = readPending();
  const trimmed = (code || '').trim();
  if (trimmed.length < 6) {
    return { success: false, error: 'Please enter the complete 6-digit code.' };
  }
  try {
    const res = await api.post('/auth/register/verify-otp', {
      phone: pending.phone,
      otp: trimmed,
      name: pending.name,
      email: pending.email,
      password: pending.password
    }, { auth: false });
    
    const user = res.user;
    const accessToken = res.accessToken;
    const refreshToken = res.refreshToken;
    const role = (user?.role === 'ADMIN' ? 'admin' : 'tourist');

    if (accessToken) {
      setTokens({ accessToken, refreshToken });
      saveSession({ user, role, accessToken, refreshToken });
    }

    clearPendingRegistration();
    return { success: true, user, role, accessToken, refreshToken };
  } catch (err) {
    const expired = err.code === 'OTP_EXPIRED';
    return { success: false, error: err.message, expired };
  }
}

function maskPhone(phone) {
  return phone ? `${phone.slice(0, 2)}******${phone.slice(-2)}` : '';
}

// ---------------------------------------------------------------------------
// Login (tourist + admin through the SAME endpoint)
// ---------------------------------------------------------------------------

export async function login(email, password) {
  const e = (email || '').trim().toLowerCase();
  const p = password || '';
  if (!e || !p) {
    return { success: false, error: 'Please enter your email and password.' };
  }
  try {
    // Automatically wait for backend cold start to finish if asleep
    await waitForBackendReady();
    const data = await api.post('/auth/login', { email: e, password: p }, { auth: false });
    setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    const role = (data.user.role || 'tourist').toLowerCase();
    const user = { ...data.user, role };
    const session = { user, role, accessToken: data.accessToken, refreshToken: data.refreshToken };
    saveSession(session);
    return { success: true, role, user };
  } catch (err) {
    const message = err.code === 'INVALID_CREDENTIALS' ? 'Incorrect email or password.' : err.message;
    return { success: false, error: message };
  }
}

export async function refreshSession() {
  try {
    const data = await api.post('/auth/refresh', { refreshToken: getRefreshToken() }, { auth: false });
    setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    return { success: true, accessToken: data.accessToken, refreshToken: data.refreshToken };
  } catch {
    return { success: false };
  }
}

export async function logout() {
  try {
    await api.post('/auth/logout', { refreshToken: getRefreshToken() }, { auth: false });
  } catch {
    // ignore — clear locally regardless
  }
  clearTokens();
  clearSession();
}

// ---------------------------------------------------------------------------
// Session persistence (used by AuthContext)
// ---------------------------------------------------------------------------

export function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function loadSession() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if (session?.accessToken) setTokens({ accessToken: session.accessToken, refreshToken: session.refreshToken });
    return session;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export async function updateProfileAvatar(avatarUrl) {
  const res = await api.patch('/auth/profile/avatar', { avatarUrl });
  const session = loadSession();
  if (session && res.user) {
    session.user = { ...session.user, avatarUrl: res.user.avatarUrl };
    saveSession(session);
  }
  return res.user;
}

export async function removeProfileAvatar() {
  const res = await api.delete('/auth/profile/avatar');
  const session = loadSession();
  if (session && res.user) {
    session.user = { ...session.user, avatarUrl: null };
    saveSession(session);
  }
  return res.user;
}

function getRefreshToken() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || '{}').refreshToken || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Password Reset Flow
// ---------------------------------------------------------------------------

export async function forgotPassword(email) {
  const e = (email || '').trim().toLowerCase();
  if (!e) {
    return { success: false, error: 'Please enter your registered email address.' };
  }
  try {
    const data = await api.post('/auth/forgot-password', { email: e }, { auth: false });
    return {
      success: true,
      message: data?.message || 'If an account exists for this email, password reset instructions have been sent.'
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function verifyResetToken(token) {
  if (!token) {
    return { success: false, error: 'This password reset link is invalid or has expired.' };
  }
  try {
    const data = await api.get(`/auth/verify-reset-token?token=${encodeURIComponent(token)}`, { auth: false });
    return { success: true, valid: Boolean(data?.valid) };
  } catch (err) {
    return { success: false, error: err.message || 'This password reset link is invalid or has expired.' };
  }
}

export async function resetPassword(token, password) {
  if (!token) {
    return { success: false, error: 'This password reset link is invalid or has expired.' };
  }
  if (!password || password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters.' };
  }
  try {
    const data = await api.post('/auth/reset-password', { token, password }, { auth: false });
    return {
      success: true,
      message: data?.message || 'Password has been reset successfully. Please log in with your new password.'
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function getDevMailPreview() {
  try {
    const data = await api.get('/auth/dev-mail-preview', { auth: false });
    return data?.mail || null;
  } catch {
    return null;
  }
}

export async function changePassword(currentPassword, newPassword) {
  if (!currentPassword) {
    return { success: false, error: 'Current password is required.' };
  }
  if (!newPassword || newPassword.trim().length < 8) {
    return { success: false, error: 'New password must be at least 8 characters long.' };
  }
  try {
    const data = await api.post('/auth/change-password', { currentPassword, newPassword });
    return { success: true, message: data?.message || 'Password changed successfully.' };
  } catch (err) {
    return { success: false, error: err.message || 'Failed to change password.' };
  }
}

