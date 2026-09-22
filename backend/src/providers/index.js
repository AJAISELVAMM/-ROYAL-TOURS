// =============================================================================
// index.js — Central Provider Registry & Multi-Source Dispatcher.
// Connects 14 specialized category providers with intelligent fallbacks.
// =============================================================================

import * as hotelProvider from './hotelProvider.js';
import * as restaurantProvider from './restaurantProvider.js';
import * as attractionProvider from './attractionProvider.js';
import * as hospitalProvider from './hospitalProvider.js';
import * as policeProvider from './policeProvider.js';
import * as emergencyProvider from './emergencyProvider.js';
import * as transportProvider from './transportProvider.js';
import * as transitHubProvider from './transitHubProvider.js';
import * as shoppingProvider from './shoppingProvider.js';
import * as theatreProvider from './theatreProvider.js';
import * as atmProvider from './atmProvider.js';
import * as pharmacyProvider from './pharmacyProvider.js';
import * as fuelProvider from './fuelProvider.js';
import * as govOfficeProvider from './govOfficeProvider.js';
import * as facilityProvider from './facilityProvider.js';
import * as geocodingProvider from './geocodingProvider.js';
import * as routingProvider from './maps/routingProvider.js';
import * as geoapifyProvider from './geoapifyProvider.js';

import providerCache from './base/cache.js';

export {
  hotelProvider,
  restaurantProvider,
  attractionProvider,
  hospitalProvider,
  policeProvider,
  emergencyProvider,
  transportProvider,
  transitHubProvider,
  shoppingProvider,
  theatreProvider,
  atmProvider,
  pharmacyProvider,
  fuelProvider,
  govOfficeProvider,
  facilityProvider,
  geocodingProvider,
  routingProvider,
  geoapifyProvider,
  providerCache
};

export const CATEGORIES = {
  HOTELS: 'hotels',
  RESTAURANTS: 'restaurants',
  PLACES: 'places',
  ATTRACTIONS: 'attractions',
  THEATRES: 'theatres',
  HOSPITALS: 'hospitals',
  POLICE: 'police',
  EMERGENCY: 'emergency',
  TRANSPORT: 'transport',
  TRANSIT_HUBS: 'transit_hubs',
  SHOPPING: 'shopping',
  ATMS: 'atms',
  PHARMACIES: 'pharmacies',
  FUEL: 'fuel',
  GOV_OFFICES: 'gov_offices',
  FACILITIES: 'facilities'
};

const PROVIDER_MAP = {
  // Theatres & Cinemas
  theatres: theatreProvider.searchTheatres,
  theatre: theatreProvider.searchTheatres,
  cinemas: theatreProvider.searchTheatres,
  cinema: theatreProvider.searchTheatres,
  // Hotels
  hotels: hotelProvider.searchHotels,
  hotel: hotelProvider.searchHotels,
  accommodation: hotelProvider.searchHotels,

  // Restaurants
  restaurants: restaurantProvider.searchRestaurants,
  restaurant: restaurantProvider.searchRestaurants,
  food: restaurantProvider.searchRestaurants,
  dining: restaurantProvider.searchRestaurants,

  // Attractions & Places
  places: attractionProvider.searchAttractions,
  place: attractionProvider.searchAttractions,
  attractions: attractionProvider.searchAttractions,
  attraction: attractionProvider.searchAttractions,
  sightseeing: attractionProvider.searchAttractions,

  // Hospitals & Healthcare
  hospitals: hospitalProvider.searchHospitals,
  hospital: hospitalProvider.searchHospitals,
  healthcare: hospitalProvider.searchHospitals,
  medical: hospitalProvider.searchHospitals,

  // Police
  police: policeProvider.searchPoliceStations,
  police_station: policeProvider.searchPoliceStations,
  police_stations: policeProvider.searchPoliceStations,

  // Emergency
  emergency: emergencyProvider.searchEmergencyServices,
  fire: emergencyProvider.searchEmergencyServices,
  ambulance: emergencyProvider.searchEmergencyServices,

  // Public Transport
  transport: transportProvider.searchTransportStops,
  public_transport: transportProvider.searchTransportStops,
  transit: transportProvider.searchTransportStops,
  bus_stops: transportProvider.searchTransportStops,

  // Transit Hubs
  transit_hubs: transitHubProvider.searchTransitHubs,
  transit_hub: transitHubProvider.searchTransitHubs,
  airports: transitHubProvider.searchTransitHubs,
  airport: transitHubProvider.searchTransitHubs,
  railway_stations: transitHubProvider.searchTransitHubs,
  railway_station: transitHubProvider.searchTransitHubs,

  // Shopping
  shopping: shoppingProvider.searchShopping,
  shops: shoppingProvider.searchShopping,
  supermarkets: shoppingProvider.searchShopping,
  malls: shoppingProvider.searchShopping,

  // ATMs
  atms: atmProvider.searchAtms,
  atm: atmProvider.searchAtms,
  banks: atmProvider.searchAtms,
  bank: atmProvider.searchAtms,

  // Pharmacies
  pharmacies: pharmacyProvider.searchPharmacies,
  pharmacy: pharmacyProvider.searchPharmacies,
  chemist: pharmacyProvider.searchPharmacies,

  // Fuel & EV
  fuel: fuelProvider.searchFuelStations,
  fuel_station: fuelProvider.searchFuelStations,
  petrol_pump: fuelProvider.searchFuelStations,
  ev_charging: fuelProvider.searchFuelStations,

  // Gov Offices
  gov_offices: govOfficeProvider.searchGovOffices,
  gov_office: govOfficeProvider.searchGovOffices,
  tourism_offices: govOfficeProvider.searchGovOffices,
  tourism_office: govOfficeProvider.searchGovOffices,

  // Facilities
  facilities: facilityProvider.searchFacilities,
  facility: facilityProvider.searchFacilities,
  toilets: facilityProvider.searchFacilities,
  drinking_water: facilityProvider.searchFacilities,
  parking: facilityProvider.searchFacilities
};

/**
 * Search POIs / facilities across any of the 14 supported categories.
 */
export async function searchByCategory(category, options = {}) {
  const normCategory = String(category || '').toLowerCase().trim();
  const searchFn = PROVIDER_MAP[normCategory];

  if (!searchFn) {
    throw new Error(`Unknown or unsupported category: ${category}`);
  }

  return searchFn(options);
}

/**
 * Returns the list of all active categories and their descriptions.
 */
export function getAvailableCategories() {
  return [
    { id: 'hotels', name: 'Hotels & Lodging', description: 'Hotels, guest houses, motels and tourist accommodation' },
    { id: 'restaurants', name: 'Restaurants & Dining', description: 'Restaurants, cafes, food outlets, veg/non-veg dining' },
    { id: 'places', name: 'Tourist Attractions', description: 'Monuments, heritage sites, viewpoints, museums, temples' },
    { id: 'hospitals', name: 'Hospitals & Healthcare', description: '24/7 hospitals, trauma care, medical clinics' },
    { id: 'police', name: 'Police Stations', description: 'Law enforcement, tourist police, public safety assistance' },
    { id: 'emergency', name: 'Emergency Services', description: 'Fire stations, ambulance points, ERSS 112 services' },
    { id: 'transport', name: 'Public Transport', description: 'City bus stops, metro stations, transit platforms' },
    { id: 'transit_hubs', name: 'Transit Hubs', description: 'Airports, junction railway stations, central bus terminals' },
    { id: 'shopping', name: 'Shopping & Markets', description: 'Supermarkets, shopping malls, handicraft & souvenir shops' },
    { id: 'atms', name: 'ATMs & Banks', description: '24/7 automated teller machines and bank branches' },
    { id: 'pharmacies', name: 'Pharmacies', description: '24/7 medical shops, Jan Aushadhi Kendras, prescription stores' },
    { id: 'fuel', name: 'Fuel & EV Charging', description: 'Petrol/diesel pumps, CNG outlets, EV fast charging points' },
    { id: 'gov_offices', name: 'Gov & Tourism Offices', description: 'Tourist information desks, collectorates, municipal offices' },
    { id: 'facilities', name: 'Tourist Facilities', description: 'Public restrooms, clean drinking water kiosks, parking' }
  ];
}

/**
 * Inspect status of all configured providers and cache.
 */
export function getProviderStatus() {
  const geoapifyKeyPresent = Boolean(process.env.GEOAPIFY_API_KEY || (typeof config !== 'undefined' && config?.geoapifyApiKey));
  return {
    cacheEntries: providerCache.size(),
    categoriesSupported: Object.keys(CATEGORIES).length,
    routingProvider: process.env.ROUTING_PROVIDER || 'openrouteservice',
    geocodingProvider: process.env.GEOCODING_PROVIDER || 'photon',
    geoapifyStatus: geoapifyKeyPresent ? 'configured' : 'available_fallback',
    overpassStatus: 'active',
    databaseFallback: 'active'
  };
}

export default {
  searchByCategory,
  getAvailableCategories,
  getProviderStatus,
  CATEGORIES
};
