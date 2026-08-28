/** Una fila del desglose de producción (por servicio o por mes). */
export interface LineaProduccion {
  /** Nombre del servicio, o el mes en formato `YYYY-MM`. */
  etiqueta: string;
  servicios: number;
  importe: number;
  comision: number;
}

/**
 * Producción de un peluquero en un rango (GET /api/produccion/mia y /peluquero/{id}).
 *
 * Solo suma las citas completadas **y cobradas**: el dinero se cuenta cuando ha entrado,
 * y el efectivo entra registrando el pago manual. Lo realizado y aún sin cobrar viaja
 * aparte para que no desaparezca de la pantalla.
 */
export interface Produccion {
  idPeluquero: number;
  nombre: string;
  desde: string; // ISO date
  hasta: string; // ISO date
  serviciosRealizados: number;
  importeVendido: number;
  comision: number;
  serviciosSinCobrar: number;
  importeSinCobrar: number;
  porServicio: LineaProduccion[];
  porMes: LineaProduccion[];
}

/** Una fila de la comparativa de la plantilla (GET /api/produccion, solo ADMIN). */
export interface ProduccionPeluquero {
  idPeluquero: number;
  nombre: string;
  serviciosRealizados: number;
  importeVendido: number;
  comision: number;
}
