// =============================================================================
// nearestService.js — nearest emergency service via Haversine distance.
//
// Reads real, geocoded emergency services from the database (EmergencyService)
// and returns the closest match(es) sorted by straight-line distance. Used by
// the "Find Nearest Help" and safety-map features.
//
// Haversine is a DETERMINISTIC geographic formula (not a trained ML model).
// =============================================================================

import prisma from '../../config/database.js';
import { haversineKm } from './haversine.js';
import config from '../config.js';

// Normalize free-text service types into the DB enum values.
const TYPE_MAP = {
  POLICE: 'POLICE',
  POLICE_STATION: 'POLICE',
  HOSPITAL: 'HOSPITAL',
  MEDICAL: 'HOSPITAL',
  FIRE: 'FIRE_STATION',
  FIRE_STATION: 'FIRE_STATION',
  PHARMACY: 'PHARMACY'
};

export function normalizeServiceType(type) {
  return TYPE_MAP[String(type || '').toUpperCase()] || null;
}

// Find the N nearest emergency services of `type` to (lat, lon).
export async function findNearestServices(lat, lon, type, { limit = 5, allTypes = false } = {}) {
  const { assertValidCoordinates } = await import('./haversine.js');
  assertValidCoordinates(lat, lon);

  const where = allTypes ? {} : { type: normalizeServiceType(type) || undefined };
  const services = await prisma.emergencyService.findMany({
    where: { active: true, ...where }
  });

  const results = services
    .map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type,
      address: s.address,
      latitude: s.latitude,
      longitude: s.longitude,
      phone: s.phone,
      distanceKm: +haversineKm(lat, lon, s.latitude, s.longitude).toFixed(2),
      estimatedTravelTime: 0
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);

  // Estimated travel time (minutes) from distance / configured emergency speed.
  const speed = config.routing.emergencySpeedKmh;
  for (const r of results) {
    r.estimatedTravelTime = Math.max(1, Math.round((r.distanceKm / speed) * 60));
  }

  return results;
}

// Convenience: single nearest service.
export async function findNearestService(lat, lon, type) {
  const list = await findNearestServices(lat, lon, type, { limit: 1 });
  return list[0] || null;
}
