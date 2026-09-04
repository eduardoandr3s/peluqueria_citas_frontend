import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../api.config';
import {
  ComisionServicio,
  Peluquero,
  PeluqueroCv,
  PeluqueroCvUpdate,
  PeluqueroGestion,
  PeluqueroPublico,
  PeluqueroRequest,
  PeluqueroUpdate,
} from '../models/peluquero.model';

@Injectable({ providedIn: 'root' })
export class PeluqueroService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${inject(API_URL)}/peluqueros`;

  listar(): Observable<Peluquero[]> {
    return this.http.get<Peluquero[]>(this.apiUrl);
  }

  obtener(id: number): Observable<Peluquero> {
    return this.http.get<Peluquero>(`${this.apiUrl}/${id}`);
  }

  crear(data: PeluqueroRequest): Observable<Peluquero> {
    return this.http.post<Peluquero>(this.apiUrl, data);
  }

  /** Fichas completas, activas e inactivas, con comisión y cuenta vinculada (ADMIN). */
  listarParaGestion(): Observable<PeluqueroGestion[]> {
    return this.http.get<PeluqueroGestion[]>(`${this.apiUrl}/gestion`);
  }

  actualizar(id: number, data: PeluqueroUpdate): Observable<PeluqueroGestion> {
    return this.http.put<PeluqueroGestion>(`${this.apiUrl}/${id}`, data);
  }

  comisiones(id: number): Observable<ComisionServicio[]> {
    return this.http.get<ComisionServicio[]>(`${this.apiUrl}/${id}/comisiones`);
  }

  /**
   * Reemplaza el conjunto entero de excepciones: lo que no se manda se borra. La pantalla
   * edita la tabla como un bloque, así que quitar una fila y no enviarla es como se borra.
   */
  reemplazarComisiones(id: number, comisiones: ComisionServicio[]): Observable<ComisionServicio[]> {
    return this.http.put<ComisionServicio[]>(`${this.apiUrl}/${id}/comisiones`, { comisiones });
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  /**
   * El equipo con su carta de presentación. **Se lee sin token**: es lo que mira alguien
   * que todavía no se ha registrado para decidir con quién agendar. Solo trae los activos
   * y ya viene ordenado por el servidor.
   */
  listarPublicos(): Observable<PeluqueroPublico[]> {
    return this.http.get<PeluqueroPublico[]>(`${this.apiUrl}/publicos`);
  }

  /**
   * El CV de la ficha de la sesión. No lleva id a propósito: lo resuelve el servidor desde
   * la cuenta, como `/produccion/mia`. Responde 404 si la cuenta no tiene ficha vinculada.
   */
  miCv(): Observable<PeluqueroCv> {
    return this.http.get<PeluqueroCv>(`${this.apiUrl}/mio`);
  }

  /**
   * Reemplaza el CV propio. Pide el permiso `PERFIL_CV_EDITAR`, y **lo que no se mande se
   * borra**: es la única forma de vaciar un campo de texto.
   */
  guardarMiCv(data: PeluqueroCvUpdate): Observable<PeluqueroCv> {
    return this.http.put<PeluqueroCv>(`${this.apiUrl}/mio`, data);
  }

  /** El CV de cualquier ficha (ADMIN). Reemplaza el bloque entero, igual que el propio. */
  guardarCv(id: number, data: PeluqueroCvUpdate): Observable<PeluqueroCv> {
    return this.http.put<PeluqueroCv>(`${this.apiUrl}/${id}/cv`, data);
  }

  /**
   * Foto del CV. La pone el dueño de la ficha con permiso, o un ADMIN.
   *
   * Ojo: NO se fija `Content-Type`. Con un `FormData` lo pone el navegador, incluyendo el
   * `boundary` del multipart; ponerlo a mano rompe la petición.
   */
  subirFoto(id: number, foto: File | Blob): Observable<PeluqueroCv> {
    const cuerpo = new FormData();
    cuerpo.append('foto', foto);
    return this.http.post<PeluqueroCv>(`${this.apiUrl}/${id}/foto`, cuerpo);
  }

  /** Quita la foto del CV. Es idempotente: sin foto no hace nada. */
  borrarFoto(id: number): Observable<PeluqueroCv> {
    return this.http.delete<PeluqueroCv>(`${this.apiUrl}/${id}/foto`);
  }
}
