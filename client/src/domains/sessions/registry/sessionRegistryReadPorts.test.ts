import { bindSessionRegistryReadsPort, type SessionRegistryReadModule } from './sessionRegistryReadPorts';

const buildRegistryModule = (overrides: Partial<SessionRegistryReadModule> = {}): SessionRegistryReadModule => ({
  SESSION_REGISTRY_CACHE_UPDATED_EVENT: 'ce:session-registry-cache-updated',
  registerSessionOnChain: jest.fn(async () => ({ ok: true })),
  loadSessionRegistryCache: jest.fn(async () => ({ sessions: {} })),
  loadGroupRegistryCache: jest.fn(async () => ({ groups: {} })),
  sessionRegistryStore: {
    getAllSessionEntries: jest.fn(() => []),
    getSessionConfig: jest.fn(() => null),
    getSessionConfigById: jest.fn(() => null),
  },
  fetchSessionFromRegistry: jest.fn(async () => ({ slug: 'top-level' })),
  upsertSessionRegistryCache: jest.fn(() => ({ ts: 1 })),
  sessionRegistryUtils: {
    getRegistryContract: jest.fn(),
    fetchSessionFromRegistry: jest.fn(async () => ({ slug: 'nested' })),
    upsertSessionRegistryCache: jest.fn(() => ({ ts: 2 })),
    normalizeSlug: jest.fn((value: unknown) =>
      String(value || '')
        .trim()
        .toLowerCase(),
    ),
    formatSessionId: jest.fn((value: unknown) => String(value || '')),
    normalizeSessionIdHex: jest.fn((value: unknown) => String(value || '').toLowerCase()),
    toRegistrySlug: jest.fn((value: unknown) =>
      String(value || '')
        .trim()
        .toLowerCase(),
    ),
  },
  ...overrides,
});

describe('session registry read ports', () => {
  it('routes cache reads and shared registry operations through call-time lookup', async () => {
    const firstModule = buildRegistryModule({
      loadSessionRegistryCache: jest.fn(async () => ({ sessions: { first: {} } })),
      loadGroupRegistryCache: jest.fn(async () => ({ groups: { first: {} } })),
      sessionRegistryStore: {
        getAllSessionEntries: jest.fn(() => [['first', { slug: 'first' }]]),
        getSessionConfig: jest.fn(() => ({ slug: 'first' })),
        getSessionConfigById: jest.fn(() => ({ slug: 'first-by-id' })),
      },
    });
    const secondModule = buildRegistryModule({
      sessionRegistryStore: {
        getAllSessionEntries: jest.fn(() => [['second', { slug: 'second' }]]),
        getSessionConfig: jest.fn(() => ({ slug: 'second' })),
        getSessionConfigById: jest.fn(() => ({ slug: 'second-by-id' })),
      },
      sessionRegistryUtils: {
        ...buildRegistryModule().sessionRegistryUtils,
        fetchSessionFromRegistry: jest.fn(async () => ({ slug: 'second' })),
        upsertSessionRegistryCache: jest.fn(() => ({ ts: 99 })),
        formatSessionId: jest.fn(() => '0xsession'),
        normalizeSessionIdHex: jest.fn(() => '0xabc'),
        toRegistrySlug: jest.fn(() => 'second-slug'),
      },
    });
    let registryModule = firstModule;
    const port = bindSessionRegistryReadsPort({
      sessionRegistry: () => registryModule,
    });

    await expect(port.loadSessionRegistryCache({ force: true })).resolves.toEqual({ sessions: { first: {} } });
    await expect(port.loadGroupRegistryCache({ bootstrapRpc: true })).resolves.toEqual({ groups: { first: {} } });
    expect(port.getAllSessionEntries()).toEqual([['first', { slug: 'first' }]]);
    expect(port.getSessionConfig('first')).toEqual({ slug: 'first' });
    expect(port.getSessionConfigById('0xfirst')).toEqual({ slug: 'first-by-id' });

    registryModule = secondModule;

    expect(port.getSessionConfig('second')).toEqual({ slug: 'second' });
    expect(port.getSessionConfigById('0xsecond')).toEqual({ slug: 'second-by-id' });
    await expect(port.fetchSessionFromRegistry({ slug: 'Second' })).resolves.toEqual({ slug: 'second' });
    expect(port.upsertSessionRegistryCache({ config: { slug: 'Second' } })).toEqual({ ts: 99 });
    expect(port.formatSessionId('session')).toBe('0xsession');
    expect(port.normalizeSessionIdHex('ABC')).toBe('0xabc');
    expect(port.toRegistrySlug(' Second Slug ')).toBe('second-slug');

    expect(firstModule.loadSessionRegistryCache).toHaveBeenCalledWith({ force: true });
    expect(firstModule.loadGroupRegistryCache).toHaveBeenCalledWith({ bootstrapRpc: true });
    expect(firstModule.sessionRegistryStore.getAllSessionEntries).toHaveBeenCalledTimes(1);
    expect(firstModule.sessionRegistryStore.getSessionConfig).toHaveBeenCalledWith('first');
    expect(firstModule.sessionRegistryStore.getSessionConfigById).toHaveBeenCalledWith('0xfirst');
    expect(secondModule.sessionRegistryStore.getSessionConfig).toHaveBeenCalledWith('second');
    expect(secondModule.sessionRegistryStore.getSessionConfigById).toHaveBeenCalledWith('0xsecond');
    expect(secondModule.sessionRegistryUtils.fetchSessionFromRegistry).toHaveBeenCalledWith({
      slug: 'Second',
    });
    expect(secondModule.sessionRegistryUtils.upsertSessionRegistryCache).toHaveBeenCalledWith({
      config: { slug: 'Second' },
    });
    expect(secondModule.sessionRegistryUtils.formatSessionId).toHaveBeenCalledWith('session');
  });

  it('models registry store entries as Object.entries-shaped tuples', () => {
    const sessions = {
      alpha: { slug: 'alpha', chainId: 11155420 },
    };
    const registryModule = buildRegistryModule({
      sessionRegistryStore: {
        getAllSessionEntries: jest.fn(() => Object.entries(sessions)),
        getSessionConfig: jest.fn(() => null),
        getSessionConfigById: jest.fn(() => null),
      },
    });
    const port = bindSessionRegistryReadsPort({
      sessionRegistry: () => registryModule,
    });

    const [[slug, config]] = port.getAllSessionEntries();

    expect(slug).toBe('alpha');
    expect(config).toEqual({ slug: 'alpha', chainId: 11155420 });
    expect(registryModule.sessionRegistryStore.getAllSessionEntries).toHaveBeenCalledTimes(1);
  });

  it('subscribes and unsubscribes from the cache update event with the same listener', () => {
    const addEventListener = jest.fn();
    const removeEventListener = jest.fn();
    const listener = jest.fn();
    const port = bindSessionRegistryReadsPort({
      sessionRegistry: () =>
        buildRegistryModule({
          SESSION_REGISTRY_CACHE_UPDATED_EVENT: 'ce:test-cache-updated',
        }),
    });

    const unsubscribe = port.subscribeToCacheUpdates(
      {
        addEventListener,
        removeEventListener,
      },
      listener,
    );
    unsubscribe();

    expect(addEventListener).toHaveBeenCalledWith('ce:test-cache-updated', listener);
    expect(removeEventListener).toHaveBeenCalledWith('ce:test-cache-updated', listener);
  });
});
