import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL, AuthService, STORAGE_KEYS, TOKEN_STORAGE } from '@peluqueria/core';
import { BiometricService } from './biometric.service';
import { BiometricTokenStorage } from './biometric-token-storage';

/**
 * Tests del acceso biométrico: el almacén (`BiometricTokenStorage`) y el servicio
 * que lo orquesta (`BiometricService`).
 *
 * **Los dos van en el MISMO fichero a propósito: no volver a separarlos.** El
 * builder de test empaqueta todos los specs, así que `vi.mock` no queda aislado por
 * fichero: si dos specs mockean el mismo módulo, solo sobrevive el factory de uno y
 * el otro acaba leyendo y escribiendo en los dobles del primero. Cuando estaban en
 * dos ficheros, el que perdía veía mapas vacíos y valores dejados por tests
 * anteriores; y como el ganador depende de cómo se reparten los ficheros entre
 * procesos, en local pasaba y en CI (2 cores) fallaba. Con un solo fichero hay un
 * único `vi.mock` por módulo y el problema no existe.
 */
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
const FLAG = 'peluqueria_biometric';

/**
 * El almacén persiste en segundo plano (promesas fire-and-forget); hay que drenar
 * las tareas pendientes antes de assertar o de limpiar el estado, o una escritura
 * rezagada de un test puede aterrizar en el siguiente.
 */
const drenar = () => new Promise<void>((resolve) => setTimeout(resolve));

/** Deja los dobles sin estado, sin llamadas y con su comportamiento original. */
function limpiarDobles(): void {
  prefs.clear();
  secure.clear();
  vi.clearAllMocks();
}

describe('BiometricTokenStorage', () => {
  let storage: InstanceType<typeof BiometricTokenStorage>;

  beforeEach(async () => {
    await drenar();
    limpiarDobles();
    storage = new BiometricTokenStorage();
  });

  it('sin biometría guarda el refresh en Preferences (texto plano)', async () => {
    await storage.init();
    expect(storage.biometricEnabled).toBe(false);

    storage.set(STORAGE_KEYS.refresh, 'r1');
    expect(storage.get(STORAGE_KEYS.refresh)).toBe('r1');

    await drenar();
    expect(prefs.get(STORAGE_KEYS.refresh)).toBe('r1');
    expect(biometric.setCredentials).not.toHaveBeenCalled();
  });

  it('enableSecure mueve el refresh al keystore y lo saca de Preferences', async () => {
    await storage.init();
    storage.set(STORAGE_KEYS.refresh, 'r1');

    await storage.enableSecure();

    expect(storage.biometricEnabled).toBe(true);
    expect(prefs.has(STORAGE_KEYS.refresh)).toBe(false);
    expect(prefs.get(FLAG)).toBe('true');
    expect(secure.get(SECURE_SERVER)?.password).toBe('r1');
  });

  it('con biometría activa, una rotación se refleja en el keystore (no en Preferences)', async () => {
    await storage.init();
    storage.set(STORAGE_KEYS.refresh, 'r1');
    await storage.enableSecure();

    storage.set(STORAGE_KEYS.refresh, 'r2'); // rotación

    await drenar();
    expect(storage.get(STORAGE_KEYS.refresh)).toBe('r2');
    expect(secure.get(SECURE_SERVER)?.password).toBe('r2');
    expect(prefs.has(STORAGE_KEYS.refresh)).toBe(false);
  });

  it('init con el flag activo NO carga el refresh desde Preferences (queda bloqueado)', async () => {
    prefs.set(FLAG, 'true');
    secure.set(SECURE_SERVER, { username: 'session', password: 'r-seguro' });

    await storage.init();

    expect(storage.biometricEnabled).toBe(true);
    expect(storage.get(STORAGE_KEYS.refresh)).toBeNull();
  });

  it('loadSecureRefresh recupera el refresh del keystore a memoria', async () => {
    prefs.set(FLAG, 'true');
    secure.set(SECURE_SERVER, { username: 'session', password: 'r-seguro' });
    await storage.init();

    const refresh = await storage.loadSecureRefresh();

    expect(refresh).toBe('r-seguro');
    expect(storage.get(STORAGE_KEYS.refresh)).toBe('r-seguro');
  });

  it('disableSecure borra el keystore y devuelve el refresh a Preferences', async () => {
    await storage.init();
    storage.set(STORAGE_KEYS.refresh, 'r1');
    await storage.enableSecure();

    await storage.disableSecure();

    expect(storage.biometricEnabled).toBe(false);
    expect(secure.has(SECURE_SERVER)).toBe(false);
    expect(prefs.has(FLAG)).toBe(false);
    expect(prefs.get(STORAGE_KEYS.refresh)).toBe('r1');
  });

  it('remove del refresh con biometría activa cierra sesión y desactiva la biometría', async () => {
    await storage.init();
    storage.set(STORAGE_KEYS.refresh, 'r1');
    await storage.enableSecure();

    storage.remove(STORAGE_KEYS.refresh); // logout

    await drenar();
    expect(storage.biometricEnabled).toBe(false);
    expect(storage.get(STORAGE_KEYS.refresh)).toBeNull();
    expect(secure.has(SECURE_SERVER)).toBe(false);
    expect(biometric.deleteCredentials).toHaveBeenCalled();
  });
});

describe('BiometricService', () => {
  let service: InstanceType<typeof BiometricService>;
  let storage: InstanceType<typeof BiometricTokenStorage>;
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(async () => {
    await drenar();
    limpiarDobles();
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
    prefs.set(FLAG, 'true');
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
    prefs.set(FLAG, 'true');
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
