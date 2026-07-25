import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../api.config';
import { DiaBloqueado, DiaBloqueadoRequest } from '../models/dia-bloqueado.model';

/**
 * Gestión de los días bloqueados (festivos y cierres puntuales). Solo un ADMIN puede
 * crear o borrar; la lectura está abierta a cualquier usuario autenticado.
 *
 * Para saber qué días NO se puede agendar (domingos incluidos) usa
 * `CitaService.diasCerrados()`, que ya los unifica.
 */
@Injectable({ providedIn: 'root' })
export class DiaBloqueadoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${inject(API_URL)}/dias-bloqueados`;

  /** Bloqueos de hoy en adelante, ordenados por fecha. */
  listar(): Observable<DiaBloqueado[]> {
    return this.http.get<DiaBloqueado[]>(this.apiUrl);
  }

  crear(data: DiaBloqueadoRequest): Observable<DiaBloqueado> {
    return this.http.post<DiaBloqueado>(this.apiUrl, data);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
