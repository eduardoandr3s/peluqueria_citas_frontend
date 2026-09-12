import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ClaveModulo } from '../models/modulo.model';
import { ModuloService } from '../services/modulo.service';

/**
 * Cierra una ruta cuyo módulo está apagado. Se usa así: `canActivate: [moduloGuard('PAGOS')]`.
 *
 * No manda al login ni enseña un error: si el negocio no hace eso, esa pantalla **no
 * existe** y lo correcto es devolver a la raíz, que en las dos apps es el redirector que
 * lleva a cada uno a su sitio según la sesión. Es la diferencia con un guard de rol, que
 * rebota a alguien de un sitio que sí existe pero no es suyo.
 *
 * Ocultar la entrada del menú no basta: la URL se puede escribir a mano.
 */
export function moduloGuard(clave: ClaveModulo): CanActivateFn {
  return () => {
    const modulos = inject(ModuloService);
    const router = inject(Router);
    return modulos.estaActivo(clave) ? true : router.createUrlTree(['/']);
  };
}
