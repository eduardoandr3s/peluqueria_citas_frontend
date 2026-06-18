import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { AuthService } from '@peluqueria/core';
import { mobileAuthGuard, adminGuard, clientGuard } from './auth.guard';

function setup(auth: { isAuthenticated: boolean; isAdmin: boolean }) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: AuthService,
        useValue: { isAuthenticated: () => auth.isAuthenticated, isAdmin: () => auth.isAdmin },
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

  it('con sesión pero sin rol ADMIN redirige a /tabs', () => {
    const { router, run } = setup({ isAuthenticated: true, isAdmin: false });
    expect(destino(router, run(adminGuard))).toBe('/tabs');
  });
});

describe('clientGuard', () => {
  it('sin sesión redirige al login', () => {
    const { router, run } = setup({ isAuthenticated: false, isAdmin: false });
    expect(destino(router, run(clientGuard))).toBe('/auth/login');
  });

  it('un ADMIN se redirige a su panel', () => {
    const { router, run } = setup({ isAuthenticated: true, isAdmin: true });
    expect(destino(router, run(clientGuard))).toBe('/admin');
  });

  it('un USER autenticado pasa', () => {
    const { run } = setup({ isAuthenticated: true, isAdmin: false });
    expect(run(clientGuard)).toBe(true);
  });
});
