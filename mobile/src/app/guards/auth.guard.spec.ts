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

function setup(auth: { isAuthenticated: boolean; isAdmin: boolean; isPeluquero?: boolean }) {
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
      guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
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
