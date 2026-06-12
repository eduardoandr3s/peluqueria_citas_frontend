import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@peluqueria/core';

/** Exige sesión iniciada. */
export const mobileAuthGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() ? true : router.createUrlTree(['/auth/login']);
};

/** Sección admin: exige sesión + rol ADMIN. Un USER se manda a su área de cliente. */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return router.createUrlTree(['/auth/login']);
  return auth.isAdmin() ? true : router.createUrlTree(['/tabs']);
};

/** Sección cliente: exige sesión; un ADMIN se redirige a su panel. */
export const clientGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return router.createUrlTree(['/auth/login']);
  return auth.isAdmin() ? router.createUrlTree(['/admin']) : true;
};
