import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { AuthService } from '@peluqueria/core';
import { of, throwError } from 'rxjs';
import { Login } from './login';

function setup(
  auth: Partial<Record<keyof AuthService, unknown>>,
  returnUrl: string | null = null,
) {
  // Los tests de aquí son o un ADMIN o un cliente, así que `isStaff` se deriva de `isAdmin`
  // salvo que el test diga otra cosa (el caso del PELUQUERO, que es staff y no admin).
  const dobleAuth = {
    isStaff: () => Boolean((auth as { isAdmin?: () => boolean }).isAdmin?.()),
    ...auth,
  };
  TestBed.configureTestingModule({
    imports: [Login],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: dobleAuth },
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
  const fixture = TestBed.createComponent(Login);
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  fixture.detectChanges();
  // Acceso a miembros protected para el test.
  const c = fixture.componentInstance as any;
  return { fixture, c, navigate, navigateByUrl };
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

  it('login correcto de un ADMIN entra por el redirector de inicio', () => {
    // A `/inicio` y no a `/dashboard`: el dashboard vive de `/api/estadisticas`, que es de
    // ADMIN, y `/inicio` es lo que lleva a cada rol a su pantalla.
    const login = vi.fn().mockReturnValue(of({ token: 't', email: 'a@b.com', nombre: 'A', rol: 'ADMIN' }));
    const { c, navigateByUrl } = setup({ login, isAdmin: () => true });
    c.form.setValue({ email: 'a@b.com', password: 'secreta' });
    c.onSubmit();
    expect(login).toHaveBeenCalledWith({ email: 'a@b.com', password: 'secreta' });
    expect(navigateByUrl).toHaveBeenCalledWith('/inicio');
    expect(c.loading()).toBe(false);
    expect(c.errorMsg()).toBeNull();
  });

  it('un PELUQUERO entra en el panel: es la puerta de su agenda y su producción', () => {
    // Esto estaba roto: el login exigía ADMIN, así que un peluquero no podía entrar y la
    // mitad de las pantallas que se le construyeron (galería, «Mi CV público», producción)
    // eran inalcanzables por la web.
    const login = vi.fn().mockReturnValue(of({ token: 't', email: 'p@b.com', nombre: 'P', rol: 'PELUQUERO' }));
    const logout = vi.fn();
    const { c, navigateByUrl } = setup({
      login,
      isAdmin: () => false,
      isStaff: () => true,
      logout,
    });
    c.form.setValue({ email: 'p@b.com', password: 'secreta' });
    c.onSubmit();
    expect(logout).not.toHaveBeenCalled();
    expect(navigateByUrl).toHaveBeenCalledWith('/inicio');
    expect(c.errorMsg()).toBeNull();
  });

  it('un cliente NO entra: cierra sesión, muestra error y no navega', () => {
    const login = vi.fn().mockReturnValue(of({ token: 't', email: 'u@b.com', nombre: 'U', rol: 'USER' }));
    const logout = vi.fn();
    const { c, navigate, navigateByUrl } = setup({ login, isAdmin: () => false, logout });
    c.form.setValue({ email: 'u@b.com', password: 'secreta' });
    c.onSubmit();
    expect(logout).toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(navigateByUrl).not.toHaveBeenCalled();
    expect(c.errorMsg()).toContain('acceso al panel');
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

  /**
   * El `returnUrl` lo ponen los guards al rebotar por falta de sesión, para que una sesión
   * caducada devuelva a la pantalla donde se estaba.
   */
  describe('returnUrl', () => {
    function entrar(c: any) {
      c.form.setValue({ email: 'a@b.com', password: 'secreta' });
      c.onSubmit();
    }

    const sesion = (rol: 'ADMIN' | 'PELUQUERO') => ({
      login: vi.fn().mockReturnValue(of({ token: 't' })),
      isAdmin: () => rol === 'ADMIN',
      isStaff: () => true,
      logout: vi.fn(),
    });

    it('se vuelve a donde se estaba', () => {
      const { c, navigateByUrl } = setup(sesion('ADMIN'), '/produccion?desde=2026-01-01');
      entrar(c);
      expect(navigateByUrl).toHaveBeenCalledWith('/produccion?desde=2026-01-01');
    });

    it('sin returnUrl se entra por /inicio', () => {
      const { c, navigateByUrl } = setup(sesion('ADMIN'));
      entrar(c);
      expect(navigateByUrl).toHaveBeenCalledWith('/inicio');
    });

    it('un destino de fuera de la app NO se obedece', () => {
      // Un redirect abierto: mandaría a alguien recién autenticado a una pantalla de otro.
      const { c, navigateByUrl } = setup(sesion('ADMIN'), 'https://sitio-falso/login');
      entrar(c);
      expect(navigateByUrl).toHaveBeenCalledWith('/inicio');
    });

    it('a un peluquero no se le manda a una pantalla de ADMIN', () => {
      // Puede traerla si su sesión caducó ahí o si escribió la URL: `adminGuard` la rebotaría,
      // y el usuario vería un salto que no ha pedido.
      const { c, navigateByUrl } = setup(sesion('PELUQUERO'), '/usuarios');
      entrar(c);
      expect(navigateByUrl).toHaveBeenCalledWith('/inicio');
    });

    it('pero sí a las que comparte con el administrador', () => {
      const { c, navigateByUrl } = setup(sesion('PELUQUERO'), '/citas?estado=CONFIRMADA');
      entrar(c);
      expect(navigateByUrl).toHaveBeenCalledWith('/citas?estado=CONFIRMADA');
    });

    it('un ADMIN sí vuelve a sus pantallas', () => {
      const { c, navigateByUrl } = setup(sesion('ADMIN'), '/usuarios');
      entrar(c);
      expect(navigateByUrl).toHaveBeenCalledWith('/usuarios');
    });
  });
});
