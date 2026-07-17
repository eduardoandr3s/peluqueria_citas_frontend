# "Lalo Segovia" Hair Salon — Frontend Monorepo

[![CI](https://github.com/eduardoandr3s/peluqueria_citas_frontend/actions/workflows/ci.yml/badge.svg)](https://github.com/eduardoandr3s/peluqueria_citas_frontend/actions/workflows/ci.yml)

🇬🇧 English | [🇪🇸 Español](README.es.md)

Frontend monorepo for a hair salon booking system: an **admin panel** (Angular) and a **customer mobile app** (Ionic + Capacitor) that share models and HTTP services through a common library. It consumes the REST API of the [peluqueria_citas](https://github.com/eduardoandr3s/peluqueria_citas) backend.

## Live Demo

| App | URL |
|-----|-----|
| Admin panel | https://peluqueria-citas-prod.web.app |
| Customer app (web build) | https://peluqueria-citas-app.web.app |

> The backend runs on Render's free tier and **sleeps after 15 minutes of inactivity**: the first request may take ~30-60 seconds. Stripe runs in **test mode** — use card `4242 4242 4242 4242` with any future date and CVC. You can register a new account directly from the customer app.

## Tech Stack

* **Angular 21** — the admin runs **zoneless** (no `zone.js`, signal-based change detection); both apps use signals throughout
* **Tailwind CSS v4** (admin styling, no component library)
* **Ionic 8 + Capacitor 8** (customer mobile app, ready to package for Android)
* **Stripe.js / Payment Element** (card payments in the mobile app)
* **Capacitor Native Biometric + Preferences** (biometric login with secure token storage)
* **npm workspaces** (monorepo: admin + `packages/core` + `mobile`)
* **Vitest** (unit tests, 264 in total)
* **GitHub Actions** (CI: tests + production builds of both apps on every push and pull request)
* **Firebase Hosting** (multi-site deployment)

## Structure

```
peluqueria_citas_frontend/
├── src/                       # Admin app (Angular 21 zoneless + Tailwind v4)
│   └── app/features/
│       ├── auth/              # Login, password recovery and reset
│       ├── citas/             # Appointment management (calendar, payments, barber selector)
│       ├── dashboard/         # Statistics dashboard (CSS-only charts)
│       ├── peluqueros/        # Barber CRUD
│       ├── servicios/         # Service catalog CRUD
│       └── usuarios/          # User management (roles, search, reactivation)
├── mobile/                    # Customer app (Ionic 8 + Angular + Capacitor)
│   └── src/app/
│       ├── agendar/           # Booking: service, date, barber and slot selection
│       ├── auth/              # Login / registration / password recovery
│       ├── core/              # Biometric login and secure token storage
│       ├── mis-citas/         # Appointment history with status and payment badges
│       ├── pago/              # Stripe Payment Element checkout with polling
│       └── perfil/            # Profile and biometric settings
├── packages/core/             # @peluqueria/core — shared library
│   └── src/
│       ├── models/            # Interfaces: Cita, Servicio, Usuario, Pago, Peluquero, Estadisticas
│       ├── services/          # HTTP services for every API resource + token storage
│       ├── auth.guard.ts      # Route guard
│       └── jwt.interceptor.ts # Attaches the JWT and handles refresh
└── package.json               # npm workspaces (packages/*, mobile)
```

## Apps

### Admin panel (`src/`)

Management panel for the salon owner:

* Appointment management: calendar with filters, pagination, booking/rescheduling with **live availability slots**, optional **barber selector**
* Payments: manual payments (cash/transfer), Stripe payment status, refunds
* **Statistics dashboard**: appointments by status, revenue by payment method, top services and new customers, with range selector (month / last 30 days / year) — charts built with plain `div` + Tailwind, no chart library, keeping the app zoneless
* CRUD for services, **barbers** and users (roles, search, soft delete and reactivation)
* Login with JWT + rotating refresh tokens, password recovery

### Customer mobile app (`mobile/`)

Ionic app for the salon's customers:

* Registration, login and password recovery
* Booking flow: pick a service, a date, optionally a **barber** ("Any" by default) and a free slot
* **Online card payment** (Stripe Payment Element) with automatic status polling, plus appointment history with payment badges
* **Biometric login** (fingerprint/face) storing tokens in secure native storage
* Built with Capacitor: the same codebase deploys as a web app today and packages as an Android app (`appId com.segovia.peluqueria`)

### Shared library (`packages/core`)

`@peluqueria/core`, consumed by both apps:

* `models/`: TypeScript interfaces for every API resource (`Cita`, `Servicio`, `Usuario`, `Pago`, `Peluquero`, `Estadisticas`) and their enums
* `services/`: one HTTP service per resource (`CitaService`, `PagoService`, `PeluqueroService`, `EstadisticasService`, ...) plus `AuthService` and token storage
* `jwt.interceptor.ts` and `auth.guard.ts`: JWT handling and route protection shared by both apps

## Getting Started

```bash
git clone https://github.com/eduardoandr3s/peluqueria_citas_frontend.git
cd peluqueria_citas_frontend
npm ci                     # installs all workspaces (root, core, mobile)

# Admin → http://localhost:4200
npx ng serve

# Customer app → http://localhost:8100
cd mobile
npx ng serve --port 8100
```

Both apps expect the backend at `http://localhost:8080/api` in development (see the [backend README](https://github.com/eduardoandr3s/peluqueria_citas) to start it, e.g. with `docker compose up`).

### Configuration

| File | Setting | Description |
|------|---------|-------------|
| `src/environments/environment*.ts` | `apiUrl` | Backend base URL (dev: `http://localhost:8080/api`) |
| `mobile/src/environments/environment*.ts` | `apiUrl`, `stripePublishableKey` | Backend URL and Stripe publishable key (`pk_test_...`) |

## Tests

**264 Vitest tests** run in CI on every push, followed by production builds of both apps:

| Suite | Tests | Covers |
|-------|-------|--------|
| Admin + core (`npx ng test`) | 146 | Feature components (citas, usuarios, servicios, peluqueros, dashboard, auth) and every core service, guard and interceptor |
| Mobile (`cd mobile && npx ng test`) | 118 | Booking flow (incl. barber selector), Stripe payment page, biometric login and token storage, appointment history |

```bash
npx ng test --watch=false            # admin + core
cd mobile && npx ng test --watch=false   # mobile
```

## Build & Deployment

Both apps are deployed to **Firebase Hosting** as separate sites of the same project (`firebase.json` multi-site: target `admin` → `dist/peluqueria-frontend/browser`, target `app` → `mobile/www`):

```bash
# Admin
npx ng build

# Customer app (web build)
cd mobile && npx ng build --configuration production && cd ..

# Deploy both sites
firebase deploy --only hosting
```

To package the customer app for Android (Play Store):

```bash
cd mobile
npx ng build --configuration production
npx cap add android     # first time only
npx cap sync android
npx cap open android    # opens Android Studio to build the AAB
```

## Backend

The REST API (Java 21 + Spring Boot 4) lives in [peluqueria_citas](https://github.com/eduardoandr3s/peluqueria_citas): JWT auth with refresh tokens, appointments with per-barber availability, Stripe payments with signed webhooks, statistics, email reminders and a 167-test suite (unit + Testcontainers).

---
*Developed by Eduardo Andres Segovia Roman.*
