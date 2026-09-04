export interface Peluquero {
  idPeluquero: number;
  nombre: string;
  activo: boolean;
}

export interface PeluqueroRequest {
  nombre: string;
}

export interface PeluqueroUpdate {
  nombre?: string;
  activo?: boolean;
  comisionPorcentaje?: number;
  /**
   * Sitio en la pantalla «Equipo» que ve el cliente. Va aquí y no en el CV porque no es
   * suyo: colocarse primero desplaza a los compañeros, así que lo decide el ADMIN.
   */
  orden?: number;
  /** Id de la cuenta a vincular. Debe tener rol PELUQUERO o ADMIN. */
  usuarioId?: number;
  /** A true deja la ficha sin cuenta. Un `usuarioId` a null significa «no lo toques». */
  desvincularUsuario?: boolean;
}

/** Excepción de comisión para un servicio (ComisionServicioDTO). */
export interface ComisionServicio {
  servicioId: number;
  /** Solo informativo al leer; al escribir se ignora. */
  servicioNombre?: string;
  porcentaje: number;
}

/**
 * Ficha completa: GET /api/peluqueros/gestion (solo ADMIN). Incluye las inactivas.
 *
 * La comisión y la cuenta vinculada NO están en `Peluquero`, que va anidado en cada
 * cita y lo leen los clientes.
 */
export interface PeluqueroGestion {
  idPeluquero: number;
  nombre: string;
  activo: boolean;
  comisionPorcentaje: number;
  orden: number;
  usuarioId?: number | null;
  usuarioNombre?: string | null;
  usuarioEmail?: string | null;
  comisionesPorServicio: ComisionServicio[];
  /** El CV va anidado para que la pestaña del panel no tenga que pedirlo aparte. */
  cv: PeluqueroCv;
}

/**
 * Carta de presentación de un profesional: GET /api/peluqueros/publicos, que **se lee sin
 * token**. Lo que importa de esta interfaz es lo que NO tiene: ni email, ni teléfono, ni
 * `usuarioId`, ni comisión, ni `activo` (el listado ya devuelve solo los activos).
 */
export interface PeluqueroPublico {
  idPeluquero: number;
  nombre: string;
  presentacion?: string | null;
  /** Ya troceadas por el servidor. Sin especialidades llega `[]`, nunca `null`. */
  especialidades: string[];
  aniosExperiencia?: number | null;
  /** Ya montada desde la clave guardada. `null` si esa ficha no tiene foto. */
  fotoUrl?: string | null;
  /** Solo el usuario, sin arroba ni URL: el enlace lo monta la pantalla. */
  instagram?: string | null;
}

/**
 * El CV como lo ve quien lo edita: GET/PUT /api/peluqueros/mio, o anidado en la ficha de
 * gestión. Es el público más `activo` y `orden`, que el cliente no necesita.
 */
export interface PeluqueroCv extends PeluqueroPublico {
  activo: boolean;
  /** Solo de lectura por aquí: ordenar el equipo es cosa del ADMIN. */
  orden: number;
}

/**
 * El CV entero para reemplazarlo de una vez.
 *
 * **Aquí un campo que falta SÍ borra**, al contrario que en {@link PeluqueroUpdate}. Es la
 * única forma de poder vaciar una presentación que ya no gusta, y por eso la pantalla
 * manda siempre el bloque completo.
 */
export interface PeluqueroCvUpdate {
  presentacion?: string | null;
  especialidades?: string[] | null;
  aniosExperiencia?: number | null;
  /** Se acepta con arroba o como URL completa: el servidor lo deja en el usuario. */
  instagram?: string | null;
}
