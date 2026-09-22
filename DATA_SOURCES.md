# TourGuard AI — Authoritative Data Sources & Provider Directory

This document provides a comprehensive, verified catalog of all official government APIs, government open datasets, and open public data platforms integrated into the TourGuard AI provider architecture.

---

## Architecture Summary

TourGuard AI uses a **modular provider architecture** with a **multi-tier fallback pipeline**:

```
[Tier 1: Official Government API / Government Open Dataset]
                      ↓
[Tier 2: High-Reliability Open Public Dataset / Open Source Engine]
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

## Category-by-Category Data Source Specifications

---

### 1. Hotels & Accommodation

- **Category:** Hotels / Accommodation
- **Provider Module:** [`hotelProvider.js`](file:///d:/sihfinal/tourguard/backend/src/providers/hotelProvider.js)
- **Primary Source Classification:** Government official & Government open dataset
- **Official Organization:** Ministry of Tourism, Government of India / National Integrated Database of Hospitality Industry (NIDHI) & State Tourism Development Corporations
- **Official API / Dataset:** NIDHI Hospitality Classification Portal / Open Government Data (OGD) Approved Accommodation Directory
- **Website:** [https://nidhi.nic.in](https://nidhi.nic.in) / [https://data.gov.in](https://data.gov.in)
- **API Documentation:** [https://data.gov.in/developer-apis](https://data.gov.in/developer-apis)
- **Free or Paid:** Free
- **API Key Required:** Optional (`DATA_GOV_IN_API_KEY` for OGD access; none for OpenStreetMap Overpass)
- **Environment Variables:** `HOTEL_PROVIDER=overpass`, `HOTEL_API_KEY=`, `DATA_GOV_IN_API_KEY=`
- **Rate Limits:** 10,000 queries/day on OGD; Overpass rate limits handled via in-memory TTL caching (15 mins) and 4 public mirror rotation
- **Data Returned:** Hotel name, address, latitude, longitude, star rating, phone/contact, website, facilities list, price estimate, source, source URL
- **Fallback Provider:** OpenStreetMap Overpass API (`tourism=hotel`, `tourism=guest_house`, `tourism=motel`, `tourism=hostel`) $\rightarrow$ Local Prisma `Hotel` table
- **Reason for Choosing It:** NIDHI is India's official statutory hospitality directory. OpenStreetMap provides exhaustive, open public real-time coverage with verified geolocation coordinates.

---

### 2. Restaurants & Food

- **Category:** Restaurants / Food & Dining
- **Provider Module:** [`restaurantProvider.js`](file:///d:/sihfinal/tourguard/backend/src/providers/restaurantProvider.js)
- **Primary Source Classification:** Government official & Open public dataset
- **Official Organization:** Food Safety and Standards Authority of India (FSSAI) / FoSCoS & Municipal Food Trade Licensing Open Data
- **Official API / Dataset:** FSSAI Open Registry & OpenStreetMap Open Food Datasets
- **Website:** [https://foscos.fssai.gov.in](https://foscos.fssai.gov.in) / [https://data.gov.in](https://data.gov.in)
- **API Documentation:** [https://foscos.fssai.gov.in](https://foscos.fssai.gov.in)
- **Free or Paid:** Free
- **API Key Required:** No
- **Environment Variables:** `RESTAURANT_PROVIDER=overpass`, `RESTAURANT_API_KEY=`
- **Rate Limits:** In-memory TTL cache (15 mins); Overpass multi-mirror rotation
- **Data Returned:** Restaurant name, address, latitude, longitude, cuisine, vegetarian/vegan tags (`veg`), contact phone, price range, opening hours, source, source URL
- **Fallback Provider:** OpenStreetMap Overpass API (`amenity=restaurant`, `amenity=cafe`, `amenity=fast_food`, `cuisine=*`, `diet:vegetarian=*`) $\rightarrow$ Local Prisma `Restaurant` table
- **Reason for Choosing It:** Provides authentic cuisine classification and strict vegetarian/non-vegetarian identification critical for domestic and international travelers.

---

### 3. Tourist Attractions & Places

- **Category:** Tourist Attractions / Sightseeing Places
- **Provider Module:** [`attractionProvider.js`](file:///d:/sihfinal/tourguard/backend/src/providers/attractionProvider.js)
- **Primary Source Classification:** Government official & Open public dataset
- **Official Organization:** Ministry of Tourism (Incredible India) / Archaeological Survey of India (ASI) / State Tourism Departments
- **Official API / Dataset:** ASI Centrally Protected Monuments Directory & Open Heritage Datasets / WikiData / OpenStreetMap Tourism
- **Website:** [https://asi.nic.in](https://asi.nic.in) / [https://www.incredibleindia.org](https://www.incredibleindia.org)
- **API Documentation:** [https://data.gov.in/keywords/monuments](https://data.gov.in/keywords/monuments)
- **Free or Paid:** Free
- **API Key Required:** No
- **Environment Variables:** `ATTRACTION_PROVIDER=overpass`, `ATTRACTION_API_KEY=`
- **Rate Limits:** In-memory TTL cache (15 mins)
- **Data Returned:** Place name, category (Temple, Museum, Historical Monument, Viewpoint, Park), description, location, latitude, longitude, opening hours, entry fee information, source, source URL
- **Fallback Provider:** OpenStreetMap Overpass API (`tourism=attraction`, `tourism=museum`, `tourism=viewpoint`, `historic=*`, `amenity=place_of_worship`) $\rightarrow$ Local Prisma `Place` table
- **Reason for Choosing It:** Comprehensive coverage of both world-famous heritage sites and regional cultural attractions with opening times and ticket/entry information.

---

### 4. Hospitals & Healthcare

- **Category:** Hospitals / Healthcare & Emergency Medical Facilities
- **Provider Module:** [`hospitalProvider.js`](file:///d:/sihfinal/tourguard/backend/src/providers/hospitalProvider.js)
- **Primary Source Classification:** Government official & Government open dataset
- **Official Organization:** National Health Authority (NHA) / Ayushman Bharat Digital Mission (ABDM) / Ministry of Health and Family Welfare (MoHFW)
- **Official API / Dataset:** Health Facility Registry (HFR) Open API / National Health Directory
- **Website:** [https://hfr.abdm.gov.in](https://hfr.abdm.gov.in) / [https://data.gov.in](https://data.gov.in)
- **API Documentation:** [https://hfr.abdm.gov.in/swagger-ui/index.html](https://hfr.abdm.gov.in/swagger-ui/index.html)
- **Free or Paid:** Free
- **API Key Required:** No (Open HFR / Overpass open data); optional ABDM client key for partner registry
- **Environment Variables:** `HOSPITAL_PROVIDER=overpass`, `HOSPITAL_API_KEY=`
- **Rate Limits:** Cached with 15-minute TTL
- **Data Returned:** Hospital name, address, latitude, longitude, 24x7 emergency availability flag (`emergency: true`), phone number (108/landline), opening hours, source, source URL
- **Fallback Provider:** OpenStreetMap Overpass API (`amenity=hospital`, `amenity=clinic`, `healthcare=hospital`, `emergency=yes`) $\rightarrow$ Local Prisma `EmergencyService` table (HOSPITAL records)
- **Reason for Choosing It:** ABDM HFR and OpenStreetMap Healthcare layers offer accurate emergency trauma center coordinates essential for SOS dispatching and medical assistance.

---

### 5. Police Stations & Law Enforcement

- **Category:** Police Stations / Law Enforcement & Public Safety
- **Provider Module:** [`policeProvider.js`](file:///d:/sihfinal/tourguard/backend/src/providers/policeProvider.js)
- **Primary Source Classification:** Government official & Government open dataset
- **Official Organization:** National Crime Records Bureau (NCRB) / Ministry of Home Affairs (MHA) / State Police GIS
- **Official API / Dataset:** National Police Station Directory & Open Government Data Police GIS
- **Website:** [https://ncrb.gov.in](https://ncrb.gov.in) / [https://data.gov.in](https://data.gov.in)
- **API Documentation:** [https://data.gov.in/keywords/police-stations](https://data.gov.in/keywords/police-stations)
- **Free or Paid:** Free
- **API Key Required:** No
- **Environment Variables:** `POLICE_PROVIDER=overpass`, `POLICE_API_KEY=`
- **Rate Limits:** Cached with 15-minute TTL
- **Data Returned:** Police station name, jurisdiction/address, latitude, longitude, control room phone (100/112), 24/7 status, source, source URL
- **Fallback Provider:** OpenStreetMap Overpass API (`amenity=police`) $\rightarrow$ Local Prisma `EmergencyService` table (POLICE records)
- **Reason for Choosing It:** Crucial for safety risk calculation, SOS alert geofencing, and tourist police routing.

---

### 6. Emergency Services

- **Category:** Emergency Services (Fire, Ambulance, ERSS 112, Disaster Response)
- **Provider Module:** [`emergencyProvider.js`](file:///d:/sihfinal/tourguard/backend/src/providers/emergencyProvider.js)
- **Primary Source Classification:** Government official & Open public dataset
- **Official Organization:** Emergency Response Support System (ERSS 112, MHA) / State Fire & Rescue Services
- **Official API / Dataset:** ERSS 112 Public Registry & OpenStreetMap Emergency Layers
- **Website:** [https://112.gov.in](https://112.gov.in)
- **API Documentation:** [https://112.gov.in](https://112.gov.in)
- **Free or Paid:** Free
- **API Key Required:** No
- **Environment Variables:** `EMERGENCY_PROVIDER=overpass`, `EMERGENCY_API_KEY=`
- **Rate Limits:** Cached with 15-minute TTL
- **Data Returned:** Station name, emergency type (`FIRE_STATION`, `POLICE`, `HOSPITAL`, `PHARMACY`), address, latitude, longitude, emergency helpline (112, 101, 108, 100), source
- **Fallback Provider:** OpenStreetMap Overpass API (`amenity=fire_station`, `emergency=ambulance_station`, `emergency=phone`) $\rightarrow$ Local Prisma `EmergencyService` table
- **Reason for Choosing It:** Direct alignment with India's unified 112 national emergency response framework.

---

### 7. Public Transport

- **Category:** Public Transport (Bus Stops, Metro Stations, Tram, Local Transit)
- **Provider Module:** [`transportProvider.js`](file:///d:/sihfinal/tourguard/backend/src/providers/transportProvider.js)
- **Primary Source Classification:** Government open dataset & Open public dataset
- **Official Organization:** State Road Transport Corporations (SRTC) / Urban Transit Authorities (e.g. BMTC, CMRL, DMRC) / Open City
- **Official API / Dataset:** Open City Transit GTFS Feeds & OpenStreetMap Public Transit Layers
- **Website:** [https://opencity.in](https://opencity.in) / [https://data.gov.in](https://data.gov.in)
- **API Documentation:** [https://opencity.in/api](https://opencity.in/api)
- **Free or Paid:** Free
- **API Key Required:** No
- **Environment Variables:** `TRANSPORT_PROVIDER=overpass`, `TRANSPORT_API_KEY=`
- **Rate Limits:** Cached with 15-minute TTL
- **Data Returned:** Stop/station name, transit mode (Bus, Metro, Tram), route references, network operator, latitude, longitude, source
- **Fallback Provider:** OpenStreetMap Overpass API (`highway=bus_stop`, `public_transport=stop_position`, `railway=subway_entrance`) $\rightarrow$ Local Prisma `TransportRoute` table
- **Reason for Choosing It:** Real stop-level geographic accuracy for tourist navigation and transit options.

---

### 8. Transit Hubs (Airports, Railway Stations, Bus Terminals)

- **Category:** Intercity Transit Hubs (Airports, Railway Junctions, Central Bus Terminals)
- **Provider Module:** [`transitHubProvider.js`](file:///d:/sihfinal/tourguard/backend/src/providers/transitHubProvider.js)
- **Primary Source Classification:** Government official & Government open dataset
- **Official Organization:** Airports Authority of India (AAI) / Ministry of Railways / Centre for Railway Information Systems (CRIS)
- **Official API / Dataset:** AAI Airport Master Registry & CRIS Indian Railways Station Open Dataset
- **Website:** [https://www.aai.aero](https://www.aai.aero) / [https://indianrailways.gov.in](https://indianrailways.gov.in)
- **API Documentation:** [https://data.gov.in/keywords/railway-stations](https://data.gov.in/keywords/railway-stations)
- **Free or Paid:** Free
- **API Key Required:** No
- **Environment Variables:** `TRANSIT_HUB_PROVIDER=overpass`, `TRANSIT_HUB_API_KEY=`
- **Rate Limits:** Cached with 30-minute TTL
- **Data Returned:** Hub name, hub type (`Airport`, `Railway Station`, `Central Bus Terminal`), station/IATA code (e.g. CJB, CBE), address, coordinates, 24/7 operating status, source
- **Fallback Provider:** OpenStreetMap Overpass API (`aeroway=aerodrome`, `railway=station`, `amenity=bus_station`) $\rightarrow$ Curated Seed Regional Transit Registry
- **Reason for Choosing It:** Authoritative hub identifiers and coordinates for multimodal journey planning and arrival safety monitoring.

---

### 9. Shopping & Supermarkets

- **Category:** Shopping / Supermarkets / Malls / Traditional Handicraft Markets
- **Provider Module:** [`shoppingProvider.js`](file:///d:/sihfinal/tourguard/backend/src/providers/shoppingProvider.js)
- **Primary Source Classification:** Government open dataset & Open public dataset
- **Official Organization:** Municipal Corporation Commercial Licensing Registers / OGD Business & Trade Open Data
- **Official API / Dataset:** Urban Local Body Trade Directory & OpenStreetMap Commercial Points of Interest
- **Website:** [https://data.gov.in](https://data.gov.in)
- **API Documentation:** [https://data.gov.in/keywords/trade](https://data.gov.in/keywords/trade)
- **Free or Paid:** Free
- **API Key Required:** No
- **Environment Variables:** `SHOPPING_PROVIDER=overpass`, `SHOPPING_API_KEY=`
- **Rate Limits:** Cached with 15-minute TTL
- **Data Returned:** Store/mall name, category (Supermarket, Shopping Mall, Handicrafts, Clothing), address, latitude, longitude, opening hours, contact, source
- **Fallback Provider:** OpenStreetMap Overpass API (`shop=supermarket`, `shop=mall`, `shop=clothes`, `shop=handicraft`, `shop=department_store`) $\rightarrow$ Local Prisma `Shopping` table
- **Reason for Choosing It:** Identifies authentic local handicraft emporiums and essential grocery stores.

---

### 10. ATMs & Banks

- **Category:** ATMs / Bank Branches & Cash Services
- **Provider Module:** [`atmProvider.js`](file:///d:/sihfinal/tourguard/backend/src/providers/atmProvider.js)
- **Primary Source Classification:** Government official & Government open dataset
- **Official Organization:** Reserve Bank of India (RBI)
- **Official API / Dataset:** RBI Bank Branch & ATM Master Directory
- **Website:** [https://www.rbi.org.in](https://www.rbi.org.in) / [https://data.gov.in](https://data.gov.in)
- **API Documentation:** [https://data.gov.in/keywords/rbi-atm](https://data.gov.in/keywords/rbi-atm)
- **Free or Paid:** Free
- **API Key Required:** No
- **Environment Variables:** `ATM_PROVIDER=overpass`, `ATM_API_KEY=`
- **Rate Limits:** Cached with 20-minute TTL
- **Data Returned:** ATM / Branch name, bank operator (e.g. State Bank of India, HDFC, ICICI), address, latitude, longitude, 24/7 operating flag, source
- **Fallback Provider:** OpenStreetMap Overpass API (`amenity=atm`, `amenity=bank`) $\rightarrow$ Curated Seed Bank Directory
- **Reason for Choosing It:** Essential for tourists needing quick access to verified cash dispensing machines.

---

### 11. Pharmacies & Medical Stores

- **Category:** Pharmacies / 24/7 Medical Stores
- **Provider Module:** [`pharmacyProvider.js`](file:///d:/sihfinal/tourguard/backend/src/providers/pharmacyProvider.js)
- **Primary Source Classification:** Government official & Open public dataset
- **Official Organization:** Central Drugs Standard Control Organization (CDSCO) / Pharmaceuticals & Medical Devices Bureau of India (PMBI - Jan Aushadhi)
- **Official API / Dataset:** Pradhan Mantri Bhartiya Janaushadhi Pariyojana (PMBJP) Kendra Directory & State Pharmacy Registers
- **Website:** [https://janaushadhi.gov.in](https://janaushadhi.gov.in) / [https://data.gov.in](https://data.gov.in)
- **API Documentation:** [https://janaushadhi.gov.in](https://janaushadhi.gov.in)
- **Free or Paid:** Free
- **API Key Required:** No
- **Environment Variables:** `PHARMACY_PROVIDER=overpass`, `PHARMACY_API_KEY=`
- **Rate Limits:** Cached with 15-minute TTL
- **Data Returned:** Pharmacy name, address, latitude, longitude, phone, 24/7 dispensing status, opening hours, source
- **Fallback Provider:** OpenStreetMap Overpass API (`amenity=pharmacy`, `healthcare=pharmacy`) $\rightarrow$ Local Prisma `EmergencyService` table (PHARMACY records)
- **Reason for Choosing It:** Fast access to prescription medication and emergency first aid supplies during travel emergencies.

---

### 12. Fuel Stations & EV Charging

- **Category:** Fuel Stations (Petrol, Diesel, CNG) & Electric Vehicle Charging Stations
- **Provider Module:** [`fuelProvider.js`](file:///d:/sihfinal/tourguard/backend/src/providers/fuelProvider.js)
- **Primary Source Classification:** Government official & Government open dataset
- **Official Organization:** Ministry of Petroleum and Natural Gas (MoPNG) / Bureau of Energy Efficiency (BEE - Ministry of Power)
- **Official API / Dataset:** National EV Charging Station Portal (e-AMRIT) & MoPNG Retail Outlets Directory
- **Website:** [https://e-amrit.niti.gov.in](https://e-amrit.niti.gov.in) / [https://mopng.gov.in](https://mopng.gov.in)
- **API Documentation:** [https://data.gov.in/keywords/fuel-stations](https://data.gov.in/keywords/fuel-stations)
- **Free or Paid:** Free
- **API Key Required:** No
- **Environment Variables:** `FUEL_PROVIDER=overpass`, `FUEL_API_KEY=`
- **Rate Limits:** Cached with 20-minute TTL
- **Data Returned:** Station name, brand/operator (e.g. Indian Oil, Bharat Petroleum, Tata Power EV), fuels available (Petrol, Diesel, CNG, EV Fast Charging), address, coordinates, 24/7 status, source
- **Fallback Provider:** OpenStreetMap Overpass API (`amenity=fuel`, `amenity=charging_station`) $\rightarrow$ Curated Seed Fuel & EV Stations
- **Reason for Choosing It:** Supports both traditional vehicle rentals and eco-friendly EV road-tripping.

---

### 13. Government Offices & Tourism Help Desks

- **Category:** Government Administration & Tourist Information Desks
- **Provider Module:** [`govOfficeProvider.js`](file:///d:/sihfinal/tourguard/backend/src/providers/govOfficeProvider.js)
- **Primary Source Classification:** Government official & Government open dataset
- **Official Organization:** National Portal of India (`india.gov.in`) / State Tourism Development Corporations / District Collectorates
- **Official API / Dataset:** National Government Directory (NGD) & Official Tourist Assistance Centers
- **Website:** [https://india.gov.in](https://india.gov.in) / [https://directory.gov.in](https://directory.gov.in)
- **API Documentation:** [https://india.gov.in/developer-apis](https://india.gov.in/developer-apis)
- **Free or Paid:** Free
- **API Key Required:** No
- **Environment Variables:** `GOV_OFFICE_PROVIDER=overpass`, `GOV_OFFICE_API_KEY=`
- **Rate Limits:** Cached with 30-minute TTL
- **Data Returned:** Office name, department type (Collectorate, Municipal Corporation, Tourist Information Centre), address, latitude, longitude, phone, office working hours, source
- **Fallback Provider:** OpenStreetMap Overpass API (`office=government`, `tourism=information`, `amenity=townhall`) $\rightarrow$ Curated Seed Civic Registry
- **Reason for Choosing It:** Direct access to verified official authorities for administrative paperwork, permits, and tourist guidance.

---

### 14. Other Useful Tourist Facilities

- **Category:** Public Amenities (Restrooms, Clean Drinking Water, Public Parking)
- **Provider Module:** [`facilityProvider.js`](file:///d:/sihfinal/tourguard/backend/src/providers/facilityProvider.js)
- **Primary Source Classification:** Government official & Open public dataset
- **Official Organization:** Ministry of Housing and Urban Affairs (MoHUA) / Swachh Bharat Mission (SBM) / Urban Local Bodies
- **Official API / Dataset:** SBM Public Toilet Directory & Municipal Public Amenities Open Register
- **Website:** [https://swachhbharatmission.ddws.gov.in](https://swachhbharatmission.ddws.gov.in) / [https://data.gov.in](https://data.gov.in)
- **API Documentation:** [https://data.gov.in/keywords/swachh-bharat](https://data.gov.in/keywords/swachh-bharat)
- **Free or Paid:** Free
- **API Key Required:** No
- **Environment Variables:** `FACILITY_PROVIDER=overpass`, `FACILITY_API_KEY=`
- **Rate Limits:** Cached with 20-minute TTL
- **Data Returned:** Facility name, type (`toilets`, `drinking_water`, `parking`), fee status (`Free Access` / `Pay & Use`), wheelchair accessibility, coordinates, source
- **Fallback Provider:** OpenStreetMap Overpass API (`amenity=toilets`, `amenity=drinking_water`, `amenity=parking`) $\rightarrow$ Curated Seed Public Amenities
- **Reason for Choosing It:** Vital day-to-day hygiene, hydration, and parking infrastructure for tourists on walking tours and road trips.

---

### 15. Geocoding & Search

- **Category:** Forward & Reverse Geocoding
- **Provider Module:** [`geocodingProvider.js`](file:///d:/sihfinal/tourguard/backend/src/providers/geocodingProvider.js)
- **Primary Source Classification:** Open public dataset & Open source geocoding engine
- **Official Organization:** OpenStreetMap Community / Komoot (Photon Engine)
- **Official API / Dataset:** Komoot Photon Geocoding Engine (OpenStreetMap data) / Nominatim OSM
- **Website:** [https://photon.komoot.io](https://photon.komoot.io) / [https://nominatim.openstreetmap.org](https://nominatim.openstreetmap.org)
- **API Documentation:** [https://photon.komoot.io](https://photon.komoot.io)
- **Free or Paid:** 100% Free
- **API Key Required:** No (Zero API key needed for Photon or Nominatim; optional keys for ORS / Google)
- **Environment Variables:** `GEOCODING_PROVIDER=photon`, `GEOCODING_API_KEY=`
- **Rate Limits:** 1-hour in-memory cache
- **Data Returned:** Standardized `{ lat, lon, label, source }` coordinates
- **Fallback Provider:** Nominatim OSM $\rightarrow$ OpenRouteService Geocoding $\rightarrow$ Google Geocoding $\rightarrow$ Local Geocoding Dictionary
- **Reason for Choosing It:** Photon provides fast, typo-tolerant OpenStreetMap geocoding with zero required registration or credit card requirements.

---

### 16. Multimodal Routing & Turn-by-Turn Directions

- **Category:** Multimodal Turn-by-Turn Routing & Directions
- **Provider Module:** [`routingProvider.js`](file:///d:/sihfinal/tourguard/backend/src/providers/maps/routingProvider.js)
- **Primary Source Classification:** Open source routing engine & Open public dataset
- **Official Organization:** OpenRouteService (Heidelberg Institute for Geoinformation Technology) & Project OSRM (Open Source Routing Machine)
- **Official API / Dataset:** OpenRouteService v2 Directions API & OSRM Open Data Routing Engine
- **Website:** [https://openrouteservice.org](https://openrouteservice.org) / [https://project-osrm.org](https://project-osrm.org)
- **API Documentation:** [https://openrouteservice.org/dev/#/api-docs/v2/directions](https://openrouteservice.org/dev/#/api-docs/v2/directions)
- **Free or Paid:** Free (Free tier for ORS; 100% free open public server for OSRM)
- **API Key Required:** Optional (None for OSRM; free API key for OpenRouteService; key for Google)
- **Environment Variables:** `ROUTING_PROVIDER=openrouteservice`, `OPENROUTESERVICE_API_KEY=`, `GOOGLE_MAPS_API_KEY=`
- **Rate Limits:** 2,000 requests/day on free ORS; unlimited for OSRM public server; deterministic geometric route fallback for offline mode
- **Data Returned:** `{ geometry, distanceKm, durationMinutes, steps: [{ index, instruction, distanceMeters, durationSeconds }], origin, destination, source }`
- **Fallback Provider:** OpenRouteService $\rightarrow$ OSRM Public Server $\rightarrow$ Google Directions $\rightarrow$ Deterministic Geometric Path
- **Reason for Choosing It:** OpenRouteService and OSRM provide precise turn-by-turn walking and driving routing without commercial lock-in.

---

### 17. Geoapify Places & Location Intelligence API

- **Category:** Unified Geospatial Location Data Provider (Hotels, Restaurants, Attractions, Healthcare, Police, Pharmacies, Supermarkets, ATMs, Banks, Fuel, Transit, Airports, Railway Stations, Facilities)
- **Provider Module:** [`geoapifyProvider.js`](file:///d:/sihfinal/tourguard/backend/src/providers/geoapifyProvider.js)
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

