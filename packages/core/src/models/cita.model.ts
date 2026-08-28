import { Servicio } from './servicio.model';
import { Peluquero } from './peluquero.model';
import { EstadoPago } from './pago.model';

export type EstadoCita =
  | 'PENDIENTE'
  | 'CONFIRMADA'
  | 'COMPLETADA'
  | 'NO_ASISTIO'
  | 'ANULADA';

export const ESTADOS_CITA: EstadoCita[] = [
  'PENDIENTE',
  'CONFIRMADA',
  'COMPLETADA',
  'NO_ASISTIO',
  'ANULADA',
];

/**
 * Estados de cierre: la cita ya no se mueve. Solo se llega a ellos por
 * `CitaService.cerrar`, nunca por el PUT (el backend responde 400), porque cerrar
 * congela el importe y la comisión.
 */
export const ESTADOS_CIERRE: EstadoCita[] = ['COMPLETADA', 'NO_ASISTIO', 'ANULADA'];

/** Etiquetas de estado para la UI. `NO_ASISTIO` sin la barra baja a la vista. */
export const ETIQUETA_ESTADO: Record<EstadoCita, string> = {
  PENDIENTE: 'Pendiente',
  CONFIRMADA: 'Confirmada',
  COMPLETADA: 'Realizada',
  NO_ASISTIO: 'No asistió',
  ANULADA: 'Anulada',
};

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
  estadoPago?: EstadoPago | null; // estado del pago asociado; null/ausente si la cita no tiene pago
  /**
   * Id de ese pago, para pedir su recibo (`PagoService.descargarRecibo`) sin consultar el
   * pago aparte. Viaja con la cita porque el backend ya lo trae en la misma consulta.
   */
  idPago?: number | null;

  // ---- Datos de cierre y gestión ----
  // El backend solo los rellena para quien gestiona la cita (ADMIN, o el peluquero que
  // la tiene asignada): a un cliente le llegan siempre a null, porque las observaciones
  // son notas internas y la comisión es lo que cobra el profesional.
  fechaCierre?: string | null;
  observaciones?: string | null;
  clienteContactado?: boolean | null;
  /** Nombre de quien cerró la cita. */
  cerradaPor?: string | null;
  /** Importe congelado al completar; no cambia si luego sube la tarifa del servicio. */
  precioAplicado?: number | null;
  comisionPorcentajeAplicado?: number | null;
}

/** Cuerpo de PATCH /api/citas/{id}/cierre (CitaCierreDTO). */
export interface CitaCierre {
  estado: EstadoCita;
  observaciones?: string;
  /** Si se avisó al cliente por teléfono o en persona; el email se manda igual. */
  clienteContactado?: boolean;
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
