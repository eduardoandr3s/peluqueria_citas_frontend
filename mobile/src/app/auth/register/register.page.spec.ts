import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '@peluqueria/core';
import { of, throwError } from 'rxjs';
import { RegisterPage } from './register.page';

function setup(auth: Partial<Record<keyof AuthService, unknown>>) {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
  });
  const router = TestBed.inject(Router);
  const nav = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  const c = TestBed.runInInjectionContext(() => new RegisterPage()) as any;
  return { c, nav };
}

const VALIDO = { nombre: 'Ana', email: 'ana@b.com', telefono: '', password: 'secreta' };

describe('RegisterPage', () => {
  it('no envía si el formulario es inválido', () => {
    const registro = vi.fn();
    const { c } = setup({ registro });
    c.register();
    expect(registro).not.toHaveBeenCalled();
  });

  it('registro correcto hace login automático y navega a /tabs (teléfono vacío => undefined)', () => {
    const registro = vi.fn().mockReturnValue(of({}));
    const login = vi.fn().mockReturnValue(of({ token: 't', email: 'ana@b.com', nombre: 'Ana', rol: 'USER' }));
    const { c, nav } = setup({ registro, login });
    c.form.setValue(VALIDO);
    c.register();
    expect(registro).toHaveBeenCalledWith({
      nombre: 'Ana',
      email: 'ana@b.com',
      password: 'secreta',
      telefono: undefined,
    });
    expect(login).toHaveBeenCalledWith({ email: 'ana@b.com', password: 'secreta' });
    expect(nav).toHaveBeenCalledWith('/tabs', { replaceUrl: true });
  });

  it('si el login automático falla, lleva a la pantalla de login', () => {
    const registro = vi.fn().mockReturnValue(of({}));
    const login = vi.fn().mockReturnValue(throwError(() => ({ status: 500 })));
    const { c, nav } = setup({ registro, login });
    c.form.setValue(VALIDO);
    c.register();
    expect(nav).toHaveBeenCalledWith('/auth/login', { replaceUrl: true });
    expect(c.loading()).toBe(false);
  });

  it('email duplicado (409) muestra el mensaje correspondiente', () => {
    const registro = vi.fn().mockReturnValue(throwError(() => ({ status: 409 })));
    const { c } = setup({ registro });
    c.form.setValue(VALIDO);
    c.register();
    expect(c.error()).toContain('Ya existe');
  });

  it('datos inválidos (400) muestra revisar datos', () => {
    const registro = vi.fn().mockReturnValue(throwError(() => ({ status: 400 })));
    const { c } = setup({ registro });
    c.form.setValue(VALIDO);
    c.register();
    expect(c.error()).toContain('Revisa');
  });

  it('otro error muestra error de conexión', () => {
    const registro = vi.fn().mockReturnValue(throwError(() => ({ status: 500 })));
    const { c } = setup({ registro });
    c.form.setValue(VALIDO);
    c.register();
    expect(c.error()).toContain('conexión');
  });
});
