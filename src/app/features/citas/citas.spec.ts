import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import {
  AuthService,
  Cita,
  CitaService,
  PagoService,
  Servicio,
  ServicioService,
  Usuario,
  UsuarioService,
} from '@peluqueria/core';
import { of, throwError } from 'rxjs';
import { PeluqueroService } from '@peluqueria/core';
import { Citas } from './citas';

const SERVICIO: Servicio = { idServicio: 1, nombre: 'Corte', precio: 15, duracion: 30, activo: true };
const USUARIO: Usuario = { idUsuario: 1, nombre: 'Ana López', email: 'ana@b.com', rol: 'USER' };

function cita(
  id: number,
  fechaHora: string,
  estado: Cita['estado'],
  nombre = 'Ana López',
  estadoPago?: Cita['estadoPago'],
): Cita {
  return {
    idCita: id,
    usuario: { idUsuario: 1, nombre, email: 'ana@b.com' },
    servicio: SERVICIO,
    fechaHora,
    estado,
    estadoPago,
  };
}

const CITAS: Cita[] = [
  cita(1, '2026-07-01T10:00:00', 'PENDIENTE'),
  cita(2, '2026-07-02T11:00:00', 'CONFIRMADA', 'Beto Ruiz'),
  cita(3, '2026-07-03T12:00:00', 'ANULADA'),
];

function setup(overrides: {
  cita?: Partial<Record<keyof CitaService, unknown>>;
  failLoad?: boolean;
  pago?: Partial<Record<keyof PagoService, unknown>>;
  /** Rol de la sesión. Un PELUQUERO ve la misma pantalla con menos acciones. */
  rol?: 'ADMIN' | 'PELUQUERO';
}) {
  const citaSvc = {
    listar: vi.fn().mockReturnValue(overrides.failLoad ? throwError(() => new Error('x')) : of([...CITAS])),
    disponibilidad: vi.fn().mockReturnValue(of(['09:00', '09:30'])),
    diasCerrados: vi.fn().mockReturnValue(of([{ fecha: '2026-07-05', motivo: 'Cerrado (domingo)' }])),
    agendar: vi.fn(),
    actualizar: vi.fn(),
    cerrar: vi.fn(),
    eliminar: vi.fn(),
    ...overrides.cita,
  };
  const rol = overrides.rol ?? 'ADMIN';
  const usuarioSvc = { listarTodos: vi.fn().mockReturnValue(of([USUARIO])) };
  const pagoSvc = {
    registrarManual: vi.fn(),
    reembolsar: vi.fn(),
    ...overrides.pago,
  };
  TestBed.configureTestingModule({
    imports: [Citas],
    providers: [
      { provide: CitaService, useValue: citaSvc },
      { provide: PagoService, useValue: pagoSvc },
      { provide: UsuarioService, useValue: usuarioSvc },
      { provide: ServicioService, useValue: { listar: vi.fn().mockReturnValue(of([SERVICIO])) } },
      { provide: PeluqueroService, useValue: { listar: vi.fn().mockReturnValue(of([])) } },
      {
        provide: AuthService,
        useValue: {
          user: signal({ nombre: 'Ana Ruiz', email: 'ana@test.com', rol }),
          isAdmin: signal(rol === 'ADMIN'),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(Citas);
  fixture.detectChanges(); // ngOnInit -> cargar (forkJoin)
  const c = fixture.componentInstance as any;
  return { fixture, c, citaSvc, usuarioSvc };
}

/** Botón de una fila de la tabla, por su texto exacto (el de la primera cita listada). */
function botonEnTabla(fixture: ComponentFixture<Citas>, texto: string): HTMLButtonElement | undefined {
  return Array.from(fixture.nativeElement.querySelectorAll('table button')).find(
    (b) => (b as HTMLElement).textContent?.trim() === texto,
  ) as HTMLButtonElement | undefined;
}

/** Botón de un modal abierto, por su texto exacto. */
function botonEnModal(fixture: ComponentFixture<Citas>, texto: string): HTMLButtonElement | undefined {
  return Array.from(fixture.nativeElement.querySelectorAll('.fixed button')).find(
    (b) => (b as HTMLElement).textContent?.trim() === texto,
  ) as HTMLButtonElement | undefined;
}

describe('Citas', () => {
  it('carga citas, usuarios y servicios', () => {
    const { c } = setup({});
    expect(c.citas().length).toBe(3);
    expect(c.usuarios().length).toBe(1);
    expect(c.servicios().length).toBe(1);
    expect(c.loading()).toBe(false);
  });

  it('si falla la carga muestra loadError', () => {
    const { c } = setup({ failLoad: true });
    expect(c.loadError()).toContain('No se pudieron cargar');
  });

  it('contar cuenta por estado y TODAS', () => {
    const { c } = setup({});
    expect(c.contar('TODAS')).toBe(3);
    expect(c.contar('PENDIENTE')).toBe(1);
    expect(c.contar('ANULADA')).toBe(1);
  });

  it('filtered filtra por estado, por texto y ordena ascendente', () => {
    const { c } = setup({});
    c.estadoFiltro.set('CONFIRMADA');
    expect(c.filtered().map((x: Cita) => x.idCita)).toEqual([2]);

    c.estadoFiltro.set('TODAS');
    c.search.set('beto');
    expect(c.filtered().map((x: Cita) => x.idCita)).toEqual([2]);

    c.search.set('');
    expect(c.filtered().map((x: Cita) => x.idCita)).toEqual([1, 2, 3]); // por fecha asc
  });

  it('horaFin suma la duración del servicio', () => {
    const { c } = setup({});
    expect(c.horaFin(cita(1, '2026-07-01T10:00:00', 'PENDIENTE'))).toBe('10:30');
  });

  it('estadoClass devuelve clases por estado', () => {
    const { c } = setup({});
    expect(c.estadoClass('CONFIRMADA')).toContain('success');
    expect(c.estadoClass('ANULADA')).toContain('muted');
    expect(c.estadoClass('PENDIENTE')).toContain('warning');
  });

  it('slotsMostrados añade la hora actual al reprogramar si no está entre las libres', () => {
    const { c } = setup({});
    c.abrirEditar(cita(5, '2026-07-05T16:45:00', 'PENDIENTE'));
    c.slots.set(['09:00', '09:30']);
    expect(c.slotsMostrados()).toContain('16:45');
  });

  it('guardar (agendar) compone fechaHora y añade la cita', () => {
    const nueva = cita(99, '2026-07-10T09:00:00', 'PENDIENTE');
    const agendar = vi.fn().mockReturnValue(of(nueva));
    const { c } = setup({ cita: { agendar } });
    c.abrirAgendar();
    c.form.setValue({ usuarioId: 1, servicioId: 1, peluqueroId: null, fecha: '2026-07-10', hora: '09:00' });
    c.guardar();
    expect(agendar).toHaveBeenCalledWith({ usuarioId: 1, servicioId: 1, peluqueroId: undefined, fechaHora: '2026-07-10T09:00:00' });
    expect(c.citas().some((x: Cita) => x.idCita === 99)).toBe(true);
    expect(c.feedback().type).toBe('success');
  });

  it('guardar (reprogramar) actualiza la cita existente', () => {
    const actualizada = { ...CITAS[0], fechaHora: '2026-07-01T09:30:00' };
    const actualizar = vi.fn().mockReturnValue(of(actualizada));
    const { c } = setup({ cita: { actualizar } });
    c.abrirEditar(CITAS[0]);
    c.form.patchValue({ hora: '09:30' });
    c.guardar();
    expect(actualizar).toHaveBeenCalledWith(1, expect.objectContaining({ fechaHora: '2026-07-01T09:30:00' }));
    expect(c.citas().find((x: Cita) => x.idCita === 1).fechaHora).toBe('2026-07-01T09:30:00');
  });

  it('guardar con error muestra formError', () => {
    const agendar = vi.fn().mockReturnValue(throwError(() => ({ error: { error: 'Horario ocupado' } })));
    const { c } = setup({ cita: { agendar } });
    c.abrirAgendar();
    c.form.setValue({ usuarioId: 1, servicioId: 1, peluqueroId: null, fecha: '2026-07-10', hora: '09:00' });
    c.guardar();
    expect(c.formError()).toBe('Horario ocupado');
    expect(c.saving()).toBe(false);
  });

  it('cambiarEstado actualiza la cita y muestra feedback', () => {
    const confirmada = { ...CITAS[0], estado: 'CONFIRMADA' as const };
    const actualizar = vi.fn().mockReturnValue(of(confirmada));
    const { c } = setup({ cita: { actualizar } });
    c.cambiarEstado(CITAS[0], 'CONFIRMADA');
    expect(actualizar).toHaveBeenCalledWith(1, { estado: 'CONFIRMADA' });
    expect(c.citas().find((x: Cita) => x.idCita === 1).estado).toBe('CONFIRMADA');
    expect(c.busyId()).toBeNull();
  });

  it('anular va por el cierre, no por el PUT: el backend rechazaría los otros estados ahí', () => {
    const anulada = { ...CITAS[0], estado: 'ANULADA' as const };
    const cerrar = vi.fn().mockReturnValue(of(anulada));
    const actualizar = vi.fn();
    const { c } = setup({ cita: { cerrar, actualizar } });

    c.abrirCierre(CITAS[0], 'ANULADA');
    c.observacionesCierre.set('  Llamó para cambiar de día  ');
    c.clienteContactado.set(true);
    c.confirmarCierre(CITAS[0]);

    expect(cerrar).toHaveBeenCalledWith(1, {
      estado: 'ANULADA',
      observaciones: 'Llamó para cambiar de día',
      clienteContactado: true,
    });
    expect(actualizar).not.toHaveBeenCalled();
    expect(c.citas()[0].estado).toBe('ANULADA');
  });

  it('cerrar como realizada manda COMPLETADA y no arrastra el «cliente avisado»', () => {
    const completada = { ...CITAS[0], estado: 'COMPLETADA' as const };
    const cerrar = vi.fn().mockReturnValue(of(completada));
    const { c } = setup({ cita: { cerrar } });

    c.abrirCierre(CITAS[0], 'COMPLETADA');
    c.clienteContactado.set(true); // pertenece a la anulación
    c.confirmarCierre(CITAS[0]);

    expect(cerrar).toHaveBeenCalledWith(1, {
      estado: 'COMPLETADA',
      observaciones: undefined,
      clienteContactado: false,
    });
  });

  it('«Anular» de la tabla abre el cierre y no anula hasta aceptarlo', () => {
    const cerrar = vi.fn().mockReturnValue(of({ ...CITAS[0], estado: 'ANULADA' as const }));
    const { fixture } = setup({ cita: { cerrar } });

    botonEnTabla(fixture, 'Anular')!.click();
    fixture.detectChanges();

    expect(cerrar).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('el hueco queda libre');

    botonEnModal(fixture, 'Cerrar cita')!.click();
    fixture.detectChanges();

    expect(cerrar).toHaveBeenCalledWith(1, {
      estado: 'ANULADA',
      observaciones: undefined,
      clienteContactado: false,
    });
  });

  it('el error del cierre se queda dentro del modal, que sigue abierto para corregir', () => {
    const cerrar = vi.fn().mockReturnValue(
      throwError(() => ({ error: 'La cita ya se cerro como COMPLETADA.' })),
    );
    const { c } = setup({ cita: { cerrar } });

    c.abrirCierre(CITAS[0], 'NO_ASISTIO');
    c.confirmarCierre(CITAS[0]);

    expect(c.cierreError()).toContain('ya se cerro');
    expect(c.pendingCierre()).not.toBeNull();
    expect(c.feedback()).toBeNull();
  });

  it('una cita ya cerrada no ofrece cerrar, anular ni reprogramar', () => {
    const { fixture, c } = setup({});
    c.citas.set([cita(9, '2026-07-09T10:00:00', 'COMPLETADA')]);
    fixture.detectChanges();

    expect(botonEnTabla(fixture, 'Cerrar')).toBeUndefined();
    expect(botonEnTabla(fixture, 'Anular')).toBeUndefined();
    expect(botonEnTabla(fixture, 'Reprogramar')).toBeUndefined();
  });

  it('un PELUQUERO no pide la lista de usuarios: es de ADMIN y el 403 tumbaría las citas', () => {
    const { c, usuarioSvc } = setup({ rol: 'PELUQUERO' });

    expect(usuarioSvc.listarTodos).not.toHaveBeenCalled();
    // Y las citas sí llegan: es lo que el forkJoin se llevaba por delante.
    expect(c.citas().length).toBe(3);
  });

  it('un ADMIN sí la pide: la necesita el formulario de agendar', () => {
    const { usuarioSvc } = setup({ rol: 'ADMIN' });
    expect(usuarioSvc.listarTodos).toHaveBeenCalledOnce();
  });

  it('un PELUQUERO solo ve confirmar, cerrar y anular: ni caja ni agendar ni borrar', () => {
    const { fixture } = setup({ rol: 'PELUQUERO' });

    expect(fixture.nativeElement.textContent).toContain('Mi agenda');
    expect(botonEnTabla(fixture, 'Confirmar')).toBeDefined();
    expect(botonEnTabla(fixture, 'Cerrar')).toBeDefined();
    expect(botonEnTabla(fixture, 'Anular')).toBeDefined();
    expect(botonEnTabla(fixture, 'Pago manual')).toBeUndefined();
    expect(botonEnTabla(fixture, 'Reprogramar')).toBeUndefined();
    expect(botonEnTabla(fixture, 'Eliminar')).toBeUndefined();
    const agendar = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
      (b: any) => b.textContent?.trim() === 'Agendar cita',
    );
    expect(agendar).toBeUndefined();
  });

  it('avisa de que completar una cita sin cobrar no sumará en la producción', () => {
    const { fixture, c } = setup({});
    c.citas.set([cita(9, '2026-07-09T10:00:00', 'CONFIRMADA', 'Ana López', 'PENDIENTE')]);
    fixture.detectChanges();

    botonEnTabla(fixture, 'Cerrar')!.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('no sumará en la producción');
  });

  it('«Eliminar» de la tabla pide confirmación y no borra hasta aceptarla', () => {
    const eliminar = vi.fn().mockReturnValue(of(undefined));
    const { fixture } = setup({ cita: { eliminar } });

    botonEnTabla(fixture, 'Eliminar')!.click();
    fixture.detectChanges();

    expect(eliminar).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('no se puede deshacer');

    botonEnModal(fixture, 'Eliminar')!.click();
    fixture.detectChanges();

    expect(eliminar).toHaveBeenCalledWith(1);
  });

  it('cancelar el cierre lo descarta sin tocar nada', () => {
    const cerrar = vi.fn();
    const { fixture, c } = setup({ cita: { cerrar } });

    botonEnTabla(fixture, 'Anular')!.click();
    fixture.detectChanges();
    botonEnModal(fixture, 'Cancelar')!.click();
    fixture.detectChanges();

    expect(c.pendingCierre()).toBeNull();
    expect(cerrar).not.toHaveBeenCalled();
  });

  it('eliminar quita la cita de la lista', () => {
    const eliminar = vi.fn().mockReturnValue(of(undefined));
    const { c } = setup({ cita: { eliminar } });
    c.eliminar(CITAS[1]);
    expect(eliminar).toHaveBeenCalledWith(2);
    expect(c.citas().some((x: Cita) => x.idCita === 2)).toBe(false);
  });

  it('un error en una acción muestra feedback de error', () => {
    const eliminar = vi.fn().mockReturnValue(throwError(() => ({ error: 'Boom' })));
    const { c } = setup({ cita: { eliminar } });
    c.eliminar(CITAS[0]);
    expect(c.feedback()).toEqual({ type: 'error', text: 'Boom' });
    expect(c.busyId()).toBeNull();
  });

  // ── Selector de peluquero ─────────────────────────────────────────────

  it('al elegir un peluquero recarga los slots pasando ese peluqueroId', () => {
    const disponibilidad = vi.fn().mockReturnValue(of(['09:00', '09:30']));
    const { c } = setup({ cita: { disponibilidad } });
    c.abrirAgendar();
    c.form.patchValue({ servicioId: 1, fecha: '2026-07-10', peluqueroId: 2 });
    disponibilidad.mockClear();
    c.onContextoSlotsCambio();
    expect(disponibilidad).toHaveBeenCalledWith('2026-07-10', 1, 2);
  });

  it('con «Cualquiera» (sin peluquero) pide disponibilidad sin peluqueroId', () => {
    const disponibilidad = vi.fn().mockReturnValue(of(['09:00', '09:30']));
    const { c } = setup({ cita: { disponibilidad } });
    c.abrirAgendar();
    c.form.patchValue({ servicioId: 1, fecha: '2026-07-10', peluqueroId: null });
    disponibilidad.mockClear();
    c.onContextoSlotsCambio();
    expect(disponibilidad).toHaveBeenCalledWith('2026-07-10', 1, undefined);
  });

  // ── Pagos ─────────────────────────────────────────────────────────────

  it('puedePagoManual true sin pago o con pago pendiente', () => {
    const { c } = setup({});
    expect(c.puedePagoManual(cita(1, '2026-07-01T10:00:00', 'PENDIENTE'))).toBe(true);
    expect(c.puedePagoManual(cita(1, '2026-07-01T10:00:00', 'PENDIENTE', 'Ana López', 'PENDIENTE'))).toBe(true);
  });

  it('puedePagoManual false con pago PAGADO', () => {
    const { c } = setup({});
    expect(c.puedePagoManual(cita(1, '2026-07-01T10:00:00', 'CONFIRMADA', 'Ana López', 'PAGADO'))).toBe(false);
  });

  it('puedeReembolsar true con pago PAGADO', () => {
    const { c } = setup({});
    expect(c.puedeReembolsar(cita(1, '2026-07-01T10:00:00', 'CONFIRMADA', 'Ana López', 'PAGADO'))).toBe(true);
    expect(c.puedeReembolsar(cita(1, '2026-07-01T10:00:00', 'PENDIENTE'))).toBe(false);
  });

  it('registrarPagoManual llama al servicio, actualiza la cita con su estadoPago, y muestra feedback', () => {
    const pagoResp = {
      idPago: 2, citaId: 1, monto: 15, metodoPago: 'EFECTIVO',
      estadoPago: 'PAGADO', referenciaExterna: null, fechaCreacion: '', fechaPago: '',
    };
    const registrarManual = vi.fn().mockReturnValue(of(pagoResp));
    const { c } = setup({ pago: { registrarManual } });

    c.abrirPagoManual(CITAS[0]);
    expect(c.pendingPagoManual()).toEqual(CITAS[0]);

    c.registrarPagoManual(CITAS[0]);
    expect(registrarManual).toHaveBeenCalledWith(1, 'EFECTIVO');
    const actualizada = c.citas().find((x: Cita) => x.idCita === 1);
    expect(actualizada?.estado).toBe('CONFIRMADA');
    expect(actualizada?.estadoPago).toBe('PAGADO');
    expect(c.feedback().type).toBe('success');
  });

  it('una cita ANULADA con pago PAGADO sigue ofreciendo «Reembolsar» y ninguna otra acción de gestión', () => {
    const { fixture, c } = setup({});
    c.citas.set([cita(9, '2026-07-09T10:00:00', 'ANULADA', 'Ana López', 'PAGADO')]);
    fixture.detectChanges();

    expect(botonEnTabla(fixture, 'Reembolsar')).toBeTruthy();
    expect(botonEnTabla(fixture, 'Pago manual')).toBeUndefined();
    expect(botonEnTabla(fixture, 'Reprogramar')).toBeUndefined();
    expect(botonEnTabla(fixture, 'Anular')).toBeUndefined();
  });

  it('el modal de reembolso de una cita anulada no pide anularla aparte', () => {
    const { fixture, c } = setup({});
    c.citas.set([cita(9, '2026-07-09T10:00:00', 'ANULADA', 'Ana López', 'PAGADO')]);
    fixture.detectChanges();

    botonEnTabla(fixture, 'Reembolsar')!.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('La cita ya está anulada');
    expect(fixture.nativeElement.textContent).not.toContain('anúlala aparte');
  });

  it('reembolsar llama al servicio y marca la cita como REEMBOLSADO', () => {
    const reembolsar = vi.fn().mockReturnValue(of(undefined));
    const { c } = setup({ pago: { reembolsar } });

    c.reembolsar(CITAS[0]);
    expect(reembolsar).toHaveBeenCalledWith(1);
    expect(c.citas().find((x: Cita) => x.idCita === 1)?.estadoPago).toBe('REEMBOLSADO');
    expect(c.feedback().type).toBe('success');
  });

  it('reembolsar con error muestra mensaje de error', () => {
    const reembolsar = vi.fn().mockReturnValue(
      throwError(() => ({ error: { error: 'No se puede reembolsar' } })),
    );
    const { c } = setup({ pago: { reembolsar } });

    c.reembolsar(CITAS[0]);
    expect(c.reembolsoError()).toBe('No se puede reembolsar');
    expect(c.reembolsoSaving()).toBe(false);
  });
});
