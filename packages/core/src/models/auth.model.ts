import { Rol } from './usuario.model';

/** Cuerpo de POST /api/auth/login (LoginRequestDTO). */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Respuesta de POST /api/auth/login (AuthResponseDTO). */
export interface AuthResponse {
  token: string;
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
