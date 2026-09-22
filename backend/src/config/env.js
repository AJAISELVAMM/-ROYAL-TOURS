// =============================================================================
// env.js — central, validated configuration. All secrets come from environment
// variables (via dotenv). Nothing sensitive is hardcoded here.
// =============================================================================

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';

function required(name, fallback) {
  const v = process.env[name];
  if (!v && isProd) {
    // In production, missing core secrets are a hard error at startup.
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v || fallback || '';
}

const config = {
  nodeEnv: NODE_ENV,
  isProd,
  port: parseInt(process.env.PORT || '5000', 10),

  databaseUrl: process.env.DATABASE_URL || '',

  jwtSecret: required('JWT_SECRET'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET'),
  jwtAccessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
  jwtRefreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d',

  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  corsOrigins: (process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  sms: {
    provider: process.env.SMS_PROVIDER || 'twilio',
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
    twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || ''
  },

  translation: {
    provider: process.env.TRANSLATION_PROVIDER || 'gemini',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    apiKey: process.env.TRANSLATION_API_KEY || ''
  },

  routing: {
    provider: process.env.ROUTING_PROVIDER || 'openrouteservice',
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
    openRouteServiceApiKey: process.env.OPENROUTESERVICE_API_KEY || ''
  },

  geocoding: {
    provider: process.env.GEOCODING_PROVIDER || 'photon',
    apiKey: process.env.GEOCODING_API_KEY || ''
  },

  // Geoapify Places API key (sanitized in case full URL was passed)
  geoapifyApiKey: (() => {
    const raw = process.env.GEOAPIFY_API_KEY || '';
    if (raw.includes('apiKey=')) {
      const match = raw.match(/apiKey=([a-zA-Z0-9_-]+)/);
      return match ? match[1] : raw;
    }
    return raw.trim();
  })(),

  // Open Government Data (data.gov.in) key
  dataGovInApiKey: process.env.DATA_GOV_IN_API_KEY || process.env.OPEN_DATA_API_KEY || '',

  // Category-specific provider selectors & keys
  hotel: {
    provider: process.env.HOTEL_PROVIDER || (process.env.GEOAPIFY_API_KEY ? 'geoapify' : 'overpass'),
    apiKey: process.env.HOTEL_API_KEY || process.env.GEOAPIFY_API_KEY || ''
  },
  restaurant: {
    provider: process.env.RESTAURANT_PROVIDER || (process.env.GEOAPIFY_API_KEY ? 'geoapify' : 'overpass'),
    apiKey: process.env.RESTAURANT_API_KEY || process.env.GEOAPIFY_API_KEY || ''
  },
  attraction: {
    provider: process.env.ATTRACTION_PROVIDER || (process.env.GEOAPIFY_API_KEY ? 'geoapify' : 'overpass'),
    apiKey: process.env.ATTRACTION_API_KEY || process.env.GEOAPIFY_API_KEY || ''
  },
  hospital: {
    provider: process.env.HOSPITAL_PROVIDER || (process.env.GEOAPIFY_API_KEY ? 'geoapify' : 'overpass'),
    apiKey: process.env.HOSPITAL_API_KEY || process.env.GEOAPIFY_API_KEY || ''
  },
  police: {
    provider: process.env.POLICE_PROVIDER || (process.env.GEOAPIFY_API_KEY ? 'geoapify' : 'overpass'),
    apiKey: process.env.POLICE_API_KEY || process.env.GEOAPIFY_API_KEY || ''
  },
  emergency: {
    provider: process.env.EMERGENCY_PROVIDER || (process.env.GEOAPIFY_API_KEY ? 'geoapify' : 'overpass'),
    apiKey: process.env.EMERGENCY_API_KEY || process.env.GEOAPIFY_API_KEY || ''
  },
  transport: {
    provider: process.env.TRANSPORT_PROVIDER || (process.env.GEOAPIFY_API_KEY ? 'geoapify' : 'overpass'),
    apiKey: process.env.TRANSPORT_API_KEY || process.env.GEOAPIFY_API_KEY || ''
  },
  transitHub: {
    provider: process.env.TRANSIT_HUB_PROVIDER || (process.env.GEOAPIFY_API_KEY ? 'geoapify' : 'overpass'),
    apiKey: process.env.TRANSIT_HUB_API_KEY || process.env.GEOAPIFY_API_KEY || ''
  },
  shopping: {
    provider: process.env.SHOPPING_PROVIDER || (process.env.GEOAPIFY_API_KEY ? 'geoapify' : 'overpass'),
    apiKey: process.env.SHOPPING_API_KEY || process.env.GEOAPIFY_API_KEY || ''
  },
  atm: {
    provider: process.env.ATM_PROVIDER || (process.env.GEOAPIFY_API_KEY ? 'geoapify' : 'overpass'),
    apiKey: process.env.ATM_API_KEY || process.env.GEOAPIFY_API_KEY || ''
  },
  pharmacy: {
    provider: process.env.PHARMACY_PROVIDER || (process.env.GEOAPIFY_API_KEY ? 'geoapify' : 'overpass'),
    apiKey: process.env.PHARMACY_API_KEY || process.env.GEOAPIFY_API_KEY || ''
  },
  fuel: {
    provider: process.env.FUEL_PROVIDER || (process.env.GEOAPIFY_API_KEY ? 'geoapify' : 'overpass'),
    apiKey: process.env.FUEL_API_KEY || process.env.GEOAPIFY_API_KEY || ''
  },
  govOffice: {
    provider: process.env.GOV_OFFICE_PROVIDER || (process.env.GEOAPIFY_API_KEY ? 'geoapify' : 'overpass'),
    apiKey: process.env.GOV_OFFICE_API_KEY || process.env.GEOAPIFY_API_KEY || ''
  },
  facility: {
    provider: process.env.FACILITY_PROVIDER || (process.env.GEOAPIFY_API_KEY ? 'geoapify' : 'overpass'),
    apiKey: process.env.FACILITY_API_KEY || process.env.GEOAPIFY_API_KEY || ''
  },

  ai: {
    provider: process.env.AI_PROVIDER || '',
    openaiApiKey: process.env.OPENAI_API_KEY || ''
  },

  // ML inference service (FastAPI serving the trained Random Forest models).
  // Empty => ML disabled => engines fall back to deterministic rule-based logic.
  mlServiceUrl: process.env.ML_SERVICE_URL || '',

  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@tourguard.ai',
    passwordHash: process.env.ADMIN_PASSWORD_HASH || ''
  },

  // External-service mock mode. In production this must be false unless the
  // operator has explicitly confirmed demo data is acceptable.
  mockExternalServices:
    String(process.env.MOCK_EXTERNAL_SERVICES || 'false').toLowerCase() === 'true',
  mockLocation: String(process.env.MOCK_LOCATION || 'false').toLowerCase() === 'true'
};

if (config.isProd && config.mockExternalServices) {
  // eslint-disable-next-line no-console
  console.warn(
    '[env] MOCK_EXTERNAL_SERVICES is enabled in production. Emergency/live data may be simulated — this requires explicit operator confirmation.'
  );
}

export default config;
