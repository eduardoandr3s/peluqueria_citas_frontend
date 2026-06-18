import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { AuthService } from '@peluqueria/core';
import { of, throwError } from 'rxjs';
import { ResetPage } from './reset.page';

function setup(auth: Partial<Record<keyof AuthService, unknown>>, token: string | null = 'tok123') {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: auth },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { queryParamMap: convertToParamMap(token ? { token } : {}) } },
      },
    ],
  });
  const router = TestBed.inject(Router);
  const nav = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  const c = TestBed.runInInjectionContext(() => new ResetPage()) as any;
  return { c, nav };
}

describe('ResetPage', () => {
  it('lee el token del query param', () => {
    const { c } = setup({ resetPassword: vi.fn() });
    expect(c.token).toBe('tok123');
  });

  it('el formulario es inválido si las contraseñas no coinciden', () => {
    const { c } = setup({ resetPassword: vi.fn() });
    c.form.setValue({ password: 'secreta', confirmar: 'otra123' });
    expect(c.form.invalid).toBe(true);
  });

  it('no envía si no hay token', () => {
    const resetPassword = vi.fn();
    const { c } = setup({ resetPassword }, null);
    c.form.setValue({ password: 'secreta', confirmar: 'secreta' });
    c.reset();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('reset correcto marca completado', () => {
    const resetPassword = vi.fn().mockReturnValue(of({}));
    const { c } = setup({ resetPassword });
    c.form.setValue({ password: 'secreta', confirmar: 'secreta' });
    c.reset();
    expect(resetPassword).toHaveBeenCalledWith('tok123', 'secreta');
    expect(c.completado()).toBe(true);
    expect(c.loading()).toBe(false);
  });

  it('un 400 muestra el mensaje del servidor si existe', () => {
    const resetPassword = vi.fn().mockReturnValue(throwError(() => ({ status: 400, error: { error: 'Token caducado' } })));
    const { c } = setup({ resetPassword });
    c.form.setValue({ password: 'secreta', confirmar: 'secreta' });
    c.reset();
    expect(c.error()).toBe('Token caducado');
  });

  it('un 400 sin cuerpo usa el mensaje por defecto', () => {
    const resetPassword = vi.fn().mockReturnValue(throwError(() => ({ status: 400 })));
    const { c } = setup({ resetPassword });
    c.form.setValue({ password: 'secreta', confirmar: 'secreta' });
    c.reset();
    expect(c.error()).toContain('no es válido');
  });

  it('un 429 muestra demasiados intentos', () => {
    const resetPassword = vi.fn().mockReturnValue(throwError(() => ({ status: 429 })));
    const { c } = setup({ resetPassword });
    c.form.setValue({ password: 'secreta', confirmar: 'secreta' });
    c.reset();
    expect(c.error()).toContain('Demasiados intentos');
  });

  it('irALogin navega a la pantalla de login', () => {
    const { c, nav } = setup({ resetPassword: vi.fn() });
    c.irALogin();
    expect(nav).toHaveBeenCalledWith('/auth/login', { replaceUrl: true });
  });
});
