/** Claves del catálogo del backend (enum `Modulo`). */
export type ClaveModulo =
  | 'COMISIONES'
  | 'PAGOS'
  | 'PAGO_TARJETA'
  | 'PAGO_EFECTIVO'
  | 'PAGO_TRANSFERENCIA'
  | 'GALERIA'
  | 'EQUIPO_CV'
  | 'PRODUCCION'
  | 'RECORDATORIOS_EMAIL';

/**
 * Todas las claves, en el orden en que se presentan.
 *
 * Es también el estado de partida del servicio: **todo encendido**, que es el valor por
 * defecto del backend y el comportamiento de siempre. Así, mientras no llega la respuesta,
 * la app no parpadea escondiendo lo que casi siempre está.
 */
export const CLAVES_MODULO: readonly ClaveModulo[] = [
  'COMISIONES',
  'PAGOS',
  'PAGO_TARJETA',
  'PAGO_EFECTIVO',
  'PAGO_TRANSFERENCIA',
  'GALERIA',
  'EQUIPO_CV',
  'PRODUCCION',
  'RECORDATORIOS_EMAIL',
];

/**
 * Una fila del catálogo, para la pantalla de configuración.
 *
 * Lleva dos booleanos y no es redundante: `activo` es lo que eligió el administrador y es
 * lo que pinta la casilla; `efectivo` es lo que aplica de verdad una vez contadas las
 * reglas de padre e hijos. Cuando no coinciden hay algo que explicar —un padre encendido
 * sin ningún hijo no hace nada— y es justo lo que evita que la pantalla mienta.
 */
export interface Modulo {
  clave: ClaveModulo;
  nombre: string;
  descripcion: string;
  /** Clave del módulo del que cuelga, o `null` si es de primer nivel. */
  padre: ClaveModulo | null;
  activo: boolean;
  efectivo: boolean;
}

/** Respuesta del endpoint público: lo que este negocio tiene encendido. */
export interface ModulosActivos {
  modulos: ClaveModulo[];
}

export interface CambioModulo {
  clave: ClaveModulo;
  activo: boolean;
}
