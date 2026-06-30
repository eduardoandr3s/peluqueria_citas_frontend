import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';
import { AuthService, TOKEN_STORAGE } from '@peluqueria/core';
import { BiometricTokenStorage } from './biometric-token-storage';

/**
 * Orquesta el acceso biométrico de la app móvil. La biometría NO sustituye al
 * JWT: solo protege el refresh token en el keystore seguro y desbloquea la
 * sesión al abrir la app.
 */
@Injectable({ providedIn: 'root' })
export class BiometricService {
  private readonly auth = inject(AuthService);
  private readonly storage = inject(TOKEN_STORAGE) as BiometricTokenStorage;

  /** ¿El dispositivo tiene biometría disponible y utilizable? */
  async isAvailable(): Promise<boolean> {
    try {
      const { isAvailable } = await NativeBiometric.isAvailable();
      return isAvailable;
    } catch {
      return false;
    }
  }

  /** ¿El usuario activó el acceso biométrico? */
  isEnabled(): boolean {
    return this.storage.biometricEnabled;
  }

  /**
   * Activa el acceso biométrico: pide confirmación de identidad y guarda el
   * refresh de la sesión actual en el keystore seguro.
   */
  async enable(): Promise<void> {
    await NativeBiometric.verifyIdentity({
      title: 'Activar acceso biométrico',
      subtitle: 'Confirma tu identidad',
    });
    await this.storage.enableSecure();
  }

  /** Desactiva el acceso biométrico y borra el refresh del keystore. */
  async disable(): Promise<void> {
    await this.storage.disableSecure();
  }

  /**
   * Desbloqueo al abrir la app: pide biometría, recupera el refresh del keystore
   * y renueva la sesión. Devuelve true si la sesión quedó restaurada; false si el
   * usuario cancela, falla la biometría o no hay refresh guardado.
   */
  async unlock(): Promise<boolean> {
    try {
      await NativeBiometric.verifyIdentity({
        title: 'Desbloquear',
        subtitle: 'Usa tu huella o rostro para entrar',
      });
      const refresh = await this.storage.loadSecureRefresh();
      if (!refresh) {
        return false;
      }
      await firstValueFrom(this.auth.refresh());
      return true;
    } catch {
      return false;
    }
  }
}
