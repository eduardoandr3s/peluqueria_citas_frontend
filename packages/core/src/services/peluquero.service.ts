import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../api.config';
import {
  ComisionServicio,
  Peluquero,
  PeluqueroGestion,
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
}
