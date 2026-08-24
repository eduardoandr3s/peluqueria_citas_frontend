/**
 * Un turno de la conversación tal como lo espera el backend. `delCliente` distingue
 * quién habló: si los turnos del asistente se enviaran como turnos del cliente, el
 * modelo leería sus propias respuestas como peticiones.
 */
export interface MensajeAsistente {
  delCliente: boolean;
  texto: string;
}

export interface AsistentePregunta {
  mensaje: string;
  /** Turnos anteriores, del más antiguo al más reciente. El backend acepta 10 como máximo. */
  historial: MensajeAsistente[];
}

export interface AsistenteRespuesta {
  respuesta: string;
  /** Tokens del turno. El backend los devuelve para poder vigilar el consumo de la cuota. */
  tokensEntrada: number | null;
  tokensSalida: number | null;
}
