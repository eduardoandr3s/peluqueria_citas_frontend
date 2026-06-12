import { InjectionToken } from '@angular/core';

/**
 * URL base del API REST (ej. "http://localhost:8080/api"), sin barra final.
 *
 * Lo provee cada aplicación que consume `@peluqueria/core`: el panel admin
 * desde su `environment`, la app móvil desde su propia configuración. Así el
 * core no depende de ningún archivo de entorno concreto y es compartible.
 */
export const API_URL = new InjectionToken<string>('API_URL');
