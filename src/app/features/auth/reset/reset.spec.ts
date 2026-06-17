import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { AuthService } from '@peluqueria/core';
import { of, throwError } from 'rxjs';
import { Reset } from './reset';

function setup(auth: Partial<Record<keyof AuthService, unknown>>, token: string | null) {
  TestBed.configureTestingModule({
    imports: [Reset],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: auth },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => token } } } },
    ],
  });
  const fixture = TestBed.createComponent(Reset);
  fixture.detectChanges();
  const c = fixture.componentInstance as any;
  return { fixture, c };
}

describe('Reset', () => {
  it('sin token expone token nulo (la plantilla muestra enlace inválido)', () => {
    const { c } = setup({ resetPassword: vi.fn() }, null);
    expect(c.token).toBeNull();
  });

  it('no envía si las contraseñas no coinciden', () => {
    const resetPassword = vi.fn();
    const { c } = setup({ resetPassword }, 'tok-123');
    c.form.setValue({ password: 'secreta', confirmar: 'distinta' });
    c.onSubmit();
    expect(resetPassword).not.toHaveBeenCalled();
    expect(c.form.hasError('noCoincide')).toBe(true);
  });

  it('no envía si la contraseña es demasiado corta', () => {
    const resetPassword = vi.fn();
    const { c } = setup({ resetPassword }, 'tok-123');
    c.form.setValue({ password: '123', confirmar: '123' });
    c.onSubmit();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('reset correcto marca completado', () => {
    const resetPassword = vi.fn().mockReturnValue(of({}));
    const { c } = setup({ resetPassword }, 'tok-123');
    c.form.setValue({ password: 'secreta', confirmar: 'secreta' });
    c.onSubmit();
    expect(resetPassword).toHaveBeenCalledWith('tok-123', 'secreta');
    expect(c.completado()).toBe(true);
  });

  it('un 400 muestra el mensaje del backend o uno por defecto', () => {
    const resetPassword = vi.fn().mockReturnValue(throwError(() => ({ status: 400, error: { error: 'Token caducado' } })));
    const { c } = setup({ resetPassword }, 'tok-123');
    c.form.setValue({ password: 'secreta', confirmar: 'secreta' });
    c.onSubmit();
    expect(c.errorMsg()).toBe('Token caducado');
    expect(c.completado()).toBe(false);
  });

  it('un 429 muestra el mensaje de demasiados intentos', () => {
    const resetPassword = vi.fn().mockReturnValue(throwError(() => ({ status: 429 })));
    const { c } = setup({ resetPassword }, 'tok-123');
    c.form.setValue({ password: 'secreta', confirmar: 'secreta' });
    c.onSubmit();
    expect(c.errorMsg()).toContain('Demasiados intentos');
  });
});
