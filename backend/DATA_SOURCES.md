# TourGuard AI — Authoritative Data Sources & Provider Directory

This document provides a comprehensive, verified catalog of all official government APIs, government open datasets, open public data platforms, and geospatial providers integrated into the TourGuard AI provider architecture.

---

## Architecture Summary

TourGuard AI uses a **modular provider architecture** with a **multi-tier fallback pipeline**:

```
[Tier 1: Geoapify Places API / Official Government API]
                      ↓
[Tier 2: High-Reliability Open Public Dataset (OSM Overpass)]
                      ↓
[Tier 3: Local Curated Database / Seed Registry]
                      ↓
[Tier 4: Graceful Empty Result (Never Fabricates Data)]
```

All data returned by providers is normalized into a unified schema:

```json
{
  "id": "...",
  "name": "...",
  "category": "hotel",
  "address": "...",
  "latitude": 0,
  "longitude": 0,
  "phone": "...",
  "rating": null,
  "openingHours": null,
  "description": null,
  "source": "...",
  "sourceUrl": "..."
}
```

---

## Geoapify Places & Location Intelligence API

- **Category:** Unified Geospatial Location Data Provider (Hotels, Restaurants, Attractions, Healthcare, Police, Pharmacies, Supermarkets, ATMs, Banks, Fuel, Transit, Airports, Railway Stations, Facilities)
- **Provider Module:** [`backend/src/providers/geoapifyProvider.js`](file:///d:/sihfinal/tourguard/backend/src/providers/geoapifyProvider.js)
- **Classification:** **Commercial Geospatial Location Data Provider** *(Not a government API)*
- **Organization / Company:** Geoapify GmbH (Augsburg, Germany)
- **Official API / Endpoint:** Geoapify Places API v2 (`https://api.geoapify.com/v2/places`)
- **Website:** [https://www.geoapify.com](https://www.geoapify.com)
- **API Documentation:** [https://apidocs.geoapify.com/docs/places/](https://apidocs.geoapify.com/docs/places/)
- **Free or Paid:** Freemium (Free Developer Tier available)
- **Free-Plan Limitations:** **3,000 API requests / credits per day** (5 requests/sec rate limit). No credit card required for free tier.
- **API Key Required:** Yes (`GEOAPIFY_API_KEY`)
- **Environment Variable:** `GEOAPIFY_API_KEY=your_geoapify_key_here`
- **Rate Limits & Caching:** In-memory TTL cache (15 minutes) with automatic key sanitization in logs.
- **Categories Supported:**
  - **Hotels / Accommodation:** `accommodation,accommodation.hotel,accommodation.guest_house,accommodation.motel,accommodation.hostel`
  - **Restaurants / Food:** `catering.restaurant,catering.cafe,catering.fast_food`
  - **Tourist Attractions:** `tourism.attraction,tourism.sights,heritage,entertainment.museum,entertainment.theme_park,leisure.park`
  - **Hospitals / Healthcare:** `healthcare.hospital,healthcare.clinic`
  - **Police Stations:** `service.police`
  - **Pharmacies:** `healthcare.pharmacy`
  - **Supermarkets & Shopping:** `commercial.supermarket,commercial.shopping_mall,commercial.clothing,commercial.marketplace`
  - **ATMs:** `service.financial.atm`
  - **Banks:** `service.financial.bank`
  - **Fuel & EV Charging:** `service.vehicle.fuel,service.vehicle.charging_station`
  - **Public Transport:** `public_transport,public_transport.bus,public_transport.subway,public_transport.train`
  - **Airports:** `airport,airport.international,airport.domestic`
  - **Railway Stations:** `railway.station,public_transport.train`
  - **Tourist Facilities:** `amenity.toilet,amenity.drinking_water,parking`
  - **Emergency Services:** `service.police,healthcare.hospital,service.fire_station`
  - **Government Offices:** `administrative,administrative.country,administrative.state,tourism.information`
- **Data Normalization:** Normalized by `normalizeGeoapifyFeature` into the TourGuard unified POI schema (`id`, `name`, `category`, `address`, `latitude`, `longitude`, `phone`, `rating`, `reviews`, `openingHours`, `description`, `source: 'geoapify'`, `verified: true`, `distanceKm`, and category-specific `facilities`, `cuisine`, `veg`, `pricePerNight`, `priceRange`).
- **Error Handling:** Gracefully catches 401 (invalid key), 403 (unauthorized), 429 (quota exceeded), network timeouts, and missing key without throwing unhandled exceptions or exposing API keys in logs, seamlessly falling back to OpenStreetMap Overpass $\rightarrow$ Database $\rightarrow$ Curated Seed Registry.
- **Reason for Choosing It:** High-speed, structured worldwide location discovery with rich category taxonomy and contact details.
