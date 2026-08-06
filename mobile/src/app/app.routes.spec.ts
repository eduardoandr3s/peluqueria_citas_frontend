import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, Routes, provideRouter } from '@angular/router';
import { AuthService } from '@peluqueria/core';
import { routes } from './app.routes';

@Component({ template: '' })
class DestinoStub {}

/**
 * Monta la ruta raíz REAL de la app (la que decide dónde aterriza el arranque)
 * con destinos de pega, para no cargar las páginas de Ionic ni sus guards.
 */
function setup(auth: { isAuthenticated: boolean; isAdmin: boolean }): Router {
  const raiz = routes.find((r) => r.path === '');
  if (!raiz) throw new Error('app.routes ya no define una ruta raíz.');
  const rutasDePrueba: Routes = [
    raiz,
    { path: 'tabs', component: DestinoStub },
    { path: 'admin', component: DestinoStub },
    { path: 'auth/login', component: DestinoStub },
  ];
  TestBed.configureTestingModule({
    providers: [
      provideRouter(rutasDePrueba),
      {
        provide: AuthService,
        useValue: { isAuthenticated: () => auth.isAuthenticated, isAdmin: () => auth.isAdmin },
      },
    ],
  });
  return TestBed.inject(Router);
}

/**
 * Regresión del bug de la APK: la biometría desbloqueaba la sesión y el refresh
 * se renovaba bien, pero la raíz redirigía siempre al login y la sesión
 * restaurada se perdía en silencio.
 */
describe('ruta raíz de la app', () => {
  it('con sesión de cliente restaurada aterriza en /tabs', async () => {
    const router = setup({ isAuthenticated: true, isAdmin: false });
    await router.navigateByUrl('/');
    expect(router.url).toBe('/tabs');
  });

  it('con sesión de admin restaurada aterriza en /admin', async () => {
    const router = setup({ isAuthenticated: true, isAdmin: true });
    await router.navigateByUrl('/');
    expect(router.url).toBe('/admin');
  });

  it('sin sesión aterriza en el login', async () => {
    const router = setup({ isAuthenticated: false, isAdmin: false });
    await router.navigateByUrl('/');
    expect(router.url).toBe('/auth/login');
  });
});

/**
 * La barra inferior navega por href, así que un botón sin su ruta detrás no
 * falla al compilar: se ve el botón y al pulsarlo la app se va al login.
 */
describe('pestañas de cliente', () => {
  const hijas = routes.find((r) => r.path === 'tabs')?.children ?? [];

  it.each(['servicios', 'mis-citas', 'contacto', 'perfil'])(
    '/tabs/%s tiene ruta',
    (tab) => {
      expect(hijas.some((r) => r.path === tab)).toBe(true);
    },
  );
});
