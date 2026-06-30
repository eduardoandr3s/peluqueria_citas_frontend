import { STORAGE_KEYS } from '@peluqueria/core';
import { BiometricTokenStorage } from './biometric-token-storage';

const { prefs, secure, biometric } = vi.hoisted(() => {
  const prefs = new Map<string, string>();
  const secure = new Map<string, { username: string; password: string }>();
  return {
    prefs,
    secure,
    biometric: {
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

const SECURE_SERVER = 'com.segovia.peluqueria.refresh';
const FLAG = 'peluqueria_biometric';

describe('BiometricTokenStorage', () => {
  let storage: InstanceType<typeof BiometricTokenStorage>;

  beforeEach(async () => {
    prefs.clear();
    secure.clear();
    vi.clearAllMocks();
    storage = new BiometricTokenStorage();
  });

  it('sin biometría guarda el refresh en Preferences (texto plano)', async () => {
    await storage.init();
    expect(storage.biometricEnabled).toBe(false);

    storage.set(STORAGE_KEYS.refresh, 'r1');
    expect(storage.get(STORAGE_KEYS.refresh)).toBe('r1');
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

    expect(storage.biometricEnabled).toBe(false);
    expect(storage.get(STORAGE_KEYS.refresh)).toBeNull();
    expect(secure.has(SECURE_SERVER)).toBe(false);
    expect(biometric.deleteCredentials).toHaveBeenCalled();
  });
});
