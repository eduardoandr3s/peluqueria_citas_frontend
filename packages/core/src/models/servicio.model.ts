/** Entidad Servicio tal como la devuelve el backend. */
export interface Servicio {
  idServicio: number;
  nombre: string;
  descripcion?: string;
  precio: number; // BigDecimal en el backend
  duracion: number; // minutos
  activo: boolean;
}

/** Cuerpo de POST /api/servicios (ServicioRequestDTO). */
export interface ServicioRequest {
  nombre: string;
  descripcion?: string;
  precio: number;
  duracion: number;
}

/** Cuerpo de PUT /api/servicios/{id} (ServicioUpdateDTO). Todos opcionales. */
export interface ServicioUpdate {
  nombre?: string;
  descripcion?: string;
  precio?: number;
  duracion?: number;
}
