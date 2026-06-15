import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { API_URL } from '../api.config';
import { AuthResponse, LoginRequest, SessionUser } from '../models/auth.model';
import { UsuarioRequest } from '../models/usuario.model';

const TOKEN_KEY = 'peluqueria_token';
const USER_KEY = 'peluqueria_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${inject(API_URL)}/auth`;

  private readonly _user = signal<SessionUser | null>(this.loadUser());

  /** Usuario de la sesión actual (o null). */
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly isAdmin = computed(() => this._user()?.rol === 'ADMIN');

  /** Autentica contra el backend y guarda token + datos de sesión. */
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

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this._user.set(null);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private storeSession(res: AuthResponse): void {
    localStorage.setItem(TOKEN_KEY, res.token);
    const user: SessionUser = { email: res.email, nombre: res.nombre, rol: res.rol };
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this._user.set(user);
  }

  private loadUser(): SessionUser | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SessionUser;
    } catch {
      return null;
    }
  }
}
