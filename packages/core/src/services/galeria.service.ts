import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../api.config';
import { GaleriaFoto, GaleriaFotoUpdate } from '../models/galeria.model';

@Injectable({ providedIn: 'root' })
export class GaleriaService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${inject(API_URL)}/galeria`;

  /** Listado público y ya ordenado por el servidor. */
  listar(): Observable<GaleriaFoto[]> {
    return this.http.get<GaleriaFoto[]>(this.apiUrl);
  }

  /**
   * Sube una foto nueva al final de la rejilla. La foto queda sellada con la cuenta
   * que la sube y eso es lo que después decide quién puede editarla.
   *
   * La miniatura va en el mismo multipart y la genera quien llama: el servidor
   * tiene 0,1 CPU en producción y escalar imágenes ahí sería pagar por algo que
   * el navegador hace gratis. Si no se manda, el backend sirve la grande también
   * en la rejilla, que funciona pero multiplica el tráfico.
   *
   * Ojo: NO se fija `Content-Type`. Con un `FormData` lo pone el navegador,
   * incluyendo el `boundary` del multipart; ponerlo a mano rompe la petición.
   */
  subir(imagen: File | Blob, miniatura?: File | Blob | null, titulo?: string): Observable<GaleriaFoto> {
    const cuerpo = new FormData();
    cuerpo.append('imagen', imagen);
    if (miniatura) {
      cuerpo.append('miniatura', miniatura);
    }
    if (titulo?.trim()) {
      cuerpo.append('titulo', titulo.trim());
    }
    return this.http.post<GaleriaFoto>(this.apiUrl, cuerpo);
  }

  /**
   * Cambia el título o la posición de una foto ya subida.
   *
   * El servidor comprueba los dos campos por separado: el título lo gobierna el dueño
   * de la foto y el orden es de la rejilla entera, así que mover una ajena solo pide
   * `GALERIA_ORDENAR`.
   */
  actualizar(id: number, data: GaleriaFotoUpdate): Observable<GaleriaFoto> {
    return this.http.put<GaleriaFoto>(`${this.apiUrl}/${id}`, data);
  }

  /** Borra la foto y, en el servidor, sus dos objetos del almacén. */
  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
