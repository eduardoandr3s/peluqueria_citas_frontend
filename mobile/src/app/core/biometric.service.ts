import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';
import { AuthService, TOKEN_STORAGE } from '@peluqueria/core';
import { BiometricTokenStorage } from './biometric-token-storage';

/**
 * Desenlace de un intento de desbloqueo. Se distingue el fallo recuperable
 * (cancelación, red) del definitivo (el servidor rechaza el refresh) porque solo
 * el segundo obliga a volver a entrar con contraseña.
 */
export type UnlockResult = 'ok' | 'cancelado' | 'sesion-caducada' | 'error-conexion';

/**
 * Orquesta el acceso biométrico de la app móvil. La biometría NO sustituye al
 * JWT: solo protege el refresh token en el keystore seguro y desbloquea la
 * sesión al abrir la app.
 */
@Injectable({ providedIn: 'root' })
export class BiometricService {
  private readonly auth = inject(AuthService);
  private readonly storage = inject(TOKEN_STORAGE) as BiometricTokenStorage;

  private readonly _ultimoIntento = signal<UnlockResult | null>(null);

  /**
   * Resultado del último desbloqueo, o null si no se ha intentado. Lo consulta
   * la pantalla de login para explicar por qué el arranque acabó ahí.
   */
  readonly ultimoIntento = this._ultimoIntento.asReadonly();

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
   * Desbloqueo: pide biometría, recupera el refresh del keystore y renueva la
   * sesión. Lo usan el arranque de la app y el botón de huella del login.
   *
   * Si el servidor rechaza el refresh (revocado o caducado) la sesión ya no es
   * recuperable, así que se cierra del todo: dejar el enrolamiento en pie
   * convertiría el botón de huella en una trampa que siempre falla. Un fallo de
   * red, en cambio, se conserva para poder reintentar.
   */
  async unlock(): Promise<UnlockResult> {
    try {
      // Solo se promete la huella: en Android el prompt exige biometría fuerte
      // (Clase 3) y el reconocimiento facial de la mayoría de moviles es débil
      // (Clase 2), asi que el sistema no lo ofrece. Ver el plugin,
      // AuthActivity.getAllowedAuthenticators(), que fija BIOMETRIC_STRONG.
      await NativeBiometric.verifyIdentity({
        title: 'Desbloquear',
        subtitle: 'Usa tu huella para entrar',
      });
    } catch {
      return this.registrar('cancelado');
    }

    let refresh: string | null = null;
    try {
      refresh = await this.storage.loadSecureRefresh();
    } catch {
      refresh = null;
    }
    if (!refresh) {
      this.auth.logout();
      return this.registrar('sesion-caducada');
    }

    try {
      await firstValueFrom(this.auth.refresh());
      return this.registrar('ok');
    } catch (err) {
      if (err instanceof HttpErrorResponse && (err.status === 0 || err.status >= 500)) {
        return this.registrar('error-conexion');
      }
      this.auth.logout();
      return this.registrar('sesion-caducada');
    }
  }

  private registrar(resultado: UnlockResult): UnlockResult {
    this._ultimoIntento.set(resultado);
    return resultado;
  }
}
