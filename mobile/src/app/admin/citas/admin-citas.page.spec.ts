import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActionSheetController, AlertController, ToastController } from '@ionic/angular/standalone';
import {
  AuthService,
  Cita,
  CitaService,
  EstadoCita,
  PeluqueroService,
  PermisoService,
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

function setup(
  overrides: {
    cita?: Partial<Record<keyof CitaService, unknown>>;
    failLoad?: boolean;
    /** Rol de la sesión: un PELUQUERO ve la misma pantalla con menos acciones. */
    rol?: 'ADMIN' | 'PELUQUERO';
    /** Permisos configurables concedidos a la sesión (ver la matriz de «Permisos»). */
    permisos?: string[];
  } = {},
) {
  const toast = { create: vi.fn().mockResolvedValue({ present: vi.fn() }) };
  const rol = overrides.rol ?? 'ADMIN';
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
  const usuarioSvc = { listarTodos: vi.fn().mockReturnValue(of([USUARIO])) };
  const actionSheet = { create: vi.fn().mockResolvedValue({ present: vi.fn() }) };
  const alertCtrl = { create: vi.fn().mockResolvedValue({ present: vi.fn() }) };
  TestBed.configureTestingModule({
    providers: [
      { provide: CitaService, useValue: citaSvc },
      { provide: UsuarioService, useValue: usuarioSvc },
      { provide: ServicioService, useValue: { listar: vi.fn().mockReturnValue(of([SERVICIO])) } },
      { provide: PeluqueroService, useValue: { listar: vi.fn().mockReturnValue(of([])) } },
      { provide: ActionSheetController, useValue: actionSheet },
      { provide: AlertController, useValue: alertCtrl },
      { provide: ToastController, useValue: toast },
      { provide: AuthService, useValue: { isAdmin: signal(rol === 'ADMIN') } },
      {
        // Mockeado y no real: el de verdad pide /api/permisos/mios al construirse y aqui
        // no hay HttpClient. `permisos` son las claves concedidas a la sesion del test.
        provide: PermisoService,
        useValue: {
          puede: (clave: string) => signal((overrides.permisos ?? []).includes(clave)),
        },
      },
    ],
  });
  const c = TestBed.runInInjectionContext(() => new AdminCitasPage()) as any;
  return { c, citaSvc, toast, actionSheet, alertCtrl, usuarioSvc };
}

/** Textos de los botones del último action sheet abierto. */
function opciones(actionSheet: { create: ReturnType<typeof vi.fn> }): string[] {
  return actionSheet.create.mock.calls.at(-1)![0].buttons.map((b: { text: string }) => b.text);
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

  it('cargar trae los días cerrados y esFechaHabilitada los rechaza', () => {
    const { c } = setup();
    c.cargar();
    const habilitada = c.esFechaHabilitada();
    expect(habilitada('2026-07-05')).toBe(false);
    expect(habilitada('2026-07-06')).toBe(true);
  });

  it('onFechaChange recorta el ISO de ion-datetime y recarga los slots', () => {
    const { c, citaSvc } = setup();
    c.cargar();
    c.fServicioId.set(1);
    c.fHora.set('10:00');
    c.onFechaChange('2026-07-06T00:00:00');
    expect(c.fFecha()).toBe('2026-07-06');
    expect(c.fHora()).toBe('');
    expect(citaSvc.disponibilidad).toHaveBeenCalledWith('2026-07-06', 1, undefined);
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
    expect(citaSvc.disponibilidad).toHaveBeenCalledWith('2026-07-01', 1, undefined);
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
    expect(agendar).toHaveBeenCalledWith({ usuarioId: 1, servicioId: 1, peluqueroId: undefined, fechaHora: '2026-07-10T09:00:00' });
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
    expect(actualizar).toHaveBeenCalledWith(1, expect.objectContaining({ peluqueroId: undefined, fechaHora: '2026-07-01T09:30:00' }));
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

  // ── Cierre de cita y rol PELUQUERO ─────────────────────────────────────────

  /** Ejecuta el botón «Cerrar cita» del último alert con los datos que devolvería el form. */
  function confirmarEnAlert(
    alertCtrl: { create: ReturnType<typeof vi.fn> },
    datos: Record<string, unknown> = {},
  ): void {
    const buttons = alertCtrl.create.mock.calls.at(-1)![0].buttons;
    const boton = buttons.find((b: { text: string }) => b.text === 'Cerrar cita');
    boton.handler(datos);
  }

  it('las acciones de una cita abierta incluyen los tres cierres', async () => {
    const { c, actionSheet } = setup();
    await c.abrirAcciones(CITAS[0]);

    expect(opciones(actionSheet)).toEqual([
      'Confirmar',
      'Marcar realizada',
      'No asistió',
      'Reprogramar',
      'Anular',
      'Eliminar',
      'Cancelar',
    ]);
  });

  it('una cita ya cerrada solo ofrece eliminar: el cierre no se reescribe desde aquí', async () => {
    const { c, actionSheet } = setup();
    await c.abrirAcciones(cita(9, '2026-07-09T10:00:00', 'COMPLETADA'));

    expect(opciones(actionSheet)).toEqual(['Eliminar', 'Cancelar']);
  });

  it('un PELUQUERO no pide usuarios: ese 403 se llevaría también sus citas', () => {
    const { c, usuarioSvc } = setup({ rol: 'PELUQUERO' });
    c.cargar();

    expect(usuarioSvc.listarTodos).not.toHaveBeenCalled();
    expect(c.citas().length).toBe(3);
    expect(c.loading()).toBe(false);
  });

  it('un PELUQUERO no ve reprogramar ni eliminar', async () => {
    const { c, actionSheet } = setup({ rol: 'PELUQUERO' });
    await c.abrirAcciones(CITAS[0]);

    expect(opciones(actionSheet)).toEqual([
      'Confirmar',
      'Marcar realizada',
      'No asistió',
      'Anular',
      'Cancelar',
    ]);
    expect(c.esAdmin()).toBe(false);
  });

  it('con CITA_REPROGRAMAR encendido, el peluquero sí ve «Reprogramar»', async () => {
    const { c, actionSheet } = setup({ rol: 'PELUQUERO', permisos: ['CITA_REPROGRAMAR'] });
    await c.abrirAcciones(CITAS[0]);

    expect(opciones(actionSheet)).toEqual([
      'Confirmar',
      'Marcar realizada',
      'No asistió',
      'Reprogramar',
      'Anular',
      'Cancelar',
    ]);
    // El permiso no lo convierte en admin: eliminar sigue fuera.
    expect(c.esAdmin()).toBe(false);
  });

  it('un ADMIN no pasa por la matriz: reprograma con los permisos apagados', async () => {
    const { c, actionSheet } = setup({ rol: 'ADMIN', permisos: [] });
    await c.abrirAcciones(CITAS[0]);

    expect(opciones(actionSheet)).toContain('Reprogramar');
  });

  it('anular manda las observaciones recortadas y el «cliente avisado»', async () => {
    const anulada = { ...CITAS[0], estado: 'ANULADA' as const };
    const cerrar = vi.fn().mockReturnValue(of(anulada));
    const { c, alertCtrl } = setup({ cita: { cerrar } });
    c.cargar();

    await c.pedirCierre(CITAS[0], 'ANULADA');
    confirmarEnAlert(alertCtrl, { observaciones: '  Llamó para cambiar  ', contactado: ['si'] });

    expect(cerrar).toHaveBeenCalledWith(1, {
      estado: 'ANULADA',
      observaciones: 'Llamó para cambiar',
      clienteContactado: true,
    });
    expect(c.citas()[0].estado).toBe('ANULADA');
  });

  it('el «cliente avisado» no se manda en un cierre que no es una anulación', async () => {
    const cerrar = vi.fn().mockReturnValue(of({ ...CITAS[0], estado: 'COMPLETADA' as const }));
    const { c, alertCtrl } = setup({ cita: { cerrar } });

    await c.pedirCierre(CITAS[0], 'COMPLETADA');
    // El checkbox no se pinta en este cierre, así que el alert no devuelve nada suyo.
    const inputs = alertCtrl.create.mock.calls.at(-1)![0].inputs;
    expect(inputs.length).toBe(1);
    confirmarEnAlert(alertCtrl, { observaciones: '' });

    expect(cerrar).toHaveBeenCalledWith(1, {
      estado: 'COMPLETADA',
      observaciones: undefined,
      clienteContactado: false,
    });
  });

  it('avisa antes de marcar realizada una cita sin cobrar', async () => {
    const { c, alertCtrl } = setup();

    await c.pedirCierre(CITAS[0], 'COMPLETADA');

    expect(alertCtrl.create.mock.calls.at(-1)![0].message).toContain('no sumará en la producción');
  });

  it('si la cita está pagada, marcarla realizada dice que contará', async () => {
    const { c, alertCtrl } = setup();
    const pagada = { ...CITAS[0], estadoPago: 'PAGADO' as const };

    await c.pedirCierre(pagada, 'COMPLETADA');

    expect(alertCtrl.create.mock.calls.at(-1)![0].message).toContain('contará en la producción');
  });

  it('anular una cita pagada avisa de que eso no devuelve el dinero', async () => {
    const { c, alertCtrl } = setup();
    const pagada = { ...CITAS[0], estadoPago: 'PAGADO' as const };

    await c.pedirCierre(pagada, 'ANULADA');

    expect(alertCtrl.create.mock.calls.at(-1)![0].message).toContain('no devuelve el dinero');
  });

  it('el error del backend se muestra tal cual: explica por qué no se pudo cerrar', async () => {
    const cerrar = vi
      .fn()
      .mockReturnValue(throwError(() => ({ error: 'La cita ya se cerro como COMPLETADA.' })));
    const { c, alertCtrl, toast } = setup({ cita: { cerrar } });

    await c.pedirCierre(CITAS[0], 'NO_ASISTIO');
    confirmarEnAlert(alertCtrl);

    expect(toast.create).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'La cita ya se cerro como COMPLETADA.', color: 'danger' }),
    );
  });

  it('etiqueta y color cubren los estados nuevos', () => {
    const { c } = setup();
    expect(c.etiqueta('COMPLETADA')).toBe('Realizada');
    expect(c.etiqueta('NO_ASISTIO')).toBe('No asistió');
    expect(c.colorEstado('COMPLETADA')).toBe('primary');
    expect(c.colorEstado('NO_ASISTIO')).toBe('danger');
    expect(c.estaCerrada('CONFIRMADA')).toBe(false);
    expect(c.estaCerrada('NO_ASISTIO')).toBe(true);
  });
});
