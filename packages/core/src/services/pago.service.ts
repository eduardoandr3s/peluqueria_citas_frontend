import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../api.config';
import { PaymentIntentResponse, PagoResponse } from '../models/pago.model';

@Injectable({ providedIn: 'root' })
export class PagoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${inject(API_URL)}/pagos`;

  crearIntent(citaId: number): Observable<PaymentIntentResponse> {
    return this.http.post<PaymentIntentResponse>(`${this.apiUrl}/crear-intent`, { citaId });
  }

  obtenerPorCita(citaId: number): Observable<PagoResponse> {
    return this.http.get<PagoResponse>(`${this.apiUrl}/cita/${citaId}`);
  }

  registrarManual(citaId: number, metodoPago: string): Observable<PagoResponse> {
    return this.http.post<PagoResponse>(`${this.apiUrl}/manual`, { citaId, metodoPago });
  }

  reembolsar(citaId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${citaId}/reembolsar`, {});
  }
}
