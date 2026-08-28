import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../api.config';
import { Produccion, ProduccionPeluquero } from '../models/produccion.model';

@Injectable({ providedIn: 'root' })
export class ProduccionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${inject(API_URL)}/produccion`;

  /**
   * La del peluquero de la sesión. No lleva id a propósito: lo resuelve el backend desde
   * la cuenta, así que no existe la versión de esta llamada en la que se pide «la mía»
   * pasando el id de otro.
   */
  mia(desde?: string, hasta?: string): Observable<Produccion> {
    return this.http.get<Produccion>(`${this.apiUrl}/mia`, { params: this.rango(desde, hasta) });
  }

  /** La de cualquiera (solo ADMIN). */
  dePeluquero(idPeluquero: number, desde?: string, hasta?: string): Observable<Produccion> {
    return this.http.get<Produccion>(`${this.apiUrl}/peluquero/${idPeluquero}`, {
      params: this.rango(desde, hasta),
    });
  }

  /** Comparativa de toda la plantilla, ordenada por importe (solo ADMIN). */
  comparativa(desde?: string, hasta?: string): Observable<ProduccionPeluquero[]> {
    return this.http.get<ProduccionPeluquero[]>(this.apiUrl, { params: this.rango(desde, hasta) });
  }

  /** Sin rango, el backend responde el mes en curso. */
  private rango(desde?: string, hasta?: string): HttpParams {
    let params = new HttpParams();
    if (desde) params = params.set('desde', desde);
    if (hasta) params = params.set('hasta', hasta);
    return params;
  }
}
