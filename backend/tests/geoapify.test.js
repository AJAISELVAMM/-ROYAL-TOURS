// =============================================================================
// geoapify.test.js — Tests for Geoapify Places API provider & normalized schema.
// =============================================================================

import * as geoapifyProvider from '../src/providers/geoapifyProvider.js';
import { normalizeGeoapifyFeature } from '../src/providers/geoapifyProvider.js';
import providerCache from '../src/providers/base/cache.js';

describe('Geoapify Places API Provider', () => {
  beforeEach(() => {
    providerCache.clear();
  });

  describe('1. Module Exports & Methods', () => {
    it('exports all standard Geoapify category search methods', () => {
      expect(typeof geoapifyProvider.searchHotels).toBe('function');
      expect(typeof geoapifyProvider.searchRestaurants).toBe('function');
      expect(typeof geoapifyProvider.searchAttractions).toBe('function');
      expect(typeof geoapifyProvider.searchHospitals).toBe('function');
      expect(typeof geoapifyProvider.searchPolice).toBe('function');
      expect(typeof geoapifyProvider.searchPharmacies).toBe('function');
      expect(typeof geoapifyProvider.searchSupermarkets).toBe('function');
      expect(typeof geoapifyProvider.searchATMs).toBe('function');
      expect(typeof geoapifyProvider.searchBanks).toBe('function');
      expect(typeof geoapifyProvider.searchFuelStations).toBe('function');
      expect(typeof geoapifyProvider.searchTransport).toBe('function');
      expect(typeof geoapifyProvider.searchAirports).toBe('function');
      expect(typeof geoapifyProvider.searchRailwayStations).toBe('function');
      expect(typeof geoapifyProvider.searchFacilities).toBe('function');
    });
  });

  describe('2. Geoapify Feature Normalization', () => {
    const mockFeature = {
      type: 'Feature',
      properties: {
        place_id: 'geo_place_12345',
        name: 'Grand Residency Hotel',
        formatted: 'Grand Residency Hotel, Avinashi Road, Coimbatore, Tamil Nadu, 641018, India',
        address_line1: 'Grand Residency Hotel',
        address_line2: 'Avinashi Road',
        city: 'Coimbatore',
        state: 'Tamil Nadu',
        country: 'India',
        postcode: '641018',
        lat: 11.0120,
        lon: 76.9680,
        categories: ['accommodation', 'accommodation.hotel', 'internet_access'],
        contact: {
          phone: '+91 422 2244111',
          email: 'info@grandresidency.com'
        },
        website: 'https://grandresidency.com',
        opening_hours: '24/7',
        rank: {
          popularity: 0.85
        },
        facilities: {
          wheelchair: true,
          internet_access: true
        },
        datasource: {
          url: 'https://www.geoapify.com'
        }
      },
      geometry: {
        type: 'Point',
        coordinates: [76.9680, 11.0120]
      }
    };

    it('normalizes Geoapify feature into standard TourGuard POI schema', () => {
      const normalized = normalizeGeoapifyFeature(mockFeature, {
        originLat: 11.0046,
        originLon: 76.9659,
        requestedCategory: 'hotel',
        extra: {
          pricePerNight: 3500,
          facilities: ['Free WiFi', 'Wheelchair Accessible']
        }
      });

      expect(normalized).toBeDefined();
      expect(normalized.id).toBe('geoapify_geo_place_12345');
      expect(normalized.name).toBe('Grand Residency Hotel');
      expect(normalized.category).toBe('hotel');
      expect(normalized.address).toContain('Avinashi Road');
      expect(normalized.latitude).toBe(11.0120);
      expect(normalized.longitude).toBe(76.9680);
      expect(normalized.phone).toBe('+91 422 2244111');
      expect(normalized.source).toBe('geoapify');
      expect(normalized.verified).toBe(true);
      expect(normalized.distanceKm).toBeGreaterThan(0);
      expect(normalized.pricePerNight).toBe(3500);
      expect(normalized.facilities).toContain('Free WiFi');
    });

    it('handles missing/empty fields without crashing', () => {
      const minimalFeature = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: [76.96, 11.00]
        }
      };

      const normalized = normalizeGeoapifyFeature(minimalFeature);
      expect(normalized).toBeDefined();
      expect(normalized.name).toBe('Unnamed Location');
      expect(normalized.source).toBe('geoapify');
      expect(normalized.phone).toBeNull();
      expect(normalized.openingHours).toBeNull();
      expect(normalized.latitude).toBe(11.00);
      expect(normalized.longitude).toBe(76.96);
    });
  });

  describe('3. Error & Edge Case Handling', () => {
    it('gracefully returns empty array for invalid or out-of-range coordinates', async () => {
      const res1 = await geoapifyProvider.searchHotels({ latitude: 'invalid', longitude: 76.9659 });
      expect(res1).toEqual([]);

      const res2 = await geoapifyProvider.searchHotels({ latitude: 120, longitude: 76.9659 });
      expect(res2).toEqual([]);
    });

    it('handles missing API key without throwing an unhandled exception', async () => {
      const res = await geoapifyProvider.searchHotels({
        latitude: 11.0046,
        longitude: 76.9659,
        apiKey: ''
      });
      expect(Array.isArray(res)).toBe(true);
    });

    it('handles invalid API key without throwing an unhandled exception', async () => {
      const res = await geoapifyProvider.searchHotels({
        latitude: 11.0046,
        longitude: 76.9659,
        apiKey: 'invalid_dummy_key_12345'
      });
      expect(Array.isArray(res)).toBe(true);
    });
  });
});
