import {
  bindSessionRegistryReadsPort,
  type SessionRegistryReadModule,
} from './sessionRegistryReadPorts';

const buildRegistryModule = (overrides: Partial<SessionRegistryReadModule> = {}): SessionRegistryReadModule => ({
  SESSION_REGISTRY_CACHE_UPDATED_EVENT: 'ce:session-registry-cache-updated',
  registerSessionOnChain: jest.fn(async () => ({ ok: true })),
  loadSessionRegistryCache: jest.fn(async () => ({ sessions: {} })),
  sessionRegistryStore: {
    getAllSessionEntries: jest.fn(() => []),
  },
  fetchSessionFromRegistry: jest.fn(async () => ({ slug: 'top-level' })),
  upsertSessionRegistryCache: jest.fn(() => ({ ts: 1 })),
  sessionRegistryUtils: {
    getRegistryContract: jest.fn(),
    fetchSessionFromRegistry: jest.fn(async () => ({ slug: 'nested' })),
    upsertSessionRegistryCache: jest.fn(() => ({ ts: 2 })),
    normalizeSlug: jest.fn((value: unknown) => String(value || '').trim().toLowerCase()),
    formatSessionId: jest.fn((value: unknown) => String(value || '')),
    normalizeSessionIdHex: jest.fn((value: unknown) => String(value || '').toLowerCase()),
    toRegistrySlug: jest.fn((value: unknown) => String(value || '').trim().toLowerCase()),
  },
  ...overrides,
});

describe('session registry read ports', () => {
  it('routes cache reads and shared registry operations through call-time lookup', async () => {
    const firstModule = buildRegistryModule({
      loadSessionRegistryCache: jest.fn(async () => ({ sessions: { first: {} } })),
      sessionRegistryStore: {
        getAllSessionEntries: jest.fn(() => [['first', { slug: 'first' }]]),
      },
    });
    const secondModule = buildRegistryModule({
      sessionRegistryStore: {
        getAllSessionEntries: jest.fn(() => [['second', { slug: 'second' }]]),
      },
      sessionRegistryUtils: {
        ...buildRegistryModule().sessionRegistryUtils,
        fetchSessionFromRegistry: jest.fn(async () => ({ slug: 'second' })),
        upsertSessionRegistryCache: jest.fn(() => ({ ts: 99 })),
        normalizeSessionIdHex: jest.fn(() => '0xabc'),
        toRegistrySlug: jest.fn(() => 'second-slug'),
      },
    });
    let registryModule = firstModule;
    const port = bindSessionRegistryReadsPort({
      sessionRegistry: () => registryModule,
    });

    await expect(port.loadSessionRegistryCache({ force: true }))
      .resolves.toEqual({ sessions: { first: {} } });
    expect(port.getAllSessionEntries()).toEqual([['first', { slug: 'first' }]]);

    registryModule = secondModule;

    await expect(port.fetchSessionFromRegistry({ slug: 'Second' }))
      .resolves.toEqual({ slug: 'second' });
    expect(port.upsertSessionRegistryCache({ config: { slug: 'Second' } }))
      .toEqual({ ts: 99 });
    expect(port.normalizeSessionIdHex('ABC')).toBe('0xabc');
    expect(port.toRegistrySlug(' Second Slug ')).toBe('second-slug');

    expect(firstModule.loadSessionRegistryCache).toHaveBeenCalledWith({ force: true });
    expect(firstModule.sessionRegistryStore.getAllSessionEntries).toHaveBeenCalledTimes(1);
    expect(secondModule.sessionRegistryUtils.fetchSessionFromRegistry).toHaveBeenCalledWith({
      slug: 'Second',
    });
    expect(secondModule.sessionRegistryUtils.upsertSessionRegistryCache).toHaveBeenCalledWith({
      config: { slug: 'Second' },
    });
  });

  it('subscribes and unsubscribes from the cache update event with the same listener', () => {
    const addEventListener = jest.fn();
    const removeEventListener = jest.fn();
    const listener = jest.fn();
    const port = bindSessionRegistryReadsPort({
      sessionRegistry: () => buildRegistryModule({
        SESSION_REGISTRY_CACHE_UPDATED_EVENT: 'ce:test-cache-updated',
      }),
    });

    const unsubscribe = port.subscribeToCacheUpdates({
      addEventListener,
      removeEventListener,
    }, listener);
    unsubscribe();

    expect(addEventListener).toHaveBeenCalledWith('ce:test-cache-updated', listener);
    expect(removeEventListener).toHaveBeenCalledWith('ce:test-cache-updated', listener);
  });
});
