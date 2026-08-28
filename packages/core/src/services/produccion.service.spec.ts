import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL } from '../api.config';
import { Produccion, ProduccionPeluquero } from '../models/produccion.model';
import { ProduccionService } from './produccion.service';

const API = 'http://test/api';

const PRODUCCION: Produccion = {
  idPeluquero: 1,
  nombre: 'Lalo',
  desde: '2026-08-01',
  hasta: '2026-08-31',
  serviciosRealizados: 12,
  importeVendido: 300,
  comision: 60,
  serviciosSinCobrar: 1,
  importeSinCobrar: 30,
  porServicio: [{ etiqueta: 'Corte', servicios: 10, importe: 150, comision: 30 }],
  porMes: [{ etiqueta: '2026-08', servicios: 12, importe: 300, comision: 60 }],
};

describe('ProduccionService', () => {
  let service: ProduccionService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_URL, useValue: API }],
    });
    service = TestBed.inject(ProduccionService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('mia hace GET /produccion/mia con el rango, y sin ningún id', () => {
    let result: Produccion | undefined;
    service.mia('2026-08-01', '2026-08-31').subscribe((r) => (result = r));

    const req = http.expectOne(`${API}/produccion/mia?desde=2026-08-01&hasta=2026-08-31`);
    expect(req.request.method).toBe('GET');
    // El id lo resuelve el backend desde la cuenta: si viajara aquí existiría la versión
    // de esta llamada en la que se pide «la mía» con el id de otro.
    expect(req.request.params.has('peluqueroId')).toBe(false);
    req.flush(PRODUCCION);
    expect(result).toEqual(PRODUCCION);
  });

  it('sin rango no manda parámetros: el backend responde el mes en curso', () => {
    service.mia().subscribe();

    const req = http.expectOne(`${API}/produccion/mia`);
    expect(req.request.params.keys()).toEqual([]);
    req.flush(PRODUCCION);
  });

  it('dePeluquero hace GET /produccion/peluquero/{id}', () => {
    service.dePeluquero(4, '2026-08-01', '2026-08-31').subscribe();

    const req = http.expectOne(`${API}/produccion/peluquero/4?desde=2026-08-01&hasta=2026-08-31`);
    expect(req.request.method).toBe('GET');
    req.flush(PRODUCCION);
  });

  it('comparativa hace GET /produccion', () => {
    const filas: ProduccionPeluquero[] = [
      { idPeluquero: 1, nombre: 'Lalo', serviciosRealizados: 12, importeVendido: 300, comision: 60 },
    ];
    let result: ProduccionPeluquero[] | undefined;
    service.comparativa('2026-08-01', '2026-08-31').subscribe((r) => (result = r));

    const req = http.expectOne(`${API}/produccion?desde=2026-08-01&hasta=2026-08-31`);
    expect(req.request.method).toBe('GET');
    req.flush(filas);
    expect(result).toEqual(filas);
  });
});
