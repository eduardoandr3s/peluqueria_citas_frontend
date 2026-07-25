import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL } from '../api.config';
import { DiaBloqueado } from '../models/dia-bloqueado.model';
import { DiaBloqueadoService } from './dia-bloqueado.service';

const API = 'http://test/api';

describe('DiaBloqueadoService', () => {
  let service: DiaBloqueadoService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_URL, useValue: API }],
    });
    service = TestBed.inject(DiaBloqueadoService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listar hace GET /dias-bloqueados', () => {
    const dias = [{ idDiaBloqueado: 1, fecha: '2027-01-06', motivo: 'Reyes' }] as DiaBloqueado[];
    let result: DiaBloqueado[] | undefined;

    service.listar().subscribe((r) => (result = r));

    const req = http.expectOne(`${API}/dias-bloqueados`);
    expect(req.request.method).toBe('GET');
    req.flush(dias);

    expect(result).toEqual(dias);
  });

  it('crear hace POST con fecha y motivo', () => {
    const body = { fecha: '2027-01-06', motivo: 'Reyes' };
    service.crear(body).subscribe();
    const req = http.expectOne(`${API}/dias-bloqueados`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('eliminar hace DELETE /dias-bloqueados/{id}', () => {
    service.eliminar(3).subscribe();
    const req = http.expectOne(`${API}/dias-bloqueados/3`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
