import { inject } from '@angular/core';
import { CanActivateFn, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Ruta del login del panel. Es la que se rechaza como destino de vuelta (sería un bucle). */
const RUTA_LOGIN = '/login';

/**
 * Al login, diciéndole a dónde se quería ir.
 *
 * Solo para el rebote por **falta de sesión**: ahí la intención del usuario era legítima y lo
 * único que falta es entrar, así que perderla y devolverlo a la pantalla de inicio es hacerle
 * repetir el camino. Los rebotes por **rol** no pasan por aquí a propósito: no falta una
 * sesión, es que ese sitio no es el suyo, y guardar el destino solo serviría para rebotarlo
 * otra vez. La raíz tampoco se guarda: no es un destino.
 */
function alLogin(router: Router, state: RouterStateSnapshot): UrlTree {
  const destino = state.url;
  return router.createUrlTree([RUTA_LOGIN], {
    queryParams: destino && destino !== '/' ? { returnUrl: destino } : {},
  });
}

/** Exige sesión iniciada. */
export const authGuard: CanActivateFn = (_ruta, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() ? true : alLogin(router, state);
};

/**
 * Exige sesión iniciada con rol ADMIN (pantallas de administración del panel).
 *
 * Un peluquero **con** sesión no vuelve al login: no le falta entrar, le falta el rol, y
 * mandarlo ahí le pediría unas credenciales que ya tiene. Va a `/inicio`, que es el redirector
 * que lleva a cada rol a su pantalla.
 */
export const adminGuard: CanActivateFn = (_ruta, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return alLogin(router, state);
  return auth.isAdmin() ? true : router.createUrlTree(['/inicio']);
};

/**
 * Exige ADMIN o PELUQUERO: es la puerta del panel. Las pantallas que son solo de
 * administración llevan además `adminGuard` en su propia ruta, así que un peluquero que
 * escriba la URL a mano acaba en su pantalla en vez de en una que va a dar 403.
 */
export const staffGuard: CanActivateFn = (_ruta, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return alLogin(router, state);
  // Un cliente sí vuelve al login: el panel entero no es para él y no hay pantalla suya
  // aquí a la que mandarlo.
  return auth.isStaff() ? true : router.createUrlTree([RUTA_LOGIN]);
};
