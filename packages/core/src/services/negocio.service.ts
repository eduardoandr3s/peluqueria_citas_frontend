import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { API_URL } from '../api.config';
import { ActualizarNegocio, Negocio } from '../models/negocio.model';
import { alVolverAPrimerPlano } from '../utils/primer-plano';

/**
 * Quién es esta peluquería: nombre, contacto, marca y horario.
 *
 * Todo esto vivía antes **fuera de la base de datos** —el horario en las properties del
 * backend y el nombre y el teléfono escritos aquí, en el código del móvil—, así que
 * cambiarlo era editar el despliegue o recompilar la app. Esa es la diferencia que hace
 * falta para instalarle el producto a otra peluquería sin reconstruir nada.
 *
 * Se carga en el arranque y sin sesión, por lo mismo que los módulos: la portada, la
 * pantalla de contacto y el pie de los correos se pintan antes del login.
 */
/**
 * Lo que se espera en el arranque, igual que en los módulos y por el mismo motivo: el
 * backend de producción vive en un plan que se duerme y un arranque en frío suyo tarda
 * decenas de segundos. Pasado el plazo se arranca con el nombre de reserva y la ficha
 * entra sola cuando llega.
 */
const ESPERA_MAXIMA_MS = 2000;

/**
 * Con qué se arranca mientras no hay respuesta. **No lleva nombre de ninguna peluquería a
 * propósito**: poner uno de reserva sería volver a incrustar en el código lo que esta tabla
 * viene a sacar de ahí, y en una instalación nueva se vería el nombre de otro negocio.
 */
const FICHA_VACIA: Negocio = {
  nombre: '',
  eslogan: null,
  telefono: null,
  email: null,
  direccion: null,
  localidad: null,
  logoUrl: null,
  colorPrimario: null,
  horaApertura: '09:00:00',
  horaCierre: '20:00:00',
  diasCerrados: ['SUNDAY'],
};

@Injectable({ providedIn: 'root' })
export class NegocioService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${inject(API_URL)}/negocio`;
  private readonly destroyRef = inject(DestroyRef);

  private readonly _ficha = signal<Negocio>(FICHA_VACIA);

  /** La ficha del negocio. Mientras no llega, la de reserva: sin nombre y sin contacto. */
  readonly ficha = this._ficha.asReadonly();

  /**
   * El nombre, o cadena vacía si todavía no ha llegado. Las plantillas lo pintan tal cual:
   * un hueco un instante es mejor que enseñar el nombre equivocado.
   */
  readonly nombre = computed(() => this._ficha().nombre);

  constructor() {
    alVolverAPrimerPlano(this.destroyRef, () => void this.cargar());
  }

  /**
   * Carga inicial. Se espera antes de pintar, pero **como mucho {@link ESPERA_MAXIMA_MS}**:
   * con el backend dormido la app arranca igual y la ficha entra sola después.
   */
  cargar(): Promise<void> {
    const respuesta = new Promise<void>((resolver) => {
      this.http.get<Negocio>(this.apiUrl).subscribe({
        next: (res) => {
          this._ficha.set(res);
          resolver();
        },
        // Sin respuesta se queda la ficha de reserva. Es lo mismo que hacen los módulos:
        // un fallo de red no puede impedir que la app arranque.
        error: () => resolver(),
      });
    });
    const espera = new Promise<void>((resolver) => setTimeout(resolver, ESPERA_MAXIMA_MS));
    return Promise.race([respuesta, espera]);
  }

  /**
   * Guarda la ficha entera (solo ADMIN). La respuesta trae lo que quedó guardado, así que
   * de ahí sale el estado sin una segunda petición.
   */
  guardar(ficha: ActualizarNegocio): Observable<Negocio> {
    return this.http.put<Negocio>(this.apiUrl, ficha).pipe(tap((res) => this._ficha.set(res)));
  }
}
