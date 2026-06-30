import { Preferences } from '@capacitor/preferences';
import { STORAGE_KEYS, TokenStorage } from '@peluqueria/core';

/**
 * Almacén de sesión sobre `@capacitor/preferences` (persistencia nativa del
 * sistema, sobrevive a reinicios de la app).
 *
 * Preferences es asíncrono, pero el interceptor necesita el token de forma
 * síncrona en cada petición. Por eso mantenemos una caché en memoria: se
 * precarga en `init()` al arrancar la app y cada escritura/borrado persiste en
 * segundo plano sin bloquear.
 */
export class PreferencesTokenStorage implements TokenStorage {
  private readonly cache = new Map<string, string>();

  async init(): Promise<void> {
    for (const key of Object.values(STORAGE_KEYS)) {
      const { value } = await Preferences.get({ key });
      if (value != null) {
        this.cache.set(key, value);
      }
    }
  }

  get(key: string): string | null {
    return this.cache.get(key) ?? null;
  }

  set(key: string, value: string): void {
    this.cache.set(key, value);
    void Preferences.set({ key, value });
  }

  remove(key: string): void {
    this.cache.delete(key);
    void Preferences.remove({ key });
  }
}
