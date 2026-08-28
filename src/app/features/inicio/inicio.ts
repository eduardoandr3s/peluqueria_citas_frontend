import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@peluqueria/core';

/**
 * Redirector de entrada al panel.
 *
 * Existe porque los dos roles que entran aquí no tienen la misma pantalla de inicio: el
 * dashboard vive de `/api/estadisticas`, que es de ADMIN, así que mandar ahí a un
 * peluquero sería mandarlo a un 403. Se resuelve en una ruta y no en el `redirectTo` de
 * `app.routes.ts` porque un `redirectTo` es estático y esto depende del rol de la sesión.
 */
@Component({
  selector: 'app-inicio',
  template: '',
})
export class Inicio {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  constructor() {
    this.router.navigate([this.auth.isAdmin() ? '/dashboard' : '/citas'], { replaceUrl: true });
  }
}
