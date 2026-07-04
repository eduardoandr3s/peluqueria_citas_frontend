import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL } from '../api.config';
import { PaymentIntentResponse, PagoResponse } from '../models/pago.model';
import { PagoService } from './pago.service';

const API = 'http://test/api';

describe('PagoService', () => {
  let service: PagoService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_URL, useValue: API }],
    });
    service = TestBed.inject(PagoService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('crearIntent hace POST /crear-intent con citaId', () => {
    const mock: PaymentIntentResponse = {
      clientSecret: 'pi_xxx_secret_yyy',
      paymentIntentId: 'pi_xxx',
      pagoId: 1,
    };

    let result: PaymentIntentResponse | undefined;
    service.crearIntent(5).subscribe((r) => (result = r));

    const req = http.expectOne(`${API}/pagos/crear-intent`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ citaId: 5 });
    req.flush(mock);
    expect(result).toEqual(mock);
  });

  it('obtenerPorCita hace GET /cita/{id}', () => {
    const mock: PagoResponse = {
      idPago: 1,
      citaId: 5,
      monto: 25.5,
      metodoPago: 'TARJETA',
      estadoPago: 'PAGADO',
      referenciaExterna: 'pi_xxx',
      fechaCreacion: '2026-07-01T10:00:00',
      fechaPago: '2026-07-01T10:05:00',
    };

    let result: PagoResponse | undefined;
    service.obtenerPorCita(5).subscribe((r) => (result = r));

    const req = http.expectOne(`${API}/pagos/cita/5`);
    expect(req.request.method).toBe('GET');
    req.flush(mock);
    expect(result).toEqual(mock);
  });

  it('obtenerPorCita con 404 (sin pago) se completa sin error', () => {
    let result: PagoResponse | undefined;
    let error: unknown;

    service.obtenerPorCita(99).subscribe({
      next: (r) => (result = r),
      error: (e) => (error = e),
    });

    const req = http.expectOne(`${API}/pagos/cita/99`);
    req.flush(null, { status: 404, statusText: 'Not Found' });
    expect(result).toBeUndefined();
    expect(error).toBeDefined();
  });

  it('registrarManual hace POST /manual con citaId y metodoPago', () => {
    const mock: PagoResponse = {
      idPago: 2,
      citaId: 3,
      monto: 30,
      metodoPago: 'EFECTIVO',
      estadoPago: 'PAGADO',
      referenciaExterna: null,
      fechaCreacion: '2026-07-01T12:00:00',
      fechaPago: '2026-07-01T12:00:00',
    };

    let result: PagoResponse | undefined;
    service.registrarManual(3, 'EFECTIVO').subscribe((r) => (result = r));

    const req = http.expectOne(`${API}/pagos/manual`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ citaId: 3, metodoPago: 'EFECTIVO' });
    req.flush(mock);
    expect(result).toEqual(mock);
  });

  it('reembolsar hace POST /{citaId}/reembolsar', () => {
    let completed = false;
    service.reembolsar(5).subscribe(() => (completed = true));

    const req = http.expectOne(`${API}/pagos/5/reembolsar`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(null);
    expect(completed).toBe(true);
  });
});
