import { TestBed } from '@angular/core/testing';
import { AuthService, Page, Usuario, UsuarioService } from '@peluqueria/core';
import { of, throwError } from 'rxjs';
import { Usuarios } from './usuarios';

const ME: Usuario = { idUsuario: 1, nombre: 'Eduardo Segovia', email: 'me@b.com', rol: 'ADMIN', activo: true };
const OTRO: Usuario = { idUsuario: 2, nombre: 'Ana López', email: 'ana@b.com', rol: 'USER', activo: true };

function page(content: Usuario[], totalPages = 1, totalElements = content.length): Page<Usuario> {
  return { content, totalElements, totalPages, number: 0, size: 20, first: true, last: true };
}

function setup(overrides: { svc?: Partial<Record<keyof UsuarioService, unknown>> } = {}) {
  const svc = {
    listar: vi.fn().mockReturnValue(of(page([ME, OTRO]))),
    crear: vi.fn(),
    actualizar: vi.fn(),
    eliminar: vi.fn(),
    cambiarRol: vi.fn(),
    activar: vi.fn(),
    ...overrides.svc,
  };
  TestBed.configureTestingModule({
    imports: [Usuarios],
    providers: [
      { provide: UsuarioService, useValue: svc },
      { provide: AuthService, useValue: { user: () => ({ email: 'me@b.com', nombre: 'Eduardo', rol: 'ADMIN' }) } },
    ],
  });
  const fixture = TestBed.createComponent(Usuarios);
  fixture.detectChanges(); // ngOnInit -> cargar
  const c = fixture.componentInstance as any;
  return { fixture, c, svc: svc as any };
}

describe('Usuarios', () => {
  it('carga la página y los totales', () => {
    const { c } = setup();
    expect(c.usuarios().length).toBe(2);
    expect(c.totalElements()).toBe(2);
    expect(c.loading()).toBe(false);
  });

  it('si falla la carga muestra loadError', () => {
    const { c } = setup({ svc: { listar: vi.fn().mockReturnValue(throwError(() => new Error('x'))) } });
    expect(c.loadError()).toContain('No se pudieron cargar');
  });

  it('iniciales saca las iniciales del nombre', () => {
    const { c } = setup();
    expect(c.iniciales('Ana López')).toBe('AL');
    expect(c.iniciales('Bob')).toBe('B');
  });

  it('esYo detecta la cuenta actual y esInactivo el flag activo=false', () => {
    const { c } = setup();
    expect(c.esYo(ME)).toBe(true);
    expect(c.esYo(OTRO)).toBe(false);
    expect(c.esInactivo({ ...OTRO, activo: false })).toBe(true);
    expect(c.esInactivo(OTRO)).toBe(false);
  });

  it('toggleInactivos recarga incluyendo inactivos', () => {
    const { c, svc } = setup();
    c.toggleInactivos();
    expect(c.incluirInactivos()).toBe(true);
    expect(svc.listar).toHaveBeenLastCalledWith(expect.objectContaining({ incluirInactivos: true, page: 0 }));
  });

  it('irPagina cambia de página y recarga; ignora fuera de rango', () => {
    const { c, svc } = setup({ svc: { listar: vi.fn().mockReturnValue(of(page([ME, OTRO], 3, 50))) } });
    svc.listar.mockClear();
    c.irPagina(1);
    expect(c.page()).toBe(1);
    expect(svc.listar).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
    svc.listar.mockClear();
    c.irPagina(99); // fuera de rango
    expect(svc.listar).not.toHaveBeenCalled();
  });

  it('guardar (crear) llama a crear y recarga', () => {
    const crear = vi.fn().mockReturnValue(of({ ...OTRO, idUsuario: 9, nombre: 'Nuevo' }));
    const { c, svc } = setup({ svc: { crear } });
    c.abrirCrear();
    c.form.setValue({ nombre: 'Nuevo', email: 'nuevo@b.com', telefono: '', password: 'secreta' });
    svc.listar.mockClear();
    c.guardar();
    expect(crear).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Nuevo', email: 'nuevo@b.com', password: 'secreta' }));
    expect(svc.listar).toHaveBeenCalled(); // recarga
    expect(c.feedback().type).toBe('success');
  });

  it('guardar (editar) actualiza en la lista y omite password vacía', () => {
    const actualizado = { ...OTRO, nombre: 'Ana Editada' };
    const actualizar = vi.fn().mockReturnValue(of(actualizado));
    const { c } = setup({ svc: { actualizar } });
    c.abrirEditar(OTRO);
    c.form.patchValue({ nombre: 'Ana Editada', password: '' });
    c.guardar();
    expect(actualizar).toHaveBeenCalledWith(2, expect.objectContaining({ nombre: 'Ana Editada', password: undefined }));
    expect(c.usuarios().find((u: Usuario) => u.idUsuario === 2).nombre).toBe('Ana Editada');
  });

  it('guardar con error muestra formError', () => {
    const crear = vi.fn().mockReturnValue(throwError(() => ({ error: { error: 'Email en uso' } })));
    const { c } = setup({ svc: { crear } });
    c.abrirCrear();
    c.form.setValue({ nombre: 'X', email: 'x@b.com', telefono: '', password: 'secreta' });
    c.guardar();
    expect(c.formError()).toBe('Email en uso');
  });

  it('confirmar (promote) cambia el rol y refleja el resultado', () => {
    const cambiarRol = vi.fn().mockReturnValue(of({ ...OTRO, rol: 'ADMIN' }));
    const { c } = setup({ svc: { cambiarRol } });
    c.confirmar({ type: 'promote', usuario: OTRO });
    expect(cambiarRol).toHaveBeenCalledWith(2, 'ADMIN');
    expect(c.usuarios().find((u: Usuario) => u.idUsuario === 2).rol).toBe('ADMIN');
  });

  it('confirmar (demote) pasa a USER', () => {
    const cambiarRol = vi.fn().mockReturnValue(of({ ...ME, rol: 'USER' }));
    const { c } = setup({ svc: { cambiarRol } });
    c.confirmar({ type: 'demote', usuario: ME });
    expect(cambiarRol).toHaveBeenCalledWith(1, 'USER');
  });

  it('confirmar (deactivate) quita de la lista cuando no se muestran inactivos', () => {
    const eliminar = vi.fn().mockReturnValue(of(undefined));
    const { c } = setup({ svc: { eliminar } });
    c.confirmar({ type: 'deactivate', usuario: OTRO });
    expect(eliminar).toHaveBeenCalledWith(2);
    expect(c.usuarios().some((u: Usuario) => u.idUsuario === 2)).toBe(false);
    expect(c.totalElements()).toBe(1);
  });

  it('confirmar (activate) reactiva y refleja el usuario', () => {
    const inactivo = { ...OTRO, activo: false };
    const activar = vi.fn().mockReturnValue(of({ ...OTRO, activo: true }));
    const { c } = setup({ svc: { listar: vi.fn().mockReturnValue(of(page([ME, inactivo]))), activar } });
    c.confirmar({ type: 'activate', usuario: inactivo });
    expect(activar).toHaveBeenCalledWith(2);
    expect(c.usuarios().find((u: Usuario) => u.idUsuario === 2).activo).toBe(true);
  });

  it('una acción con error muestra feedback de error', () => {
    const cambiarRol = vi.fn().mockReturnValue(throwError(() => ({ error: { error: 'No permitido' } })));
    const { c } = setup({ svc: { cambiarRol } });
    c.confirmar({ type: 'promote', usuario: OTRO });
    expect(c.feedback()).toEqual({ type: 'error', text: 'No permitido' });
    expect(c.busyId()).toBeNull();
  });

  it('textos de confirmación según el tipo de acción', () => {
    const { c } = setup();
    expect(c.confirmTitulo({ type: 'promote', usuario: OTRO })).toContain('administrador');
    expect(c.confirmAccion({ type: 'deactivate', usuario: OTRO })).toBe('Desactivar');
    expect(c.confirmAccion({ type: 'activate', usuario: OTRO })).toBe('Reactivar');
    expect(c.confirmMensaje({ type: 'activate', usuario: OTRO })).toContain('volverá a tener acceso');
  });
});
