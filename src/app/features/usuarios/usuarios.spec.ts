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
    obtener: vi.fn().mockReturnValue(of({ ...OTRO, urlAvatar: null })),
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
    c.form.setValue({ nombre: 'Nuevo', email: 'nuevo@b.com', telefono: '', password: 'secreta', rol: 'USER' });
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
    c.form.setValue({ nombre: 'X', email: 'x@b.com', telefono: '', password: 'secreta', rol: 'USER' });
    c.guardar();
    expect(c.formError()).toBe('Email en uso');
  });

  it('el listado no cambia roles: solo edita, desactiva y reactiva', () => {
    const { fixture } = setup();

    // El interruptor «Hacer/Quitar admin» ya no existe: con tres roles pintaba a un
    // PELUQUERO como administrador. El rol se elige en el desplegable de «Editar».
    const textos = Array.from(fixture.nativeElement.querySelectorAll('table button')).map((b: any) =>
      b.textContent?.trim(),
    );
    expect(textos).not.toContain('Hacer admin');
    expect(textos).not.toContain('Quitar admin');
  });

  it('el listado muestra el rol con su etiqueta, no con el valor del enum', () => {
    const { fixture, c } = setup();

    expect(c.etiquetaRol('PELUQUERO')).toBe('Peluquero');
    expect(c.etiquetaRol('ADMIN')).toBe('Administrador');
    expect(c.etiquetaRol('USER')).toBe('Cliente');
    // Y cada rol tiene su color, para no confundir un peluquero con un administrador.
    expect(c.rolClass('ADMIN')).not.toBe(c.rolClass('PELUQUERO'));
    expect(fixture.nativeElement.textContent).not.toContain('PELUQUERO');
  });

  it('editar con otro rol manda el PUT y luego el PATCH del rol', () => {
    const peluquero = { ...OTRO, rol: 'PELUQUERO' as const };
    const actualizar = vi.fn().mockReturnValue(of(OTRO));
    const cambiarRol = vi.fn().mockReturnValue(of(peluquero));
    const { c } = setup({ svc: { actualizar, cambiarRol } });

    c.abrirEditar(OTRO);
    c.form.patchValue({ rol: 'PELUQUERO' });
    c.guardar();

    // El rol NO viaja en el PUT: tiene su endpoint porque invalida los tokens.
    expect(actualizar).toHaveBeenCalledWith(2, expect.not.objectContaining({ rol: 'PELUQUERO' }));
    expect(cambiarRol).toHaveBeenCalledWith(2, 'PELUQUERO');
    expect(c.usuarios().find((u: Usuario) => u.idUsuario === 2).rol).toBe('PELUQUERO');
    expect(c.formOpen()).toBe(false);
  });

  it('editar sin tocar el rol no gasta una llamada que cerraría sus sesiones', () => {
    const actualizar = vi.fn().mockReturnValue(of(OTRO));
    const cambiarRol = vi.fn();
    const { c } = setup({ svc: { actualizar, cambiarRol } });

    c.abrirEditar(OTRO);
    c.form.patchValue({ nombre: 'Ana Nueva' });
    c.guardar();

    expect(actualizar).toHaveBeenCalled();
    expect(cambiarRol).not.toHaveBeenCalled();
  });

  it('si el cambio de rol falla, avisa de que los datos sí se guardaron', () => {
    const actualizar = vi.fn().mockReturnValue(of(OTRO));
    const cambiarRol = vi
      .fn()
      .mockReturnValue(throwError(() => ({ error: { error: 'No se puede quitar el rol ADMIN al único administrador activo.' } })));
    const { c } = setup({ svc: { actualizar, cambiarRol } });

    c.abrirEditar(OTRO);
    c.form.patchValue({ rol: 'ADMIN' });
    c.guardar();

    expect(c.formError()).toContain('único administrador activo');
    expect(c.formError()).toContain('El resto de los datos sí se guardaron');
    // El modal se queda abierto para corregir, y no se pierde lo escrito.
    expect(c.formOpen()).toBe(true);
    expect(c.saving()).toBe(false);
  });

  it('nadie se cambia el rol a sí mismo: el desplegable queda deshabilitado', () => {
    const actualizar = vi.fn().mockReturnValue(of(ME));
    const cambiarRol = vi.fn();
    const { c } = setup({ svc: { actualizar, cambiarRol } });

    c.abrirEditar(ME);

    expect(c.form.controls.rol.disabled).toBe(true);

    // Aunque el valor llegue cambiado (por ejemplo, tocando el DOM a mano), guardar no
    // manda el cambio de rol: es la forma tonta de quedarse fuera del panel.
    c.form.controls.rol.setValue('USER');
    c.guardar();

    expect(actualizar).toHaveBeenCalled();
    expect(cambiarRol).not.toHaveBeenCalled();
  });

  it('al volver a «Nuevo usuario» el desplegable no arrastra el disabled de la edición', () => {
    const { c } = setup();

    c.abrirEditar(ME); // deshabilita
    c.abrirCrear();

    expect(c.form.controls.rol.disabled).toBe(false);
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
    const eliminar = vi.fn().mockReturnValue(throwError(() => ({ error: { error: 'No permitido' } })));
    const { c } = setup({ svc: { eliminar } });
    c.confirmar({ type: 'deactivate', usuario: OTRO });
    expect(c.feedback()).toEqual({ type: 'error', text: 'No permitido' });
    expect(c.busyId()).toBeNull();
  });

  it('textos de confirmación según el tipo de acción', () => {
    const { c } = setup();
    expect(c.confirmTitulo({ type: 'deactivate', usuario: OTRO })).toContain('Desactivar');
    expect(c.confirmAccion({ type: 'deactivate', usuario: OTRO })).toBe('Desactivar');
    expect(c.confirmAccion({ type: 'activate', usuario: OTRO })).toBe('Reactivar');
    expect(c.confirmMensaje({ type: 'activate', usuario: OTRO })).toContain('volverá a tener acceso');
  });

  it('cada rol explica lo que puede hacer, para no elegir a ciegas', () => {
    const { c } = setup();
    expect(c.descripcionRol('ADMIN')).toContain('Acceso total');
    expect(c.descripcionRol('PELUQUERO')).toContain('agenda');
    expect(c.descripcionRol('USER')).toContain('Cliente');
  });

  it('el listado no pide ninguna foto: solo al abrir la ficha', () => {
    const { c, svc } = setup();

    // Cargar la página no llama al detalle de nadie.
    expect(svc.obtener).not.toHaveBeenCalled();

    c.abrirFicha(OTRO);

    expect(svc.obtener).toHaveBeenCalledWith(2);
    expect(c.ficha().idUsuario).toBe(2);
  });

  it('la ficha muestra la foto que devuelve el detalle', () => {
    const conFoto = { ...OTRO, urlAvatar: 'https://almacen/firmada/2/ana.jpg' };
    const { c } = setup({ svc: { obtener: vi.fn().mockReturnValue(of(conFoto)) } });

    c.abrirFicha(OTRO);

    expect(c.ficha().urlAvatar).toBe('https://almacen/firmada/2/ana.jpg');
    expect(c.fichaCargando()).toBe(false);
  });

  it('si el detalle falla, la ficha sigue abierta con los datos de la fila', () => {
    const { c } = setup({ svc: { obtener: vi.fn().mockReturnValue(throwError(() => new Error('x'))) } });

    c.abrirFicha(OTRO);

    expect(c.ficha().nombre).toBe('Ana López');
    expect(c.fichaError()).toContain('No se pudo cargar la foto');
    expect(c.fichaCargando()).toBe(false);
  });

  it('cerrar la ficha la vacía', () => {
    const { c } = setup();

    c.abrirFicha(OTRO);
    c.cerrarFicha();

    expect(c.ficha()).toBeNull();
    expect(c.fichaError()).toBeNull();
  });
});
