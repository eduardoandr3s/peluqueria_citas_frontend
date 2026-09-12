/** Una fila del desglose de producción (por servicio o por mes). */
export interface LineaProduccion {
  /** Nombre del servicio, o el mes en formato `YYYY-MM`. */
  etiqueta: string;
  servicios: number;
  importe: number;
  /** `null` si el módulo de comisiones está apagado. No es cero: es «aquí no se comisiona». */
  comision: number | null;
}

/**
 * Producción de un peluquero en un rango (GET /api/produccion/mia y /peluquero/{id}).
 *
 * Solo suma las citas completadas **y cobradas**: el dinero se cuenta cuando ha entrado,
 * y el efectivo entra registrando el pago manual. Lo realizado y aún sin cobrar viaja
 * aparte para que no desaparezca de la pantalla.
 *
 * Salvo que el negocio no cobre por la aplicación: con el módulo `PAGOS` apagado nada
 * llegaría nunca a pagado y todo sería cero, así que ahí cuenta lo realizado a secas. Eso
 * es lo que dice {@link Produccion.exigeCobro}.
 */
export interface Produccion {
  idPeluquero: number;
  nombre: string;
  desde: string; // ISO date
  hasta: string; // ISO date
  serviciosRealizados: number;
  importeVendido: number;
  /** `null` si el módulo de comisiones está apagado. */
  comision: number | null;
  /** Si para sumar hace falta que la cita esté cobrada. Sale del módulo `PAGOS`. */
  exigeCobro: boolean;
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
  /** `null` si el módulo de comisiones está apagado. */
  comision: number | null;
}
