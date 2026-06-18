import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AlertController } from '@ionic/angular/standalone';
import { AuthService } from '@peluqueria/core';
import { PerfilPage } from './perfil.page';

function setup(auth: Partial<Record<keyof AuthService, unknown>>) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: auth },
      { provide: AlertController, useValue: { create: vi.fn().mockResolvedValue({ present: vi.fn() }) } },
    ],
  });
  const router = TestBed.inject(Router);
  const nav = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  const c = TestBed.runInInjectionContext(() => new PerfilPage()) as any;
  return { c, nav };
}

describe('PerfilPage', () => {
  it('expone el usuario de la sesión', () => {
    const { c } = setup({ user: () => ({ email: 'a@b.com', nombre: 'Ana', rol: 'USER' }), logout: vi.fn() });
    expect(c.user().nombre).toBe('Ana');
  });

  it('logout cierra la sesión y vuelve al login', () => {
    const logout = vi.fn();
    const { c, nav } = setup({ user: () => null, logout });
    c.logout();
    expect(logout).toHaveBeenCalled();
    expect(nav).toHaveBeenCalledWith('/auth/login', { replaceUrl: true });
  });
});
