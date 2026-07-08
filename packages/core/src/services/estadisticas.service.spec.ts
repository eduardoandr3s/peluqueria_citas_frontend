import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL } from '../api.config';
import { EstadisticasResponse } from '../models/estadisticas.model';
import { EstadisticasService } from './estadisticas.service';

const API = 'http://test/api';

describe('EstadisticasService', () => {
  let service: EstadisticasService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_URL, useValue: API }],
    });
    service = TestBed.inject(EstadisticasService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('obtener hace GET /estadisticas con params desde y hasta', () => {
    const mock: EstadisticasResponse = {
      citasPorEstado: [{ estado: 'CONFIRMADA', total: 10 }],
      ingresos: { total: 500, porMetodoPago: { TARJETA: 300, EFECTIVO: 200 } },
      topServicios: [{ nombre: 'Corte', total: 15 }],
      nuevosClientes: 5,
    };

    let result: EstadisticasResponse | undefined;
    service.obtener('2026-01-01', '2026-06-30').subscribe((r) => (result = r));

    const req = http.expectOne(`${API}/estadisticas?desde=2026-01-01&hasta=2026-06-30`);
    expect(req.request.method).toBe('GET');
    req.flush(mock);
    expect(result).toEqual(mock);
  });
});
