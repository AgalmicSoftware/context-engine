import {
  __test__resetSessionWizardSponsoredBundleCacheKey,
  purgeLegacySessionWizardSponsoredBundleStorage,
  readSessionWizardSponsoredBundleCache,
  writeSessionWizardSponsoredBundleCache,
} from './sessionWizardSponsoredBundleCache';

const LEGACY_SESSION_STORAGE_KEYS = [
  'ce:sessionWizardSponsoredBundle:v1',
  'ce:sessionWizardSponsoredBundle:ek:v1',
  'ce:sessionWizardSponsoredBundle:tabId:v1',
];

const originalIndexedDbDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');

const createIndexedDbDeleteMock = () => ({
  deleteDatabase: jest.fn((_databaseName: string) => {
    const request = {
      onsuccess: null as (() => void) | null,
      onerror: null as (() => void) | null,
      onblocked: null as (() => void) | null,
    };
    setTimeout(() => request.onsuccess?.(), 0);
    return request;
  }),
  open: jest.fn(),
});

describe('session wizard sponsored bundle memory cache', () => {
  beforeEach(() => {
    __test__resetSessionWizardSponsoredBundleCacheKey();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    if (originalIndexedDbDescriptor) {
      Object.defineProperty(globalThis, 'indexedDB', originalIndexedDbDescriptor);
    } else {
      Reflect.deleteProperty(globalThis as Record<string, unknown>, 'indexedDB');
    }
  });

  it('purges legacy encrypted cache, tab id, and IndexedDB key records', async () => {
    LEGACY_SESSION_STORAGE_KEYS.forEach((key) => {
      window.sessionStorage.setItem(key, 'legacy-sensitive-value');
    });
    const indexedDbMock = createIndexedDbDeleteMock();
    Object.defineProperty(globalThis, 'indexedDB', {
      value: indexedDbMock,
      configurable: true,
    });

    await purgeLegacySessionWizardSponsoredBundleStorage();

    LEGACY_SESSION_STORAGE_KEYS.forEach((key) => {
      expect(window.sessionStorage.getItem(key)).toBeNull();
    });
    expect(indexedDbMock.deleteDatabase).toHaveBeenCalledWith('ce-sponsored-bundle-keys');
    expect(indexedDbMock.open).not.toHaveBeenCalled();
  });

  it('keeps decrypted credentials in memory without writing browser storage', async () => {
    const indexedDbMock = createIndexedDbDeleteMock();
    Object.defineProperty(globalThis, 'indexedDB', {
      value: indexedDbMock,
      configurable: true,
    });
    const bundle = {
      openaiKey: 'memory-only-openai-key',
      customRpcUrl: 'https://rpc.example.test',
      meta: { label: 'Memory only' },
    };

    await writeSessionWizardSponsoredBundleCache('bundle-id', bundle);

    await expect(readSessionWizardSponsoredBundleCache('bundle-id')).resolves.toEqual(
      expect.objectContaining({
        openaiKey: 'memory-only-openai-key',
        customRpcUrl: 'https://rpc.example.test',
      }),
    );
    expect(Object.values(window.sessionStorage).join('\n')).not.toContain('memory-only-openai-key');
    LEGACY_SESSION_STORAGE_KEYS.forEach((key) => {
      expect(window.sessionStorage.getItem(key)).toBeNull();
    });
    expect(indexedDbMock.open).not.toHaveBeenCalled();
  });

  it('drops memory-only credentials when cleared or when the runtime cache resets', async () => {
    const bundle = { openaiKey: 'ephemeral-openai-key' };

    await writeSessionWizardSponsoredBundleCache('bundle-id', bundle);
    await writeSessionWizardSponsoredBundleCache('bundle-id', null);
    await expect(readSessionWizardSponsoredBundleCache('bundle-id')).resolves.toBeNull();

    await writeSessionWizardSponsoredBundleCache('bundle-id', bundle);
    __test__resetSessionWizardSponsoredBundleCacheKey();
    await expect(readSessionWizardSponsoredBundleCache('bundle-id')).resolves.toBeNull();
  });
});
