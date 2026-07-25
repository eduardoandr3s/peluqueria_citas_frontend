/** Día concreto bloqueado por el administrador (festivo, vacaciones, cierre puntual). */
export interface DiaBloqueado {
  idDiaBloqueado: number;
  /** Formato ISO `YYYY-MM-DD`. */
  fecha: string;
  motivo?: string | null;
}

export interface DiaBloqueadoRequest {
  fecha: string;
  motivo?: string | null;
}

/**
 * Día en el que no se puede agendar, tal y como lo devuelve el backend: unifica los
 * cierres fijos por día de la semana (domingo) y los días bloqueados a mano.
 */
export interface DiaCerrado {
  /** Formato ISO `YYYY-MM-DD`. */
  fecha: string;
  /** Texto listo para mostrar: «Cerrado (domingo)», «Reyes»… */
  motivo: string;
}
