import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL } from '../api.config';
import { Page, Usuario } from '../models/usuario.model';
import { UsuarioService } from './usuario.service';

const API = 'http://test/api';

function pageOf(content: Usuario[]): Page<Usuario> {
  return {
    content,
    totalElements: content.length,
    totalPages: 1,
    number: 0,
    size: 20,
    first: true,
    last: true,
  };
}

describe('UsuarioService', () => {
  let service: UsuarioService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_URL, useValue: API }],
    });
    service = TestBed.inject(UsuarioService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listar usa defaults page=0 size=20 sort=nombre y NO añade incluirInactivos ni search', () => {
    service.listar().subscribe();
    const req = http.expectOne((r) => r.url === `${API}/usuarios`);
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('20');
    expect(req.request.params.get('sort')).toBe('nombre');
    expect(req.request.params.has('incluirInactivos')).toBe(false);
    expect(req.request.params.has('search')).toBe(false);
    req.flush(pageOf([]));
  });

  it('listar añade incluirInactivos y search (trim) cuando se pasan', () => {
    service.listar({ page: 2, size: 5, incluirInactivos: true, search: '  ana  ' }).subscribe();
    const req = http.expectOne((r) => r.url === `${API}/usuarios`);
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('5');
    expect(req.request.params.get('incluirInactivos')).toBe('true');
    expect(req.request.params.get('search')).toBe('ana');
    req.flush(pageOf([]));
  });

  it('listar ignora un search en blanco', () => {
    service.listar({ search: '   ' }).subscribe();
    const req = http.expectOne((r) => r.url === `${API}/usuarios`);
    expect(req.request.params.has('search')).toBe(false);
    req.flush(pageOf([]));
  });

  it('listarTodos pide size=2000 y devuelve solo el content', () => {
    const usuarios = [{ idUsuario: 1 }, { idUsuario: 2 }] as Usuario[];
    let result: Usuario[] | undefined;
    service.listarTodos().subscribe((r) => (result = r));
    const req = http.expectOne((r) => r.url === `${API}/usuarios`);
    expect(req.request.params.get('size')).toBe('2000');
    req.flush(pageOf(usuarios));
    expect(result).toEqual(usuarios);
  });

  it('obtener hace GET /usuarios/{id}', () => {
    service.obtener(3).subscribe();
    const req = http.expectOne(`${API}/usuarios/3`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('me hace GET /usuarios/me', () => {
    service.me().subscribe();
    const req = http.expectOne(`${API}/usuarios/me`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('crear hace POST con el body', () => {
    const body = { nombre: 'N', email: 'n@b.com', password: 'p' };
    service.crear(body).subscribe();
    const req = http.expectOne(`${API}/usuarios`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('actualizar hace PUT /usuarios/{id}', () => {
    service.actualizar(4, { nombre: 'Nuevo' }).subscribe();
    const req = http.expectOne(`${API}/usuarios/4`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ nombre: 'Nuevo' });
    req.flush({});
  });

  it('eliminar hace DELETE /usuarios/{id}', () => {
    service.eliminar(8).subscribe();
    const req = http.expectOne(`${API}/usuarios/8`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('cambiarRol hace PATCH /usuarios/{id}/rol con el rol', () => {
    service.cambiarRol(2, 'ADMIN').subscribe();
    const req = http.expectOne(`${API}/usuarios/2/rol`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ rol: 'ADMIN' });
    req.flush({});
  });

  it('activar hace PATCH /usuarios/{id}/activar', () => {
    service.activar(2).subscribe();
    const req = http.expectOne(`${API}/usuarios/2/activar`);
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });
});
