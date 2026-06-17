import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL } from '../api.config';
import { Cita, CitaRequest } from '../models/cita.model';
import { Page } from '../models/usuario.model';
import { CitaService } from './cita.service';

const API = 'http://test/api';

function pageOf(content: Cita[]): Page<Cita> {
  return {
    content,
    totalElements: content.length,
    totalPages: 1,
    number: 0,
    size: 2000,
    first: true,
    last: true,
  };
}

describe('CitaService', () => {
  let service: CitaService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_URL, useValue: API }],
    });
    service = TestBed.inject(CitaService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listar pide size=2000 y devuelve solo el content', () => {
    const citas = [{ idCita: 1 }, { idCita: 2 }] as Cita[];
    let result: Cita[] | undefined;

    service.listar().subscribe((r) => (result = r));

    const req = http.expectOne((r) => r.url === `${API}/citas`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('size')).toBe('2000');
    req.flush(pageOf(citas));

    expect(result).toEqual(citas);
  });

  it('disponibilidad pasa fecha e idServicio y devuelve los slots', () => {
    let slots: string[] | undefined;
    service.disponibilidad('2026-06-20', 3).subscribe((s) => (slots = s));

    const req = http.expectOne((r) => r.url === `${API}/citas/disponibilidad`);
    expect(req.request.params.get('fecha')).toBe('2026-06-20');
    expect(req.request.params.get('idServicio')).toBe('3');
    req.flush(['09:00', '09:30']);

    expect(slots).toEqual(['09:00', '09:30']);
  });

  it('obtener hace GET /citas/{id}', () => {
    service.obtener(7).subscribe();
    const req = http.expectOne(`${API}/citas/7`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('agendar hace POST con el body', () => {
    const body: CitaRequest = { servicioId: 2, fechaHora: '2026-06-20T10:00:00' };
    service.agendar(body).subscribe();
    const req = http.expectOne(`${API}/citas`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('actualizar hace PUT /citas/{id}', () => {
    service.actualizar(5, { estado: 'ANULADA' }).subscribe();
    const req = http.expectOne(`${API}/citas/5`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ estado: 'ANULADA' });
    req.flush({});
  });

  it('eliminar hace DELETE /citas/{id}', () => {
    service.eliminar(9).subscribe();
    const req = http.expectOne(`${API}/citas/9`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
