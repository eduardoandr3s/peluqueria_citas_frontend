import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { API_URL } from '../api.config';
import { CambioPermiso, ClavePermiso, MisPermisos, Permiso } from '../models/permiso.model';
import { AuthService } from './auth.service';

/**
 * Permisos configurables por rol.
 *
 * Los de la sesión se cargan solos al entrar y se tiran al salir: un `effect` sobre el
 * usuario de {@link AuthService} evita que cada pantalla tenga que acordarse de pedirlos
 * y, sobre todo, que la sesión siguiente herede los permisos de la anterior.
 *
 * **Ocultar un botón no es seguridad.** Esto sirve para no ofrecer acciones que
 * terminarían en un 403; quien decide de verdad es el backend.
 */
@Injectable({ providedIn: 'root' })
export class PermisoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${inject(API_URL)}/permisos`;
  private readonly auth = inject(AuthService);

  private readonly _mios = signal<ClavePermiso[]>([]);

  /** Claves concedidas a la cuenta de la sesión. */
  readonly mios = this._mios.asReadonly();

  constructor() {
    effect(() => {
      // Se reacciona al usuario entero y no solo al rol: al cambiar de cuenta hay que
      // volver a preguntar aunque el rol nuevo sea el mismo que el anterior.
      const user = this.auth.user();
      if (!user) {
        this._mios.set([]);
        return;
      }
      this.refrescarMios();
    });
  }

  /**
   * Si la sesión tiene concedida esa acción. Se devuelve como señal para poder usarla
   * directamente en las plantillas sin recalcular en cada ciclo de detección.
   */
  puede(clave: ClavePermiso) {
    return computed(() => this._mios().includes(clave));
  }

  /** Vuelve a preguntar por los permisos de la sesión. */
  refrescarMios(): void {
    this.http.get<MisPermisos>(`${this.apiUrl}/mios`).subscribe({
      next: (res) => this._mios.set(res.permisos ?? []),
      // Sin permisos es el estado seguro: se ocultan las acciones configurables y, si
      // alguien fuerza una, el backend responde 403 igualmente.
      error: () => this._mios.set([]),
    });
  }

  /** Matriz completa rol x permiso, para la pantalla de configuración (solo ADMIN). */
  matriz(): Observable<Permiso[]> {
    return this.http.get<Permiso[]>(this.apiUrl);
  }

  /**
   * Guarda las casillas que han cambiado. Se mandan solo esas y no la matriz entera:
   * así dos administradores en pantallas distintas no se pisan el trabajo.
   */
  guardar(cambios: CambioPermiso[]): Observable<Permiso[]> {
    return this.http.put<Permiso[]>(this.apiUrl, { cambios }).pipe(
      // Los suyos pueden haber cambiado en el mismo guardado (un admin que además
      // corta pelo, o el propio rol del que mira).
      tap(() => this.refrescarMios()),
    );
  }
}
