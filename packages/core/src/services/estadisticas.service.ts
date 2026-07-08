import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../api.config';
import { EstadisticasResponse } from '../models/estadisticas.model';

@Injectable({ providedIn: 'root' })
export class EstadisticasService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${inject(API_URL)}/estadisticas`;

  obtener(desde: string, hasta: string): Observable<EstadisticasResponse> {
    const params = new HttpParams().set('desde', desde).set('hasta', hasta);
    return this.http.get<EstadisticasResponse>(this.apiUrl, { params });
  }
}
