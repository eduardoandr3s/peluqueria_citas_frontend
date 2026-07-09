import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL } from '../api.config';
import { Peluquero } from '../models/peluquero.model';
import { PeluqueroService } from './peluquero.service';

const API = 'http://test/api';

describe('PeluqueroService', () => {
  let service: PeluqueroService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_URL, useValue: API }],
    });
    service = TestBed.inject(PeluqueroService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listar hace GET /peluqueros', () => {
    const peluqueros = [{ idPeluquero: 1 }, { idPeluquero: 2 }] as Peluquero[];
    let result: Peluquero[] | undefined;
    service.listar().subscribe((r) => (result = r));
    const req = http.expectOne(`${API}/peluqueros`);
    expect(req.request.method).toBe('GET');
    req.flush(peluqueros);
    expect(result).toEqual(peluqueros);
  });

  it('obtener hace GET /peluqueros/{id}', () => {
    service.obtener(4).subscribe();
    const req = http.expectOne(`${API}/peluqueros/4`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('crear hace POST con el body', () => {
    const body = { nombre: 'Lalo' };
    service.crear(body).subscribe();
    const req = http.expectOne(`${API}/peluqueros`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('actualizar hace PUT /peluqueros/{id}', () => {
    service.actualizar(2, { nombre: 'Pepe' }).subscribe();
    const req = http.expectOne(`${API}/peluqueros/2`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ nombre: 'Pepe' });
    req.flush({});
  });

  it('eliminar hace DELETE /peluqueros/{id}', () => {
    service.eliminar(6).subscribe();
    const req = http.expectOne(`${API}/peluqueros/6`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
