/** Entidad Servicio tal como la devuelve el backend. */
export interface Servicio {
  idServicio: number;
  nombre: string;
  descripcion?: string;
  precio: number; // BigDecimal en el backend
  duracion: number; // minutos
  activo: boolean;
  /**
   * URL de la foto del catálogo, o null si no tiene. La calcula el backend a
   * partir de la clave que guarda; el cliente nunca ve ni maneja esa clave.
   */
  urlImagen?: string | null;
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
