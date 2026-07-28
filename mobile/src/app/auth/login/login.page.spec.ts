import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '@peluqueria/core';
import { of, throwError } from 'rxjs';
import { BiometricService, UnlockResult } from '../../core/biometric.service';
import { LoginPage } from './login.page';

/** Doble del servicio de biometría: por defecto, un móvil sin huella enrolada. */
function dobleBiometrico(overrides: Record<string, unknown> = {}) {
  return {
    isEnabled: vi.fn(() => false),
    isAvailable: vi.fn(async () => false),
    ultimoIntento: vi.fn((): UnlockResult | null => null),
    unlock: vi.fn(async (): Promise<UnlockResult> => 'cancelado'),
    ...overrides,
  };
}

function setup(
  auth: Partial<Record<keyof AuthService, unknown>>,
  biometric: Record<string, unknown> = {},
) {
  const bio = dobleBiometrico(biometric);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: auth },
      { provide: BiometricService, useValue: bio },
    ],
  });
  const router = TestBed.inject(Router);
  const nav = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  const c = TestBed.runInInjectionContext(() => new LoginPage()) as any;
  return { c, nav, bio };
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

describe('LoginPage · botón de huella', () => {
  const enrolada = { isEnabled: vi.fn(() => true), isAvailable: vi.fn(async () => true) };

  it('se ofrece si hay sesión enrolada y el aparato la soporta', async () => {
    const { c } = setup({ isAdmin: () => false }, enrolada);
    await c.ngOnInit();
    expect(c.biometriaDisponible()).toBe(true);
  });

  it('no se ofrece si no hay nada enrolado', async () => {
    const { c } = setup({ isAdmin: () => false });
    await c.ngOnInit();
    expect(c.biometriaDisponible()).toBe(false);
  });

  it('no se ofrece si el aparato no tiene biometría utilizable', async () => {
    const { c } = setup(
      { isAdmin: () => false },
      { isEnabled: vi.fn(() => true), isAvailable: vi.fn(async () => false) },
    );
    await c.ngOnInit();
    expect(c.biometriaDisponible()).toBe(false);
  });

  it('al desbloquear con éxito entra en el área del rol', async () => {
    const { c, nav } = setup(
      { isAdmin: () => true },
      { ...enrolada, unlock: vi.fn(async () => 'ok' as UnlockResult) },
    );
    await c.ngOnInit();
    await c.desbloquear();
    expect(nav).toHaveBeenCalledWith('/admin', { replaceUrl: true });
    expect(c.desbloqueando()).toBe(false);
  });

  it('si se cancela, avisa y deja reintentar', async () => {
    const { c, nav } = setup(
      { isAdmin: () => false },
      { ...enrolada, unlock: vi.fn(async () => 'cancelado' as UnlockResult) },
    );
    await c.ngOnInit();
    await c.desbloquear();
    expect(nav).not.toHaveBeenCalled();
    expect(c.avisoBiometrico()).toContain('cancelado');
    expect(c.biometriaDisponible()).toBe(true);
  });

  it('si la sesión caducó, avisa y retira el botón', async () => {
    // El servicio ya ha olvidado el enrolamiento al rechazarse el refresh.
    const isEnabled = vi.fn(() => true);
    const { c } = setup(
      { isAdmin: () => false },
      {
        isEnabled,
        isAvailable: vi.fn(async () => true),
        unlock: vi.fn(async () => {
          isEnabled.mockReturnValue(false);
          return 'sesion-caducada' as UnlockResult;
        }),
      },
    );
    await c.ngOnInit();
    expect(c.biometriaDisponible()).toBe(true);

    await c.desbloquear();

    expect(c.avisoBiometrico()).toContain('caducado');
    expect(c.biometriaDisponible()).toBe(false);
  });

  it('explica al entrar por qué el arranque acabó en el login', async () => {
    const { c } = setup(
      { isAdmin: () => false },
      { ...enrolada, ultimoIntento: vi.fn(() => 'error-conexion' as UnlockResult) },
    );
    await c.ngOnInit();
    expect(c.avisoBiometrico()).toContain('conectar');
  });

  it('no lanza dos desbloqueos a la vez', async () => {
    const unlock = vi.fn(async () => 'cancelado' as UnlockResult);
    const { c } = setup({ isAdmin: () => false }, { ...enrolada, unlock });
    await c.ngOnInit();
    await Promise.all([c.desbloquear(), c.desbloquear()]);
    expect(unlock).toHaveBeenCalledTimes(1);
  });
});
