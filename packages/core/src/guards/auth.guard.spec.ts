import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { adminGuard, authGuard, staffGuard } from './auth.guard';

function setup(auth: {
  isAuthenticated?: boolean;
  isAdmin?: boolean;
  isStaff?: boolean;
  /** URL que se intentaba abrir: es lo que el guard guarda en `returnUrl` al rebotar. */
  url?: string;
}) {
  // Hay tests que prueban dos roles seguidos: sin reset, la segunda configuración se ignora.
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: AuthService,
        useValue: {
          isAuthenticated: () => auth.isAuthenticated ?? true,
          isAdmin: () => auth.isAdmin ?? false,
          isStaff: () => auth.isStaff ?? auth.isAdmin ?? false,
        },
      },
    ],
  });
  const router = TestBed.inject(Router);
  const run = (guard: typeof authGuard) =>
    TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, { url: auth.url } as RouterStateSnapshot),
    );
  return { router, run };
}

function destino(router: Router, resultado: unknown): string {
  return router.serializeUrl(resultado as UrlTree);
}

describe('authGuard', () => {
  it('permite el paso con sesión iniciada', () => {
    const { run } = setup({ isAuthenticated: true });
    expect(run(authGuard)).toBe(true);
  });

  it('redirige a /login sin sesión', () => {
    const { router, run } = setup({ isAuthenticated: false });
    expect(destino(router, run(authGuard))).toBe('/login');
  });
});

describe('adminGuard', () => {
  it('permite el paso a un ADMIN', () => {
    const { run } = setup({ isAdmin: true });
    expect(run(adminGuard)).toBe(true);
  });

  it('sin sesión redirige a /login', () => {
    const { router, run } = setup({ isAuthenticated: false });
    expect(destino(router, run(adminGuard))).toBe('/login');
  });

  it('un peluquero CON sesión va a /inicio, no al login', () => {
    // No le falta entrar, le falta el rol: mandarlo al login le pediría unas credenciales que
    // ya tiene. `/inicio` es el redirector que lleva a cada rol a su pantalla.
    const { router, run } = setup({ isAdmin: false, isStaff: true });
    expect(destino(router, run(adminGuard))).toBe('/inicio');
  });
});

describe('staffGuard', () => {
  it('permite el paso al personal del negocio (ADMIN o PELUQUERO)', () => {
    expect(setup({ isAdmin: true }).run(staffGuard)).toBe(true);
    expect(setup({ isAdmin: false, isStaff: true }).run(staffGuard)).toBe(true);
  });

  it('sin sesión redirige a /login', () => {
    const { router, run } = setup({ isAuthenticated: false });
    expect(destino(router, run(staffGuard))).toBe('/login');
  });

  it('un cliente CON sesión también vuelve al login', () => {
    // A diferencia del peluquero en adminGuard, aquí no hay pantalla suya a la que mandarlo:
    // el panel entero no es para él, su área es la app móvil.
    const { router, run } = setup({ isStaff: false });
    expect(destino(router, run(staffGuard))).toBe('/login');
  });
});

/**
 * Al rebotar por falta de sesión, el guard se lleva al login el destino que se intentaba
 * abrir, y el login vuelve allí tras entrar. Sin esto, una sesión caducada en cualquier
 * pantalla devolvía a la de inicio y había que rehacer el camino a mano.
 */
describe('returnUrl al rebotar', () => {
  it('los tres guards guardan el destino cuando falta la sesión', () => {
    for (const guard of [authGuard, adminGuard, staffGuard]) {
      const { router, run } = setup({ isAuthenticated: false, url: '/citas' });
      expect(destino(router, run(guard))).toBe('/login?returnUrl=%2Fcitas');
    }
  });

  it('se guardan también los parámetros de la URL', () => {
    const { router, run } = setup({ isAuthenticated: false, url: '/produccion?desde=2026-01-01' });
    expect(destino(router, run(authGuard))).toBe(
      '/login?returnUrl=%2Fproduccion%3Fdesde%3D2026-01-01',
    );
  });

  it('la raíz no se guarda: no es un destino', () => {
    const { router, run } = setup({ isAuthenticated: false, url: '/' });
    expect(destino(router, run(authGuard))).toBe('/login');
  });

  it('un rebote por ROL no guarda destino, porque no se resuelve entrando', () => {
    const peluquero = setup({ isAdmin: false, isStaff: true, url: '/usuarios' });
    expect(destino(peluquero.router, peluquero.run(adminGuard))).toBe('/inicio');

    const cliente = setup({ isStaff: false, url: '/citas' });
    expect(destino(cliente.router, cliente.run(staffGuard))).toBe('/login');
  });
});
