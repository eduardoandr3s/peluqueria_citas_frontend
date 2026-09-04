import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { AuthService, rutaInternaSegura } from '@peluqueria/core';
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
  returnUrl: string | null = null,
) {
  const bio = dobleBiometrico(biometric);
  // Los tests de aqui son o un ADMIN o un cliente, asi que `isStaff` se deriva de `isAdmin`
  // salvo que el test diga otra cosa (el caso del PELUQUERO, que es staff y no admin).
  const dobleAuth = {
    isStaff: () => Boolean((auth as { isAdmin?: () => boolean }).isAdmin?.()),
    ...auth,
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: dobleAuth },
      { provide: BiometricService, useValue: bio },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            queryParamMap: convertToParamMap(returnUrl == null ? {} : { returnUrl }),
          },
        },
      },
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

  /**
   * Las dos salidas del login que no piden cuenta. Se prueba sobre la plantilla porque el
   * enlace ES el mecanismo: sus endpoints son publicos, pero todo /tabs exige sesion, asi que
   * sin estos dos anclas nadie llegaria nunca a esas rutas. Borrar uno no rompe ni el
   * compilador ni ningun otro test.
   */
  describe('salidas sin cuenta', () => {
    function render() {
      TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          { provide: AuthService, useValue: { login: vi.fn(), isAdmin: vi.fn(() => false) } },
          { provide: BiometricService, useValue: dobleBiometrico() },
        ],
      });
      const fixture = TestBed.createComponent(LoginPage);
      fixture.detectChanges();
      return Array.from(fixture.nativeElement.querySelectorAll('a')).map((a) =>
        (a as HTMLAnchorElement).getAttribute('href'),
      );
    }

    it('el login enlaza al equipo y al asistente', () => {
      const hrefs = render();

      expect(hrefs).toContain('/equipo');
      expect(hrefs).toContain('/asistente');
    });

    it('y sigue enlazando al registro y a la recuperación', () => {
      const hrefs = render();

      expect(hrefs).toContain('/auth/register');
      expect(hrefs).toContain('/auth/recuperar');
    });
  });

  /**
   * El `returnUrl` existe por «El equipo», que es publico: se elige a alguien sin tener
   * cuenta y, tras entrar, hay que caer en agendar con esa persona ya puesta. Sin esto el
   * visitante tendria que volver a buscarla, que es el paso que esa pantalla quita.
   */
  describe('returnUrl', () => {
    function autenticado(rol: 'USER' | 'PELUQUERO' | 'ADMIN') {
      return {
        login: vi.fn().mockReturnValue(of({})),
        isAdmin: vi.fn(() => rol === 'ADMIN'),
        isStaff: vi.fn(() => rol !== 'USER'),
      };
    }

    function entrar(c: any) {
      c.form.setValue({ email: 'ana@test.com', password: 'Secreta123!' });
      c.login();
    }

    it('un cliente cae en el destino que venia en la URL', () => {
      const { c, nav } = setup(autenticado('USER'), {}, '/tabs/agendar?peluqueroId=2');
      entrar(c);

      expect(nav).toHaveBeenCalledWith('/tabs/agendar?peluqueroId=2', { replaceUrl: true });
    });

    it('sin returnUrl se sigue entrando donde se entraba', () => {
      const { c, nav } = setup(autenticado('USER'));
      entrar(c);

      expect(nav).toHaveBeenCalledWith('/tabs', { replaceUrl: true });
    });

    it('el desbloqueo por huella respeta el mismo destino', async () => {
      // Es la otra puerta de entrada: si solo lo hiciera el formulario, entrar con huella
      // desde el enlace del equipo perderia la eleccion.
      const { c, nav } = setup(
        autenticado('USER'),
        { isEnabled: vi.fn(() => true), isAvailable: vi.fn(async () => true), unlock: vi.fn(async () => 'ok') },
        '/tabs/agendar?peluqueroId=5',
      );

      await c.desbloquear();

      expect(nav).toHaveBeenCalledWith('/tabs/agendar?peluqueroId=5', { replaceUrl: true });
    });

    it('a un ADMIN no se le manda a una ruta de cliente: clientGuard lo rebotaria', () => {
      // Obedecer a ciegas mandaria a la pantalla que el guard del area contraria va a
      // rechazar, y el usuario veria un salto que no ha pedido.
      const { c, nav } = setup(autenticado('ADMIN'), {}, '/tabs/agendar?peluqueroId=2');
      entrar(c);

      expect(nav).toHaveBeenCalledWith('/admin', { replaceUrl: true });
    });

    it('pero el personal SI vuelve a su propia area, que es de donde lo echo el guard', () => {
      // Es el caso que abren los guards: una sesion caducada en /admin/produccion tiene que
      // devolver ahi y no a la pantalla de inicio.
      const { c, nav } = setup(autenticado('PELUQUERO'), {}, '/admin/produccion');
      entrar(c);

      expect(nav).toHaveBeenCalledWith('/admin/produccion', { replaceUrl: true });
    });

    it('a un cliente no se le manda al area de trabajo', () => {
      // Puede traerlo si escribio la ruta a mano y le rebotaron: staffGuard lo devolveria.
      const { c, nav } = setup(autenticado('USER'), {}, '/admin/usuarios');
      entrar(c);

      expect(nav).toHaveBeenCalledWith('/tabs', { replaceUrl: true });
    });

    // /pago/:id, /equipo y /asistente no los rebota ningun guard de rol, asi que valen para
    // los dos. Van en dos tests porque este `setup` no resetea el TestBed y la segunda
    // configuracion se ignoraria.
    it('lo que no es de ningun area vale para un cliente', () => {
      const { c, nav } = setup(autenticado('USER'), {}, '/pago/5');
      entrar(c);

      expect(nav).toHaveBeenCalledWith('/pago/5', { replaceUrl: true });
    });

    it('lo que no es de ningun area vale tambien para el personal', () => {
      const { c, nav } = setup(autenticado('ADMIN'), {}, '/pago/5');
      entrar(c);

      expect(nav).toHaveBeenCalledWith('/pago/5', { replaceUrl: true });
    });

    it('un destino de fuera de la app NO se obedece', () => {
      // Un redirect abierto: mandaria a alguien recien autenticado a una pantalla de otro.
      const { c, nav } = setup(autenticado('USER'), {}, 'https://sitio-falso/login');
      entrar(c);

      expect(nav).toHaveBeenCalledWith('/tabs', { replaceUrl: true });
    });

    it('rutaInternaSegura acepta solo rutas internas', () => {
      expect(rutaInternaSegura('/tabs/agendar?peluqueroId=2', '/auth/login')).toBe('/tabs/agendar?peluqueroId=2');
      expect(rutaInternaSegura('/tabs', '/auth/login')).toBe('/tabs');
    });

    it('rutaInternaSegura rechaza todo lo que sale de la app o hace bucle', () => {
      expect(rutaInternaSegura(null, '/auth/login')).toBeNull();
      expect(rutaInternaSegura('', '/auth/login')).toBeNull();
      // Sin barra inicial no es una ruta: el Router lo resolveria relativo a donde este.
      expect(rutaInternaSegura('tabs/agendar', '/auth/login')).toBeNull();
      expect(rutaInternaSegura('https://sitio-falso/x', '/auth/login')).toBeNull();
      // Protocolo-relativo: se lee como host, no como ruta.
      expect(rutaInternaSegura('//sitio-falso/x', '/auth/login')).toBeNull();
      // Hay navegadores que tratan la barra invertida como la otra.
      expect(rutaInternaSegura('/\\sitio-falso/x', '/auth/login')).toBeNull();
      expect(rutaInternaSegura('javascript:alert(1)', '/auth/login')).toBeNull();
      // Volver al login seria un bucle.
      expect(rutaInternaSegura('/auth/login', '/auth/login')).toBeNull();
      expect(rutaInternaSegura('/auth/login?returnUrl=/tabs', '/auth/login')).toBeNull();
    });

    it('un PELUQUERO entra en su area en un solo salto, aunque no sea admin', () => {
      // Antes iba a /tabs y clientGuard lo llevaba a /admin: dos saltos para llegar al mismo
      // sitio. Es la misma regla que ya usaba sessionRedirectGuard para la raiz.
      const auth = autenticado('PELUQUERO');
      const { c, nav } = setup(auth, {}, '/tabs/agendar?peluqueroId=2');
      entrar(c);

      expect(auth.isStaff).toHaveBeenCalled();
      expect(nav).toHaveBeenCalledWith('/admin', { replaceUrl: true });
    });
  });
});
