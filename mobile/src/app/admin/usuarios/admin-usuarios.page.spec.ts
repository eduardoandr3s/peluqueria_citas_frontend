import { TestBed } from '@angular/core/testing';
import { ActionSheetController, AlertController, ToastController } from '@ionic/angular/standalone';
import { Page, Usuario, UsuarioService } from '@peluqueria/core';
import { of, throwError } from 'rxjs';
import { AdminUsuariosPage } from './admin-usuarios.page';

const ME: Usuario = { idUsuario: 1, nombre: 'Eduardo', email: 'me@b.com', rol: 'ADMIN', activo: true };
const OTRO: Usuario = { idUsuario: 2, nombre: 'Ana', email: 'ana@b.com', rol: 'USER', activo: true };

function page(content: Usuario[], last = true): Page<Usuario> {
  return { content, totalElements: content.length, totalPages: last ? 1 : 2, number: 0, size: 20, first: true, last };
}

function setup(svc: Partial<Record<keyof UsuarioService, unknown>> = {}) {
  const toast = { create: vi.fn().mockResolvedValue({ present: vi.fn() }) };
  // Captura las opciones del último alert para poder invocar sus handlers.
  let lastAlert: any = null;
  const alertCtrl = {
    create: vi.fn().mockImplementation((opts: any) => {
      lastAlert = opts;
      return Promise.resolve({ present: vi.fn() });
    }),
  };
  const usuarioSvc = {
    listar: vi.fn().mockReturnValue(of(page([ME, OTRO]))),
    crear: vi.fn(),
    actualizar: vi.fn(),
    eliminar: vi.fn(),
    cambiarRol: vi.fn(),
    activar: vi.fn(),
    ...svc,
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: UsuarioService, useValue: usuarioSvc },
      { provide: ActionSheetController, useValue: { create: vi.fn().mockResolvedValue({ present: vi.fn() }) } },
      { provide: AlertController, useValue: alertCtrl },
      { provide: ToastController, useValue: toast },
    ],
  });
  const c = TestBed.runInInjectionContext(() => new AdminUsuariosPage()) as any;
  // `datos` es lo que el alert pasa al handler: el valor del radio elegido, o los campos
  // del formulario en los alerts que los tienen.
  const pulsar = (text: string, datos?: unknown) =>
    lastAlert.buttons.find((b: any) => b.text === text).handler(datos);
  return { c, usuarioSvc: usuarioSvc as any, toast, pulsar, alertCtrl };
}

describe('AdminUsuariosPage', () => {
  it('recargar carga la primera página', () => {
    const { c } = setup();
    c.recargar();
    expect(c.usuarios().length).toBe(2);
    expect(c.last()).toBe(true);
    expect(c.loading()).toBe(false);
  });

  it('si falla la carga apaga el loading y notifica', () => {
    const { c, toast } = setup({ listar: vi.fn().mockReturnValue(throwError(() => new Error('x'))) });
    c.recargar();
    expect(c.loading()).toBe(false);
    expect(toast.create).toHaveBeenCalled();
  });

  it('cargarMas anexa la siguiente página y respeta last', () => {
    const listar = vi.fn()
      .mockReturnValueOnce(of(page([ME], false)))
      .mockReturnValueOnce(of(page([OTRO], true)));
    const { c } = setup({ listar });
    c.recargar();
    const evt = { target: { complete: vi.fn() } } as any;
    c.cargarMas(evt);
    expect(c.usuarios().map((u: Usuario) => u.idUsuario)).toEqual([1, 2]);
    expect(c.last()).toBe(true);
    expect(evt.target.complete).toHaveBeenCalled();
  });

  it('onSearch reinicia la búsqueda y recarga', () => {
    const { c, usuarioSvc } = setup();
    c.onSearch('ana');
    expect(c.search()).toBe('ana');
    expect(usuarioSvc.listar).toHaveBeenLastCalledWith(expect.objectContaining({ page: 0, search: 'ana' }));
  });

  it('onToggleInactivos recarga incluyendo inactivos', () => {
    const { c, usuarioSvc } = setup();
    c.onToggleInactivos(true);
    expect(c.incluirInactivos()).toBe(true);
    expect(usuarioSvc.listar).toHaveBeenLastCalledWith(expect.objectContaining({ incluirInactivos: true }));
  });

  it('guardar (crear) sin nombre/email muestra formError', () => {
    const { c, usuarioSvc } = setup();
    c.abrirCrear();
    c.guardar();
    expect(c.formError()).toContain('obligatorios');
    expect(usuarioSvc.crear).not.toHaveBeenCalled();
  });

  it('guardar (crear) con contraseña corta muestra formError', () => {
    const { c } = setup();
    c.abrirCrear();
    c.fNombre.set('Nuevo');
    c.fEmail.set('n@b.com');
    c.fPassword.set('123');
    c.guardar();
    expect(c.formError()).toContain('6 caracteres');
  });

  it('guardar (crear) correcto llama a crear y recarga', () => {
    const crear = vi.fn().mockReturnValue(of(OTRO));
    const { c, usuarioSvc } = setup({ crear });
    c.abrirCrear();
    c.fNombre.set('Nuevo');
    c.fEmail.set('n@b.com');
    c.fPassword.set('secreta');
    usuarioSvc.listar.mockClear();
    c.guardar();
    expect(crear).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Nuevo', email: 'n@b.com', password: 'secreta' }));
    expect(c.formOpen()).toBe(false);
    expect(usuarioSvc.listar).toHaveBeenCalled();
  });

  it('guardar (editar) omite la contraseña si está vacía', () => {
    const actualizar = vi.fn().mockReturnValue(of(OTRO));
    const { c } = setup({ actualizar });
    c.abrirEditar(OTRO);
    c.fNombre.set('Ana Editada');
    c.guardar();
    expect(actualizar).toHaveBeenCalledWith(2, expect.objectContaining({ nombre: 'Ana Editada' }));
    expect(actualizar.mock.calls[0][1]).not.toHaveProperty('password');
  });

  it('email duplicado (409) muestra el mensaje correspondiente', () => {
    const crear = vi.fn().mockReturnValue(throwError(() => ({ status: 409 })));
    const { c } = setup({ crear });
    c.abrirCrear();
    c.fNombre.set('X');
    c.fEmail.set('x@b.com');
    c.fPassword.set('secreta');
    c.guardar();
    expect(c.formError()).toContain('Ya existe');
  });

  it('elegirRol ofrece los tres roles y marca el actual', async () => {
    const { c, alertCtrl } = setup();

    await c.elegirRol(OTRO); // OTRO es cliente

    const inputs = alertCtrl.create.mock.calls.at(-1)![0].inputs;
    expect(inputs.map((i: any) => i.value)).toEqual(['USER', 'PELUQUERO', 'ADMIN']);
    expect(inputs.map((i: any) => i.label)).toEqual(['Cliente', 'Peluquero', 'Administrador']);
    expect(inputs.find((i: any) => i.checked).value).toBe('USER');
  });

  it('elegirRol cambia el rol al elegir otro y confirmar', async () => {
    const cambiarRol = vi.fn().mockReturnValue(of({ ...OTRO, rol: 'PELUQUERO' }));
    const { c, usuarioSvc, pulsar } = setup({ cambiarRol });
    usuarioSvc.listar.mockClear();

    await c.elegirRol(OTRO);
    pulsar('Cambiar', 'PELUQUERO');

    expect(cambiarRol).toHaveBeenCalledWith(2, 'PELUQUERO');
    expect(usuarioSvc.listar).toHaveBeenCalled(); // recarga
  });

  it('elegir el mismo rol que ya tiene no gasta una llamada que cerraría sus sesiones', async () => {
    const cambiarRol = vi.fn();
    const { c, pulsar } = setup({ cambiarRol });

    await c.elegirRol(OTRO);
    pulsar('Cambiar', 'USER'); // el que ya tiene

    expect(cambiarRol).not.toHaveBeenCalled();
  });

  it('un error al cambiar el rol avisa de que no se puede dejar el sistema sin administradores', async () => {
    const cambiarRol = vi.fn().mockReturnValue(throwError(() => ({ status: 400 })));
    const { c, toast, pulsar } = setup({ cambiarRol });

    await c.elegirRol(ME); // ME es el admin
    pulsar('Cambiar', 'PELUQUERO');

    expect(toast.create).toHaveBeenCalledWith(
      expect.objectContaining({ color: 'danger', message: expect.stringContaining('último administrador') }),
    );
  });

  it('confirmarDesactivar elimina (borrado lógico) al pulsar Desactivar', async () => {
    const eliminar = vi.fn().mockReturnValue(of(undefined));
    const { c, pulsar } = setup({ eliminar });
    await c.confirmarDesactivar(OTRO);
    pulsar('Desactivar');
    expect(eliminar).toHaveBeenCalledWith(2);
  });

  it('activar reactiva al usuario y recarga', () => {
    const activar = vi.fn().mockReturnValue(of({ ...OTRO, activo: true }));
    const { c, usuarioSvc } = setup({ activar });
    usuarioSvc.listar.mockClear();
    c.activar(OTRO);
    expect(activar).toHaveBeenCalledWith(2);
    expect(usuarioSvc.listar).toHaveBeenCalled();
  });
});
