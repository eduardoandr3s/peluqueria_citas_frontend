import { TestBed } from '@angular/core/testing';
import { ActionSheetController, AlertController, ToastController } from '@ionic/angular/standalone';
import {
  Cita,
  CitaService,
  EstadoCita,
  Servicio,
  ServicioService,
  Usuario,
  UsuarioService,
} from '@peluqueria/core';
import { of, throwError } from 'rxjs';
import { AdminCitasPage } from './admin-citas.page';

const SERVICIO: Servicio = { idServicio: 1, nombre: 'Corte', precio: 15, duracion: 30, activo: true };
const USUARIO: Usuario = { idUsuario: 1, nombre: 'Ana López', email: 'ana@b.com', rol: 'USER', activo: true };

function cita(id: number, fechaHora: string, estado: EstadoCita, nombre = 'Ana López'): Cita {
  return {
    idCita: id,
    usuario: { idUsuario: 1, nombre, email: 'ana@b.com' },
    servicio: SERVICIO,
    fechaHora,
    estado,
  };
}

const CITAS = [
  cita(1, '2026-07-01T10:00:00', 'PENDIENTE'),
  cita(2, '2026-07-02T11:00:00', 'CONFIRMADA', 'Beto Ruiz'),
  cita(3, '2026-07-03T12:00:00', 'ANULADA'),
];

function setup(overrides: { cita?: Partial<Record<keyof CitaService, unknown>>; failLoad?: boolean } = {}) {
  const toast = { create: vi.fn().mockResolvedValue({ present: vi.fn() }) };
  const citaSvc = {
    listar: vi.fn().mockReturnValue(overrides.failLoad ? throwError(() => new Error('x')) : of([...CITAS])),
    disponibilidad: vi.fn().mockReturnValue(of(['09:00', '09:30'])),
    agendar: vi.fn(),
    actualizar: vi.fn(),
    eliminar: vi.fn(),
    ...overrides.cita,
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: CitaService, useValue: citaSvc },
      { provide: UsuarioService, useValue: { listarTodos: vi.fn().mockReturnValue(of([USUARIO])) } },
      { provide: ServicioService, useValue: { listar: vi.fn().mockReturnValue(of([SERVICIO])) } },
      { provide: ActionSheetController, useValue: { create: vi.fn().mockResolvedValue({ present: vi.fn() }) } },
      { provide: AlertController, useValue: { create: vi.fn().mockResolvedValue({ present: vi.fn() }) } },
      { provide: ToastController, useValue: toast },
    ],
  });
  const c = TestBed.runInInjectionContext(() => new AdminCitasPage()) as any;
  return { c, citaSvc, toast };
}

describe('AdminCitasPage', () => {
  it('cargar trae citas, usuarios y servicios activos', () => {
    const { c } = setup();
    c.cargar();
    expect(c.citas().length).toBe(3);
    expect(c.usuarios().length).toBe(1);
    expect(c.servicios().length).toBe(1);
    expect(c.loading()).toBe(false);
  });

  it('si falla la carga apaga el loading y notifica', () => {
    const { c, toast } = setup({ failLoad: true });
    c.cargar();
    expect(c.loading()).toBe(false);
    expect(toast.create).toHaveBeenCalled();
  });

  it('contar cuenta por estado y TODAS', () => {
    const { c } = setup();
    c.cargar();
    expect(c.contar('TODAS')).toBe(3);
    expect(c.contar('PENDIENTE')).toBe(1);
    expect(c.contar('ANULADA')).toBe(1);
  });

  it('filtered filtra por estado, por texto y ordena ascendente', () => {
    const { c } = setup();
    c.cargar();
    c.estadoFiltro.set('CONFIRMADA');
    expect(c.filtered().map((x: Cita) => x.idCita)).toEqual([2]);
    c.estadoFiltro.set('TODAS');
    c.search.set('beto');
    expect(c.filtered().map((x: Cita) => x.idCita)).toEqual([2]);
    c.search.set('');
    expect(c.filtered().map((x: Cita) => x.idCita)).toEqual([1, 2, 3]);
  });

  it('colorEstado devuelve el color de cada estado', () => {
    const { c } = setup();
    expect(c.colorEstado('CONFIRMADA')).toBe('success');
    expect(c.colorEstado('ANULADA')).toBe('medium');
    expect(c.colorEstado('PENDIENTE')).toBe('warning');
  });

  it('abrirAgendar limpia el formulario y abre el modal', () => {
    const { c } = setup();
    c.abrirAgendar();
    expect(c.editando()).toBeNull();
    expect(c.fUsuarioId()).toBeNull();
    expect(c.formOpen()).toBe(true);
  });

  it('abrirEditar precarga los datos de la cita y pide disponibilidad', () => {
    const { c, citaSvc } = setup();
    c.abrirEditar(CITAS[0]);
    expect(c.editando()?.idCita).toBe(1);
    expect(c.fUsuarioId()).toBe(1);
    expect(c.fFecha()).toBe('2026-07-01');
    expect(c.fHora()).toBe('10:00');
    expect(citaSvc.disponibilidad).toHaveBeenCalledWith('2026-07-01', 1);
  });

  it('usuariosForm añade el cliente de la cita editada si no está en la lista', () => {
    const { c } = setup();
    c.cargar();
    c.abrirEditar(cita(7, '2026-07-07T10:00:00', 'PENDIENTE', 'Carlos Fuera'));
    c.editando.set({ ...c.editando(), usuario: { idUsuario: 99, nombre: 'Carlos Fuera', email: 'c@b.com' } });
    expect(c.usuariosForm().some((u: Usuario) => u.idUsuario === 99)).toBe(true);
  });

  it('slotsMostrados añade la hora actual al reprogramar si no está libre', () => {
    const { c } = setup();
    c.abrirEditar(cita(5, '2026-07-05T16:45:00', 'PENDIENTE'));
    c.slots.set(['09:00', '09:30']);
    expect(c.slotsMostrados()).toContain('16:45');
  });

  it('guardar sin datos completos muestra formError', () => {
    const { c } = setup();
    c.abrirAgendar();
    c.guardar();
    expect(c.formError()).toContain('Completa');
  });

  it('guardar (agendar) compone fechaHora y añade la cita', () => {
    const nueva = cita(99, '2026-07-10T09:00:00', 'PENDIENTE');
    const agendar = vi.fn().mockReturnValue(of(nueva));
    const { c } = setup({ cita: { agendar } });
    c.abrirAgendar();
    c.fUsuarioId.set(1);
    c.fServicioId.set(1);
    c.fFecha.set('2026-07-10');
    c.fHora.set('09:00');
    c.guardar();
    expect(agendar).toHaveBeenCalledWith({ usuarioId: 1, servicioId: 1, fechaHora: '2026-07-10T09:00:00' });
    expect(c.citas().some((x: Cita) => x.idCita === 99)).toBe(true);
    expect(c.formOpen()).toBe(false);
  });

  it('guardar (reprogramar) actualiza la cita existente', () => {
    const actualizada = { ...CITAS[0], fechaHora: '2026-07-01T09:30:00' };
    const actualizar = vi.fn().mockReturnValue(of(actualizada));
    const { c } = setup({ cita: { actualizar } });
    c.cargar();
    c.abrirEditar(CITAS[0]);
    c.fHora.set('09:30');
    c.guardar();
    expect(actualizar).toHaveBeenCalledWith(1, expect.objectContaining({ fechaHora: '2026-07-01T09:30:00' }));
    expect(c.citas().find((x: Cita) => x.idCita === 1).fechaHora).toBe('2026-07-01T09:30:00');
  });

  it('guardar con 409 muestra que el horario no está disponible', () => {
    const agendar = vi.fn().mockReturnValue(throwError(() => ({ status: 409 })));
    const { c } = setup({ cita: { agendar } });
    c.abrirAgendar();
    c.fUsuarioId.set(1);
    c.fServicioId.set(1);
    c.fFecha.set('2026-07-10');
    c.fHora.set('09:00');
    c.guardar();
    expect(c.formError()).toContain('ya no está disponible');
    expect(c.saving()).toBe(false);
  });

  it('cambiarEstado actualiza la cita y notifica', () => {
    const confirmada = { ...CITAS[0], estado: 'CONFIRMADA' as const };
    const actualizar = vi.fn().mockReturnValue(of(confirmada));
    const { c, toast } = setup({ cita: { actualizar } });
    c.cargar();
    c.cambiarEstado(CITAS[0], 'CONFIRMADA');
    expect(actualizar).toHaveBeenCalledWith(1, { estado: 'CONFIRMADA' });
    expect(c.citas().find((x: Cita) => x.idCita === 1).estado).toBe('CONFIRMADA');
    expect(toast.create).toHaveBeenCalled();
  });

  it('esHoraActual detecta la hora de la cita en edición', () => {
    const { c } = setup();
    c.abrirEditar(cita(5, '2026-07-05T16:45:00', 'PENDIENTE'));
    expect(c.esHoraActual('16:45')).toBe(true);
    expect(c.esHoraActual('09:00')).toBe(false);
  });
});
