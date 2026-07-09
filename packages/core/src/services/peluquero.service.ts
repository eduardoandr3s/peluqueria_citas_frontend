import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../api.config';
import { Peluquero, PeluqueroRequest, PeluqueroUpdate } from '../models/peluquero.model';

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

  actualizar(id: number, data: PeluqueroUpdate): Observable<Peluquero> {
    return this.http.put<Peluquero>(`${this.apiUrl}/${id}`, data);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
