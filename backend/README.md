# TourGuard AI — Backend

Production-ready backend for **TourGuard AI** ("Plan Smart. Explore More. Travel Safe.").

Node.js + Express + PostgreSQL + Prisma + JWT + Socket.IO. Plain JavaScript (ESM) — **no TypeScript**.

## Stack

| Concern           | Technology                                             |
| ----------------- | ------------------------------------------------------ |
| Runtime           | Node.js (ESM)                                          |
| Web framework     | Express                                                |
| Database          | PostgreSQL (Prisma ORM)                                |
| Auth              | JWT (access + refresh), bcryptjs, hashed OTP           |
| Validation        | Zod                                                    |
| Realtime          | Socket.IO (group presence, live location, SOS)         |
| Security          | Helmet, CORS, rate limiting, hashed secrets            |
| Docs              | Swagger UI (`/api/docs`)                               |
| Tests             | Jest + Supertest                                       |

## Quick start

```bash
npm install
cp .env.example .env          # fill in DATABASE_URL + secrets
npx prisma migrate deploy     # non-destructive (production)
npx prisma db seed
npm start                     # node src/server.js
```

Local development (mock providers, demo data):

```bash
npx prisma migrate dev --name init
npx prisma db seed
npm run dev                   # node --watch src/server.js
```

## Environment variables

See `.env.example` for the full template. Core variables:

- `DATABASE_URL` — PostgreSQL connection string (e.g. `postgresql://user:pass@host:5432/db?schema=public`)
- `JWT_SECRET`, `JWT_REFRESH_SECRET` — signing secrets (never hardcode)
- `FRONTEND_URL` — comma-separated CORS origins
- `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` — the single authorized admin (hash via bcrypt)
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` — SMS (optional)
- `TRANSLATION_API_KEY` — Google Translate (optional)
- `OPENROUTESERVICE_API_KEY` / `GOOGLE_MAPS_API_KEY` — routing (optional)
- `OPENAI_API_KEY` — AI itinerary/packing (optional)
- `MOCK_EXTERNAL_SERVICES` — enable demo fallbacks for SMS/translation/routing
- `MOCK_LOCATION` — demo GPS for SOS (development only)

**Optional providers never crash the server.** If a provider key is missing, that
feature returns `{ success:false, error:{ code:"PROVIDER_NOT_CONFIGURED" } }` and
the rest of the API stays healthy. The backend never calls `process.exit()` for a
missing optional key.

## Key endpoints

| Method | Path                              | Auth      | Description                              |
| ------ | --------------------------------- | --------- | ---------------------------------------- |
| GET    | `/api/health`                     | public    | Health + DB status                       |
| POST   | `/api/auth/register/request-otp`  | public    | Request registration OTP                 |
| POST   | `/api/auth/register/verify-otp`   | public    | Verify OTP → create TOURIST              |
| POST   | `/api/auth/login`                 | public    | Login (tourist **and** admin, same route)|
| POST   | `/api/auth/refresh`               | public    | Rotate refresh token                     |
| GET    | `/api/auth/me`                    | user      | Current user                             |
| POST   | `/api/trips`                      | user      | Create trip (transactional)              |
| GET    | `/api/trips`, `/api/trips/:id`    | user      | List / detail (itinerary, packing)       |
| PATCH  | `/api/trips/:id/packing/:itemId`  | user      | Toggle packing item (packed)             |
| POST   | `/api/groups/:groupId/call`       | member    | Initiate a group call                    |
| POST   | `/api/location/:groupId/start`    | member    | Start live location sharing (consent)    |
| POST   | `/api/location/:groupId/stop`     | member    | Stop sharing                             |
| GET    | `/api/transport/routes`           | public    | Distance/duration/steps/fare             |
| GET    | `/api/fare/estimate`              | public    | Fare estimate                            |
| POST   | `/api/fare/check`                 | public    | Fair / slightly-high / overcharge        |
| POST   | `/api/translation/translate`      | public    | en/ta/hi/ml/kn/te                        |
| GET    | `/api/discover/:type`             | public    | Catalog list/search/filter/paginate      |
| GET    | `/api/discover/theatres/:id/shows`| public    | Theatre showtimes                        |
| GET    | `/api/safety/map`                 | public    | Police/hospital/pharmacy/safe-points     |
| POST   | `/api/safety/guide`               | public    | "I'm lost" nearest + route               |
| GET    | `/api/emergency/nearest`          | public    | Nearest facility by type                 |
| POST   | `/api/sos`                        | user      | Solo SOS                                 |
| POST   | `/api/sos/group`                  | member    | Group SOS                                |
| GET    | `/api/sos/active`                 | admin     | Active SOS list                          |
| PATCH  | `/api/sos/:id/transition`         | user/admin| Acknowledge / escalate / resolve / cancel|
| POST   | `/api/reports`                    | user      | Submit travel report                     |
| GET    | `/api/reports`                    | admin     | List reports                             |
| PATCH  | `/api/reports/:id/status`         | admin     | Resolve / reject                         |
| GET    | `/api/admin/overview`             | admin     | Dashboard counters (SQL aggregations)    |
| GET    | `/api/admin/users`                | admin     | Manage / suspend users                   |
| CRUD   | `/api/admin/catalog/:type`        | admin     | Catalog CRUD + verify                    |
| GET    | `/api/admin/services`             | admin     | Provider/dependency status               |

## Security model

- **No public admin registration.** Registration only ever creates a `TOURIST`.
- **One login endpoint.** Admins sign in through `POST /api/auth/login`; the
  backend returns the role. Admin existence is never exposed to the UI.
- **Identity is always server-derived.** Tourist name/phone/ID come from the JWT
  and the database, never from the request body.
- **OTP**: 6-digit, stored **hashed** (salted SHA-256), 5-minute expiry, max 5
  attempts, resend cooldown, prior OTP invalidated on re-request.
- **Refresh tokens**: stored hashed, rotated on refresh, revocable.
- **Socket.IO**: JWT-authenticated. Rooms `group:<id>` (members only),
  `admin:safety` / `admin:dashboard` (ADMIN only).
- **Location sharing is opt-in** (default OFF); broadcast only to the remaining
  group members; limited retention (last known position only).
- **Admins never see all tourist locations** — only active SOS, explicitly shared
  locations, or authorized monitoring.
- **SOS is SMS-fault-tolerant** — an SMS provider failure never blocks SOS
  creation (status `PENDING`/`SENT`/`FAILED` with retry).
- Helmet, CORS allowlist, per-endpoint rate limits, Zod validation, Prisma
  parameterized queries (anti-SQLi), request size limits, no stack traces in
  production, no logging of passwords/OTP/keys.

## Realtime (Socket.IO)

Connect with `auth: { token: <accessToken> }`.

- `group:join` / `group:leave` → presence (`group:member:online/offline`)
- `group:location:update` → `group:location:update` (broadcast to other members)
- `group:location:stopped` → `group:location:stopped`
- Server emits: `admin:sos:new`, `admin:sos:update`, `admin:sos:location:update`,
  `admin:report:new`, `tourist:report:updated`, `admin:dashboard:update`

## Testing

```bash
npm test
```

Jest + Supertest cover registration/OTP, login (admin via same endpoint),
authorization failures, trip + members, group authorization, location sharing,
SOS (solo/group), admin SOS, reports, transport, translation, discover,
emergency nearest, and admin CRUD.

## Project layout

```
src/
  config/        env, database, swagger
  controllers/   auth, trip, group, location, transport, translation,
                 discover, safety, sos, report, admin
  routes/        matching route modules
  middleware/    auth, role, error, rateLimit
  services/      auth, otp, sms, call, trip, group, location, routing,
                 translation, discover, safety, sos, notification, admin
  providers/     sms/{smsProvider,twilioProvider}, translation/translationProvider,
                 maps/routingProvider
  realtime/      socket, groupLocationSocket, sosSocket, adminSocket
  utils/         errors, logger, response, asyncHandler
  app.js         Express app
  server.js      HTTP + Socket.IO bootstrap (graceful shutdown)
prisma/
  schema.prisma  23 models (postgresql)
  seed.js        catalog + admin + demo tourists + sample trip
tests/           Jest + Supertest suite
```
