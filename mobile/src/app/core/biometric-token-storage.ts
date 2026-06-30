import { Preferences } from '@capacitor/preferences';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';
import { STORAGE_KEYS } from '@peluqueria/core';
import { PreferencesTokenStorage } from './preferences-token-storage';

/** Flag en Preferences que indica si el acceso biométrico está activado. */
const BIOMETRIC_FLAG_KEY = 'peluqueria_biometric';
/** Identificador del registro en el keystore seguro del sistema. */
const SECURE_SERVER = 'com.segovia.peluqueria.refresh';
const SECURE_USERNAME = 'session';

/**
 * Almacén de sesión móvil con biometría.
 *
 * Cuando el acceso biométrico está activado, el refresh token NO se guarda en
 * Preferences (texto plano) sino en el keystore/llavero seguro del sistema
 * (`@capgo/capacitor-native-biometric`). El access token y el usuario siguen en
 * Preferences. Durante la sesión viva el refresh vive en la caché en memoria (la
 * hereda de {@link PreferencesTokenStorage}); cada rotación se refleja en el
 * keystore de forma silenciosa (sin prompt), y el refresh solo se recupera del
 * keystore al desbloquear, tras verificación biométrica (ver `BiometricService`).
 */
export class BiometricTokenStorage extends PreferencesTokenStorage {
  private secureEnabled = false;

  override async init(): Promise<void> {
    await super.init();
    const { value } = await Preferences.get({ key: BIOMETRIC_FLAG_KEY });
    this.secureEnabled = value === 'true';
    if (this.secureEnabled) {
      // El refresh vive en el keystore; se carga al desbloquear, no desde Preferences.
      this.cache.delete(STORAGE_KEYS.refresh);
    }
  }

  /** True si el usuario activó el acceso biométrico. */
  get biometricEnabled(): boolean {
    return this.secureEnabled;
  }

  override set(key: string, value: string): void {
    if (key === STORAGE_KEYS.refresh && this.secureEnabled) {
      // Mantener en memoria para la sesión viva y reflejar la rotación en el
      // keystore sin prompt (accessControl por defecto = NONE).
      this.cache.set(key, value);
      void NativeBiometric.setCredentials({
        username: SECURE_USERNAME,
        password: value,
        server: SECURE_SERVER,
      });
      return;
    }
    super.set(key, value);
  }

  override remove(key: string): void {
    if (key === STORAGE_KEYS.refresh && this.secureEnabled) {
      // Quitar el refresh seguro equivale a cerrar sesión: desactiva la biometría.
      this.cache.delete(key);
      this.secureEnabled = false;
      void NativeBiometric.deleteCredentials({ server: SECURE_SERVER });
      void Preferences.remove({ key: BIOMETRIC_FLAG_KEY });
      return;
    }
    super.remove(key);
  }

  /**
   * Activa la biometría: guarda el refresh actual en el keystore seguro y lo
   * elimina de Preferences. Requiere una sesión activa.
   */
  async enableSecure(): Promise<void> {
    const refresh = this.cache.get(STORAGE_KEYS.refresh);
    if (!refresh) {
      throw new Error('No hay sesión activa que proteger.');
    }
    await NativeBiometric.setCredentials({
      username: SECURE_USERNAME,
      password: refresh,
      server: SECURE_SERVER,
    });
    await Preferences.remove({ key: STORAGE_KEYS.refresh });
    await Preferences.set({ key: BIOMETRIC_FLAG_KEY, value: 'true' });
    this.secureEnabled = true;
  }

  /**
   * Desactiva la biometría: borra el keystore seguro y devuelve el refresh a
   * Preferences para que la sesión siga sin biometría.
   */
  async disableSecure(): Promise<void> {
    this.secureEnabled = false;
    await Preferences.remove({ key: BIOMETRIC_FLAG_KEY });
    await NativeBiometric.deleteCredentials({ server: SECURE_SERVER }).catch(() => undefined);
    const refresh = this.cache.get(STORAGE_KEYS.refresh);
    if (refresh) {
      await Preferences.set({ key: STORAGE_KEYS.refresh, value: refresh });
    }
  }

  /**
   * Recupera el refresh del keystore seguro y lo deja en memoria. Debe llamarse
   * DESPUÉS de una verificación biométrica correcta (`NativeBiometric.verifyIdentity`).
   */
  async loadSecureRefresh(): Promise<string | null> {
    const { password } = await NativeBiometric.getCredentials({ server: SECURE_SERVER });
    if (password) {
      this.cache.set(STORAGE_KEYS.refresh, password);
      return password;
    }
    return null;
  }
}
