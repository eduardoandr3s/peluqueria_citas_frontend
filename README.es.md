# Peluquería "Lalo Segovia" — Monorepo Frontend

[![CI](https://github.com/eduardoandr3s/peluqueria_citas_frontend/actions/workflows/ci.yml/badge.svg)](https://github.com/eduardoandr3s/peluqueria_citas_frontend/actions/workflows/ci.yml)

[🇬🇧 English](README.md) | 🇪🇸 Español

Monorepo frontend de un sistema de gestión de citas para una peluquería: un **panel de administración** (Angular) y una **app móvil para clientes** (Ionic + Capacitor) que comparten modelos y servicios HTTP a través de una librería común. Consume la API REST del backend [peluqueria_citas](https://github.com/eduardoandr3s/peluqueria_citas).

## Demo en producción

| Aplicación | URL |
|-----------|-----|
| Panel de administración | https://peluqueria-citas-prod.web.app |
| App de clientes (versión web) | https://peluqueria-citas-app.web.app |

> El backend corre en el tier gratuito de Render y **se duerme tras 15 minutos de inactividad**: la primera petición puede tardar ~30-60 segundos. Stripe está en **modo test** — usa la tarjeta `4242 4242 4242 4242` con cualquier fecha futura y CVC. Puedes registrar una cuenta nueva directamente desde la app de clientes.

## Tecnologías

* **Angular 21** — el admin funciona **zoneless** (sin `zone.js`, change detection basada en signals); ambas apps usan signals en todas partes
* **Tailwind CSS v4** (estilos del admin, sin librería de componentes)
* **Ionic 8 + Capacitor 8** (app móvil de clientes, lista para empaquetar para Android)
* **Stripe.js / Payment Element** (pago con tarjeta en la app móvil)
* **Capacitor Native Biometric + Preferences** (login biométrico con almacenamiento seguro de tokens)
* **npm workspaces** (monorepo: admin + `packages/core` + `mobile`)
* **Vitest** (tests unitarios, 264 en total)
* **GitHub Actions** (CI: tests + builds de producción de ambas apps en cada push y pull request)
* **Firebase Hosting** (despliegue multi-site)

## Estructura

```
peluqueria_citas_frontend/
├── src/                       # App admin (Angular 21 zoneless + Tailwind v4)
│   └── app/features/
│       ├── auth/              # Login, recuperación y reset de contraseña
│       ├── citas/             # Gestión de citas (calendario, pagos, selector de peluquero)
│       ├── dashboard/         # Dashboard de estadísticas (gráficas solo con CSS)
│       ├── peluqueros/        # CRUD de peluqueros
│       ├── servicios/         # CRUD del catálogo de servicios
│       └── usuarios/          # Gestión de usuarios (roles, búsqueda, reactivación)
├── mobile/                    # App clientes (Ionic 8 + Angular + Capacitor)
│   └── src/app/
│       ├── agendar/           # Reserva: selección de servicio, fecha, peluquero y hueco
│       ├── auth/              # Login / registro / recuperación de contraseña
│       ├── core/              # Login biométrico y almacenamiento seguro de tokens
│       ├── mis-citas/         # Historial de citas con badges de estado y pago
│       ├── pago/              # Checkout con Stripe Payment Element y polling
│       └── perfil/            # Perfil y ajustes de biometría
├── packages/core/             # @peluqueria/core — librería compartida
│   └── src/
│       ├── models/            # Interfaces: Cita, Servicio, Usuario, Pago, Peluquero, Estadisticas
│       ├── services/          # Servicios HTTP de cada recurso de la API + token storage
│       ├── auth.guard.ts      # Guard de rutas
│       └── jwt.interceptor.ts # Adjunta el JWT y gestiona el refresh
└── package.json               # npm workspaces (packages/*, mobile)
```

## Aplicaciones

### Panel de administración (`src/`)

Panel de gestión para el dueño de la peluquería:

* Gestión de citas: calendario con filtros, paginación, agendado/reprogramación con **slots de disponibilidad en vivo** y **selector de peluquero** opcional
* Pagos: pagos manuales (efectivo/transferencia), estado del pago Stripe, reembolsos
* **Dashboard de estadísticas**: citas por estado, ingresos por método de pago, top servicios y clientes nuevos, con selector de rango (mes / últimos 30 días / año) — gráficas hechas con `div` + Tailwind, sin librería de charts, manteniendo la app zoneless
* CRUD de servicios, **peluqueros** y usuarios (roles, búsqueda, soft delete y reactivación)
* Login con JWT + refresh tokens con rotación, recuperación de contraseña

### App móvil de clientes (`mobile/`)

App Ionic para los clientes de la peluquería:

* Registro, login y recuperación de contraseña
* Flujo de reserva: elegir servicio, fecha, opcionalmente **peluquero** ("Cualquiera" por defecto) y un hueco libre
* **Pago online con tarjeta** (Stripe Payment Element) con polling automático del estado, e historial de citas con badges de pago
* **Login biométrico** (huella/cara) guardando los tokens en almacenamiento nativo seguro
* Construida con Capacitor: el mismo código se despliega hoy como web y se empaqueta como app Android (`appId com.segovia.peluqueria`)

### Librería compartida (`packages/core`)

`@peluqueria/core`, consumida por ambas apps:

* `models/`: interfaces TypeScript de cada recurso de la API (`Cita`, `Servicio`, `Usuario`, `Pago`, `Peluquero`, `Estadisticas`) y sus enums
* `services/`: un servicio HTTP por recurso (`CitaService`, `PagoService`, `PeluqueroService`, `EstadisticasService`, ...) más `AuthService` y el token storage
* `jwt.interceptor.ts` y `auth.guard.ts`: manejo del JWT y protección de rutas compartidos por las dos apps

## Puesta en marcha

```bash
git clone https://github.com/eduardoandr3s/peluqueria_citas_frontend.git
cd peluqueria_citas_frontend
npm ci                     # instala todos los workspaces (raíz, core, mobile)

# Admin → http://localhost:4200
npx ng serve

# App de clientes → http://localhost:8100
cd mobile
npx ng serve --port 8100
```

Ambas apps esperan el backend en `http://localhost:8080/api` en desarrollo (mira el [README del backend](https://github.com/eduardoandr3s/peluqueria_citas) para arrancarlo, p. ej. con `docker compose up`).

### Configuración

| Archivo | Ajuste | Descripción |
|---------|--------|-------------|
| `src/environments/environment*.ts` | `apiUrl` | URL base del backend (dev: `http://localhost:8080/api`) |
| `mobile/src/environments/environment*.ts` | `apiUrl`, `stripePublishableKey` | URL del backend y clave publicable de Stripe (`pk_test_...`) |

## Tests

**264 tests con Vitest** se ejecutan en CI en cada push, seguidos de las builds de producción de ambas apps:

| Suite | Tests | Cubre |
|-------|-------|-------|
| Admin + core (`npx ng test`) | 146 | Componentes de features (citas, usuarios, servicios, peluqueros, dashboard, auth) y todos los servicios, guard e interceptor del core |
| Mobile (`cd mobile && npx ng test`) | 118 | Flujo de reserva (incl. selector de peluquero), página de pago Stripe, login biométrico y token storage, historial de citas |

```bash
npx ng test --watch=false            # admin + core
cd mobile && npx ng test --watch=false   # mobile
```

## Build y despliegue

Ambas apps se despliegan en **Firebase Hosting** como sites separados del mismo proyecto (`firebase.json` multi-site: target `admin` → `dist/peluqueria-frontend/browser`, target `app` → `mobile/www`):

```bash
# Admin
npx ng build

# App de clientes (versión web)
cd mobile && npx ng build --configuration production && cd ..

# Desplegar los dos sites
firebase deploy --only hosting
```

Para empaquetar la app de clientes para Android (Play Store):

```bash
cd mobile
npx ng build --configuration production
npx cap add android     # solo la primera vez
npx cap sync android
npx cap open android    # abre Android Studio para generar el AAB
```

## Backend

La API REST (Java 21 + Spring Boot 4) vive en [peluqueria_citas](https://github.com/eduardoandr3s/peluqueria_citas): autenticación JWT con refresh tokens, citas con disponibilidad por peluquero, pagos Stripe con webhooks firmados, estadísticas, recordatorios por correo y una suite de 167 tests (unitarios + Testcontainers).

---
*Desarrollado por Eduardo Andrés Segovia Román.*
