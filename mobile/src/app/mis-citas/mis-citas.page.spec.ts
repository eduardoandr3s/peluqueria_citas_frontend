import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AlertController } from '@ionic/angular/standalone';
import { API_URL, Cita, CitaService, PagoService, EstadoCita, Servicio } from '@peluqueria/core';
import { of, throwError } from 'rxjs';
import { MisCitasPage } from './mis-citas.page';

const SERVICIO: Servicio = { idServicio: 1, nombre: 'Corte', precio: 15, duracion: 30, activo: true };

function cita(id: number, fechaHora: string, estado: EstadoCita): Cita {
  return {
    idCita: id,
    usuario: { idUsuario: 1, nombre: 'Ana', email: 'ana@b.com' },
    servicio: SERVICIO,
    fechaHora,
    estado,
  };
}

function setup(cita$: Partial<Record<keyof CitaService, unknown>> = {}) {
  const citaSvc = {
    listar: vi.fn().mockReturnValue(of([])),
    actualizar: vi.fn().mockReturnValue(of({})),
    ...cita$,
  };
  const pagoSvc = {
    obtenerPorCita: vi.fn().mockReturnValue(throwError(() => ({ status: 404 }))),
    crearIntent: vi.fn(),
    registrarManual: vi.fn(),
    reembolsar: vi.fn(),
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'tabs/mis-citas', children: [] },
        { path: '**', children: [] },
      ]),
      { provide: API_URL, useValue: 'http://test/api' },
      { provide: CitaService, useValue: citaSvc },
      { provide: PagoService, useValue: pagoSvc },
      { provide: AlertController, useValue: { create: vi.fn().mockResolvedValue({ present: vi.fn() }) } },
    ],
  });
  const router = TestBed.inject(Router);
  const nav = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const c = TestBed.runInInjectionContext(() => new MisCitasPage()) as any;
  return { c, nav, citaSvc };
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
});
