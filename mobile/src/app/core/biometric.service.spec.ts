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

  /** Deja el almacén como al abrir la app con la huella ya enrolada. */
  async function conHuellaEnrolada(refresh = 'r-seguro'): Promise<void> {
    prefs.set('peluqueria_biometric', 'true');
    secure.set(SECURE_SERVER, { username: 'session', password: refresh });
    await storage.init();
  }

  /** unlock encadena verifyIdentity + getCredentials (microtasks) antes de refrescar. */
  const trasLasMicrotasks = () => new Promise((r) => setTimeout(r, 0));

  it('unlock pide biometría, recupera el refresh y renueva la sesión', async () => {
    await conHuellaEnrolada();

    const ok = service.unlock();
    await trasLasMicrotasks();

    const req = http.expectOne(`${API}/auth/refresh`);
    expect(req.request.body).toEqual({ refreshToken: 'r-seguro' });
    req.flush({ token: 'jwt-2', refreshToken: 'r3', email: 'a@b.com', nombre: 'Ana', rol: 'USER' });

    expect(await ok).toBe('ok');
    expect(service.ultimoIntento()).toBe('ok');
    expect(biometric.verifyIdentity).toHaveBeenCalled();
    expect(auth.getToken()).toBe('jwt-2');
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('unlock informa de la cancelación sin tocar la sesión ni el enrolamiento', async () => {
    await conHuellaEnrolada();
    biometric.verifyIdentity.mockRejectedValueOnce(new Error('cancelado'));

    expect(await service.unlock()).toBe('cancelado');
    expect(service.ultimoIntento()).toBe('cancelado');
    expect(auth.isAuthenticated()).toBe(false);
    // La huella sigue enrolada: el botón del login debe poder reintentar.
    expect(service.isEnabled()).toBe(true);
    expect(secure.has(SECURE_SERVER)).toBe(true);
    // afterEach http.verify() confirma que NO se llamó a /auth/refresh.
  });

  it('unlock olvida la huella si el servidor rechaza el refresh', async () => {
    await conHuellaEnrolada('r-revocado');

    const resultado = service.unlock();
    await trasLasMicrotasks();
    http
      .expectOne(`${API}/auth/refresh`)
      .flush({ mensaje: 'refresh revocado' }, { status: 401, statusText: 'Unauthorized' });

    expect(await resultado).toBe('sesion-caducada');
    // Un refresh rechazado no volverá a servir: se cierra la sesión del todo para
    // que el botón de huella no quede como una trampa que siempre falla.
    http.expectOne(`${API}/auth/logout`).flush({});
    expect(service.isEnabled()).toBe(false);
    expect(secure.has(SECURE_SERVER)).toBe(false);
    expect(auth.isAuthenticated()).toBe(false);
    await drenar();
  });

  it('unlock conserva la huella si el fallo es de conexión', async () => {
    await conHuellaEnrolada();

    const resultado = service.unlock();
    await trasLasMicrotasks();
    http
      .expectOne(`${API}/auth/refresh`)
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

    expect(await resultado).toBe('error-conexion');
    // Sin red no se puede saber si la sesión vive: se conserva para reintentar.
    expect(service.isEnabled()).toBe(true);
    expect(secure.get(SECURE_SERVER)?.password).toBe('r-seguro');
  });

  it('unlock con el keystore vacío no deja la huella activa', async () => {
    prefs.set('peluqueria_biometric', 'true');
    await storage.init();

    expect(await service.unlock()).toBe('sesion-caducada');
    expect(service.isEnabled()).toBe(false);
    expect(auth.isAuthenticated()).toBe(false);
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
