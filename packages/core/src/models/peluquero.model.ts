export interface Peluquero {
  idPeluquero: number;
  nombre: string;
  activo: boolean;
}

export interface PeluqueroRequest {
  nombre: string;
}

export interface PeluqueroUpdate {
  nombre?: string;
  activo?: boolean;
  comisionPorcentaje?: number;
  /** Id de la cuenta a vincular. Debe tener rol PELUQUERO o ADMIN. */
  usuarioId?: number;
  /** A true deja la ficha sin cuenta. Un `usuarioId` a null significa «no lo toques». */
  desvincularUsuario?: boolean;
}

/** Excepción de comisión para un servicio (ComisionServicioDTO). */
export interface ComisionServicio {
  servicioId: number;
  /** Solo informativo al leer; al escribir se ignora. */
  servicioNombre?: string;
  porcentaje: number;
}

/**
 * Ficha completa: GET /api/peluqueros/gestion (solo ADMIN). Incluye las inactivas.
 *
 * La comisión y la cuenta vinculada NO están en `Peluquero`, que va anidado en cada
 * cita y lo leen los clientes.
 */
export interface PeluqueroGestion {
  idPeluquero: number;
  nombre: string;
  activo: boolean;
  comisionPorcentaje: number;
  usuarioId?: number | null;
  usuarioNombre?: string | null;
  usuarioEmail?: string | null;
  comisionesPorServicio: ComisionServicio[];
}
