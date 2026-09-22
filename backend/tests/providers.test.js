// =============================================================================
// providers.test.js — Automated tests for all 14 data providers & normalized schemas.
// =============================================================================

import { api } from './helpers.js';
import * as providers from '../src/providers/index.js';
import { providerCache } from '../src/providers/base/cache.js';

describe('Modular Data Providers', () => {
  beforeEach(() => {
    providerCache.clear();
  });

  describe('1. Provider Registry & Initialization', () => {
    it('initializes all 14 category providers and utilities', () => {
      expect(providers.hotelProvider).toBeDefined();
      expect(providers.restaurantProvider).toBeDefined();
      expect(providers.attractionProvider).toBeDefined();
      expect(providers.hospitalProvider).toBeDefined();
      expect(providers.policeProvider).toBeDefined();
      expect(providers.emergencyProvider).toBeDefined();
      expect(providers.transportProvider).toBeDefined();
      expect(providers.transitHubProvider).toBeDefined();
      expect(providers.shoppingProvider).toBeDefined();
      expect(providers.atmProvider).toBeDefined();
      expect(providers.pharmacyProvider).toBeDefined();
      expect(providers.fuelProvider).toBeDefined();
      expect(providers.govOfficeProvider).toBeDefined();
      expect(providers.facilityProvider).toBeDefined();
      expect(providers.geocodingProvider).toBeDefined();
      expect(providers.routingProvider).toBeDefined();
    });

    it('returns available categories metadata', () => {
      const cats = providers.getAvailableCategories();
      expect(Array.isArray(cats)).toBe(true);
      expect(cats.length).toBe(14);
      expect(cats.find((c) => c.id === 'hotels')).toBeDefined();
      expect(cats.find((c) => c.id === 'hospitals')).toBeDefined();
      expect(cats.find((c) => c.id === 'police')).toBeDefined();
    });

    it('reports provider and cache status', () => {
      const status = providers.getProviderStatus();
      expect(status.categoriesSupported).toBeGreaterThanOrEqual(15);
      expect(status.overpassStatus).toBe('active');
    });
  });

  describe('2. Normalized Response Schema Verification', () => {
    const requiredFields = ['id', 'name', 'category', 'source', 'sourceUrl'];

    it('normalizes hotel search results', async () => {
      const hotels = await providers.hotelProvider.searchHotels({
        latitude: 11.0046,
        longitude: 76.9659,
        limit: 5
      });
      expect(Array.isArray(hotels)).toBe(true);
      expect(hotels.length).toBeGreaterThan(0);
      const h = hotels[0];
      requiredFields.forEach((f) => expect(h).toHaveProperty(f));
      expect(h.category).toBe('hotel');
      expect(Array.isArray(h.facilities)).toBe(true);
    });

    it('normalizes restaurant search results with veg and cuisine tags', async () => {
      const restaurants = await providers.restaurantProvider.searchRestaurants({
        latitude: 11.0046,
        longitude: 76.9659,
        limit: 5
      });
      expect(Array.isArray(restaurants)).toBe(true);
      expect(restaurants.length).toBeGreaterThan(0);
      const r = restaurants[0];
      requiredFields.forEach((f) => expect(r).toHaveProperty(f));
      expect(r.category).toBe('restaurant');
      expect(r).toHaveProperty('cuisine');
      expect(r).toHaveProperty('veg');
    });

    it('normalizes hospital search results with emergency availability', async () => {
      const hospitals = await providers.hospitalProvider.searchHospitals({
        latitude: 11.0046,
        longitude: 76.9659,
        limit: 5
      });
      expect(Array.isArray(hospitals)).toBe(true);
      expect(hospitals.length).toBeGreaterThan(0);
      const hosp = hospitals[0];
      requiredFields.forEach((f) => expect(hosp).toHaveProperty(f));
      expect(hosp.category).toBe('hospital');
      expect(hosp.phone).toBeTruthy();
    });

    it('normalizes police station search results', async () => {
      const police = await providers.policeProvider.searchPoliceStations({
        latitude: 11.0046,
        longitude: 76.9659,
        limit: 5
      });
      expect(Array.isArray(police)).toBe(true);
      expect(police.length).toBeGreaterThan(0);
      const pol = police[0];
      requiredFields.forEach((f) => expect(pol).toHaveProperty(f));
      expect(pol.category).toBe('police');
      expect(pol.phone).toBeTruthy();
    });

    it('normalizes emergency services results', async () => {
      const emergency = await providers.emergencyProvider.searchEmergencyServices({
        latitude: 11.0046,
        longitude: 76.9659,
        limit: 5
      });
      expect(Array.isArray(emergency)).toBe(true);
      expect(emergency.length).toBeGreaterThan(0);
      const em = emergency[0];
      requiredFields.forEach((f) => expect(em).toHaveProperty(f));
    });

    it('normalizes transit hubs (airports, railway, bus terminals)', async () => {
      const hubs = await providers.transitHubProvider.searchTransitHubs({
        latitude: 11.0046,
        longitude: 76.9659,
        limit: 5
      });
      expect(Array.isArray(hubs)).toBe(true);
      expect(hubs.length).toBeGreaterThan(0);
      expect(hubs[0].category).toBe('transit_hub');
    });

    it('normalizes ATMs and bank branches', async () => {
      const atms = await providers.atmProvider.searchAtms({
        latitude: 11.0046,
        longitude: 76.9659,
        limit: 5
      });
      expect(Array.isArray(atms)).toBe(true);
      expect(atms.length).toBeGreaterThan(0);
      expect(['atm', 'bank']).toContain(atms[0].category);
    });

    it('normalizes pharmacies with dispensing status', async () => {
      const pharmacies = await providers.pharmacyProvider.searchPharmacies({
        latitude: 11.0046,
        longitude: 76.9659,
        limit: 5
      });
      expect(Array.isArray(pharmacies)).toBe(true);
      expect(pharmacies.length).toBeGreaterThan(0);
      expect(pharmacies[0].category).toBe('pharmacy');
    });

    it('normalizes fuel stations and EV charging', async () => {
      const fuels = await providers.fuelProvider.searchFuelStations({
        latitude: 11.0046,
        longitude: 76.9659,
        limit: 5
      });
      expect(Array.isArray(fuels)).toBe(true);
      expect(fuels.length).toBeGreaterThan(0);
      expect(['fuel_station', 'ev_charging']).toContain(fuels[0].category);
    });

    it('normalizes government and tourism offices', async () => {
      const offices = await providers.govOfficeProvider.searchGovOffices({
        latitude: 11.0046,
        longitude: 76.9659,
        limit: 5
      });
      expect(Array.isArray(offices)).toBe(true);
      expect(offices.length).toBeGreaterThan(0);
      expect(['gov_office', 'tourism_office']).toContain(offices[0].category);
    });

    it('normalizes useful tourist facilities (toilets, water, parking)', async () => {
      const facilities = await providers.facilityProvider.searchFacilities({
        latitude: 11.0046,
        longitude: 76.9659,
        limit: 5
      });
      expect(Array.isArray(facilities)).toBe(true);
      expect(facilities.length).toBeGreaterThan(0);
      expect(facilities[0].category).toBe('tourist_facility');
    });
  });

  describe('3. Geocoding & Routing Providers', () => {
    it('geocodes place names into coordinates', async () => {
      const geo = await providers.geocodingProvider.geocode('Coimbatore Railway Station');
      expect(geo).toBeDefined();
      expect(geo.lat).toBeCloseTo(11.0, 1);
      expect(geo.lon).toBeCloseTo(76.96, 1);
    });

    it('calculates walking and driving routes', async () => {
      const route = await providers.routingProvider.getRoute({
        from: 'Railway Station',
        to: 'Marudamalai',
        mode: 'driving'
      });
      expect(route).toBeDefined();
      expect(route.distanceKm).toBeGreaterThan(0);
      expect(route.durationMinutes).toBeGreaterThan(0);
      expect(route.steps.length).toBeGreaterThan(0);
    });
  });

  describe('4. API Endpoints Compatibility', () => {
    it('GET /api/facilities/categories returns all categories', async () => {
      const res = await api().get('/api/facilities/categories');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(14);
    });

    it('GET /api/facilities/nearby queries any category by location', async () => {
      const res = await api().get('/api/facilities/nearby?lat=11.0046&lon=76.9659&category=hospital');
      expect(res.status).toBe(200);
      expect(res.body.data.category).toBe('hospital');
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThan(0);
    });

    it('GET /api/facilities/providers/status returns provider health and cache stats', async () => {
      const res = await api().get('/api/facilities/providers/status');
      expect(res.status).toBe(200);
      expect(res.body.data.categoriesSupported).toBeGreaterThanOrEqual(15);
    });

    it('GET /api/discover/atms returns ATM list seamlessly', async () => {
      const res = await api().get('/api/discover/atms');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('GET /api/discover/pharmacies returns pharmacy list seamlessly', async () => {
      const res = await api().get('/api/discover/pharmacies');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('GET /api/safety/map returns live and fallback emergency markers', async () => {
      const res = await api().get('/api/safety/map');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.markers)).toBe(true);
      expect(res.body.data.markers.length).toBeGreaterThan(0);
    });

    it('GET /api/emergency/nearest locates nearest hospital', async () => {
      const res = await api().get('/api/emergency/nearest?latitude=11.0046&longitude=76.9659&type=HOSPITAL');
      expect(res.status).toBe(200);
      expect(res.body.data.type).toBe('HOSPITAL');
      expect(res.body.data.name).toBeTruthy();
    });
  });
});
