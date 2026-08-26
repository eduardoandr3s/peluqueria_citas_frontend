/** Una foto de la galería de trabajos, tal como la devuelve el backend. */
export interface GaleriaFoto {
  idFoto: number;
  titulo?: string | null;
  /** Posición en la rejilla. La decide el admin; a igualdad manda el id. */
  orden: number;
  fechaSubida?: string;
  /** Imagen a tamaño completo. Solo se pide al abrir una foto concreta. */
  urlImagen: string;
  /**
   * Miniatura para la rejilla. El backend garantiza que siempre viene: si la foto
   * se subió sin miniatura, aquí llega la imagen grande, así que no hay que
   * comprobar nulos al pintar.
   */
  urlMiniatura: string;
}

/** Cuerpo de PUT /api/galeria/{id}. Los dos campos son opcionales. */
export interface GaleriaFotoUpdate {
  titulo?: string;
  orden?: number;
}
