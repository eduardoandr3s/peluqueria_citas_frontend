import { Rol } from './usuario.model';

/** Claves del catálogo del backend (enum `Permiso`). */
export type ClavePermiso =
  | 'PAGO_MANUAL_REGISTRAR'
  | 'CITA_REPROGRAMAR'
  | 'GALERIA_SUBIR'
  | 'GALERIA_EDITAR_PROPIA'
  | 'GALERIA_EDITAR_AJENA'
  | 'GALERIA_ORDENAR';

/**
 * Una fila de la matriz de configuración. `roles` solo trae los roles a los que ese
 * permiso se le puede configurar: un ADMIN los tiene todos por rol y un cliente ninguno,
 * así que el panel pinta una casilla por entrada y no repite esa regla.
 */
export interface Permiso {
  clave: ClavePermiso;
  descripcion: string;
  roles: Partial<Record<Rol, boolean>>;
}

/** Lo que tiene concedido la cuenta de la sesión. */
export interface MisPermisos {
  rol: Rol;
  permisos: ClavePermiso[];
}

export interface CambioPermiso {
  rol: Rol;
  clave: ClavePermiso;
  habilitado: boolean;
}
