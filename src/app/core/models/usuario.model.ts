export type Rol = 'USER' | 'ADMIN';

/** Respuesta de GET /api/usuarios (UsuarioResponseDTO). */
export interface Usuario {
  idUsuario: number;
  nombre: string;
  email: string;
  telefono?: string;
  fechaRegistro?: string; // ISO date (LocalDate)
  rol: Rol;
}

/** Cuerpo de PATCH /api/usuarios/{id}/rol (CambiarRolRequestDTO). */
export interface CambiarRolRequest {
  rol: Rol;
}

/** Cuerpo de POST /api/usuarios y /api/auth/registro (UsuarioRequestDTO). */
export interface UsuarioRequest {
  nombre: string;
  email: string;
  telefono?: string;
  password: string;
}

/** Cuerpo de PUT /api/usuarios/{id} (UsuarioUpdateDTO). Todos opcionales. */
export interface UsuarioUpdate {
  nombre?: string;
  email?: string;
  telefono?: string;
  password?: string;
}
