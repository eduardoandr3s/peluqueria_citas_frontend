import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { adminGuard, authGuard, staffGuard } from './auth.guard';

const LOGIN_TREE = { __login: true } as unknown as UrlTree;

function setup(auth: Partial<AuthService>) {
  const createUrlTree = vi.fn().mockReturnValue(LOGIN_TREE);
  // Hay tests que prueban dos roles seguidos: sin reset, la segunda configuración se ignora.
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: auth },
      { provide: Router, useValue: { createUrlTree } },
    ],
  });
  return { createUrlTree };
}

const run = (guard: typeof authGuard) =>
  TestBed.runInInjectionContext(() => guard({} as any, {} as any));

describe('authGuard', () => {
  it('permite el paso con sesión iniciada', () => {
    setup({ isAuthenticated: (() => true) as any });
    expect(run(authGuard)).toBe(true);
  });

  it('redirige a /login sin sesión', () => {
    const { createUrlTree } = setup({ isAuthenticated: (() => false) as any });
    expect(run(authGuard)).toBe(LOGIN_TREE);
    expect(createUrlTree).toHaveBeenCalledWith(['/login']);
  });
});

describe('adminGuard', () => {
  it('permite el paso a un ADMIN', () => {
    setup({ isAdmin: (() => true) as any });
    expect(run(adminGuard)).toBe(true);
  });

  it('redirige a /login a un no-admin', () => {
    const { createUrlTree } = setup({ isAdmin: (() => false) as any });
    expect(run(adminGuard)).toBe(LOGIN_TREE);
    expect(createUrlTree).toHaveBeenCalledWith(['/login']);
  });
});

describe('staffGuard', () => {
  it('permite el paso al personal del negocio (ADMIN o PELUQUERO)', () => {
    setup({ isStaff: (() => true) as any });
    expect(run(staffGuard)).toBe(true);
  });

  it('redirige a /login a un cliente', () => {
    // El panel no es su sitio: el área de cliente es la app móvil.
    const { createUrlTree } = setup({ isStaff: (() => false) as any });
    expect(run(staffGuard)).toBe(LOGIN_TREE);
    expect(createUrlTree).toHaveBeenCalledWith(['/login']);
  });
});
