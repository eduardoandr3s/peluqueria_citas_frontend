import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { API_URL } from '../api.config';
import { CambiarRolRequest, Page, Rol, Usuario, UsuarioRequest, UsuarioUpdate } from '../models/usuario.model';

export interface ListarUsuariosOpts {
  page?: number; // 0-based
  size?: number;
  incluirInactivos?: boolean;
  search?: string; // filtra por nombre o email (server-side, sobre toda la tabla)
}

@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${inject(API_URL)}/usuarios`;

  /** Listado paginado (Page<Usuario>). Solo ADMIN. */
  listar(opts: ListarUsuariosOpts = {}): Observable<Page<Usuario>> {
    let params = new HttpParams()
      .set('page', String(opts.page ?? 0))
      .set('size', String(opts.size ?? 20))
      .set('sort', 'nombre');
    if (opts.incluirInactivos) {
      params = params.set('incluirInactivos', 'true');
    }
    const search = opts.search?.trim();
    if (search) {
      params = params.set('search', search);
    }
    return this.http.get<Page<Usuario>>(this.apiUrl, { params });
  }

  /**
   * Trae todos los usuarios como array plano (recorre la paginación con un size alto).
   * Para selects y conteos donde se necesita la lista completa, no una página.
   */
  listarTodos(incluirInactivos = false): Observable<Usuario[]> {
    return this.listar({ page: 0, size: 2000, incluirInactivos }).pipe(map((p) => p.content));
  }

  /** Datos del usuario autenticado (GET /api/usuarios/me). */
  me(): Observable<Usuario> {
    return this.http.get<Usuario>(`${this.apiUrl}/me`);
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

  /** Reactiva un usuario previamente desactivado (borrado lógico). Solo ADMIN. */
  activar(id: number): Observable<Usuario> {
    return this.http.patch<Usuario>(`${this.apiUrl}/${id}/activar`, {});
  }
}
