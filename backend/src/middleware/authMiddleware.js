// =============================================================================
// authMiddleware.js — JWT verification for REST + Socket.IO.
// =============================================================================

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../config/env.js';
import { unauthorized } from '../utils/errors.js';
import prisma from '../config/database.js';

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role },
    config.jwtSecret,
    { expiresIn: config.jwtAccessExpires }
  );
}

export function signRefreshToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, type: 'refresh', jti: crypto.randomUUID() },
    config.jwtRefreshSecret,
    { expiresIn: config.jwtRefreshExpires }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, config.jwtRefreshSecret);
}

// Express middleware — authenticates a request from the Bearer token.
export async function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw unauthorized('Authentication required.');

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw unauthorized('Invalid or expired token.');
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw unauthorized('Account no longer exists.');
    if (user.status === 'BLOCKED') throw unauthorized('Account is suspended.');

    req.user = {
      id: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      phone: user.phone
    };
    next();
  } catch (err) {
    next(err);
  }
}

// Optional auth — attaches req.user if a valid token is present, else continues.
export async function optionalAuthenticate(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (token) {
      const payload = verifyAccessToken(token);
      const user = await prisma.user.findUnique({ where: { id: payload.sub } });
      if (user && user.status !== 'BLOCKED') {
        req.user = { id: user.id, role: user.role, name: user.name, email: user.email, phone: user.phone };
      }
    }
  } catch {
    // ignore invalid tokens in optional mode
  }
  next();
}

// Socket.IO authentication — verifies a JWT supplied in the handshake auth.
export async function authenticateSocket(socket, next) {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Unauthorized'));
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status === 'BLOCKED') return next(new Error('Unauthorized'));
    socket.user = {
      id: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      phone: user.phone
    };
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
}
