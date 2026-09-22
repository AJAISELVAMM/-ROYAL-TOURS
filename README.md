ROYAL TOURS

An AI-powered smart travel companion for safer, smarter, and more
convenient journeys.**

ROYAL TOURS is a full-stack smart travel and tourism platform that
combines trip planning, destination discovery, real-time safety
assistance, transportation support, fair-fare analysis, language
translation, group budgeting, live-location services, and emergency
assistance in one unified application. It is designed to support
travelers before, during, and after their journey while making group
travel easier to plan, manage, and experience.

## ✨ Key Features {#sparkles-key-features}

### 🧭 Smart Trip Planning {#compass-smart-trip-planning}

-   Create and manage trips.
-   Set destinations, dates, group size, and travel preferences.
-   Manage trip members and journey information.
-   View selected-trip information throughout the application.

### 🗺️ Destination Discovery {#world_map-destination-discovery}

-   Discover nearby travel destinations and points of interest.
-   Find relevant places based on selected/current location.
-   Find restaurants, hotels, theatres, shopping and other useful
    destinations.
-   Location-aware discovery using OpenStreetMap-based services.

### 🛡️ Safety & Emergency Assistance {#shield-safety--emergency-assistance}

-   Dedicated Safety section.
-   Live-location-based safety map.
-   Find nearby hospitals and police stations.
-   \"I\'m Lost\" assistance flow.
-   Emergency assistance and SOS functionality.
-   Location-aware safety information.

### 🚕 Smart Travel & Transportation {#taxi-smart-travel--transportation}

-   Transportation options for different travel modes.
-   Support for bus, train, flight and cab-related travel workflows.
-   Fare analysis and fair-fare estimation.
-   Driver quote comparison against estimated fair rates.

### 🌐 Translation {#globe_with_meridians-translation}

-   Traveler-focused language translation.
-   Self-hosted LibreTranslate integration.
-   Argos language models for supported Indian-language translation.
-   Backend translation service separated from the frontend.

### 💰 Group Budget Management {#moneybag-group-budget-management}

-   Manage trip budgets.
-   Track trip expenses.
-   Display member-wise budget information.
-   Dynamically retrieve all members associated with the selected trip.
-   Support group travel expense management without hardcoded member
    data.

### 📍 Live Location & Maps {#round_pushpin-live-location--maps}

ROYAL TOURS uses open mapping technologies instead of Google Maps APIs:

-   OpenStreetMap
-   Leaflet / React-Leaflet
-   Nominatim
-   Overpass API
-   OSRM
-   Browser Geolocation API

### 🔐 Authentication {#closed_lock_with_key-authentication}

-   Login
-   Create Account
-   OTP verification
-   Forgot Password
-   Password reset
-   Protected routes
-   Logout flow
-   Responsive authentication pages
-   Royal Tours travel-themed authentication experience

### 🎬 Travel-Themed Animations {#clapper-travel-themed-animations}

Login and logout include custom travel animations.

``` text
Login clicked
    ↓
Character runs toward Login button
    ↓
Character clicks button
    ↓
Click / spark effect
    ↓
Login loading animation
    ↓
Authentication
    ↓
Dashboard
```

``` text
Logout clicked
    ↓
Character animation
    ↓
Travel / train loading animation
    ↓
"Logging you out..."
    ↓
Session cleared
    ↓
Login page
```

------------------------------------------------------------------------

## 🏗️ System Architecture {#building_construction-system-architecture}

``` text
                    ┌─────────────────────────┐
                    │       ROYAL TOURS       │
                    │      Web Application    │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │       React + Vite      │
                    │       Frontend          │
                    └────────────┬────────────┘
                                 │ REST APIs
                    ┌────────────▼────────────┐
                    │    Node.js + Express    │
                    │       Backend API       │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │ PostgreSQL + Supabase   │
                    │       Database          │
                    └─────────────────────────┘

Supporting Services
├── OpenStreetMap
├── Nominatim
├── Overpass API
├── OSRM
├── LibreTranslate
└── Argos language models
```

## 🛠️ Technology Stack {#hammer_and_wrench-technology-stack}

### Frontend

-   React.js
-   Vite
-   JavaScript / JSX
-   CSS
-   Leaflet
-   React-Leaflet
-   Responsive Web Design

### Backend

-   Node.js
-   Express.js
-   REST APIs

### Database

-   PostgreSQL
-   Supabase
-   Prisma ORM

### Maps & Location {#maps--location}

-   OpenStreetMap
-   Leaflet
-   React-Leaflet
-   Nominatim
-   Overpass API
-   OSRM
-   Browser Geolocation API

### AI / ML {#ai--ml}

-   Python
-   Random Forest
-   Fare analysis model
-   Safety analysis model
-   LibreTranslate
-   Argos language models

### Deployment / Infrastructure {#deployment--infrastructure}

-   Vercel
-   Render
-   Cloudflare Tunnel
-   Environment-based configuration

------------------------------------------------------------------------

## 📁 Project Structure {#file_folder-project-structure}

The exact structure may vary with the current version:

``` text
ROYAL-TOURS/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── context/
│   │   ├── assets/
│   │   └── App.*
│   ├── public/
│   ├── package.json
│   └── vite.config.*
│
├── backend/
│   ├── controllers/
│   ├── routes/
│   ├── services/
│   ├── middleware/
│   ├── prisma/
│   ├── models/
│   ├── utils/
│   ├── package.json
│   └── server.*
│
├── ml/
│   ├── fare/
│   ├── safety/
│   └── requirements.txt
│
├── libretranslate/
│
├── .env
├── .gitignore
└── README.md
```

------------------------------------------------------------------------

## 🔑 Environment Variables {#key-environment-variables}

Use the variable names already defined in the project. Typical
configuration includes:

``` env
PORT=5000
DATABASE_URL=your_postgresql_connection_string
DIRECT_URL=your_direct_database_url

JWT_SECRET=your_secure_secret
FRONTEND_URL=http://localhost:5173

LIBRETRANSLATE_URL=http://localhost:5050
```

Frontend example:

``` env
VITE_API_URL=http://localhost:5000
```

Never commit real credentials or secrets.

------------------------------------------------------------------------

## 🚀 Installation {#rocket-installation}

### 1. Clone {#1-clone}

``` bash
git clone <YOUR_REPOSITORY_URL>
cd ROYAL-TOURS
```

### 2. Frontend {#2-frontend}

``` bash
cd frontend
npm install
```

### 3. Backend {#3-backend}

Open another terminal:

``` bash
cd backend
npm install
```

### 4. Configure Environment {#4-configure-environment}

Create the required `.env` files according to the current project
configuration.

------------------------------------------------------------------------

## 🗄️ Database Setup {#file_cabinet-database-setup}

ROYAL TOURS uses PostgreSQL with Supabase and Prisma.

From the backend directory:

``` bash
npx prisma generate
```

For a new development database:

``` bash
npx prisma migrate dev
```

To inspect the database:

``` bash
npx prisma studio
```

For an existing database, follow the project\'s established
migration/schema workflow.

**Do not reset or drop a database containing required project data.**

------------------------------------------------------------------------

## ▶️ Running the Application {#arrow_forward-running-the-application}

### Frontend {#frontend-1}

``` bash
cd frontend
npm run dev
```

Normally available at:

``` text
http://localhost:5173
```

### Backend {#backend-1}

``` bash
cd backend
npm run dev
```

Normally available at:

``` text
http://localhost:5000
```

Use the project\'s existing scripts if their names differ.

------------------------------------------------------------------------

## 🌐 Translation Service {#globe_with_meridians-translation-service}

The translation architecture is:

``` text
React Translator UI
        ↓
Express Backend
        ↓
LibreTranslate
        ↓
Argos Language Models
```

LibreTranslate may run on:

``` text
http://localhost:5050
```

The URL should be controlled through environment configuration.

------------------------------------------------------------------------

## 🗺️ Map Architecture {#world_map-map-architecture}

``` text
Browser Location
      ↓
Geolocation API
      ↓
Latitude + Longitude
      ↓
OpenStreetMap / Nominatim
      ↓
Location / Geocoding

Latitude + Longitude
      ↓
Overpass API
      ↓
Nearby POIs

Origin + Destination
      ↓
OSRM
      ↓
Route
      ↓
Leaflet Map
```

The core mapping architecture does not require a Google Maps API key.

------------------------------------------------------------------------

## 📍 Safety Architecture {#round_pushpin-safety-architecture}

``` text
User Live Location
        ↓
Latitude / Longitude
        ↓
Nearby POI Search
        ↓
Category Filtering
        ↓
Hospital / Police Station
        ↓
Distance Calculation
        ↓
Map + Safety Information
```

Safety facilities should be selected relative to the user\'s actual live
location rather than displaying an unrelated distant result.

------------------------------------------------------------------------

## 💰 Budget Architecture {#moneybag-budget-architecture}

``` text
User
  ↓
Selected Trip
  ↓
Trip Members
  ↓
Member User Records
  ↓
Trip Expenses / Budget
  ↓
Member Budget Breakdown
```

Example:

``` text
Selected Trip
├── AJAI
├── Arun
├── Kavin
└── Sanjay
```

All members must be retrieved dynamically from the selected trip\'s
database relationship.

------------------------------------------------------------------------

## 🔐 Security {#closed_lock_with_key-security}

### Authentication {#authentication}

-   Never store plaintext passwords.
-   Use secure password hashing.
-   Validate authentication tokens.
-   Protect private routes.
-   Handle expired sessions.
-   Clear authentication state during logout.

### Secrets

Never commit:

-   Database passwords
-   JWT secrets
-   API keys
-   SMTP credentials
-   Supabase service-role keys
-   Other private credentials

### API Security

-   Validate request data.
-   Authenticate protected endpoints.
-   Avoid exposing sensitive database fields.
-   Return safe error messages.

------------------------------------------------------------------------

## 📱 Responsive Design {#iphone-responsive-design}

The application supports:

-   Desktop
-   Laptop
-   Tablet
-   Mobile

Important responsive modules:

-   Authentication
-   Dashboard
-   Safety
-   Discover
-   Smart Travel
-   Budget
-   Account
-   Maps

Avoid:

-   Horizontal overflow
-   Overlapping forms
-   Cropped buttons
-   Broken cards
-   Off-screen map controls
-   Mobile keyboard layout problems

------------------------------------------------------------------------

## 🎨 Design {#art-design}

ROYAL TOURS follows a modern travel-focused visual identity:

-   Royal purple
-   White/light backgrounds
-   Rounded cards
-   Clean typography
-   Soft shadows
-   Travel illustrations
-   Smooth transitions
-   Professional responsive interface

The official Royal Tours branding is used consistently throughout the
application.

------------------------------------------------------------------------

## 🔄 Main User Flow {#arrows_counterclockwise-main-user-flow}

``` text
                    ┌───────────────┐
                    │     Login     │
                    └───────┬───────┘
                            │
             ┌──────────────┴──────────────┐
             │                             │
        Create Account                Forgot Password
             │                             │
            OTP                     Reset Password
             │                             │
             └──────────────┬──────────────┘
                            │
                       Authentication
                            │
                    ┌───────▼────────┐
                    │    Dashboard   │
                    └───────┬────────┘
                            │
       ┌────────────┬───────┼────────┬─────────────┐
       │            │       │        │             │
    Journey      Smart   Discover  Safety       Account
                 Travel
       │            │       │        │             │
       └────────────┴───────┴────────┴─────────────┘
```

------------------------------------------------------------------------

## 🧭 Application Modules {#compass-application-modules}

  Module           Purpose
  ---------------- ------------------------------------------------
  Dashboard        Overview of the travel experience
  My Journey       Manage trips and journey information
  Smart Travel     Transportation, fare analysis and translation
  Discover         Explore nearby destinations and useful places
  Safety           Live location and emergency assistance
  Account          Profile and account management
  Budget           Trip and group expense management
  Authentication   Login, registration, OTP and password recovery

------------------------------------------------------------------------

## 🚨 Emergency Assistance {#rotating_light-emergency-assistance}

The Safety module helps travelers access emergency-related information
such as:

-   Current location
-   Nearby police stations
-   Nearby hospitals/clinics
-   \"I\'m Lost\" assistance
-   SOS/emergency functionality
-   Safety-related map information

Emergency features are intended as travel assistance and do not replace
official emergency services.

------------------------------------------------------------------------

## 🤖 Intelligent Features {#robot-intelligent-features}

### Fare Analysis

``` text
Trip Details
     ↓
Vehicle / Transport Information
     ↓
Distance + Relevant Inputs
     ↓
Fare Model
     ↓
Estimated Fair Fare
     ↓
Compare With Quoted Fare
```

### Safety Analysis

The safety module can use configured inputs such as nearby emergency
facilities, lighting-related information, crowd-related information, and
other available safety data to provide contextual safety information.

The exact output depends on the trained model and available data.

------------------------------------------------------------------------

## 🧪 Testing Checklist {#test_tube-testing-checklist}

### Authentication {#authentication-1}

-   [ ] Login
-   [ ] Invalid login handling
-   [ ] Create Account
-   [ ] OTP verification
-   [ ] Forgot Password
-   [ ] Reset Password
-   [ ] Protected routes
-   [ ] Logout

### Trips & Budget {#trips--budget}

-   [ ] Create/select trip
-   [ ] Load trip members
-   [ ] Display all members
-   [ ] Load expenses
-   [ ] Display member-wise budget
-   [ ] Changing selected trip changes member list

### Maps

-   [ ] Current location
-   [ ] Map rendering
-   [ ] Nearby places
-   [ ] Nearby police station
-   [ ] Nearby hospital
-   [ ] Routing

### Smart Travel

-   [ ] Transport options
-   [ ] Fare analysis
-   [ ] Translation

### Responsive

-   [ ] Desktop
-   [ ] Laptop
-   [ ] Tablet
-   [ ] Mobile

------------------------------------------------------------------------

## 🐛 Troubleshooting {#bug-troubleshooting}

### Frontend {#frontend-2}

``` bash
npm install
npm run dev
```

### Prisma

``` bash
npx prisma validate
npx prisma generate
```

### Database

Check:

-   `DATABASE_URL`
-   `DIRECT_URL`
-   Supabase project status
-   PostgreSQL credentials
-   Network connectivity

### Map

Check:

-   Browser geolocation permission
-   Internet connection
-   Leaflet CSS
-   Tile URL
-   Nominatim / Overpass availability
-   Latitude/longitude
-   Browser console

### Translation {#translation}

Check:

-   LibreTranslate process
-   Port `5050`
-   Argos models
-   Backend translation route
-   Frontend API URL

------------------------------------------------------------------------

## ☁️ Deployment {#cloud-deployment}

A typical deployment architecture is:

``` text
                    Internet
                       │
                       ▼
                    Vercel
                   Frontend
                       │
                       │ API
                       ▼
                    Render
                   Backend
                       │
                       ▼
                   Supabase
                  PostgreSQL
```

For temporary/public development access:

``` text
Local Frontend / Backend
          ↓
    Cloudflare Tunnel
          ↓
      Public URL
```

Use deployment environment variables rather than hardcoded production
URLs.

------------------------------------------------------------------------

## 🔒 Production Checklist {#lock-production-checklist}

-   [ ] Configure production environment variables
-   [ ] Remove development credentials
-   [ ] Secure database credentials
-   [ ] Configure CORS
-   [ ] Use HTTPS
-   [ ] Verify authentication
-   [ ] Verify OTP
-   [ ] Verify password reset
-   [ ] Verify logout
-   [ ] Verify trip-member relationships
-   [ ] Verify budget
-   [ ] Verify maps
-   [ ] Verify translation
-   [ ] Test mobile layout
-   [ ] Test production build
-   [ ] Check browser console
-   [ ] Check backend logs

------------------------------------------------------------------------

## 🌍 Vision {#earth_africa-vision}

ROYAL TOURS aims to provide travelers with a single digital platform
that combines **planning, discovery, safety, mobility, communication,
and group travel management**.

Instead of requiring travelers to switch between separate applications
for maps, destinations, transportation, translation, budgeting, and
emergency assistance, ROYAL TOURS brings these capabilities together
into one intelligent travel companion.

------------------------------------------------------------------------

## 📌 Project Highlights {#pushpin-project-highlights}

-   Full-stack smart travel platform
-   AI/ML-assisted travel services
-   Real-time location support
-   OpenStreetMap-based mapping
-   Nearby emergency facility discovery
-   Transportation and fare assistance
-   Group trip management
-   Member-wise budget management
-   Translation support
-   Secure authentication
-   Responsive web experience
-   Travel-themed interactive animations

------------------------------------------------------------------------

## 👥 Project Information {#busts_in_silhouette-project-information}

**Project:** ROYAL TOURS\
**Category:** Travel & Tourism\
**Type:** Full-Stack Smart Travel Platform

------------------------------------------------------------------------

## 📄 License {#page_facing_up-license}

Add the project\'s applicable license here before public distribution.

If no license has been selected, do not assume an open-source license.
The project remains subject to the rights of its creators.
