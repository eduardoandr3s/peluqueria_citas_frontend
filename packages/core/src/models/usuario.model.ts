/**
 * Roles, de menos a más privilegios. `PELUQUERO` es el intermedio: ve su agenda y su
 * producción, pero no gestiona usuarios, servicios ni caja.
 */
export type Rol = 'USER' | 'PELUQUERO' | 'ADMIN';

/** Respuesta de GET /api/usuarios (UsuarioResponseDTO). */
export interface Usuario {
  idUsuario: number;
  nombre: string;
  email: string;
  telefono?: string;
  fechaRegistro?: string; // ISO date (LocalDate)
  rol: Rol;
  activo?: boolean;
  /**
   * URL firmada del avatar, o null si no tiene.
   *
   * Caduca (el bucket es privado), así que no se guarda en cliente: llega en las
   * respuestas de un usuario concreto (`me()`, `obtener(id)`, subir/borrar avatar).
   * El listado la devuelve siempre null para no firmar una URL por fila.
   */
  urlAvatar?: string | null;
}

/** Página de Spring Data (Page<T>). GET /api/usuarios devuelve esta forma. */
export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number; // página actual (0-based)
  size: number;
  first: boolean;
  last: boolean;
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
