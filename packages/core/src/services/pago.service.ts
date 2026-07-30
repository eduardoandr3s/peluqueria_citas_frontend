import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { API_URL } from '../api.config';
import { EstadoPago, MetodoPago, PaymentIntentResponse, PagoResponse } from '../models/pago.model';
import { Page } from '../models/usuario.model';

export interface ListarPagosOpts {
  desde?: string; // ISO date (YYYY-MM-DD), inclusive
  hasta?: string; // ISO date (YYYY-MM-DD), inclusive
  estado?: EstadoPago;
  metodo?: MetodoPago;
  page?: number; // 0-based
  size?: number;
}

@Injectable({ providedIn: 'root' })
export class PagoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${inject(API_URL)}/pagos`;

  /** Listado paginado de pagos con filtros opcionales. Solo ADMIN. */
  listar(opts: ListarPagosOpts = {}): Observable<Page<PagoResponse>> {
    let params = new HttpParams()
      .set('page', String(opts.page ?? 0))
      .set('size', String(opts.size ?? 20));
    if (opts.desde) params = params.set('desde', opts.desde);
    if (opts.hasta) params = params.set('hasta', opts.hasta);
    if (opts.estado) params = params.set('estado', opts.estado);
    if (opts.metodo) params = params.set('metodo', opts.metodo);
    return this.http.get<Page<PagoResponse>>(this.apiUrl, { params });
  }

  /**
   * Todos los pagos que cumplan los filtros, como array plano. El panel los desglosa y
   * busca en cliente, así que se piden de una vez con un size alto (igual que las citas).
   */
  listarTodos(opts: Omit<ListarPagosOpts, 'page' | 'size'> = {}): Observable<PagoResponse[]> {
    return this.listar({ ...opts, page: 0, size: 2000 }).pipe(map((p) => p.content));
  }

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

  /**
   * Recibo en PDF de un pago. Ojo: **el id es del pago, no de la cita** (a diferencia
   * de `obtenerPorCita` y `reembolsar`).
   *
   * Va por `HttpClient` con `responseType: 'blob'` y no con un `<a href>` directo porque
   * el endpoint exige el JWT, que lo pone el interceptor: un enlace normal no pasaría por
   * él y recibiría un 401. Para disparar la descarga en el navegador, `descargarBlob`.
   *
   * Solo existe para pagos PAGADO o REEMBOLSADO; en cualquier otro estado responde 409.
   */
  descargarRecibo(idPago: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${idPago}/recibo`, { responseType: 'blob' });
  }

  /** Nombre con el que el backend sirve el recibo, para no repetirlo en cada llamada. */
  nombreRecibo(idPago: number): string {
    return `recibo-${idPago}.pdf`;
  }
}
