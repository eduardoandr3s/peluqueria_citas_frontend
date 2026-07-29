import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AlertController } from '@ionic/angular/standalone';
import { AuthService, Usuario, UsuarioService } from '@peluqueria/core';
import { of, throwError } from 'rxjs';
import { BiometricService } from '../core/biometric.service';
import { CamaraService } from '../core/camara.service';
import { PerfilPage } from './perfil.page';

const YO: Usuario = {
  idUsuario: 7,
  nombre: 'Ana',
  email: 'a@b.com',
  rol: 'USER',
  activo: true,
  urlAvatar: null,
};

function setup(
  auth: Partial<Record<keyof AuthService, unknown>>,
  biometric: Partial<Record<keyof BiometricService, unknown>> = {},
  extras: {
    usuarios?: Partial<Record<keyof UsuarioService, unknown>>;
    camara?: Partial<Record<keyof CamaraService, unknown>>;
  } = {},
) {
  const alertaCreada = vi.fn().mockResolvedValue({ present: vi.fn() });
  const usuarios = {
    me: vi.fn().mockReturnValue(of({ ...YO })),
    subirAvatar: vi.fn().mockReturnValue(of({ ...YO, urlAvatar: 'https://a/firmada/7.jpg' })),
    borrarAvatar: vi.fn().mockReturnValue(of({ ...YO, urlAvatar: null })),
    ...extras.usuarios,
  };
  const camara = {
    elegirFoto: vi.fn().mockResolvedValue({ ok: true, blob: new Blob(['bytes'], { type: 'image/jpeg' }) }),
    ...extras.camara,
  };

  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { setAvatarUrl: vi.fn(), ...auth } },
      { provide: AlertController, useValue: { create: alertaCreada } },
      {
        provide: BiometricService,
        useValue: {
          isAvailable: vi.fn().mockResolvedValue(false),
          isEnabled: vi.fn().mockReturnValue(false),
          enable: vi.fn().mockResolvedValue(undefined),
          disable: vi.fn().mockResolvedValue(undefined),
          ...biometric,
        },
      },
      { provide: UsuarioService, useValue: usuarios },
      { provide: CamaraService, useValue: camara },
    ],
  });
  const router = TestBed.inject(Router);
  const nav = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  const bio = TestBed.inject(BiometricService) as any;
  const authMock = TestBed.inject(AuthService) as any;
  const c = TestBed.runInInjectionContext(() => new PerfilPage()) as any;
  return { c, nav, bio, usuarios, camara, authMock, alertaCreada };
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

  it('al entrar refleja la disponibilidad y el estado de la biometría', async () => {
    const { c } = setup(
      { user: () => null },
      { isAvailable: vi.fn().mockResolvedValue(true), isEnabled: vi.fn().mockReturnValue(true) },
    );
    await c.ionViewWillEnter();
    expect(c.biometriaDisponible()).toBe(true);
    expect(c.biometriaActiva()).toBe(true);
  });

  it('activar el toggle llama a enable y marca la biometría activa', async () => {
    let enabled = false;
    const { c, bio } = setup(
      { user: () => null },
      {
        enable: vi.fn().mockImplementation(async () => { enabled = true; }),
        isEnabled: vi.fn().mockImplementation(() => enabled),
      },
    );
    await c.onToggleBiometria({ detail: { checked: true } } as CustomEvent);
    expect(bio.enable).toHaveBeenCalled();
    expect(c.biometriaActiva()).toBe(true);
  });

  it('si el usuario cancela al activar, revierte el toggle', async () => {
    const { c, bio } = setup(
      { user: () => null },
      { enable: vi.fn().mockRejectedValue(new Error('cancelado')), isEnabled: vi.fn().mockReturnValue(false) },
    );
    await c.onToggleBiometria({ detail: { checked: true } } as CustomEvent);
    expect(bio.enable).toHaveBeenCalled();
    expect(c.biometriaActiva()).toBe(false);
  });

  it('desactivar el toggle llama a disable', async () => {
    let enabled = true;
    const { c, bio } = setup(
      { user: () => null },
      {
        isEnabled: vi.fn().mockImplementation(() => enabled),
        disable: vi.fn().mockImplementation(async () => { enabled = false; }),
      },
    );
    // Estado inicial: activa.
    c.biometriaActiva.set(true);
    await c.onToggleBiometria({ detail: { checked: false } } as CustomEvent);
    expect(bio.disable).toHaveBeenCalled();
    expect(c.biometriaActiva()).toBe(false);
  });

  // === Avatar ===

  it('al entrar carga el perfil y publica el avatar en la sesión', async () => {
    const { c, usuarios, authMock } = setup(
      { user: () => ({ email: 'a@b.com', nombre: 'Ana', rol: 'USER' }) },
      {},
      { usuarios: { me: vi.fn().mockReturnValue(of({ ...YO, urlAvatar: 'https://a/firmada/7.jpg' })) } },
    );

    await c.ionViewWillEnter();

    expect(usuarios.me).toHaveBeenCalled();
    expect(c.usuario().urlAvatar).toBe('https://a/firmada/7.jpg');
    expect(authMock.setAvatarUrl).toHaveBeenCalledWith('https://a/firmada/7.jpg');
  });

  it('si /me falla, la pantalla sigue viva con los datos de la sesión', async () => {
    const { c } = setup(
      { user: () => ({ email: 'a@b.com', nombre: 'Ana', rol: 'USER' }) },
      {},
      { usuarios: { me: vi.fn().mockReturnValue(throwError(() => new Error('x'))) } },
    );

    await c.ionViewWillEnter();

    expect(c.usuario()).toBeNull();
    expect(c.avatarError()).toBeNull();
  });

  it('la foto de la cámara se sube y actualiza el avatar', async () => {
    const { c, usuarios, camara, authMock } = setup({ user: () => null });
    await c.ionViewWillEnter();

    await c.cambiarFoto();

    expect(camara.elegirFoto).toHaveBeenCalled();
    expect(usuarios.subirAvatar).toHaveBeenCalledWith(7, expect.anything());
    expect(c.usuario().urlAvatar).toBe('https://a/firmada/7.jpg');
    expect(authMock.setAvatarUrl).toHaveBeenLastCalledWith('https://a/firmada/7.jpg');
    expect(c.subiendo()).toBe(false);
  });

  it('cancelar la cámara no sube nada ni pinta ningún error', async () => {
    const { c, usuarios } = setup({ user: () => null }, {}, {
      camara: { elegirFoto: vi.fn().mockResolvedValue({ ok: false, motivo: 'cancelado' }) },
    });
    await c.ionViewWillEnter();

    await c.cambiarFoto();

    expect(usuarios.subirAvatar).not.toHaveBeenCalled();
    expect(c.avatarError()).toBeNull();
  });

  it('sin permiso se explica con un aviso, no en silencio', async () => {
    const { c, alertaCreada } = setup({ user: () => null }, {}, {
      camara: { elegirFoto: vi.fn().mockResolvedValue({ ok: false, motivo: 'sin-permiso' }) },
    });
    await c.ionViewWillEnter();
    alertaCreada.mockClear();

    await c.cambiarFoto();

    expect(alertaCreada).toHaveBeenCalledWith(
      expect.objectContaining({ header: 'Sin permiso' }),
    );
  });

  it('un fallo de la cámara se avisa en la propia pantalla', async () => {
    const { c } = setup({ user: () => null }, {}, {
      camara: { elegirFoto: vi.fn().mockResolvedValue({ ok: false, motivo: 'error' }) },
    });
    await c.ionViewWillEnter();

    await c.cambiarFoto();

    expect(c.avatarError()).toContain('No se pudo abrir la cámara');
  });

  it('un 413 al subir se explica como foto demasiado grande', async () => {
    const { c } = setup({ user: () => null }, {}, {
      usuarios: {
        subirAvatar: vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 413 }))),
      },
    });
    await c.ionViewWillEnter();

    await c.cambiarFoto();

    expect(c.avatarError()).toContain('demasiado grande');
    expect(c.subiendo()).toBe(false);
  });

  it('no se puede lanzar una subida mientras hay otra en marcha', async () => {
    const { c, camara } = setup({ user: () => null });
    await c.ionViewWillEnter();
    c.subiendo.set(true);

    await c.cambiarFoto();

    expect(camara.elegirFoto).not.toHaveBeenCalled();
  });

  it('quitar la foto la borra y deja la sesión sin avatar', async () => {
    const { c, usuarios, authMock } = setup({ user: () => null }, {}, {
      usuarios: { me: vi.fn().mockReturnValue(of({ ...YO, urlAvatar: 'https://a/firmada/7.jpg' })) },
    });
    await c.ionViewWillEnter();

    c.quitarFoto();

    expect(usuarios.borrarAvatar).toHaveBeenCalledWith(7);
    expect(c.usuario().urlAvatar).toBeNull();
    expect(authMock.setAvatarUrl).toHaveBeenLastCalledWith(null);
  });
});
