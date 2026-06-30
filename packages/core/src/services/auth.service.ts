import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, finalize, shareReplay, tap, throwError } from 'rxjs';
import { API_URL } from '../api.config';
import { AuthResponse, LoginRequest, SessionUser } from '../models/auth.model';
import { UsuarioRequest } from '../models/usuario.model';
import { STORAGE_KEYS, TOKEN_STORAGE } from './token-storage';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${inject(API_URL)}/auth`;
  private readonly storage = inject(TOKEN_STORAGE);

  private readonly _user = signal<SessionUser | null>(this.loadUser());

  /** Usuario de la sesión actual (o null). */
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly isAdmin = computed(() => this._user()?.rol === 'ADMIN');

  /**
   * Rotación en curso compartida: si varias peticiones caducan a la vez,
   * reutilizan una sola llamada a `/auth/refresh` en lugar de lanzar una cada una.
   */
  private refreshInFlight$: Observable<AuthResponse> | null = null;

  /** Autentica contra el backend y guarda access token + refresh + datos de sesión. */
  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/login`, credentials)
      .pipe(tap((res) => this.storeSession(res)));
  }

  /** Registra un nuevo usuario (se crea con rol USER en el backend). */
  registro(data: UsuarioRequest): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/registro`, data);
  }

  /**
   * Solicita el envío del correo de recuperación. El backend responde siempre 200
   * (anti-enumeración), por lo que la UI no debe revelar si el email existe.
   */
  recuperarPassword(email: string): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/recuperar`, { email });
  }

  /** Restablece la contraseña con el token recibido por correo. */
  resetPassword(token: string, password: string): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/reset`, { token, password });
  }

  /**
   * Renueva el access token a partir del refresh token (rotación con detección de
   * reuso en el backend). Si varias peticiones caducan a la vez, todas comparten
   * la misma llamada en vuelo. Falla si no hay refresh token guardado.
   */
  refresh(): Observable<AuthResponse> {
    if (!this.refreshInFlight$) {
      const refreshToken = this.getRefreshToken();
      if (!refreshToken) {
        return throwError(() => new Error('No hay refresh token disponible.'));
      }
      this.refreshInFlight$ = this.http
        .post<AuthResponse>(`${this.apiUrl}/refresh`, { refreshToken })
        .pipe(
          tap((res) => this.storeSession(res)),
          finalize(() => (this.refreshInFlight$ = null)),
          shareReplay({ bufferSize: 1, refCount: true }),
        );
    }
    return this.refreshInFlight$;
  }

  /**
   * Cierra la sesión: revoca el refresh token en el backend (best-effort, no
   * bloquea ni propaga errores) y limpia el estado del cliente.
   */
  logout(): void {
    const refreshToken = this.getRefreshToken();
    if (refreshToken) {
      this.http.post(`${this.apiUrl}/logout`, { refreshToken }).subscribe({ error: () => {} });
    }
    this.storage.remove(STORAGE_KEYS.token);
    this.storage.remove(STORAGE_KEYS.refresh);
    this.storage.remove(STORAGE_KEYS.user);
    this._user.set(null);
  }

  getToken(): string | null {
    return this.storage.get(STORAGE_KEYS.token);
  }

  getRefreshToken(): string | null {
    return this.storage.get(STORAGE_KEYS.refresh);
  }

  /**
   * Rehidrata la sesión desde el almacén. Necesario tras `TokenStorage.init()` en
   * plataformas con almacén asíncrono (móvil), donde la sesión no está disponible
   * en el momento de construir el servicio.
   */
  restoreSession(): void {
    this._user.set(this.loadUser());
  }

  private storeSession(res: AuthResponse): void {
    this.storage.set(STORAGE_KEYS.token, res.token);
    this.storage.set(STORAGE_KEYS.refresh, res.refreshToken);
    const user: SessionUser = { email: res.email, nombre: res.nombre, rol: res.rol };
    this.storage.set(STORAGE_KEYS.user, JSON.stringify(user));
    this._user.set(user);
  }

  private loadUser(): SessionUser | null {
    const raw = this.storage.get(STORAGE_KEYS.user);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SessionUser;
    } catch {
      return null;
    }
  }
}
