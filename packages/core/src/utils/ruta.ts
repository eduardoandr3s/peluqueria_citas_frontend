/**
 * Validación del destino de vuelta tras iniciar sesión (`returnUrl`).
 *
 * **Esto no es una formalidad: un destino que llega en un parámetro es un redirect abierto si
 * no se comprueba.** Las dos apps se sirven también en un navegador, así que un enlace con
 * `?returnUrl=https://sitio-falso/...` mandaría a alguien recién autenticado a una pantalla de
 * otro que puede pedirle lo que quiera.
 *
 * Vive en el core porque el panel y la app lo necesitan igual y solo se diferencian en cuál es
 * su ruta de login. Duplicarlo sería tener dos ideas de qué destino es de fiar.
 */

/**
 * Devuelve la ruta si es interna y utilizable, y null si no.
 *
 * Se aceptan solo rutas internas:
 * - tiene que empezar por una sola `/`; `//host` es protocolo-relativo y sale de la app, igual
 *   que `http://host` o cualquier cosa con esquema;
 * - se rechaza la barra invertida, porque hay navegadores que tratan `/\host` como
 *   protocolo-relativo;
 * - se rechaza el propio login, que sería un bucle;
 * - y se rechaza la raíz, que no es un destino: devolver a un redirector no lleva a ninguna
 *   parte.
 *
 * @param rutaLogin la del login de esa app (`/login` en el panel, `/auth/login` en el móvil)
 */
export function rutaInternaSegura(
  valor: string | null | undefined,
  rutaLogin: string,
): string | null {
  if (!valor || !valor.startsWith('/') || valor.startsWith('//') || valor.includes('\\')) {
    return null;
  }
  if (valor === '/') {
    return null;
  }
  if (valor === rutaLogin || valor.startsWith(`${rutaLogin}?`)) {
    return null;
  }
  return valor;
}

/**
 * Si esa ruta la rebotaría el guard del área que no le toca a este rol.
 *
 * Hace falta porque el destino puede venir de cualquiera de las dos áreas: los guards lo
 * guardan tal cual estaba la URL, así que un cliente puede traer una ruta de administración
 * (si la escribió a mano) y el personal una de cliente (si entró por un enlace público).
 * Obedecerlo a ciegas mandaría a la pantalla que el otro guard va a rechazar, y el usuario
 * vería un salto que no ha pedido.
 *
 * Se deniega **solo** eso: lo que no es de ningún área vale para los dos.
 *
 * @param areaAjena prefijo del área que no es la suya
 */
export function esAreaAjena(ruta: string, areaAjena: string): boolean {
  return (
    ruta === areaAjena || ruta.startsWith(`${areaAjena}/`) || ruta.startsWith(`${areaAjena}?`)
  );
}
