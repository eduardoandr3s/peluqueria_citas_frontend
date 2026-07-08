# PeluqueriaFrontend

[![CI](https://github.com/eduardoandr3s/peluqueria_citas_frontend/actions/workflows/ci.yml/badge.svg)](https://github.com/eduardoandr3s/peluqueria_citas_frontend/actions/workflows/ci.yml)

Monorepo frontend para la peluquería "Lalo Segovia". Consume la API REST del backend [peluqueria_citas](https://github.com/eduardoandr3s/peluqueria_citas).

## Estructura

```
peluqueria_citas_frontend/
├── src/                    # Aplicación admin (Angular 21 + Tailwind v4)
│   └── app/features/       # Módulos funcionales del panel admin
├── mobile/                 # App móvil clientes (Ionic 8 + Angular)
│   └── src/app/
│       ├── pago/           # Página de pago con Stripe Payment Element
│       └── mis-citas/      # Listado de citas del cliente
├── packages/core/          # Librería compartida (modelos, servicios HTTP)
│   ├── models/             # Interfaces TypeScript (Cita, Servicio, Pago, Usuario)
│   └── services/           # Servicios HTTP (CitaService, PagoService, AuthService, etc.)
└── package.json            # npm workspaces (packages/*, mobile)
```

## Apps

### Admin (`ng serve` → puerto 4200)
Panel de gestión para el administrador:
- CRUD de servicios, usuarios y citas
- Gestión de pagos: registro manual (efectivo/transferencia) y reembolsos
- Calendario de citas con filtros y paginación
- Roles y permisos (USER / ADMIN)

### Mobile (`ionic serve` → puerto 8100)
App para clientes:
- Registro e inicio de sesión
- Agendar citas seleccionando servicio y horario
- Pago online con tarjeta (Stripe Payment Element) con polling de verificación
- Historial de citas con estados y badges de pago

## Core (`packages/core`)
Librería compartida entre admin y mobile:
- `models/`: interfaces `Cita`, `Servicio`, `Usuario`, `PagoResponse`, `PaymentIntentResponse` y enums (`EstadoCita`, `EstadoPago`, `MetodoPago`)
- `services/`: servicios HTTP que consumen la API REST (`CitaService`, `PagoService`, `UsuarioService`, `AuthService`)

## Scripts

```bash
ng serve              # Iniciar admin en localhost:4200
ng build              # Build producción del admin
ng test               # Tests unitarios (Vitest)

cd mobile && npx @ionic/cli serve --port 8100   # Iniciar app móvil
```

## Tests

| Proyecto | Archivo | Tests |
|----------|---------|-------|
| Core | `pago.service.spec.ts` | 5 (crear intent, consultar, manual, reembolso, errores) |
| Admin | `citas.spec.ts` | 5 (modal pago, estados, reembolso, carga pagos) |
| Mobile | `mis-citas.page.spec.ts` | Mock PagoService + API_URL |

Ejecutar: `ng test` (admin) o `ng test` dentro de `mobile/`.

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `stripePublishableKey` | Clave publicable de Stripe (test mode: `pk_test_...`) |
| `apiUrl` | URL base de la API REST (default `http://localhost:8080/api`) |
