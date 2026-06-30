import { LocalStorageTokenStorage, STORAGE_KEYS } from './token-storage';

describe('LocalStorageTokenStorage', () => {
  let storage: LocalStorageTokenStorage;

  beforeEach(() => {
    localStorage.clear();
    storage = new LocalStorageTokenStorage();
  });

  it('init no falla y deja el almacén usable', async () => {
    await expect(storage.init()).resolves.toBeUndefined();
  });

  it('set/get/remove operan sobre localStorage', () => {
    expect(storage.get(STORAGE_KEYS.token)).toBeNull();

    storage.set(STORAGE_KEYS.token, 'jwt');
    expect(storage.get(STORAGE_KEYS.token)).toBe('jwt');
    expect(localStorage.getItem(STORAGE_KEYS.token)).toBe('jwt');

    storage.remove(STORAGE_KEYS.token);
    expect(storage.get(STORAGE_KEYS.token)).toBeNull();
  });
});
