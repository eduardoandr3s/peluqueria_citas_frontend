/**
 * API pública de `@peluqueria/core`: modelos, servicios HTTP, guards e
 * interceptor compartidos entre el panel admin y la app móvil.
 *
 * El core no depende de ninguna UI (ni Ionic ni Tailwind) ni de un archivo de
 * entorno concreto: la URL del API se inyecta vía el token `API_URL`.
 */
export * from './api.config';

// Modelos
export * from './models/auth.model';
export * from './models/cita.model';
export * from './models/servicio.model';
export * from './models/usuario.model';
export * from './models/pago.model';
export * from './models/estadisticas.model';

// Servicios HTTP
export * from './services/auth.service';
export * from './services/token-storage';
export * from './services/cita.service';
export * from './services/servicio.service';
export * from './services/usuario.service';
export * from './services/pago.service';
export * from './services/estadisticas.service';

// Guards e interceptor
export * from './guards/auth.guard';
export * from './interceptors/jwt.interceptor';
