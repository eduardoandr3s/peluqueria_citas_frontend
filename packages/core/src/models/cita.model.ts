import { Servicio } from './servicio.model';
import { Peluquero } from './peluquero.model';

export type EstadoCita = 'PENDIENTE' | 'CONFIRMADA' | 'ANULADA';

export const ESTADOS_CITA: EstadoCita[] = ['PENDIENTE', 'CONFIRMADA', 'ANULADA'];

/** Datos del usuario anidados dentro de una Cita. */
export interface CitaUsuario {
  idUsuario: number;
  nombre: string;
  email: string;
  telefono?: string;
}

/** Entidad Cita tal como la devuelve GET /api/citas (con usuario, servicio y peluquero anidados). */
export interface Cita {
  idCita: number;
  usuario: CitaUsuario;
  servicio: Servicio;
  peluquero?: Peluquero;
  fechaHora: string; // ISO LocalDateTime, ej. "2026-05-29T14:30:00"
  estado: EstadoCita;
}

/** Cuerpo de POST /api/citas (CitaRequestDTO). */
export interface CitaRequest {
  usuarioId?: number; // opcional: el backend usa la identidad del token para rol USER
  servicioId: number;
  peluqueroId?: number;
  fechaHora: string; // ISO LocalDateTime, ej. "2026-05-29T14:30:00"
}

/** Cuerpo de PUT /api/citas/{id} (CitaUpdateDTO). Todos opcionales. */
export interface CitaUpdate {
  usuarioId?: number;
  servicioId?: number;
  peluqueroId?: number;
  fechaHora?: string;
  estado?: EstadoCita;
}
