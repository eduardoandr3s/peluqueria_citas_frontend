import { Servicio } from './servicio.model';

export type EstadoCita = 'PENDIENTE' | 'CONFIRMADA' | 'ANULADA';

export const ESTADOS_CITA: EstadoCita[] = ['PENDIENTE', 'CONFIRMADA', 'ANULADA'];

/** Datos del usuario anidados dentro de una Cita. */
export interface CitaUsuario {
  idUsuario: number;
  nombre: string;
  email: string;
  telefono?: string;
}

/** Entidad Cita tal como la devuelve GET /api/citas (con usuario y servicio anidados). */
export interface Cita {
  idCita: number;
  usuario: CitaUsuario;
  servicio: Servicio;
  fechaHora: string; // ISO LocalDateTime, ej. "2026-05-29T14:30:00"
  estado: EstadoCita;
}

/** Cuerpo de POST /api/citas (CitaRequestDTO). */
export interface CitaRequest {
  usuarioId: number;
  servicioId: number;
  fechaHora: string; // ISO LocalDateTime
}

/** Cuerpo de PUT /api/citas/{id} (CitaUpdateDTO). Todos opcionales. */
export interface CitaUpdate {
  usuarioId?: number;
  servicioId?: number;
  fechaHora?: string;
  estado?: EstadoCita;
}
