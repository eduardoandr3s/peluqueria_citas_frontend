import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { ToastController } from '@ionic/angular/standalone';
import { API_URL, Cita, CitaService, PagoService, PagoResponse } from '@peluqueria/core';
import { of, throwError } from 'rxjs';
import { loadStripe } from '@stripe/stripe-js';
import { PagoPage } from './pago.page';

vi.mock('@stripe/stripe-js', () => ({ loadStripe: vi.fn() }));

const CITA: Cita = {
  idCita: 5,
  usuario: { idUsuario: 1, nombre: 'Ana', email: 'ana@b.com' },
  servicio: { idServicio: 1, nombre: 'Corte', precio: 15, duracion: 30, activo: true },
  fechaHora: '2026-07-10T10:00:00',
  estado: 'PENDIENTE',
};

function pago(estadoPago: PagoResponse['estadoPago']): PagoResponse {
  return {
    idPago: 1,
    citaId: 5,
    monto: 15,
    metodoPago: 'TARJETA',
    estadoPago,
    referenciaExterna: 'pi_x',
    fechaCreacion: '2026-07-01T10:00:00',
    fechaPago: null,
  };
}

function setup(pago$: Partial<Record<keyof PagoService, unknown>> = {}) {
  const pagoSvc = {
    crearIntent: vi.fn().mockReturnValue(of({ clientSecret: 'cs_x', paymentIntentId: 'pi_x', pagoId: 1 })),
    obtenerPorCita: vi.fn().mockReturnValue(throwError(() => ({ status: 404 }))),
    registrarManual: vi.fn(),
    reembolsar: vi.fn(),
    ...pago$,
  };
  const toast = { present: vi.fn() };
  const toastCtrl = { create: vi.fn().mockResolvedValue(toast) };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: API_URL, useValue: 'http://test/api' },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '5' } } } },
      { provide: CitaService, useValue: { obtener: vi.fn().mockReturnValue(of(CITA)) } },
      { provide: PagoService, useValue: pagoSvc },
      { provide: ToastController, useValue: toastCtrl },
    ],
  });
  const router = TestBed.inject(Router);
  const nav = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const c = TestBed.runInInjectionContext(() => new PagoPage()) as any;
  return { c, nav, pagoSvc, toastCtrl };
}

describe('PagoPage', () => {
  afterEach(() => vi.useRealTimers());

  it('ionViewWillEnter pinta la rama lista ANTES de montar el Payment Element', async () => {
    const { c } = setup();
    let estadoAlMontar = '';
    const mount = vi.fn(() => {
      estadoAlMontar = c.estado();
    });
    vi.mocked(loadStripe).mockResolvedValue({
      elements: vi.fn().mockReturnValue({ create: vi.fn().mockReturnValue({ mount }) }),
    } as any);

    await c.ionViewWillEnter();

    expect(mount).toHaveBeenCalledWith('#payment-element');
    expect(estadoAlMontar).toBe('listo');
    expect(c.estado()).toBe('listo');
  });

  it('si crear-intent falla muestra el error del backend', async () => {
    const crearIntent = vi.fn().mockReturnValue(
      throwError(() => new HttpErrorResponse({ error: { error: 'No se puede pagar una cita anulada' }, status: 400 })),
    );
    const { c } = setup({ crearIntent });

    await c.ionViewWillEnter();

    expect(c.estado()).toBe('error-inicial');
    expect(c.mensajeError()).toBe('No se puede pagar una cita anulada');
  });

  it('confirmarPago con error de Stripe muestra el mensaje y permite reintentar', async () => {
    const { c } = setup();
    c.stripe = { confirmPayment: vi.fn().mockResolvedValue({ error: { message: 'Tarjeta rechazada' } }) };
    c.elements = {};

    await c.confirmarPago();

    expect(c.errorPago()).toBe('Tarjeta rechazada');
    expect(c.pagoProcesando()).toBe(false);
    expect(c.estado()).not.toBe('verificando');
  });

  it('tras confirmar, el polling detecta PAGADO, avisa y vuelve a mis citas', async () => {
    vi.useFakeTimers();
    const obtenerPorCita = vi.fn()
      .mockReturnValueOnce(of(pago('PENDIENTE')))
      .mockReturnValue(of(pago('PAGADO')));
    const { c, nav, toastCtrl } = setup({ obtenerPorCita });
    c.stripe = { confirmPayment: vi.fn().mockResolvedValue({}) };
    c.elements = {};

    await c.confirmarPago();
    expect(c.estado()).toBe('verificando');

    await vi.advanceTimersByTimeAsync(2000); // 1ª consulta: PENDIENTE
    expect(c.estado()).toBe('verificando');

    await vi.advanceTimersByTimeAsync(2000); // 2ª consulta: PAGADO
    await vi.advanceTimersByTimeAsync(0);

    expect(toastCtrl.create).toHaveBeenCalled();
    expect(nav).toHaveBeenCalledWith(['/tabs/mis-citas']);

    // El polling queda detenido: no hay más consultas.
    await vi.advanceTimersByTimeAsync(10000);
    expect(obtenerPorCita).toHaveBeenCalledTimes(2);
  });

  it('si el pago no se confirma en 30s pasa a timeout con el polling detenido', async () => {
    vi.useFakeTimers();
    const obtenerPorCita = vi.fn().mockReturnValue(of(pago('PENDIENTE')));
    const { c } = setup({ obtenerPorCita });

    c.iniciarVerificacion();
    await vi.advanceTimersByTimeAsync(30000);

    expect(c.estado()).toBe('timeout');
    const llamadas = obtenerPorCita.mock.calls.length;
    await vi.advanceTimersByTimeAsync(10000);
    expect(obtenerPorCita.mock.calls.length).toBe(llamadas);
  });

  it('ionViewWillLeave detiene el polling', async () => {
    vi.useFakeTimers();
    const obtenerPorCita = vi.fn().mockReturnValue(of(pago('PENDIENTE')));
    const { c } = setup({ obtenerPorCita });

    c.iniciarVerificacion();
    await vi.advanceTimersByTimeAsync(4000);
    expect(obtenerPorCita).toHaveBeenCalledTimes(2);

    c.ionViewWillLeave();
    await vi.advanceTimersByTimeAsync(10000);
    expect(obtenerPorCita).toHaveBeenCalledTimes(2);
  });
});
