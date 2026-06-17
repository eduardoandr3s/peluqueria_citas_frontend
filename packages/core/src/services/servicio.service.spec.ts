import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL } from '../api.config';
import { Servicio } from '../models/servicio.model';
import { ServicioService } from './servicio.service';

const API = 'http://test/api';

describe('ServicioService', () => {
  let service: ServicioService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_URL, useValue: API }],
    });
    service = TestBed.inject(ServicioService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listar hace GET /servicios y devuelve el array', () => {
    const servicios = [{ idServicio: 1 }, { idServicio: 2 }] as Servicio[];
    let result: Servicio[] | undefined;
    service.listar().subscribe((r) => (result = r));
    const req = http.expectOne(`${API}/servicios`);
    expect(req.request.method).toBe('GET');
    req.flush(servicios);
    expect(result).toEqual(servicios);
  });

  it('obtener hace GET /servicios/{id}', () => {
    service.obtener(4).subscribe();
    const req = http.expectOne(`${API}/servicios/4`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('crear hace POST con el body', () => {
    const body = { nombre: 'Corte', duracion: 30, precio: 15 };
    service.crear(body).subscribe();
    const req = http.expectOne(`${API}/servicios`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('actualizar hace PUT /servicios/{id}', () => {
    service.actualizar(2, { precio: 20 }).subscribe();
    const req = http.expectOne(`${API}/servicios/2`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ precio: 20 });
    req.flush({});
  });

  it('eliminar hace DELETE /servicios/{id}', () => {
    service.eliminar(6).subscribe();
    const req = http.expectOne(`${API}/servicios/6`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
