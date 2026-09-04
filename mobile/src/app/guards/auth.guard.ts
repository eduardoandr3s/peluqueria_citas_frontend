import { inject } from '@angular/core';
import { CanActivateFn, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthService } from '@peluqueria/core';

/**
 * Al login, diciéndole a dónde se quería ir.
 *
 * Solo para el rebote por **falta de sesión**: es el caso en que la intención del usuario era
 * legítima y lo único que falta es entrar, así que perderla —y devolverlo a la pantalla de
 * inicio— es hacerle repetir el camino. Los rebotes por **rol** no pasan por aquí a propósito:
 * ahí no falta una sesión, es que ese sitio no es el suyo, y guardar el destino solo serviría
 * para volver a rebotarlo.
 *
 * La raíz no se guarda: `/` no es un destino, y devolver a un redirector no lleva a ninguna
 * parte. El login valida lo que le llega (`rutaInternaSegura`), así que esto no es la única
 * defensa.
 */
function alLogin(router: Router, state: RouterStateSnapshot): UrlTree {
  const destino = state.url;
  return router.createUrlTree(['/auth/login'], {
    queryParams: destino && destino !== '/' ? { returnUrl: destino } : {},
  });
}

/** Exige sesión iniciada. */
export const mobileAuthGuard: CanActivateFn = (_ruta, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() ? true : alLogin(router, state);
};

/**
 * Pantallas que son solo de administración (servicios, usuarios). Un PELUQUERO que llegue
 * a una de ellas vuelve a su área en vez de ver un 403.
 */
export const adminGuard: CanActivateFn = (_ruta, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return alLogin(router, state);
  if (auth.isAdmin()) return true;
  // Cada uno a su área, y en un solo salto: mandar a un cliente a /admin lo haría
  // rebotar otra vez en staffGuard.
  return router.createUrlTree([auth.isStaff() ? '/admin' : '/tabs']);
};

/**
 * Puerta del área de trabajo: ADMIN o PELUQUERO. Dentro, cada pantalla pide lo suyo.
 * Un cliente se va a su área.
 */
export const staffGuard: CanActivateFn = (_ruta, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return alLogin(router, state);
  return auth.isStaff() ? true : router.createUrlTree(['/tabs']);
};

/** Sección cliente: exige sesión; el personal del negocio se redirige a su área. */
export const clientGuard: CanActivateFn = (_ruta, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return alLogin(router, state);
  return auth.isStaff() ? router.createUrlTree(['/admin']) : true;
};

/**
 * Ruta raíz: manda a cada uno a su sitio según la sesión ya rehidratada por el
 * inicializador de `main.ts` (Preferences, o keystore + refresh si hay biometría).
 * Sin esto la raíz iría siempre al login y una sesión restaurada se perdería.
 */
export const sessionRedirectGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return router.createUrlTree(['/auth/login']);
  return router.createUrlTree([auth.isStaff() ? '/admin' : '/tabs']);
};
