import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../api.config';
import { Servicio, ServicioRequest, ServicioUpdate } from '../models/servicio.model';

@Injectable({ providedIn: 'root' })
export class ServicioService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${inject(API_URL)}/servicios`;

  listar(): Observable<Servicio[]> {
    return this.http.get<Servicio[]>(this.apiUrl);
  }

  obtener(id: number): Observable<Servicio> {
    return this.http.get<Servicio>(`${this.apiUrl}/${id}`);
  }

  crear(data: ServicioRequest): Observable<Servicio> {
    return this.http.post<Servicio>(this.apiUrl, data);
  }

  actualizar(id: number, data: ServicioUpdate): Observable<Servicio> {
    return this.http.put<Servicio>(`${this.apiUrl}/${id}`, data);
  }

  /** Borrado lógico: el backend marca el servicio como inactivo. */
  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
