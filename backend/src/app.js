// =============================================================================
// app.js — Express application (routes, middleware, docs). No server listen.
// =============================================================================

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';

import config from './config/env.js';
import swaggerSpec from './config/swagger.js';
import { errorHandler, notFoundHandler } from './middleware/errorMiddleware.js';
import { ok } from './utils/response.js';

import authRoutes from './routes/authRoutes.js';
import tripRoutes from './routes/tripRoutes.js';
import groupRoutes from './routes/groupRoutes.js';
import locationRoutes from './routes/locationRoutes.js';
import transportRoutes from './routes/transportRoutes.js';
import translationRoutes from './routes/translationRoutes.js';
import discoverRoutes from './routes/discoverRoutes.js';
import safetyRoutes from './routes/safetyRoutes.js';
import sosRoutes from './routes/sosRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import intelligenceRoutes from './routes/intelligenceRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import facilityRoutes from './routes/facilityRoutes.js';
import weatherRoutes from './routes/weatherRoutes.js';
import geocodingRoutes from './routes/geocodingRoutes.js';

import prisma from './config/database.js';

const app = express();

app.set('trust proxy', 1);

app.disable('x-powered-by');
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => callback(null, true),
    credentials: true
  })
);
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Public health endpoint — returns success/healthy without auth.
app.get('/api/health', async (_req, res) => {
  let db = 'connected';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    db = 'disconnected';
  }
  ok(res, { status: 'healthy', database: db, timestamp: new Date().toISOString() });
});

// API routes.
app.use('/api/auth', authRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/location', locationRoutes);
app.use('/api', transportRoutes); // /api/transport/routes, /api/routes, /api/fare/...
app.use('/api/translation', translationRoutes);
app.use('/api', translationRoutes); // /api/translate, /api/languages
app.use('/api/discover', discoverRoutes);
app.use('/api', safetyRoutes); // /api/safety/map, /api/emergency/nearest
app.use('/api/sos', sosRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/intelligence', intelligenceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/facilities', facilityRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/geocoding', geocodingRoutes);
app.use('/api/search', geocodingRoutes);

// Swagger docs.
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// 404 + global error handler.
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
