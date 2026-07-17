import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL, AuthService, TOKEN_STORAGE } from '@peluqueria/core';
import { BiometricService } from './biometric.service';
import { BiometricTokenStorage } from './biometric-token-storage';

const { prefs, secure, biometric } = vi.hoisted(() => {
  const prefs = new Map<string, string>();
  const secure = new Map<string, { username: string; password: string }>();
  return {
    prefs,
    secure,
    biometric: {
      isAvailable: vi.fn(async () => ({ isAvailable: true })),
      verifyIdentity: vi.fn(async () => undefined),
      setCredentials: vi.fn(async ({ username, password, server }: { username: string; password: string; server: string }) => {
        secure.set(server, { username, password });
      }),
      getCredentials: vi.fn(async ({ server }: { server: string }) => secure.get(server) ?? { username: '', password: '' }),
      deleteCredentials: vi.fn(async ({ server }: { server: string }) => {
        secure.delete(server);
      }),
    },
  };
});

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => ({ value: prefs.get(key) ?? null })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
      prefs.set(key, value);
    }),
    remove: vi.fn(async ({ key }: { key: string }) => {
      prefs.delete(key);
    }),
  },
}));

vi.mock('@capgo/capacitor-native-biometric', () => ({ NativeBiometric: biometric }));

const API = 'http://test/api';
const SECURE_SERVER = 'com.segovia.peluqueria.refresh';

/**
 * El almacén persiste en segundo plano (promesas fire-and-forget); se drenan
 * las tareas pendientes antes de limpiar el estado para que una escritura
 * rezagada de un test no aterrice en el siguiente.
 */
const drenar = () => new Promise<void>((resolve) => setTimeout(resolve));

describe('BiometricService', () => {
  let service: InstanceType<typeof BiometricService>;
  let storage: InstanceType<typeof BiometricTokenStorage>;
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(async () => {
    await drenar();
    prefs.clear();
    secure.clear();
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: API },
        { provide: TOKEN_STORAGE, useClass: BiometricTokenStorage },
      ],
    });
    service = TestBed.inject(BiometricService);
    storage = TestBed.inject(TOKEN_STORAGE) as InstanceType<typeof BiometricTokenStorage>;
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('isAvailable refleja el resultado del plugin', async () => {
    expect(await service.isAvailable()).toBe(true);
    biometric.isAvailable.mockRejectedValueOnce(new Error('no hw'));
    expect(await service.isAvailable()).toBe(false);
  });

  it('enable verifica identidad y guarda el refresh en el keystore', async () => {
    // Simula una sesión activa: el login deja el refresh en el almacén.
    auth.login({ email: 'a@b.com', password: 'x' }).subscribe();
    http.expectOne(`${API}/auth/login`).flush({
      token: 'jwt', refreshToken: 'r1', email: 'a@b.com', nombre: 'Ana', rol: 'USER',
    });

    await service.enable();

    expect(biometric.verifyIdentity).toHaveBeenCalled();
    expect(service.isEnabled()).toBe(true);
    expect(secure.get(SECURE_SERVER)?.password).toBe('r1');
  });

  it('unlock pide biometría, recupera el refresh y renueva la sesión', async () => {
    prefs.set('peluqueria_biometric', 'true');
    secure.set(SECURE_SERVER, { username: 'session', password: 'r-seguro' });
    await storage.init();

    const ok = service.unlock();
    // unlock encadena verifyIdentity + getCredentials (microtasks) antes de refrescar.
    await new Promise((r) => setTimeout(r, 0));

    const req = http.expectOne(`${API}/auth/refresh`);
    expect(req.request.body).toEqual({ refreshToken: 'r-seguro' });
    req.flush({ token: 'jwt-2', refreshToken: 'r3', email: 'a@b.com', nombre: 'Ana', rol: 'USER' });

    expect(await ok).toBe(true);
    expect(biometric.verifyIdentity).toHaveBeenCalled();
    expect(auth.getToken()).toBe('jwt-2');
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('unlock devuelve false si la biometría falla (sin renovar sesión)', async () => {
    prefs.set('peluqueria_biometric', 'true');
    secure.set(SECURE_SERVER, { username: 'session', password: 'r-seguro' });
    await storage.init();
    biometric.verifyIdentity.mockRejectedValueOnce(new Error('cancelado'));

    expect(await service.unlock()).toBe(false);
    expect(auth.isAuthenticated()).toBe(false);
    // afterEach http.verify() confirma que NO se llamó a /auth/refresh.
  });

  it('disable borra el keystore y desactiva la biometría', async () => {
    auth.login({ email: 'a@b.com', password: 'x' }).subscribe();
    http.expectOne(`${API}/auth/login`).flush({
      token: 'jwt', refreshToken: 'r1', email: 'a@b.com', nombre: 'Ana', rol: 'USER',
    });
    await service.enable();

    await service.disable();

    expect(service.isEnabled()).toBe(false);
    expect(secure.has(SECURE_SERVER)).toBe(false);
  });
});
