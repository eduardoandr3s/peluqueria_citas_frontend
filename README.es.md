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
│   │   ├── galeria/           # Galería de trabajos: subida múltiple, orden y títulos
│   │   ├── inicio/           # Redirector de entrada: cada rol a su pantalla
│   │   ├── peluqueros/        # Peluqueros: ficha, comisión y cuenta vinculada
│   │   ├── produccion/        # Producción y comisión (la propia, o la de la plantilla)
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
│       ├── galeria/           # Escaparate de trabajos: rejilla de miniaturas y visor
│       ├── mis-citas/         # Historial de citas con badges de estado y pago
│       ├── pago/              # Checkout con Stripe Payment Element y polling
│       ├── perfil/            # Perfil, foto de perfil y ajustes de biometría
│       └── servicios/         # Catálogo de servicios con fotos
├── packages/core/             # @peluqueria/core — librería compartida
│   └── src/
│       ├── models/            # Interfaces: Cita, Servicio, Usuario, Pago, Peluquero, DiaBloqueado, Estadisticas, GaleriaFoto
│       ├── services/          # Servicios HTTP de cada recurso de la API + token storage
│       ├── utils/             # Fechas ISO, redimensionado de imágenes, formato de importes y descargas
│       ├── auth.guard.ts      # Guard de rutas
│       └── jwt.interceptor.ts # Adjunta el JWT y gestiona el refresh
└── package.json               # npm workspaces (packages/*, mobile)
```

## Aplicaciones

### Panel de administración (`src/`)

Panel de gestión para el dueño de la peluquería:

* Gestión de citas: calendario con filtros, paginación, agendado/reprogramación con **slots de disponibilidad en vivo** y **selector de peluquero** opcional
* **Cierre de cita** (realizada / no asistió / anulada) con observaciones y un «ya he avisado al cliente». Va por un endpoint propio y no por el PUT de siempre: cerrar congela en la cita el importe y la comisión, y el PUT responde 400 a esos estados para que no queden citas realizadas sin precio congelado. Al marcar realizada una cita sin pago registrado **avisa de que no sumará en la producción** hasta que se cobre — en el momento en que aún se puede hacer algo
* **Producción y comisión**: lo vendido, lo cobrado y la comisión por peluquero, con desglose por servicio y por mes y comparativa de toda la plantilla. Solo suma lo **realizado y cobrado**; lo realizado y sin cobrar sale aparte para que no se pierda de vista
* **Rol `PELUQUERO`**: entra al mismo panel con su agenda y su producción, y sin nada de administración. El menú, los botones y hasta las peticiones cambian con el rol: siendo peluquero no se pide la lista de usuarios, que es de ADMIN, porque ese 403 dentro del `forkJoin` de la pantalla se llevaría por delante también las citas
* Pagos: pagos manuales (efectivo/transferencia), estado del pago Stripe, reembolsos
* **Dashboard de estadísticas**: citas por estado, ingresos por método de pago, top servicios y clientes nuevos, con selector de rango (mes / últimos 30 días / año) — gráficas hechas con `div` + Tailwind, sin librería de charts, manteniendo la app zoneless
* CRUD de servicios y usuarios (búsqueda, soft delete y reactivación). **El rol se elige en un desplegable dentro de «Editar»** y en el listado solo se lee: mientras fue un interruptor de «hacer/quitar admin» pintaba a un peluquero como si fuera administrador. El desplegable explica qué puede hacer cada rol, avisa de que el cambio cierra las sesiones abiertas de esa cuenta, y está deshabilitado sobre la propia — que es la forma tonta de quedarse fuera del panel. El rol no viaja en el `PUT` del usuario: tiene su propio endpoint porque invalida sus tokens, así que se manda aparte y solo si ha cambiado
* **Peluqueros**: además del CRUD, el **porcentaje de comisión** con **excepciones por servicio** (un tinte no comisiona como un corte) y la **cuenta vinculada** con la que el profesional entra al panel. La pantalla no ofrece vincular una cuenta de cliente: el backend lo rechaza, y sin el rol el dueño de esa ficha no vería ni una cita
* **Días cerrados**: bloquear un festivo o un cierre puntual (con motivo) y desbloquearlo. Los días cerrados —domingos incluidos— se pintan **no seleccionables** en el calendario de agendar, así que ya no se puede elegir un día sin horas disponibles
* **Fotos de catálogo**: subir, sustituir o borrar la foto de cada servicio desde un modal, redimensionada en el navegador antes de subirla
* **Galería de trabajos** (bajo «Configuración»): subida de **varias fotos a la vez**, títulos editables y orden manual con ↑/↓ —dos botones en vez de *drag and drop*: es el 90 % del valor con el 10 % del código—. De cada fichero se generan **dos tamaños en el navegador**, la imagen y una miniatura, y se suben en el mismo multipart: el servidor tiene 0,1 CPU en producción. Las subidas van **en serie**, porque el orden en que se guardan es el orden en que los clientes las verán. Mover una foto **renumera la rejilla** y solo manda al servidor lo que cambia de posición; intercambiar los dos `orden` sería una petición menos pero no movería nada si las dos fotos comparten número
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
* **Galería de trabajos**, a la que se entra desde la cabecera de Servicios y no como sexta pestaña (la barra ya tiene cinco y una más se aprieta). La rejilla se pinta **siempre con la miniatura**, con `loading="lazy"` y altura fija para que no salte al cargar, y la imagen grande se pide solo al abrir una foto: es la única pantalla que carga muchas imágenes de golpe y el límite del plan gratuito de almacenamiento es el tráfico
* Para el personal, el área de trabajo tiene su propia barra de pestañas: **agenda** (con el cierre de citas en un *action sheet*, y las observaciones y el aviso de «no sumará en la producción» en el propio diálogo) y **producción**. Un peluquero no ve las pestañas de servicios ni usuarios, y sus rutas lo devuelven a su área en un solo salto
* **Pantalla de contacto** con la dirección, el teléfono y el email del salón. El teléfono y el email son enlaces `tel:` y `mailto:`, que Capacitor saca al marcador y al cliente de correo del sistema en vez de abrirlos dentro del WebView
* Construida con Capacitor: el mismo código se despliega hoy como web y se empaqueta como app Android (`appId com.segovia.peluqueria`), con icono de lanzador y pantalla de arranque propios

### Librería compartida (`packages/core`)

`@peluqueria/core`, consumida por ambas apps:

* `models/`: interfaces TypeScript de cada recurso de la API (`Cita`, `Servicio`, `Usuario`, `Pago`, `Peluquero`, `DiaBloqueado`, `Estadisticas`, `GaleriaFoto`, `Produccion`) y sus enums
* `services/`: un servicio HTTP por recurso (`CitaService`, `PagoService`, `PeluqueroService`, `ProduccionService`, `DiaBloqueadoService`, `EstadisticasService`, `GaleriaService`, ...) más `AuthService` y el token storage
* `guards/`: `authGuard`, `adminGuard` y `staffGuard` (ADMIN o PELUQUERO). La puerta del área de trabajo es `staffGuard` y las pantallas de administración repiten `adminGuard` en su propia ruta: ocultar un enlace no es seguridad, pero enseñar una puerta cerrada es un panel roto
* `utils/fecha.ts`: helpers de `YYYY-MM-DD` en hora local (`toISOString()` desplazaría el día en las zonas con offset positivo)
* `utils/imagen.ts`: redimensiona la imagen en el navegador antes de subirla, para que una foto de móvil entre en el límite de 2 MB del backend gastando la CPU del usuario y no la del servidor. Solo **optimiza**: si el entorno no ofrece `createImageBitmap` se sube el original y decide el servidor — la utilidad nunca impide una subida
* `utils/precio.ts`: el formato de los importes, uno solo para las dos apps. Existe porque el formato salía de dos sitios —el pipe `number`, que depende del `LOCALE_ID` que registre cada app, y `toFixed(2)`, que siempre pone punto—, así que el mismo precio se veía «15.00 €» en el panel y «15,00 €» en el móvil. El separador se fija aquí a `es-ES` en vez de dejarlo en manos del locale de cada app: un importe no debería cambiar de forma según por qué pantalla se mire
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

**572 tests con Vitest** se ejecutan en CI en cada push, seguidos de las builds de producción de ambas apps:

| Suite | Tests | Cubre |
|-------|-------|-------|
| Admin + core (`npx ng test`) | 326 | Componentes de features (citas, bloqueos, usuarios, servicios, peluqueros, producción, perfil, dashboard, galería, auth), el date picker de días cerrados, el modal de listado con buscador, el redimensionado de imágenes, la descarga del recibo, el cliente del asistente, y todos los servicios, guards e interceptor del core. Del rol `PELUQUERO` se comprueba lo que **no** hace: no pide la lista de usuarios (ese 403 tumbaría las citas), no ve los botones de caja ni de borrado, y no tiene en el menú los enlaces que su guard rechazaría. De los **permisos configurables** se comprueban las dos caras: apagados no aparecen «Pago manual» ni «Reprogramar», encendidos sí y solo el que se encendió, y un ADMIN los ve con la matriz entera apagada porque no pasa por ella |
| Mobile (`cd mobile && npx ng test`) | 246 | Flujo de reserva (incl. selector de peluquero y días cerrados deshabilitados), página de pago Stripe, login biométrico y token storage, cámara y foto de perfil, recibo en PDF (compartir en el dispositivo, descarga en el navegador), historial de citas, pantalla de contacto, el chat del asistente (traducción de errores por estado, recorte del historial), la galería de trabajos, el cierre de citas con sus avisos según haya pago o no, la producción propia y la comparativa, los permisos configurables en el menú de acciones de una cita, y las rutas y guards de las pestañas |

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

La API REST (Java 21 + Spring Boot 4) vive en [peluqueria_citas](https://github.com/eduardoandr3s/peluqueria_citas): autenticación JWT con refresh tokens, citas con disponibilidad por peluquero, pagos Stripe con webhooks firmados, almacenamiento de imágenes en Supabase Storage validadas por magic bytes, estadísticas, recordatorios por correo, galería de trabajos, rol `PELUQUERO` con producción y comisiones, y una suite de 381 tests (unitarios + Testcontainers).

---
*Desarrollado por Eduardo Andrés Segovia Román.*
