// =============================================================================
// database.js — shared Prisma client instance.
// =============================================================================

import config from './env.js';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: config.databaseUrl || process.env.DATABASE_URL
    }
  },
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
});

export default prisma;
