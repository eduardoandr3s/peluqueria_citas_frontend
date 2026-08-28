import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Exige sesión iniciada. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() ? true : router.createUrlTree(['/login']);
};

/** Exige sesión iniciada con rol ADMIN (panel de administración). */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAdmin() ? true : router.createUrlTree(['/login']);
};

/**
 * Exige ADMIN o PELUQUERO: es la puerta del panel. Las pantallas que son solo de
 * administración llevan además `adminGuard` en su propia ruta, así que un peluquero que
 * escriba la URL a mano acaba en el login en vez de en una pantalla que va a dar 403.
 */
export const staffGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isStaff() ? true : router.createUrlTree(['/login']);
};
