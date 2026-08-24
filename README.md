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
* **Capacitor Camera** (profile photo from the camera or the gallery, with permission handling)
* **Capacitor Filesystem + Share** (saving the PDF receipt and opening it through the system share sheet)
* **Client-side image resizing** (`packages/core/src/utils/imagen.ts`, via `createImageBitmap` + canvas) so a phone photo fits the backend's 2 MB limit without spending server CPU
* **npm workspaces** (monorepo: admin + `packages/core` + `mobile`)
* **Vitest** (unit tests, 414 in total)
* **GitHub Actions** (CI: tests + production builds of both apps on every push and pull request)
* **Firebase Hosting** (multi-site deployment)

## Structure

```
peluqueria_citas_frontend/
├── src/                       # Admin app (Angular 21 zoneless + Tailwind v4)
│   ├── app/features/
│   │   ├── auth/              # Login, password recovery and reset
│   │   ├── bloqueos/          # Closed days (holidays and one-off closures)
│   │   ├── citas/             # Appointment management (calendar, payments, barber selector)
│   │   ├── dashboard/         # Statistics dashboard (CSS-only charts)
│   │   ├── peluqueros/        # Barber CRUD
│   │   ├── perfil/            # "My profile": own details and profile photo
│   │   ├── servicios/         # Service catalog CRUD (incl. the photo modal)
│   │   └── usuarios/          # User management (roles, search, reactivation)
│   └── app/shared/
│       ├── cita-detalle/      # Appointment detail, opened from the dashboard
│       ├── date-picker/       # Month grid that disables closed days
│       └── lista-modal/       # Searchable, incrementally-scrolled list modal
├── mobile/                    # Customer app (Ionic 8 + Angular + Capacitor)
│   ├── assets/                # Icon sources + LEEME.md (how to regenerate them)
│   ├── scripts/               # Icon composition and PNG optimisation
│   └── src/app/
│       ├── agendar/           # Booking: service, date, barber and slot selection
│       ├── auth/              # Login / registration / password recovery
│       ├── asistente/         # Assistant chat (also reachable without a session)
│       ├── contacto/          # Salon address, phone and email
│       ├── core/              # Biometric login, secure token storage, camera
│       ├── mis-citas/         # Appointment history with status and payment badges
│       ├── pago/              # Stripe Payment Element checkout with polling
│       ├── perfil/            # Profile, profile photo and biometric settings
│       └── servicios/         # Service catalog with photos
├── packages/core/             # @peluqueria/core — shared library
│   └── src/
│       ├── models/            # Interfaces: Cita, Servicio, Usuario, Pago, Peluquero, DiaBloqueado, Estadisticas
│       ├── services/          # HTTP services for every API resource + token storage
│       ├── utils/             # ISO date helpers and client-side image resizing
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
* **Closed days**: block a holiday or a one-off closure (with a reason) and unblock it. Closed days — Sundays included — render as **unselectable** in the booking calendar, so a day with no available times can no longer be picked
* **Catalog photos**: upload, replace or remove a photo per service from a modal, resized in the browser before uploading
* **"My profile"** screen with the admin's own details and profile photo, plus a real avatar in the header. Avatars are deliberately **not** shown in the user listing — the signed URL is requested only when opening a user's card, so browsing users costs no signing round-trips
* **PDF receipt** per payment from the revenue breakdown. The file is fetched with `HttpClient` as a blob and not through a plain `<a href>`: the endpoint requires the JWT, which the interceptor adds, so a direct link would just get a 401
* Login with JWT + rotating refresh tokens, password recovery

### Customer mobile app (`mobile/`)

Ionic app for the salon's customers:

* Registration, login and password recovery
* Booking flow: pick a service, a date, optionally a **barber** ("Any" by default) and a free slot. The calendar (`ion-datetime` with `isDateEnabled`) **greys out Sundays and closed days**, so they cannot be selected
* **Online card payment** (Stripe Payment Element) with automatic status polling, plus appointment history with payment badges
* **Biometric login** (fingerprint/face) storing tokens in secure native storage
* **Profile photo from the camera or the gallery**, with permission handling: if both camera and gallery are denied the app says so instead of failing silently, and cancelling the picker is treated as a cancellation, not an error. In the browser the plugin falls back to a file picker, so the same screen works without a device
* **PDF receipt** of a paid appointment: the file is written to the cache directory and opened through the **system share sheet**, which is what offers "Save to Files", "Open with…" or sending it on — the WebView has no downloads folder and no PDF viewer. In the browser it degrades to a normal download, so the same screen works as a PWA
* **Conversational assistant** in its own tab: ask about services, prices, opening hours or whether a day has a free slot, and the backend answers by querying the real data through tool calling. Three decisions:
    * **It is the only screen besides login reachable without an account.** Its endpoint is public because people ask about prices *before* registering, and all of `/tabs` requires a session — so besides the tab there is an `/asistente` route **outside the guards**, linked from the login screen. Without it no client would ever exercise that backend design. The routing spec asserts it carries no guards and is declared before the wildcard.
    * **The conversation lives in memory only.** The backend is stateless: the history is resent on every turn. Leaving the screen clears it, which is right here — there is nothing worth persisting, and nothing that was asked is left on the device. The history is trimmed to the **10 most recent turns** (not the first ones: the context needed to understand "and Thursday?" is what was just said), which is what the backend accepts and what stops each new message from costing more tokens than the last.
    * **Each error status says something different**, because the customer has to be able to act on it: **429** means wait, **503** means retrying won't help and offers the phone number, **404** means the assistant is not deployed on that backend, and no connectivity is said plainly. If the request fails the question **stays on screen** so it doesn't have to be retyped.
* **Contact screen** with the salon's address, phone number and email. Phone and email are `tel:` and `mailto:` links, which Capacitor hands to the system dialler and mail client instead of opening them inside the WebView
* Built with Capacitor: the same codebase deploys as a web app today and packages as an Android app (`appId com.segovia.peluqueria`), with its own launcher icon and splash screen

### Shared library (`packages/core`)

`@peluqueria/core`, consumed by both apps:

* `models/`: TypeScript interfaces for every API resource (`Cita`, `Servicio`, `Usuario`, `Pago`, `Peluquero`, `DiaBloqueado`, `Estadisticas`) and their enums
* `services/`: one HTTP service per resource (`CitaService`, `PagoService`, `PeluqueroService`, `DiaBloqueadoService`, `EstadisticasService`, ...) plus `AuthService` and token storage
* `utils/fecha.ts`: local-time `YYYY-MM-DD` helpers (`toISOString()` would shift the day in positive-offset timezones)
* `utils/imagen.ts`: resizes an image in the browser before uploading, so a phone photo fits the backend's 2 MB limit using the user's CPU rather than the server's. It only ever **optimises**: if the environment has no `createImageBitmap`, the original is uploaded and the server decides — the helper never blocks an upload
* `utils/descarga.ts`: turns a blob into a browser download. Needed because files served by the API require the JWT, so they cannot be linked directly; also used as the mobile app's fallback when it runs in a browser
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

**448 Vitest tests** run in CI on every push, followed by production builds of both apps:

| Suite | Tests | Covers |
|-------|-------|--------|
| Admin + core (`npx ng test`) | 241 | Feature components (citas, bloqueos, usuarios, servicios, peluqueros, perfil, dashboard, auth), the closed-day date picker, the searchable list modal, client-side image resizing, receipt download, the assistant client, and every core service, guard and interceptor |
| Mobile (`cd mobile && npx ng test`) | 207 | Booking flow (incl. barber selector and disabled closed days), Stripe payment page, biometric login and token storage, camera and profile photo, PDF receipt (share on device, download in the browser), appointment history, contact screen, the assistant chat (per-status error mapping, history trimming) and the tab routes |

```bash
npx ng test --watch=false            # admin + core
cd mobile && npx ng test --watch=false   # mobile
```

> One rule for the mobile suite: **two spec files must never `vi.mock` the same module.** The `@angular/build:unit-test` builder bundles the specs, so the mock registry is shared — when two files register a factory for the same module only one survives and the other silently gets the first one's doubles. It does not reproduce locally, only on CI's 2-core runner, so a green local run says nothing about it. Specs that need the same double live in the same file.

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

The launcher icon and splash screen are generated from the salon's logo with `npm run assets` (inside `mobile/`). **Read `mobile/assets/LEEME.md` first**: the tool overwrites a few hand-made decisions on every run, and the splash is a single XML drawable rather than the 26 bitmaps it produces — leaving both in place is a duplicate resource and the build fails.

## Backend

The REST API (Java 21 + Spring Boot 4) lives in [peluqueria_citas](https://github.com/eduardoandr3s/peluqueria_citas): JWT auth with refresh tokens, appointments with per-barber availability, Stripe payments with signed webhooks, image storage on Supabase Storage validated by magic bytes, statistics, email reminders and a 298-test suite (unit + Testcontainers).

---
*Developed by Eduardo Andres Segovia Roman.*
