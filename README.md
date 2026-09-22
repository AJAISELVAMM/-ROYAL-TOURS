# TourGuard AI

**Plan Smart. Explore More. Travel Safe.**

A professional, AI-powered smart-tourism web application. This is a
**frontend-first** implementation (React + JavaScript + JSX, no TypeScript),
built around a centralized mock-data/services layer that a real backend can
later replace without touching the UI.

---

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build
```

---

## Demo accounts

| Role    | Email                | Password   |
| ------- | -------------------- | ---------- |
| Tourist | `arun@example.com`   | `tour123`  |
| Tourist | `priya@example.com`  | `tour123`  |
| Admin   | `admin@tourguard.ai` | `admin@123` |

> **The Admin login uses the SAME public login form.** There is no visible
> "Admin Login" button, selector, or registration anywhere in the UI. Entering
> the admin credentials on `/login` routes directly to the hidden
> `/control-center` dashboard. Admin credentials live only in
> `src/services/authService.js` and are never rendered in the UI.

**OTP (demo):** any 10-digit phone is accepted; the 6-digit code is `123456`.
This is frontend demo logic only — no real SMS is sent.

---

## Two complete experiences

1. **Tourist** — public landing → register (with mandatory phone OTP) → login →
   Dashboard, My Journey (trip / budget / packing / group), Smart Travel
   (transport / fair fare / translator / weather), Discover (places / hotels /
   restaurants / theatres / shopping + detail views), Safety (map / I'm Lost /
   report issue / emergency), global SOS, and Account.
2. **Hidden Admin** — same login form → `/control-center` with Dashboard,
   Users, Travel Data, AI & Recommendations, Fare & Reports, Safety Center
   (incl. live SOS monitoring), Analytics, and Account.

**Shared demo state** powers Tourist ↔ Admin flows: a tourist fare report
appears in Admin → Fare & Reports; a safety report appears in the Safety
Center; an SOS appears instantly as an Active SOS for the admin to
acknowledge / escalate / resolve; admin verification flips a place to
"Verified" for tourists.

---

## Project structure

```
src/
  data/mockDatabase.js      # single source of truth for demo data
  store.js                  # reactive store + localStorage persistence
  useStore.js               # React hook to subscribe components to the store
  services/                 # auth, trip, catalog, fare, translation, safety,
                            # sos, admin — the future backend boundary
  context/                  # AuthContext, ToastContext
  components/
    common/                 # Button, Card, Modal, Icon, Tabs, badges, charts…
    layout/                 # Tourist sidebar/header, Admin sidebar/layout
    tourist/                # SOS modal
    admin/                  # stat cards etc.
    auth/                   # route guards (RequireTourist / RequireAdmin)
  pages/
    public/                 # Landing, Login, Create Account, Verify Phone
    tourist/                # all tourist pages
    admin/                  # all admin pages
  App.jsx                   # routing + authorization
  styles.css                # full purple/violet theme, responsive
```

## Routing & authorization

- Public: `/`, `/login`, `/create-account`, `/verify-phone`
- Tourist (protected): `/dashboard`, `/my-journey/*`, `/smart-travel/*`,
  `/discover/*`, `/safety/*`, `/account`
- Admin (hidden, protected): `/control-center/*`

Unauthenticated access to protected routes → redirect to `/login`. A tourist
who hits an admin route → denied and sent to `/dashboard`. An admin never sees
the tourist sidebar and vice-versa.

## Theme

Purple/violet brand (deep purple `#5b21b6`, violet `#8b5cf6`) with clean
white/light surfaces, rounded cards, subtle borders and soft shadows.
Semantic colors are preserved: green = success/safe, amber = warning,
red = emergency (SOS and all emergency UI remain red).

## Notes for future backend integration

All services are structured as plain modules (`authService.login(email,
password)`, `sosService.createSOS(...)`, etc.) returning objects. Replace their
internals with `fetch` calls to real APIs (OTP/SMS, auth, trips, reports, SOS
via WebSocket/SSE) without changing component code. No fake external
SMS/police/medical communication is performed in this frontend-only demo.
