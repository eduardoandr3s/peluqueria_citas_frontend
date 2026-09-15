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

/**
 * Un juego de módulos preparado para dar de alta una peluquería nueva.
 *
 * Existe porque los módulos **nacen todos encendidos**, que es lo correcto para un negocio
 * que ya venía funcionando —desplegar un módulo nuevo no le quita nada— y justo lo contrario
 * de lo que quiere uno que acaba de entrar: a ese se le enseña de golpe el producto entero.
 *
 * Aplicarlo no deja al negocio «en» ningún perfil: escribe el estado de todos los módulos y
 * después se le cambia cualquiera. Por eso `enciende` y `apaga` vienen resueltos del
 * backend, para poder avisar de lo que se pierde sin recalcularlo aquí y discrepar.
 */
export interface PerfilArranque {
  clave: string;
  nombre: string;
  descripcion: string;
  enciende: ClaveModulo[];
  apaga: ClaveModulo[];
}
