import { Rol } from './usuario.model';

/** Cuerpo de POST /api/auth/login (LoginRequestDTO). */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Respuesta de POST /api/auth/login y /api/auth/refresh (AuthResponseDTO). */
export interface AuthResponse {
  /** Access JWT de vida corta (30 min). */
  token: string;
  /** Refresh token de vida larga (30 días); rota en cada uso. */
  refreshToken: string;
  email: string;
  nombre: string;
  rol: Rol;
}

/** Sesión guardada en cliente tras el login. */
export interface SessionUser {
  email: string;
  nombre: string;
  rol: Rol;
}

/** Cuerpo de POST /api/auth/recuperar. */
export interface RecuperarPasswordRequest {
  email: string;
}

/** Cuerpo de POST /api/auth/reset. */
export interface ResetPasswordRequest {
  token: string;
  password: string;
}
