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
  /**
   * Nombre de quien la subió, o null si es «del negocio»: las que ya existían antes
   * de que la galería guardara el dueño. Es para mostrar de quién es el trabajo, no
   * para decidir qué botones se pintan: dos personas pueden llamarse igual.
   */
  subidoPorNombre?: string | null;
  /**
   * Si la subió la cuenta de la sesión. Lo calcula el servidor comparando ids, que es
   * lo único fiable, y es lo que hay que mirar para ofrecer o no las acciones. Sin
   * cuenta, o si la foto no tiene dueño, llega false.
   */
  mia: boolean;
}

/** Cuerpo de PUT /api/galeria/{id}. Los dos campos son opcionales. */
export interface GaleriaFotoUpdate {
  titulo?: string;
  orden?: number;
}
