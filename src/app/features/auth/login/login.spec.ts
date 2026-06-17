import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '@peluqueria/core';
import { of, throwError } from 'rxjs';
import { Login } from './login';

function setup(auth: Partial<Record<keyof AuthService, unknown>>) {
  TestBed.configureTestingModule({
    imports: [Login],
    providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
  });
  const fixture = TestBed.createComponent(Login);
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  fixture.detectChanges();
  // Acceso a miembros protected para el test.
  const c = fixture.componentInstance as any;
  return { fixture, c, navigate };
}

describe('Login', () => {
  it('se crea', () => {
    const { fixture } = setup({ login: vi.fn() });
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('no envía si el formulario es inválido y marca los campos', () => {
    const login = vi.fn();
    const { c } = setup({ login });
    c.onSubmit();
    expect(login).not.toHaveBeenCalled();
    expect(c.form.controls.email.touched).toBe(true);
  });

  it('login correcto de un ADMIN navega al dashboard', () => {
    const login = vi.fn().mockReturnValue(of({ token: 't', email: 'a@b.com', nombre: 'A', rol: 'ADMIN' }));
    const { c, navigate } = setup({ login, isAdmin: () => true });
    c.form.setValue({ email: 'a@b.com', password: 'secreta' });
    c.onSubmit();
    expect(login).toHaveBeenCalledWith({ email: 'a@b.com', password: 'secreta' });
    expect(navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(c.loading()).toBe(false);
    expect(c.errorMsg()).toBeNull();
  });

  it('cuenta válida pero NO admin: cierra sesión, muestra error y no navega', () => {
    const login = vi.fn().mockReturnValue(of({ token: 't', email: 'u@b.com', nombre: 'U', rol: 'USER' }));
    const logout = vi.fn();
    const { c, navigate } = setup({ login, isAdmin: () => false, logout });
    c.form.setValue({ email: 'u@b.com', password: 'secreta' });
    c.onSubmit();
    expect(logout).toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(c.errorMsg()).toContain('administrador');
  });

  it('error del backend muestra el mensaje del servidor si existe', () => {
    const login = vi.fn().mockReturnValue(throwError(() => ({ error: { error: 'Credenciales malas' } })));
    const { c } = setup({ login, isAdmin: () => false });
    c.form.setValue({ email: 'a@b.com', password: 'secreta' });
    c.onSubmit();
    expect(c.loading()).toBe(false);
    expect(c.errorMsg()).toBe('Credenciales malas');
  });

  it('error sin cuerpo muestra el mensaje por defecto', () => {
    const login = vi.fn().mockReturnValue(throwError(() => ({})));
    const { c } = setup({ login, isAdmin: () => false });
    c.form.setValue({ email: 'a@b.com', password: 'secreta' });
    c.onSubmit();
    expect(c.errorMsg()).toContain('No se pudo iniciar sesión');
  });

  it('showError solo es true cuando el control es inválido y fue tocado', () => {
    const { c } = setup({ login: vi.fn() });
    expect(c.showError('email')).toBe(false);
    c.form.controls.email.markAsTouched();
    expect(c.showError('email')).toBe(true);
  });
});
