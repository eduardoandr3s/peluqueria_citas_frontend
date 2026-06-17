import { TestBed } from '@angular/core/testing';
import {
  Cita,
  CitaService,
  Servicio,
  ServicioService,
  Usuario,
  UsuarioService,
} from '@peluqueria/core';
import { of, throwError } from 'rxjs';
import { Citas } from './citas';

const SERVICIO: Servicio = { idServicio: 1, nombre: 'Corte', precio: 15, duracion: 30, activo: true };
const USUARIO: Usuario = { idUsuario: 1, nombre: 'Ana López', email: 'ana@b.com', rol: 'USER' };

function cita(id: number, fechaHora: string, estado: Cita['estado'], nombre = 'Ana López'): Cita {
  return {
    idCita: id,
    usuario: { idUsuario: 1, nombre, email: 'ana@b.com' },
    servicio: SERVICIO,
    fechaHora,
    estado,
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
}) {
  const citaSvc = {
    listar: vi.fn().mockReturnValue(overrides.failLoad ? throwError(() => new Error('x')) : of([...CITAS])),
    disponibilidad: vi.fn().mockReturnValue(of(['09:00', '09:30'])),
    agendar: vi.fn(),
    actualizar: vi.fn(),
    eliminar: vi.fn(),
    ...overrides.cita,
  };
  TestBed.configureTestingModule({
    imports: [Citas],
    providers: [
      { provide: CitaService, useValue: citaSvc },
      { provide: UsuarioService, useValue: { listarTodos: vi.fn().mockReturnValue(of([USUARIO])) } },
      { provide: ServicioService, useValue: { listar: vi.fn().mockReturnValue(of([SERVICIO])) } },
    ],
  });
  const fixture = TestBed.createComponent(Citas);
  fixture.detectChanges(); // ngOnInit -> cargar (forkJoin)
  const c = fixture.componentInstance as any;
  return { fixture, c, citaSvc };
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
    c.form.setValue({ usuarioId: 1, servicioId: 1, fecha: '2026-07-10', hora: '09:00' });
    c.guardar();
    expect(agendar).toHaveBeenCalledWith({ usuarioId: 1, servicioId: 1, fechaHora: '2026-07-10T09:00:00' });
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
    c.form.setValue({ usuarioId: 1, servicioId: 1, fecha: '2026-07-10', hora: '09:00' });
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

  it('anular marca la cita como ANULADA', () => {
    const anulada = { ...CITAS[0], estado: 'ANULADA' as const };
    const actualizar = vi.fn().mockReturnValue(of(anulada));
    const { c } = setup({ cita: { actualizar } });
    c.anular(CITAS[0]);
    expect(actualizar).toHaveBeenCalledWith(1, { estado: 'ANULADA' });
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
});
