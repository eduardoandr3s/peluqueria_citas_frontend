import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AlertController } from '@ionic/angular/standalone';
import { AuthService } from '@peluqueria/core';
import { BiometricService } from '../core/biometric.service';
import { PerfilPage } from './perfil.page';

function setup(
  auth: Partial<Record<keyof AuthService, unknown>>,
  biometric: Partial<Record<keyof BiometricService, unknown>> = {},
) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: auth },
      { provide: AlertController, useValue: { create: vi.fn().mockResolvedValue({ present: vi.fn() }) } },
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
    ],
  });
  const router = TestBed.inject(Router);
  const nav = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  const bio = TestBed.inject(BiometricService) as any;
  const c = TestBed.runInInjectionContext(() => new PerfilPage()) as any;
  return { c, nav, bio };
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
});
