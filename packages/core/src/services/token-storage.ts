import { InjectionToken } from '@angular/core';

/** Claves bajo las que se persiste la sesión en el almacén. */
export const STORAGE_KEYS = {
  token: 'peluqueria_token',
  refresh: 'peluqueria_refresh',
  user: 'peluqueria_user',
} as const;

/**
 * Almacén de sesión desacoplado de la plataforma.
 *
 * El interceptor necesita leer el access token de forma SÍNCRONA al construir
 * cada petición, por eso `get` es síncrono. Las implementaciones cuyo backing
 * store sea asíncrono (p. ej. `@capacitor/preferences` en móvil) deben mantener
 * una caché en memoria y precargarla en `init()` antes de que arranque la app.
 */
export interface TokenStorage {
  /** Precarga el backing store en memoria. Se llama una vez al arrancar la app. */
  init(): Promise<void>;
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

/**
 * Implementación por defecto (web). `localStorage` ya es síncrono, así que no
 * necesita caché ni precarga.
 */
export class LocalStorageTokenStorage implements TokenStorage {
  async init(): Promise<void> {
    // localStorage es síncrono; no hay nada que precargar.
  }

  get(key: string): string | null {
    return localStorage.getItem(key);
  }

  set(key: string, value: string): void {
    localStorage.setItem(key, value);
  }

  remove(key: string): void {
    localStorage.removeItem(key);
  }
}

/**
 * Almacén de sesión inyectable. Por defecto usa `localStorage` (web); la app
 * móvil lo sobrescribe con una implementación sobre `@capacitor/preferences`.
 */
export const TOKEN_STORAGE = new InjectionToken<TokenStorage>('TOKEN_STORAGE', {
  providedIn: 'root',
  factory: () => new LocalStorageTokenStorage(),
});
