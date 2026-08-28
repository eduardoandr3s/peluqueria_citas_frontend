import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@peluqueria/core';

/** Exige sesión iniciada. */
export const mobileAuthGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() ? true : router.createUrlTree(['/auth/login']);
};

/**
 * Pantallas que son solo de administración (servicios, usuarios). Un PELUQUERO que llegue
 * a una de ellas vuelve a su área en vez de ver un 403.
 */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return router.createUrlTree(['/auth/login']);
  if (auth.isAdmin()) return true;
  // Cada uno a su área, y en un solo salto: mandar a un cliente a /admin lo haría
  // rebotar otra vez en staffGuard.
  return router.createUrlTree([auth.isStaff() ? '/admin' : '/tabs']);
};

/**
 * Puerta del área de trabajo: ADMIN o PELUQUERO. Dentro, cada pantalla pide lo suyo.
 * Un cliente se va a su área.
 */
export const staffGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return router.createUrlTree(['/auth/login']);
  return auth.isStaff() ? true : router.createUrlTree(['/tabs']);
};

/** Sección cliente: exige sesión; el personal del negocio se redirige a su área. */
export const clientGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return router.createUrlTree(['/auth/login']);
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
