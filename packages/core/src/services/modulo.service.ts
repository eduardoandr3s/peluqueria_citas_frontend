import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { API_URL } from '../api.config';
import {
  CLAVES_MODULO,
  CambioModulo,
  ClaveModulo,
  Modulo,
  ModulosActivos,
  PerfilArranque,
} from '../models/modulo.model';
import { alVolverAPrimerPlano } from '../utils/primer-plano';

/**
 * Módulos del negocio: qué partes del producto están encendidas aquí.
 *
 * **Un módulo no es un permiso.** Un permiso dice quién puede hacer algo y nunca alcanza al
 * ADMIN; un módulo dice si este negocio hace eso en absoluto, y apagado desaparece también
 * para el administrador. Por eso esto no depende de la sesión y se carga en el arranque: el
 * endpoint es público porque la app tiene pantallas que se ven sin cuenta.
 *
 * **Ocultar algo no es seguridad.** Esto evita ofrecer acciones que terminarían en un 409;
 * quien decide de verdad es el backend.
 */
/**
 * Lo que se espera en el arranque por la respuesta. El backend de producción vive en un plan
 * que **se duerme**, y un arranque en frío suyo tarda decenas de segundos: bloquear ahí la app
 * dejaría al usuario mirando una pantalla en blanco para no ver parpadear un botón.
 */
const ESPERA_MAXIMA_MS = 2000;

@Injectable({ providedIn: 'root' })
export class ModuloService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${inject(API_URL)}/modulos`;

  // Se parte de todo encendido, que es el valor por defecto del backend: mientras no llega
  // la respuesta la app se comporta como siempre, y si la carga falla se queda así. El
  // estado seguro aquí NO es el vacío: esconderlo todo dejaría un panel inútil por un fallo
  // de red, y forzar una acción que no existe solo consigue un 409.
  private readonly _activos = signal<ClaveModulo[]>([...CLAVES_MODULO]);

  /** Claves encendidas en este negocio. */
  readonly activos = this._activos.asReadonly();

  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    // Preguntar solo al arrancar no basta: en el móvil la app **no se cierra**, se queda en
    // segundo plano, así que ese arranque puede ser de hace semanas y un módulo apagado
    // desde el panel no llegaría nunca. El cómo está en `alVolverAPrimerPlano`, compartido
    // con el servicio del negocio para que no haya dos copias que un día divergirían.
    alVolverAPrimerPlano(this.destroyRef, () => void this.cargar());
  }

  /**
   * Carga inicial, pensada para el arranque de la app: se espera antes de pintar nada para que
   * no se vea aparecer y desaparecer lo que este negocio no usa.
   *
   * Pero se espera **como mucho {@link ESPERA_MAXIMA_MS}**, y la petición sigue viva después:
   * con el backend dormido la app arranca igual, con todo encendido, y se corrige sola cuando
   * llega la respuesta. El parpadeo es un mal menor frente a no arrancar.
   */
  cargar(): Promise<void> {
    const respuesta = new Promise<void>((resolver) => {
      this.http.get<ModulosActivos>(`${this.apiUrl}/activos`).subscribe({
        next: (res) => {
          this._activos.set(res.modulos ?? []);
          resolver();
        },
        // Sin respuesta se queda todo encendido, que es el comportamiento de siempre: esconder
        // la app entera por un fallo de red sería peor, y el backend responde 409 igualmente.
        error: () => resolver(),
      });
    });
    const espera = new Promise<void>((resolver) => setTimeout(resolver, ESPERA_MAXIMA_MS));
    return Promise.race([respuesta, espera]);
  }

  /**
   * Si el negocio tiene ese módulo. Se devuelve como señal para usarla en las plantillas
   * sin recalcular en cada ciclo de detección.
   */
  activo(clave: ClaveModulo) {
    return computed(() => this._activos().includes(clave));
  }

  /** La misma pregunta fuera de una plantilla (guards, condiciones sueltas). */
  estaActivo(clave: ClaveModulo): boolean {
    return this._activos().includes(clave);
  }

  /** Catálogo completo con su estado, para la pantalla de configuración (solo ADMIN). */
  catalogo(): Observable<Modulo[]> {
    return this.http.get<Modulo[]>(this.apiUrl);
  }

  /**
   * Enciende y apaga. Se mandan solo los que cambian, igual que en los permisos, para que
   * dos administradores en pantallas distintas no se pisen.
   *
   * La respuesta trae el catálogo entero ya recalculado, así que de ahí se sacan los
   * activos sin una segunda petición: lo que vale es `efectivo`, no lo que se marcó.
   */
  guardar(cambios: CambioModulo[]): Observable<Modulo[]> {
    return this.http.put<Modulo[]>(this.apiUrl, { cambios }).pipe(
      tap((catalogo) => this.refrescarActivos(catalogo)),
    );
  }

  /** Los perfiles de arranque, con lo que enciende y lo que apaga cada uno (solo ADMIN). */
  perfiles(): Observable<PerfilArranque[]> {
    return this.http.get<PerfilArranque[]>(`${this.apiUrl}/perfiles`);
  }

  /**
   * Aplica un perfil: enciende su juego de módulos y **apaga todos los demás**. Es un atajo
   * para dar de alta una peluquería nueva, no un estado que quede guardado: después se le
   * cambia cualquier módulo sin salir de nada.
   */
  aplicarPerfil(clave: string): Observable<Modulo[]> {
    return this.http
      .post<Modulo[]>(`${this.apiUrl}/perfiles/${clave}`, {})
      .pipe(tap((catalogo) => this.refrescarActivos(catalogo)));
  }

  /**
   * La respuesta de escribir trae el catálogo entero ya recalculado, así que de ahí salen
   * los activos sin una segunda petición: lo que vale es `efectivo`, no lo que se marcó.
   */
  private refrescarActivos(catalogo: Modulo[]): void {
    this._activos.set(catalogo.filter((m) => m.efectivo).map((m) => m.clave));
  }
}
