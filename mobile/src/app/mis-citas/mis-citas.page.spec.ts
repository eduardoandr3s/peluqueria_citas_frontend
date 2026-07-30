import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AlertController } from '@ionic/angular/standalone';
import { API_URL, Cita, CitaService, EstadoCita, PagoService, Servicio } from '@peluqueria/core';
import { Subject, of, throwError } from 'rxjs';
import { FicheroService } from '../core/fichero.service';
import { MisCitasPage } from './mis-citas.page';

const SERVICIO: Servicio = { idServicio: 1, nombre: 'Corte', precio: 15, duracion: 30, activo: true };

function cita(
  id: number,
  fechaHora: string,
  estado: EstadoCita,
  estadoPago?: Cita['estadoPago'],
  idPago?: number,
): Cita {
  return {
    idCita: id,
    usuario: { idUsuario: 1, nombre: 'Ana', email: 'ana@b.com' },
    servicio: SERVICIO,
    fechaHora,
    estado,
    estadoPago,
    idPago,
  };
}

function setup(
  cita$: Partial<Record<keyof CitaService, unknown>> = {},
  extra: { pagoFail?: boolean; ficheroResultado?: unknown } = {},
) {
  const citaSvc = {
    listar: vi.fn().mockReturnValue(of([])),
    actualizar: vi.fn().mockReturnValue(of({})),
    ...cita$,
  };
  const pagoSvc = {
    descargarRecibo: vi
      .fn()
      .mockReturnValue(
        extra.pagoFail
          ? throwError(() => new Error('x'))
          : of(new Blob(['%PDF-1.4'], { type: 'application/pdf' })),
      ),
    nombreRecibo: (id: number) => `recibo-${id}.pdf`,
  };
  // FicheroService va doblado por el proveedor y no con vi.mock: aqui interesa que la
  // pagina lo llame bien, no como guarda el fichero (eso es fichero.service.spec.ts).
  const ficheroSvc = {
    compartir: vi.fn().mockResolvedValue(extra.ficheroResultado ?? { ok: true }),
  };
  const alerta = { present: vi.fn() };
  const alertCtrl = { create: vi.fn().mockResolvedValue(alerta) };

  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'tabs/mis-citas', children: [] },
        { path: '**', children: [] },
      ]),
      { provide: API_URL, useValue: 'http://test/api' },
      { provide: CitaService, useValue: citaSvc },
      { provide: PagoService, useValue: pagoSvc },
      { provide: FicheroService, useValue: ficheroSvc },
      { provide: AlertController, useValue: alertCtrl },
    ],
  });
  const router = TestBed.inject(Router);
  const nav = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const c = TestBed.runInInjectionContext(() => new MisCitasPage()) as any;
  return { c, nav, citaSvc, pagoSvc, ficheroSvc, alertCtrl };
}

describe('MisCitasPage', () => {
  it('cargar ordena pendientes/confirmadas antes que anuladas y por fecha desc dentro del grupo', () => {
    const lista = [
      cita(1, '2026-07-01T10:00:00', 'PENDIENTE'),
      cita(2, '2026-07-05T10:00:00', 'ANULADA'),
      cita(3, '2026-07-02T10:00:00', 'CONFIRMADA'),
      cita(4, '2026-07-10T10:00:00', 'PENDIENTE'),
    ];
    const { c } = setup({ listar: vi.fn().mockReturnValue(of(lista)) });
    c.cargar();
    expect(c.citas().map((x: Cita) => x.idCita)).toEqual([4, 1, 3, 2]);
    expect(c.loading()).toBe(false);
  });

  it('si falla la carga apaga el loading', () => {
    const { c } = setup({ listar: vi.fn().mockReturnValue(throwError(() => new Error('x'))) });
    c.cargar();
    expect(c.loading()).toBe(false);
  });

  it('anular actualiza la cita de forma optimista y llama al backend', () => {
    const actualizar = vi.fn().mockReturnValue(of({}));
    const { c } = setup({ listar: vi.fn().mockReturnValue(of([cita(1, '2026-07-01T10:00:00', 'PENDIENTE')])), actualizar });
    c.cargar();
    c.anular(1);
    expect(c.citas().find((x: Cita) => x.idCita === 1).estado).toBe('ANULADA');
    expect(actualizar).toHaveBeenCalledWith(1, { estado: 'ANULADA' });
  });

  it('si la anulación falla, recarga la lista para revertir', () => {
    const listar = vi.fn()
      .mockReturnValueOnce(of([cita(1, '2026-07-01T10:00:00', 'PENDIENTE')]))
      .mockReturnValueOnce(of([cita(1, '2026-07-01T10:00:00', 'PENDIENTE')]));
    const actualizar = vi.fn().mockReturnValue(throwError(() => new Error('x')));
    const { c } = setup({ listar, actualizar });
    c.cargar();
    c.anular(1);
    expect(listar).toHaveBeenCalledTimes(2); // carga inicial + recarga al fallar
  });

  it('recarga la lista al navegar a /tabs/mis-citas (p. ej. al volver de la pagina de pago)', async () => {
    const listar = vi.fn().mockReturnValue(of([]));
    const { c } = setup({ listar });
    expect(listar).not.toHaveBeenCalled();

    const router = TestBed.inject(Router);
    await router.navigateByUrl('/tabs/mis-citas');
    expect(listar).toHaveBeenCalledTimes(1);

    await router.navigateByUrl('/');
    await router.navigateByUrl('/tabs/mis-citas');
    expect(listar).toHaveBeenCalledTimes(2);
  });

  it('irAgendar navega a la pantalla de agendar', () => {
    const { c, nav } = setup();
    c.irAgendar();
    expect(nav).toHaveBeenCalledWith(['/tabs/agendar']);
  });

  it('colorEstado y labelEstado mapean cada estado', () => {
    const { c } = setup();
    expect(c.colorEstado('PENDIENTE')).toBe('warning');
    expect(c.colorEstado('CONFIRMADA')).toBe('success');
    expect(c.colorEstado('ANULADA')).toBe('medium');
    expect(c.labelEstado('PENDIENTE')).toBe('Pendiente');
    expect(c.labelEstado('ANULADA')).toBe('Anulada');
  });

  it('colorPago y labelPago mapean cada estado de pago', () => {
    const { c } = setup();
    expect(c.colorPago('PAGADO')).toBe('success');
    expect(c.colorPago('PENDIENTE')).toBe('warning');
    expect(c.colorPago('REEMBOLSADO')).toBe('medium');
    expect(c.labelPago('PAGADO')).toBe('Pagado');
    expect(c.labelPago('PENDIENTE')).toBe('Pago pendiente');
  });

  it('el estado de pago viaja en la cita, sin peticiones extra por cita', () => {
    const lista = [cita(1, '2026-07-01T10:00:00', 'CONFIRMADA', 'PAGADO')];
    const { c } = setup({ listar: vi.fn().mockReturnValue(of(lista)) });
    c.cargar();
    expect(c.citas()[0].estadoPago).toBe('PAGADO');
  });

  describe('recibo', () => {
    const pagada = () => cita(1, '2026-07-01T10:00:00', 'CONFIRMADA', 'PAGADO', 7);

    it('solo hay recibo si el pago esta cobrado o reembolsado', () => {
      const { c } = setup();

      expect(c.tieneRecibo(pagada())).toBe(true);
      expect(c.tieneRecibo(cita(2, '2026-07-01T10:00:00', 'CONFIRMADA', 'REEMBOLSADO', 8))).toBe(true);
      expect(c.tieneRecibo(cita(3, '2026-07-01T10:00:00', 'PENDIENTE', 'PENDIENTE', 9))).toBe(false);
      // Sin cita pagada no hay pago, asi que tampoco hay recibo.
      expect(c.tieneRecibo(cita(4, '2026-07-01T10:00:00', 'CONFIRMADA'))).toBe(false);
    });

    it('sin idPago no se pide nada, aunque el estado diga PAGADO', () => {
      const { c, pagoSvc } = setup();
      // Defensivo: un backend viejo podria mandar estadoPago sin idPago.
      const sinId = cita(5, '2026-07-01T10:00:00', 'CONFIRMADA', 'PAGADO');

      expect(c.tieneRecibo(sinId)).toBe(false);
      c.descargarRecibo(sinId);
      expect(pagoSvc.descargarRecibo).not.toHaveBeenCalled();
    });

    it('pide el PDF por el id del PAGO y lo entrega al servicio de ficheros', async () => {
      const { c, pagoSvc, ficheroSvc } = setup();

      c.descargarRecibo(pagada());
      await vi.waitFor(() => expect(c.generandoRecibo()).toBeNull());

      expect(pagoSvc.descargarRecibo).toHaveBeenCalledWith(7);
      expect(ficheroSvc.compartir).toHaveBeenCalledWith(expect.any(Blob), 'recibo-7.pdf');
    });

    it('no lanza dos descargas a la vez', () => {
      const { c, pagoSvc } = setup();
      pagoSvc.descargarRecibo.mockReturnValue(new Subject());

      c.descargarRecibo(pagada());
      c.descargarRecibo(pagada());

      expect(pagoSvc.descargarRecibo).toHaveBeenCalledTimes(1);
      expect(c.generandoRecibo()).toBe(7);
    });

    it('si falla la peticion avisa y deja volver a intentarlo', async () => {
      const { c, alertCtrl } = setup({}, { pagoFail: true });

      c.descargarRecibo(pagada());
      await vi.waitFor(() => expect(alertCtrl.create).toHaveBeenCalled());

      expect(c.generandoRecibo()).toBeNull();
    });

    it('cancelar el dialogo de compartir no avisa de nada', async () => {
      const { c, alertCtrl, ficheroSvc } = setup(
        {},
        { ficheroResultado: { ok: false, motivo: 'cancelado' } },
      );

      c.descargarRecibo(pagada());
      await vi.waitFor(() => expect(ficheroSvc.compartir).toHaveBeenCalled());
      await vi.waitFor(() => expect(c.generandoRecibo()).toBeNull());

      // El usuario acaba de cerrarlo a proposito: avisarle seria ruido.
      expect(alertCtrl.create).not.toHaveBeenCalled();
    });

    it('un fallo al guardar el fichero si avisa', async () => {
      const { c, alertCtrl } = setup({}, { ficheroResultado: { ok: false, motivo: 'error' } });

      c.descargarRecibo(pagada());
      await vi.waitFor(() => expect(alertCtrl.create).toHaveBeenCalled());
    });
  });
});
