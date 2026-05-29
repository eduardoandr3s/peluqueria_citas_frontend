import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CambiarRolRequest, Rol, Usuario, UsuarioRequest, UsuarioUpdate } from '../models/usuario.model';

@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/usuarios`;

  /** Solo ADMIN. */
  listar(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(this.apiUrl);
  }

  obtener(id: number): Observable<Usuario> {
    return this.http.get<Usuario>(`${this.apiUrl}/${id}`);
  }

  crear(data: UsuarioRequest): Observable<Usuario> {
    return this.http.post<Usuario>(this.apiUrl, data);
  }

  actualizar(id: number, data: UsuarioUpdate): Observable<Usuario> {
    return this.http.put<Usuario>(`${this.apiUrl}/${id}`, data);
  }

  /** Borrado lógico: el backend marca el usuario como inactivo. Solo ADMIN. */
  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  /** Cambia el rol de un usuario (USER <-> ADMIN). Solo ADMIN. */
  cambiarRol(id: number, rol: Rol): Observable<Usuario> {
    const body: CambiarRolRequest = { rol };
    return this.http.patch<Usuario>(`${this.apiUrl}/${id}/rol`, body);
  }
}
