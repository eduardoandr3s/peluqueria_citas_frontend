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
function setup(auth: { isAuthenticated: boolean; isAdmin: boolean; isPeluquero?: boolean }): Router {
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
        useValue: {
          isAuthenticated: () => auth.isAuthenticated,
          isAdmin: () => auth.isAdmin,
          isStaff: () => auth.isAdmin || !!auth.isPeluquero,
        },
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

  it.each(['servicios', 'mis-citas', 'contacto', 'asistente', 'perfil'])(
    '/tabs/%s tiene ruta',
    (tab) => {
      expect(hijas.some((r) => r.path === tab)).toBe(true);
    },
  );
});

/**
 * La galería no es una pestaña: se entra desde el botón de la cabecera de Servicios,
 * que navega por código. Sin la ruta detrás, ese botón llevaría al comodín y de ahí
 * al login, y compilar no lo detecta.
 */
describe('galería de trabajos', () => {
  it('/tabs/galeria tiene ruta', () => {
    const hijas = routes.find((r) => r.path === 'tabs')?.children ?? [];
    expect(hijas.some((r) => r.path === 'galeria')).toBe(true);
  });
});

/**
 * «El equipo» no es una pestaña y vive en dos sitios a la vez, cada uno con su motivo: dentro
 * de /tabs para el cliente que viene del flujo de agendar (y no pierde la barra), y fuera y sin
 * guards para el visitante que todavía no tiene cuenta, que es justo para quien se escribe un
 * CV público. A los dos se llega navegando por código o por un enlace del login, así que sin la
 * ruta detrás se acabaría en el comodín y compilar no lo detecta.
 */
describe('el equipo', () => {
  it('/tabs/equipo tiene ruta', () => {
    const hijas = routes.find((r) => r.path === 'tabs')?.children ?? [];
    expect(hijas.some((r) => r.path === 'equipo')).toBe(true);
  });

  it('/equipo existe también fuera de /tabs y sin guards', () => {
    // Su endpoint (GET /api/peluqueros/publicos) es público a propósito; si esta ruta cayera
    // dentro de los guards, el CV solo lo vería quien ya está registrado.
    const equipo = routes.find((r) => r.path === 'equipo');
    expect(equipo).toBeDefined();
    expect(equipo?.canActivate).toBeUndefined();
  });

  it('la pública está declarada antes del comodín, o nunca se alcanzaría', () => {
    const posicionEquipo = routes.findIndex((r) => r.path === 'equipo');
    const posicionComodin = routes.findIndex((r) => r.path === '**');
    expect(posicionEquipo).toBeGreaterThanOrEqual(0);
    expect(posicionEquipo).toBeLessThan(posicionComodin);
  });

  it('las dos rutas cargan el mismo componente', () => {
    const publica = routes.find((r) => r.path === 'equipo');
    const enTabs = (routes.find((r) => r.path === 'tabs')?.children ?? []).find(
      (r) => r.path === 'equipo',
    );
    expect(publica?.loadComponent).toBeDefined();
    expect(enTabs?.loadComponent).toBeDefined();
  });
});

/**
 * El asistente responde sin sesión (su endpoint es público), y todo /tabs exige login.
 * Si esta ruta cayera dentro de los guards, un visitante sin cuenta acabaría en el login
 * y la única pantalla pensada para él sería inalcanzable.
 */
describe('ruta pública del asistente', () => {
  const asistente = routes.find((r) => r.path === 'asistente');

  it('existe fuera de /tabs', () => {
    expect(asistente).toBeDefined();
  });

  it('no tiene guards', () => {
    expect(asistente?.canActivate).toBeUndefined();
  });

  it('está declarada antes del comodín, o nunca se alcanzaría', () => {
    const posicionAsistente = routes.findIndex((r) => r.path === 'asistente');
    const posicionComodin = routes.findIndex((r) => r.path === '**');
    expect(posicionAsistente).toBeGreaterThanOrEqual(0);
    expect(posicionAsistente).toBeLessThan(posicionComodin);
  });
});
