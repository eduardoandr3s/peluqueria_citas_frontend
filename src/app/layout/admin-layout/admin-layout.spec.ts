import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService, PermisoService, UsuarioService } from '@peluqueria/core';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { AdminLayout } from './admin-layout';

function setup(
  opts: {
    urlAvatar?: string | null;
    meFalla?: boolean;
    rol?: 'ADMIN' | 'PELUQUERO';
    permisos?: string[];
  } = {},
) {
  const rol = opts.rol ?? 'ADMIN';
  // Señal real (no un vi.fn suelto) para poder comprobar que la cabecera reacciona
  // a la URL que publica el layout tras pedir /usuarios/me.
  const avatarUrl = signal<string | null>(null);
  const me = vi.fn(() =>
    opts.meFalla
      ? throwError(() => new Error('boom'))
      : of({
          idUsuario: 1,
          nombre: 'Ana Ruiz',
          email: 'ana@test.com',
          rol,
          urlAvatar: opts.urlAvatar ?? null,
        }),
  );

  TestBed.configureTestingModule({
    imports: [AdminLayout],
    providers: [
      provideRouter([]),
      {
        provide: AuthService,
        useValue: {
          user: signal({ idUsuario: 1, nombre: 'Ana Ruiz', email: 'ana@test.com', rol }),
          isAdmin: signal(rol === 'ADMIN'),
          logout: vi.fn(),
          avatarUrl,
          setAvatarUrl: (url: string | null) => avatarUrl.set(url),
        },
      },
      { provide: UsuarioService, useValue: { me } },
      {
        // Mockeado y no real: el de verdad pide /api/permisos/mios al construirse y aquí
        // no hay HttpClient.
        provide: PermisoService,
        useValue: { mios: signal(opts.permisos ?? []) },
      },
    ],
  });
  const fixture = TestBed.createComponent(AdminLayout);
  fixture.detectChanges();
  return { fixture, c: fixture.componentInstance as any, me, avatarUrl };
}

/** Enlaces de la barra lateral, por su destino. */
function enlace(fixture: ComponentFixture<AdminLayout>, href: string): HTMLAnchorElement | undefined {
  return Array.from(fixture.nativeElement.querySelectorAll('a')).find(
    (a) => (a as HTMLAnchorElement).getAttribute('href') === href,
  ) as HTMLAnchorElement | undefined;
}

function boton(fixture: ComponentFixture<AdminLayout>, texto: string): HTMLButtonElement | undefined {
  return Array.from(fixture.nativeElement.querySelectorAll('button')).find((b) =>
    (b as HTMLElement).textContent?.includes(texto),
  ) as HTMLButtonElement | undefined;
}

describe('AdminLayout', () => {
  it('el logo lleva al inicio', () => {
    const { fixture } = setup();

    const logo = fixture.nativeElement.querySelector('img[alt*="Panel Admin"]') as HTMLImageElement;
    expect(logo.closest('a')?.getAttribute('href')).toBe('/dashboard');
  });

  it('«Días cerrados» ya no está suelto: cuelga del menú Configuración', () => {
    const { fixture } = setup();

    // Colapsado de inicio (la ruta activa no es la suya), así que su enlace no está pintado.
    expect(boton(fixture, 'Configuración')).toBeTruthy();
    expect(enlace(fixture, '/bloqueos')).toBeUndefined();

    boton(fixture, 'Configuración')!.click();
    fixture.detectChanges();

    expect(enlace(fixture, '/bloqueos')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Días cerrados');
  });

  it('el grupo se puede volver a plegar', () => {
    const { fixture } = setup();

    boton(fixture, 'Configuración')!.click();
    fixture.detectChanges();
    boton(fixture, 'Configuración')!.click();
    fixture.detectChanges();

    expect(enlace(fixture, '/bloqueos')).toBeUndefined();
  });

  it('mantiene los enlaces de primer nivel', () => {
    const { fixture } = setup();

    for (const path of [
      '/dashboard',
      '/citas',
      '/produccion',
      '/servicios',
      '/usuarios',
      '/peluqueros',
    ]) {
      expect(enlace(fixture, path)).toBeTruthy();
    }
  });

  it('muestra el nombre y las iniciales del administrador', () => {
    const { fixture, c } = setup();

    expect(c.iniciales()).toBe('AR');
    expect(fixture.nativeElement.textContent).toContain('Ana Ruiz');
  });

  it('«Mi perfil» cuelga del menú Configuración', () => {
    const { fixture } = setup();

    boton(fixture, 'Configuración')!.click();
    fixture.detectChanges();

    expect(enlace(fixture, '/perfil')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Mi perfil');
  });

  it('sin avatar deja las iniciales y el círculo lleva al perfil', () => {
    const { fixture, me } = setup({ urlAvatar: null });

    expect(me).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('header img')).toBeNull();
    // Las iniciales siguen siendo el enlace a «Mi perfil».
    const enlacePerfil = fixture.nativeElement.querySelector('header a[href="/perfil"]');
    expect(enlacePerfil?.textContent).toContain('AR');
  });

  it('con avatar pinta la foto en la cabecera', () => {
    const { fixture } = setup({ urlAvatar: 'https://almacen/firmada/1/yo.jpg' });

    const img = fixture.nativeElement.querySelector('header img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://almacen/firmada/1/yo.jpg');
    expect(img.closest('a')?.getAttribute('href')).toBe('/perfil');
  });

  it('un PELUQUERO solo ve su agenda, su producción y su perfil', () => {
    const { fixture } = setup({ rol: 'PELUQUERO' });

    expect(enlace(fixture, '/citas')).toBeTruthy();
    expect(enlace(fixture, '/produccion')).toBeTruthy();
    // Nada de administración: el guard de esas rutas lo mandaría al login, así que
    // enseñarle el enlace sería enseñarle una puerta cerrada.
    for (const path of ['/dashboard', '/servicios', '/usuarios', '/peluqueros']) {
      expect(enlace(fixture, path)).toBeUndefined();
    }
    // Y las entradas que sí ve están en su idioma: son las suyas, no las de la casa.
    expect(fixture.nativeElement.textContent).toContain('Mi agenda');
    expect(fixture.nativeElement.textContent).toContain('Mi producción');
  });

  it('a un PELUQUERO el grupo Configuración le queda solo con «Mi perfil»', () => {
    const { fixture } = setup({ rol: 'PELUQUERO' });

    boton(fixture, 'Configuración')!.click();
    fixture.detectChanges();

    expect(enlace(fixture, '/perfil')).toBeTruthy();
    // La galería sí es de la plantilla, pero con todos sus permisos apagados no habría
    // nada que hacer dentro: la entrada aparece cuando tiene alguno.
    expect(enlace(fixture, '/galeria')).toBeUndefined();
    expect(enlace(fixture, '/bloqueos')).toBeUndefined();
  });

  it('con un permiso de galería, el peluquero sí ve la entrada', () => {
    const { fixture } = setup({ rol: 'PELUQUERO', permisos: ['GALERIA_SUBIR'] });

    boton(fixture, 'Configuración')!.click();
    fixture.detectChanges();

    expect(enlace(fixture, '/galeria')).toBeTruthy();
    // Y lo que sigue siendo solo del admin no se cuela con él.
    expect(enlace(fixture, '/bloqueos')).toBeUndefined();
    expect(enlace(fixture, '/permisos')).toBeUndefined();
  });

  it('el logo de un PELUQUERO lleva a su agenda y no al dashboard', () => {
    const { fixture } = setup({ rol: 'PELUQUERO' });

    const logo = fixture.nativeElement.querySelector('img[alt*="Panel Admin"]') as HTMLImageElement;
    expect(logo.closest('a')?.getAttribute('href')).toBe('/citas');
  });

  it('si /usuarios/me falla, la cabecera sigue viva con las iniciales', () => {
    // El avatar es decoración: un error aquí no debe romper el layout ni avisar de nada.
    const { fixture } = setup({ meFalla: true });

    expect(fixture.nativeElement.querySelector('header img')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Ana Ruiz');
  });
});
