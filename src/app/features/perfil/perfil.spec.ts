import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { AuthService, Usuario, UsuarioService } from '@peluqueria/core';
import { of, throwError } from 'rxjs';
import { Perfil } from './perfil';

const YO: Usuario = {
  idUsuario: 7,
  nombre: 'Ana Ruiz',
  email: 'ana@test.com',
  telefono: '600111222',
  rol: 'ADMIN',
  activo: true,
  fechaRegistro: '2026-01-15',
  urlAvatar: null,
};

function setup(svc: Partial<Record<keyof UsuarioService, unknown>> = {}) {
  const base = { me: vi.fn().mockReturnValue(of({ ...YO })) };
  const setAvatarUrl = vi.fn();
  TestBed.configureTestingModule({
    imports: [Perfil],
    providers: [
      { provide: UsuarioService, useValue: { ...base, ...svc } },
      { provide: AuthService, useValue: { setAvatarUrl } },
    ],
  });
  const fixture = TestBed.createComponent(Perfil);
  fixture.detectChanges(); // dispara ngOnInit -> cargar()
  return { fixture, c: fixture.componentInstance as any, setAvatarUrl };
}

/** Evento equivalente al de un <input type="file"> con un fichero elegido. */
function eventoFichero(fichero: File): Event {
  return { target: { files: [fichero], value: 'C:\\fakepath\\yo.jpg' } } as unknown as Event;
}

describe('Perfil', () => {
  it('carga el perfil al iniciar', () => {
    const { c } = setup();

    expect(c.usuario().email).toBe('ana@test.com');
    expect(c.loading()).toBe(false);
    expect(c.iniciales()).toBe('AR');
  });

  it('publica en la sesión el avatar que llega, para que la cabecera lo pinte', () => {
    const conFoto = { ...YO, urlAvatar: 'https://almacen/firmada/7/yo.jpg' };
    const { setAvatarUrl } = setup({ me: vi.fn().mockReturnValue(of(conFoto)) });

    expect(setAvatarUrl).toHaveBeenCalledWith('https://almacen/firmada/7/yo.jpg');
  });

  it('si falla la carga muestra loadError', () => {
    const { c } = setup({ me: vi.fn().mockReturnValue(throwError(() => new Error('x'))) });

    expect(c.loadError()).toContain('No se pudo cargar');
    expect(c.loading()).toBe(false);
  });

  it('al elegir una foto la sube y refresca el avatar', async () => {
    const subido = { ...YO, urlAvatar: 'https://almacen/firmada/7/nueva.jpg' };
    const subirAvatar = vi.fn().mockReturnValue(of(subido));
    const { c, setAvatarUrl } = setup({ subirAvatar });

    await c.onFotoElegida(eventoFichero(new File(['bytes'], 'yo.jpg', { type: 'image/jpeg' })));

    expect(subirAvatar).toHaveBeenCalledWith(7, expect.anything());
    expect(c.usuario().urlAvatar).toBe('https://almacen/firmada/7/nueva.jpg');
    expect(setAvatarUrl).toHaveBeenCalledWith('https://almacen/firmada/7/nueva.jpg');
    expect(c.subiendo()).toBe(false);
    expect(c.feedback().type).toBe('success');
  });

  it('un 413 se explica como imagen demasiado grande', async () => {
    const subirAvatar = vi
      .fn()
      .mockReturnValue(throwError(() => new HttpErrorResponse({ status: 413 })));
    const { c } = setup({ subirAvatar });

    await c.onFotoElegida(eventoFichero(new File(['bytes'], 'yo.jpg', { type: 'image/jpeg' })));

    expect(c.fotoError()).toContain('demasiado grande');
    expect(c.subiendo()).toBe(false);
  });

  it('sin fichero elegido no llama al backend', async () => {
    const subirAvatar = vi.fn();
    const { c } = setup({ subirAvatar });

    await c.onFotoElegida({ target: { files: [], value: '' } } as unknown as Event);

    expect(subirAvatar).not.toHaveBeenCalled();
  });

  it('quitar foto la borra y deja la sesión sin avatar', () => {
    const borrarAvatar = vi.fn().mockReturnValue(of({ ...YO, urlAvatar: null }));
    const { c, setAvatarUrl } = setup({
      me: vi.fn().mockReturnValue(of({ ...YO, urlAvatar: 'https://almacen/firmada/7/yo.jpg' })),
      borrarAvatar,
    });

    c.quitarFoto();

    expect(borrarAvatar).toHaveBeenCalledWith(7);
    expect(c.usuario().urlAvatar).toBeNull();
    expect(setAvatarUrl).toHaveBeenLastCalledWith(null);
  });

  it('si el borrado falla lo dice y no toca el avatar mostrado', () => {
    const borrarAvatar = vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    const { c } = setup({
      me: vi.fn().mockReturnValue(of({ ...YO, urlAvatar: 'https://almacen/firmada/7/yo.jpg' })),
      borrarAvatar,
    });

    c.quitarFoto();

    expect(c.fotoError()).toContain('No se pudo quitar');
    expect(c.usuario().urlAvatar).toBe('https://almacen/firmada/7/yo.jpg');
  });
});
