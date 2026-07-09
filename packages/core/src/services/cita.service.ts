import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { API_URL } from '../api.config';
import { Cita, CitaRequest, CitaUpdate } from '../models/cita.model';
import { Page } from '../models/usuario.model';

@Injectable({ providedIn: 'root' })
export class CitaService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${inject(API_URL)}/citas`;

  /**
   * GET /api/citas devuelve un Page<Cita> (paginado). La tabla muestra y filtra
   * todas las citas en cliente, así que pedimos un size alto y devolvemos solo el
   * content como array plano.
   */
  listar(): Observable<Cita[]> {
    const params = new HttpParams().set('size', '2000');
    return this.http.get<Page<Cita>>(this.apiUrl, { params }).pipe(map((p) => p.content));
  }

  /**
   * Horas libres (slots de 30 min, formato "HH:mm") para una fecha, servicio y opcionalmente peluquero.
   * El backend ya descuenta citas existentes, duración, horario laboral y domingos.
   */
  disponibilidad(fecha: string, idServicio: number, peluqueroId?: number): Observable<string[]> {
    let params = new HttpParams().set('fecha', fecha).set('idServicio', String(idServicio));
    if (peluqueroId != null) params = params.set('peluqueroId', String(peluqueroId));
    return this.http.get<string[]>(`${this.apiUrl}/disponibilidad`, { params });
  }

  obtener(id: number): Observable<Cita> {
    return this.http.get<Cita>(`${this.apiUrl}/${id}`);
  }

  agendar(data: CitaRequest): Observable<Cita> {
    return this.http.post<Cita>(this.apiUrl, data);
  }

  actualizar(id: number, data: CitaUpdate): Observable<Cita> {
    return this.http.put<Cita>(`${this.apiUrl}/${id}`, data);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
