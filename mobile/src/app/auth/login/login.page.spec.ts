import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '@peluqueria/core';
import { of, throwError } from 'rxjs';
import { LoginPage } from './login.page';

function setup(auth: Partial<Record<keyof AuthService, unknown>>) {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
  });
  const router = TestBed.inject(Router);
  const nav = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  const c = TestBed.runInInjectionContext(() => new LoginPage()) as any;
  return { c, nav };
}

describe('LoginPage', () => {
  it('no envía si el formulario es inválido', () => {
    const login = vi.fn();
    const { c } = setup({ login });
    c.login();
    expect(login).not.toHaveBeenCalled();
  });

  it('login de un ADMIN navega a /admin', () => {
    const login = vi.fn().mockReturnValue(of({ token: 't', email: 'a@b.com', nombre: 'A', rol: 'ADMIN' }));
    const { c, nav } = setup({ login, isAdmin: () => true });
    c.form.setValue({ email: 'a@b.com', password: 'secreta' });
    c.login();
    expect(login).toHaveBeenCalledWith({ email: 'a@b.com', password: 'secreta' });
    expect(nav).toHaveBeenCalledWith('/admin', { replaceUrl: true });
  });

  it('login de un USER navega a /tabs', () => {
    const login = vi.fn().mockReturnValue(of({ token: 't', email: 'u@b.com', nombre: 'U', rol: 'USER' }));
    const { c, nav } = setup({ login, isAdmin: () => false });
    c.form.setValue({ email: 'u@b.com', password: 'secreta' });
    c.login();
    expect(nav).toHaveBeenCalledWith('/tabs', { replaceUrl: true });
  });

  it('error 401 muestra credenciales incorrectas', () => {
    const login = vi.fn().mockReturnValue(throwError(() => ({ status: 401 })));
    const { c } = setup({ login, isAdmin: () => false });
    c.form.setValue({ email: 'a@b.com', password: 'secreta' });
    c.login();
    expect(c.loading()).toBe(false);
    expect(c.error()).toContain('incorrectos');
  });

  it('otro error muestra error de conexión', () => {
    const login = vi.fn().mockReturnValue(throwError(() => ({ status: 500 })));
    const { c } = setup({ login, isAdmin: () => false });
    c.form.setValue({ email: 'a@b.com', password: 'secreta' });
    c.login();
    expect(c.error()).toContain('conexión');
  });
});
