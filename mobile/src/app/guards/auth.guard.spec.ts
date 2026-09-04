import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { AuthService } from '@peluqueria/core';
import {
  mobileAuthGuard,
  adminGuard,
  staffGuard,
  clientGuard,
  sessionRedirectGuard,
} from './auth.guard';

function setup(auth: {
  isAuthenticated: boolean;
  isAdmin: boolean;
  isPeluquero?: boolean;
  /** URL que se intentaba abrir. Es lo que los guards guardan en `returnUrl` al rebotar. */
  url?: string;
}) {
  // Reset explícito: hay tests que comparan dos roles y configuran el TestBed dos veces;
  // sin esto la segunda configuración se ignora y el segundo caso se prueba con el primero.
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
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
  const router = TestBed.inject(Router);
  const run = (guard: CanActivateFn) =>
    TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, { url: auth.url } as RouterStateSnapshot),
    );
  return { router, run };
}

function destino(router: Router, result: unknown): string {
  return router.serializeUrl(result as UrlTree);
}

/** Ejecuta un guard sobre un setup ya creado. Para comparar dos roles en un mismo test. */
function run(entorno: { run: (g: CanActivateFn) => unknown }, guard: CanActivateFn): unknown {
  return entorno.run(guard);
}

describe('mobileAuthGuard', () => {
  it('permite el paso si hay sesión', () => {
    const { run } = setup({ isAuthenticated: true, isAdmin: false });
    expect(run(mobileAuthGuard)).toBe(true);
  });

  it('redirige al login si no hay sesión', () => {
    const { router, run } = setup({ isAuthenticated: false, isAdmin: false });
    const r = run(mobileAuthGuard);
    expect(r).toBeInstanceOf(UrlTree);
    expect(destino(router, r)).toBe('/auth/login');
  });
});

describe('adminGuard', () => {
  it('sin sesión redirige al login', () => {
    const { router, run } = setup({ isAuthenticated: false, isAdmin: false });
    expect(destino(router, run(adminGuard))).toBe('/auth/login');
  });

  it('con sesión ADMIN permite el paso', () => {
    const { run } = setup({ isAuthenticated: true, isAdmin: true });
    expect(run(adminGuard)).toBe(true);
  });

  it('un cliente va a /tabs, y en un solo salto', () => {
    const { router, run } = setup({ isAuthenticated: true, isAdmin: false });
    expect(destino(router, run(adminGuard))).toBe('/tabs');
  });

  it('un PELUQUERO vuelve a su área, no al área de cliente', () => {
    const { router, run } = setup({ isAuthenticated: true, isAdmin: false, isPeluquero: true });
    expect(destino(router, run(adminGuard))).toBe('/admin');
  });
});

describe('staffGuard', () => {
  it('sin sesión redirige al login', () => {
    const { router, run } = setup({ isAuthenticated: false, isAdmin: false });
    expect(destino(router, run(staffGuard))).toBe('/auth/login');
  });

  it('deja pasar a un ADMIN y a un PELUQUERO', () => {
    expect(run(setup({ isAuthenticated: true, isAdmin: true }), staffGuard)).toBe(true);
    expect(
      run(setup({ isAuthenticated: true, isAdmin: false, isPeluquero: true }), staffGuard),
    ).toBe(true);
  });

  it('un cliente se va a su área', () => {
    const { router, run } = setup({ isAuthenticated: true, isAdmin: false });
    expect(destino(router, run(staffGuard))).toBe('/tabs');
  });
});

describe('clientGuard', () => {
  it('sin sesión redirige al login', () => {
    const { router, run } = setup({ isAuthenticated: false, isAdmin: false });
    expect(destino(router, run(clientGuard))).toBe('/auth/login');
  });

  it('el personal del negocio se redirige a su área', () => {
    const { router, run } = setup({ isAuthenticated: true, isAdmin: true });
    expect(destino(router, run(clientGuard))).toBe('/admin');

    const peluquero = setup({ isAuthenticated: true, isAdmin: false, isPeluquero: true });
    expect(destino(peluquero.router, peluquero.run(clientGuard))).toBe('/admin');
  });

  it('un USER autenticado pasa', () => {
    const { run } = setup({ isAuthenticated: true, isAdmin: false });
    expect(run(clientGuard)).toBe(true);
  });
});

describe('sessionRedirectGuard', () => {
  it('sin sesión manda al login', () => {
    const { router, run } = setup({ isAuthenticated: false, isAdmin: false });
    expect(destino(router, run(sessionRedirectGuard))).toBe('/auth/login');
  });

  it('con sesión de cliente manda a /tabs', () => {
    const { router, run } = setup({ isAuthenticated: true, isAdmin: false });
    expect(destino(router, run(sessionRedirectGuard))).toBe('/tabs');
  });

  it('con sesión de admin manda a /admin', () => {
    const { router, run } = setup({ isAuthenticated: true, isAdmin: true });
    expect(destino(router, run(sessionRedirectGuard))).toBe('/admin');
  });

  it('con sesión de peluquero también manda a /admin, que es su área de trabajo', () => {
    const { router, run } = setup({ isAuthenticated: true, isAdmin: false, isPeluquero: true });
    expect(destino(router, run(sessionRedirectGuard))).toBe('/admin');
  });

  it('nunca devuelve true: la raíz siempre redirige', () => {
    const { run } = setup({ isAuthenticated: true, isAdmin: false });
    expect(run(sessionRedirectGuard)).toBeInstanceOf(UrlTree);
  });
});

/**
 * Al rebotar por falta de sesión, el guard se lleva al login el destino que se intentaba
 * abrir, y el login vuelve allí tras entrar. Sin esto, una sesión caducada en cualquier
 * pantalla devolvía a la de inicio y había que rehacer el camino a mano.
 *
 * Lo que NO lleva `returnUrl` importa igual: los rebotes por **rol** no pasan por el login
 * —ahí no falta una sesión, es que ese sitio no es el suyo— y guardar el destino solo serviría
 * para volver a rebotar.
 */
describe('returnUrl al rebotar', () => {
  it('los cuatro guards que exigen sesión guardan el destino', () => {
    for (const guard of [mobileAuthGuard, adminGuard, staffGuard, clientGuard]) {
      const { router, run } = setup({
        isAuthenticated: false,
        isAdmin: false,
        url: '/tabs/mis-citas',
      });
      expect(destino(router, run(guard))).toBe('/auth/login?returnUrl=%2Ftabs%2Fmis-citas');
    }
  });

  it('se guardan también los parámetros de la URL', () => {
    const { router, run } = setup({
      isAuthenticated: false,
      isAdmin: false,
      url: '/tabs/agendar?peluqueroId=2&servicioId=4',
    });

    expect(destino(router, run(mobileAuthGuard))).toBe(
      '/auth/login?returnUrl=%2Ftabs%2Fagendar%3FpeluqueroId%3D2%26servicioId%3D4',
    );
  });

  it('la raíz no se guarda: no es un destino', () => {
    // Devolver a un redirector no lleva a ninguna parte.
    const { router, run } = setup({ isAuthenticated: false, isAdmin: false, url: '/' });

    expect(destino(router, run(mobileAuthGuard))).toBe('/auth/login');
  });

  it('un rebote por ROL no guarda destino, porque no se resuelve entrando', () => {
    const cliente = setup({ isAuthenticated: true, isAdmin: false, url: '/admin/usuarios' });
    expect(destino(cliente.router, cliente.run(adminGuard))).toBe('/tabs');

    const staff = setup({
      isAuthenticated: true,
      isAdmin: true,
      url: '/tabs/agendar?peluqueroId=2',
    });
    expect(destino(staff.router, staff.run(clientGuard))).toBe('/admin');
  });

  it('la raíz sigue mandando al login a secas', () => {
    // sessionRedirectGuard no guarda nada: su trabajo es mandar a cada uno a su área.
    const { router, run } = setup({ isAuthenticated: false, isAdmin: false, url: '/' });

    expect(destino(router, run(sessionRedirectGuard))).toBe('/auth/login');
  });
});
