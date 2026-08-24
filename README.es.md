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
* **Capacitor Camera** (foto de perfil desde la cámara o la galería, con gestión de permisos)
* **Capacitor Filesystem + Share** (guardar el recibo en PDF y abrirlo con la hoja de compartir del sistema)
* **Redimensionado de imágenes en el cliente** (`packages/core/src/utils/imagen.ts`, con `createImageBitmap` + canvas) para que una foto de móvil entre en el límite de 2 MB del backend sin gastar CPU del servidor
* **npm workspaces** (monorepo: admin + `packages/core` + `mobile`)
* **Vitest** (tests unitarios, 414 en total)
* **GitHub Actions** (CI: tests + builds de producción de ambas apps en cada push y pull request)
* **Firebase Hosting** (despliegue multi-site)

## Estructura

```
peluqueria_citas_frontend/
├── src/                       # App admin (Angular 21 zoneless + Tailwind v4)
│   ├── app/features/
│   │   ├── auth/              # Login, recuperación y reset de contraseña
│   │   ├── bloqueos/          # Días cerrados (festivos y cierres puntuales)
│   │   ├── citas/             # Gestión de citas (calendario, pagos, selector de peluquero)
│   │   ├── dashboard/         # Dashboard de estadísticas (gráficas solo con CSS)
│   │   ├── peluqueros/        # CRUD de peluqueros
│   │   ├── perfil/            # "Mi perfil": datos propios y foto de perfil
│   │   ├── servicios/         # CRUD del catálogo de servicios (incluido el modal de foto)
│   │   └── usuarios/          # Gestión de usuarios (roles, búsqueda, reactivación)
│   └── app/shared/
│       ├── cita-detalle/      # Detalle de cita, se abre desde el dashboard
│       ├── date-picker/       # Rejilla de mes que deshabilita los días cerrados
│       └── lista-modal/       # Modal de listado con buscador y scroll incremental
├── mobile/                    # App clientes (Ionic 8 + Angular + Capacitor)
│   ├── assets/                # Fuentes del icono + LEEME.md (cómo regenerarlo)
│   ├── scripts/               # Composición del icono y optimización de los PNG
│   └── src/app/
│       ├── agendar/           # Reserva: selección de servicio, fecha, peluquero y hueco
│       ├── auth/              # Login / registro / recuperación de contraseña
│       ├── asistente/         # Chat con el asistente (también accesible sin sesión)
│       ├── contacto/          # Dirección, teléfono y email del salón
│       ├── core/              # Login biométrico, almacenamiento seguro de tokens y cámara
│       ├── mis-citas/         # Historial de citas con badges de estado y pago
│       ├── pago/              # Checkout con Stripe Payment Element y polling
│       ├── perfil/            # Perfil, foto de perfil y ajustes de biometría
│       └── servicios/         # Catálogo de servicios con fotos
├── packages/core/             # @peluqueria/core — librería compartida
│   └── src/
│       ├── models/            # Interfaces: Cita, Servicio, Usuario, Pago, Peluquero, DiaBloqueado, Estadisticas
│       ├── services/          # Servicios HTTP de cada recurso de la API + token storage
│       ├── utils/             # Helpers de fechas ISO y redimensionado de imágenes en cliente
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
* **Días cerrados**: bloquear un festivo o un cierre puntual (con motivo) y desbloquearlo. Los días cerrados —domingos incluidos— se pintan **no seleccionables** en el calendario de agendar, así que ya no se puede elegir un día sin horas disponibles
* **Fotos de catálogo**: subir, sustituir o borrar la foto de cada servicio desde un modal, redimensionada en el navegador antes de subirla
* Pantalla **"Mi perfil"** con los datos propios y la foto de perfil, más el avatar real en la cabecera. En el listado de usuarios **no** se pintan avatares a propósito: la URL firmada se pide solo al abrir la ficha de un usuario, así que recorrer el listado no cuesta ninguna firma
* **Recibo en PDF** de cada pago desde el desglose de ingresos. El fichero se pide con `HttpClient` como blob y no con un `<a href>` normal: el endpoint exige el JWT, que lo pone el interceptor, así que un enlace directo recibiría un 401
* Login con JWT + refresh tokens con rotación, recuperación de contraseña

### App móvil de clientes (`mobile/`)

App Ionic para los clientes de la peluquería:

* Registro, login y recuperación de contraseña
* Flujo de reserva: elegir servicio, fecha, opcionalmente **peluquero** ("Cualquiera" por defecto) y un hueco libre. El calendario (`ion-datetime` con `isDateEnabled`) **deshabilita domingos y días cerrados**, que quedan en gris y no se pueden pulsar
* **Pago online con tarjeta** (Stripe Payment Element) con polling automático del estado, e historial de citas con badges de pago
* **Login biométrico** (huella/cara) guardando los tokens en almacenamiento nativo seguro
* **Foto de perfil desde la cámara o la galería**, con gestión de permisos: si se deniegan cámara y galería la app lo dice en vez de fallar en silencio, y cerrar el selector se trata como cancelación, no como error. En el navegador el plugin cae a un selector de ficheros, así que la misma pantalla funciona sin dispositivo
* **Recibo en PDF** de una cita pagada: el fichero se escribe en el directorio de caché y se abre con la **hoja de compartir del sistema**, que es la que ofrece «Guardar en Archivos», «Abrir con…» o reenviarlo — el WebView no tiene carpeta de descargas ni visor de PDF. En el navegador degrada a una descarga normal, así que la misma pantalla funciona como PWA
* **Asistente conversacional** en una pestaña propia: pregunta por servicios, precios, horario o si queda hueco un día, y el backend responde consultando los datos reales con *tool calling*. Tres decisiones:
    * **Es la única pantalla, aparte del login, a la que se llega sin cuenta.** Su endpoint es público porque se pregunta por precios *antes* de registrarse, y todo `/tabs` exige sesión, así que además de la pestaña hay una ruta `/asistente` **fuera de los guards**, enlazada desde el login. Sin ella ese diseño del backend no lo aprovecharía ningún cliente. El spec de rutas comprueba que no tenga guards y que esté declarada antes del comodín.
    * **La conversación vive solo en memoria.** El backend no guarda estado: en cada turno se le reenvía el historial. Salir de la pantalla la borra, que es lo correcto aquí — no hay nada que valga la pena persistir y no queda en el dispositivo nada de lo que se haya preguntado. El historial se recorta a los **10 turnos más recientes** (no a los primeros: el contexto que hace falta para entender «y el jueves?» es lo último que se dijo), que es lo que acepta el backend y lo que evita que cada mensaje nuevo cueste más tokens que el anterior.
    * **Cada estado de error dice algo distinto**, porque el cliente tiene que poder actuar: con **429** espera, con **503** no vale reintentar y se le ofrece el teléfono, con **404** el asistente no está desplegado en ese backend, y sin conexión se dice tal cual. Si la petición falla, la pregunta **se queda en pantalla** para no obligar a reescribirla.
* **Pantalla de contacto** con la dirección, el teléfono y el email del salón. El teléfono y el email son enlaces `tel:` y `mailto:`, que Capacitor saca al marcador y al cliente de correo del sistema en vez de abrirlos dentro del WebView
* Construida con Capacitor: el mismo código se despliega hoy como web y se empaqueta como app Android (`appId com.segovia.peluqueria`), con icono de lanzador y pantalla de arranque propios

### Librería compartida (`packages/core`)

`@peluqueria/core`, consumida por ambas apps:

* `models/`: interfaces TypeScript de cada recurso de la API (`Cita`, `Servicio`, `Usuario`, `Pago`, `Peluquero`, `DiaBloqueado`, `Estadisticas`) y sus enums
* `services/`: un servicio HTTP por recurso (`CitaService`, `PagoService`, `PeluqueroService`, `DiaBloqueadoService`, `EstadisticasService`, ...) más `AuthService` y el token storage
* `utils/fecha.ts`: helpers de `YYYY-MM-DD` en hora local (`toISOString()` desplazaría el día en las zonas con offset positivo)
* `utils/imagen.ts`: redimensiona la imagen en el navegador antes de subirla, para que una foto de móvil entre en el límite de 2 MB del backend gastando la CPU del usuario y no la del servidor. Solo **optimiza**: si el entorno no ofrece `createImageBitmap` se sube el original y decide el servidor — la utilidad nunca impide una subida
* `utils/descarga.ts`: convierte un blob en una descarga del navegador. Hace falta porque los ficheros que sirve el API exigen el JWT y no se pueden enlazar directamente; la app móvil lo usa además como respaldo cuando corre en el navegador
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

**448 tests con Vitest** se ejecutan en CI en cada push, seguidos de las builds de producción de ambas apps:

| Suite | Tests | Cubre |
|-------|-------|-------|
| Admin + core (`npx ng test`) | 241 | Componentes de features (citas, bloqueos, usuarios, servicios, peluqueros, perfil, dashboard, auth), el date picker de días cerrados, el modal de listado con buscador, el redimensionado de imágenes, la descarga del recibo, el cliente del asistente, y todos los servicios, guard e interceptor del core |
| Mobile (`cd mobile && npx ng test`) | 207 | Flujo de reserva (incl. selector de peluquero y días cerrados deshabilitados), página de pago Stripe, login biométrico y token storage, cámara y foto de perfil, recibo en PDF (compartir en el dispositivo, descarga en el navegador), historial de citas, pantalla de contacto, el chat del asistente (traducción de errores por estado, recorte del historial) y las rutas de las pestañas |

```bash
npx ng test --watch=false            # admin + core
cd mobile && npx ng test --watch=false   # mobile
```

> Una regla para la suite del móvil: **dos ficheros de spec nunca deben hacer `vi.mock` del mismo módulo.** El builder `@angular/build:unit-test` empaqueta los specs, así que el registro de mocks es compartido: cuando dos ficheros registran un factory para el mismo módulo sobrevive uno solo y el otro acaba usando los dobles del primero sin avisar. No se reproduce en local, solo en el runner de 2 cores de CI, así que verde en local no dice nada al respecto. Los specs que necesitan el mismo doble van en el mismo fichero.

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

El icono de lanzador y la pantalla de arranque se generan desde el logo de la peluquería con `npm run assets` (dentro de `mobile/`). **Leer antes `mobile/assets/LEEME.md`**: la herramienta pisa en cada ejecución unas cuantas decisiones hechas a mano, y el splash es un único drawable XML en vez de los 26 bitmaps que ella produce — dejar los dos es un recurso duplicado y la build falla.

## Backend

La API REST (Java 21 + Spring Boot 4) vive en [peluqueria_citas](https://github.com/eduardoandr3s/peluqueria_citas): autenticación JWT con refresh tokens, citas con disponibilidad por peluquero, pagos Stripe con webhooks firmados, almacenamiento de imágenes en Supabase Storage validadas por magic bytes, estadísticas, recordatorios por correo y una suite de 295 tests (unitarios + Testcontainers).

---
*Desarrollado por Eduardo Andrés Segovia Román.*
