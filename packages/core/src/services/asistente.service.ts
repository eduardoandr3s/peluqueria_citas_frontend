import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../api.config';
import { AsistentePregunta, AsistenteRespuesta, MensajeAsistente } from '../models/asistente.model';

/**
 * Asistente conversacional. El endpoint es público: se puede preguntar por precios y
 * horarios sin haber iniciado sesión.
 *
 * <p>La conversación **la mantiene el cliente**: en cada turno se reenvía el historial,
 * porque el servidor no guarda estado. De ahí el recorte de {@link MAX_HISTORIAL}, que no
 * es cosmético — cada turno reenviado se paga en tokens en todos los mensajes siguientes, y
 * el backend rechaza con 400 un historial más largo.
 */
@Injectable({ providedIn: 'root' })
export class AsistenteService {
  /** Debe coincidir con el `@Size(max = 10)` del backend. */
  static readonly MAX_HISTORIAL = 10;

  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${inject(API_URL)}/asistente`;

  preguntar(mensaje: string, historial: MensajeAsistente[] = []): Observable<AsistenteRespuesta> {
    const cuerpo: AsistentePregunta = {
      mensaje,
      historial: this.recortar(historial),
    };
    return this.http.post<AsistenteRespuesta>(this.apiUrl, cuerpo);
  }

  /**
   * Se queda con los turnos más **recientes**, no con los primeros: el contexto que importa
   * para entender «y el jueves?» es lo que acaba de decirse, no cómo empezó la conversación.
   */
  private recortar(historial: MensajeAsistente[]): MensajeAsistente[] {
    return historial.length <= AsistenteService.MAX_HISTORIAL
      ? historial
      : historial.slice(-AsistenteService.MAX_HISTORIAL);
  }
}
