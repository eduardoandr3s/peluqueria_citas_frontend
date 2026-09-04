import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import {
  AuthService,
  PeluqueroCv,
  PeluqueroService,
  PermisoService,
  Usuario,
  UsuarioService,
} from '@peluqueria/core';
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

const MI_CV: PeluqueroCv = {
  idPeluquero: 3,
  nombre: 'Ana Ruiz',
  activo: true,
  orden: 0,
  presentacion: 'Llevo cortando desde 2015',
  especialidades: ['Degradados'],
  aniosExperiencia: 9,
  fotoUrl: null,
  instagram: null,
};

function setup(
  svc: Partial<Record<keyof UsuarioService, unknown>> = {},
  opciones: {
    peluquero?: Partial<Record<keyof PeluqueroService, unknown>>;
    permisos?: string[];
  } = {},
) {
  const base = { me: vi.fn().mockReturnValue(of({ ...YO })) };
  const setAvatarUrl = vi.fn();
  // Por defecto la cuenta tiene ficha: es el caso interesante. Un 404 (la cuenta sin
  // ficha) se prueba aparte, porque entonces el bloque del CV no se pinta.
  const peluqueroBase = {
    miCv: vi.fn().mockReturnValue(of({ ...MI_CV })),
    guardarMiCv: vi.fn().mockReturnValue(of({ ...MI_CV })),
    subirFoto: vi.fn().mockReturnValue(of({ ...MI_CV })),
    borrarFoto: vi.fn().mockReturnValue(of({ ...MI_CV })),
  };
  const peluquero = { ...peluqueroBase, ...(opciones.peluquero ?? {}) };
  TestBed.configureTestingModule({
    imports: [Perfil],
    providers: [
      { provide: UsuarioService, useValue: { ...base, ...svc } },
      { provide: AuthService, useValue: { setAvatarUrl } },
      { provide: PeluqueroService, useValue: peluquero },
      {
        provide: PermisoService,
        useValue: { puede: (clave: string) => () => (opciones.permisos ?? []).includes(clave) },
      },
    ],
  });
  const fixture = TestBed.createComponent(Perfil);
  fixture.detectChanges(); // dispara ngOnInit -> cargar()
  return { fixture, c: fixture.componentInstance as any, setAvatarUrl, peluquero };
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

  // ---- CV público (fase 5) ----

  it('carga su CV al entrar y pinta el bloque', () => {
    const { c, fixture } = setup();

    expect(c.cv().presentacion).toBe('Llevo cortando desde 2015');
    expect(fixture.nativeElement.textContent).toContain('Mi CV público');
  });

  it('una cuenta sin ficha de peluquero no ve el bloque del CV', () => {
    // Un 404 aquí no es un error que mostrar: es un administrador que no corta pelo, y no
    // tiene nada que presentar al cliente.
    const { c, fixture } = setup(
      {},
      {
        peluquero: {
          miCv: vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 }))),
        },
      },
    );

    expect(c.cv()).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Mi CV público');
    // Y el resto de la pantalla sigue en pie: el CV es un añadido, no la pantalla.
    expect(c.usuario().email).toBe('ana@test.com');
    expect(c.loadError()).toBeNull();
  });

  it('sin PERFIL_CV_EDITAR lo ve pero no lo puede cambiar', () => {
    const { c, fixture } = setup();

    expect(c.puedeEditarCv()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('no está habilitado para tu rol');
  });

  it('con el permiso puede editarlo', () => {
    const { c } = setup({}, { permisos: ['PERFIL_CV_EDITAR'] });

    expect(c.puedeEditarCv()).toBe(true);
  });

  it('guardar el CV va por /mio y refresca lo que se muestra', () => {
    const guardado = { ...MI_CV, presentacion: 'Nuevo texto' };
    const guardarMiCv = vi.fn().mockReturnValue(of(guardado));
    const { c } = setup({}, { peluquero: { guardarMiCv }, permisos: ['PERFIL_CV_EDITAR'] });

    const cambios = {
      presentacion: 'Nuevo texto',
      especialidades: ['Barba'],
      aniosExperiencia: null,
      instagram: null,
    };
    c.guardarCv(cambios);

    // Por /mio y sin id: el servidor resuelve la ficha desde la cuenta, así que no existe
    // la versión de esta llamada en la que se manda el id de otro.
    expect(guardarMiCv).toHaveBeenCalledWith(cambios);
    expect(c.cv().presentacion).toBe('Nuevo texto');
    expect(c.guardandoCv()).toBe(false);
    expect(c.feedback().type).toBe('success');
  });

  it('si guardar el CV falla lo dice y no pisa lo que había', () => {
    const guardarMiCv = vi
      .fn()
      .mockReturnValue(throwError(() => new HttpErrorResponse({ error: { error: 'Sin comas.' } })));
    const { c } = setup({}, { peluquero: { guardarMiCv }, permisos: ['PERFIL_CV_EDITAR'] });

    c.guardarCv({ presentacion: 'x' });

    expect(c.feedback().type).toBe('error');
    expect(c.feedback().text).toContain('Sin comas.');
    expect(c.cv().presentacion).toBe('Llevo cortando desde 2015');
    expect(c.guardandoCv()).toBe(false);
  });

  it('la foto del CV va con el id de la ficha, no con el del usuario', async () => {
    // Son dos ids distintos y confundirlos subiría la foto a la ficha de otro. El endpoint
    // es /peluqueros/{id}/foto y el servidor comprueba que sea la suya.
    const conFoto = { ...MI_CV, fotoUrl: 'https://cdn/peluqueros/ana.jpg' };
    const subirFoto = vi.fn().mockReturnValue(of(conFoto));
    const { c } = setup({}, { peluquero: { subirFoto }, permisos: ['PERFIL_CV_EDITAR'] });

    await c.subirFotoCv(new File([new Uint8Array([1])], 'yo.jpg', { type: 'image/jpeg' }));

    expect(subirFoto.mock.calls[0][0]).toBe(3);
    expect(c.cv().fotoUrl).toBe('https://cdn/peluqueros/ana.jpg');
    expect(c.subiendoFotoCv()).toBe(false);
  });

  it('quitar la foto del CV no toca el avatar de la cuenta', () => {
    // Son dos fotos distintas: el avatar es de la cuenta y la del CV es del escaparate.
    const borrarFoto = vi.fn().mockReturnValue(of({ ...MI_CV, fotoUrl: null }));
    const { c, setAvatarUrl } = setup(
      {},
      { peluquero: { borrarFoto }, permisos: ['PERFIL_CV_EDITAR'] },
    );
    setAvatarUrl.mockClear();

    c.quitarFotoCv();

    expect(borrarFoto).toHaveBeenCalledWith(3);
    expect(setAvatarUrl).not.toHaveBeenCalled();
  });
});
