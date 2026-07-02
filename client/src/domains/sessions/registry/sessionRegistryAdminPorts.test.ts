import {
  bindAdminSessionRegistryPorts,
  type AdminSessionRegistryModule,
} from './sessionRegistryAdminPorts';

const buildRegistryModule = (overrides: Partial<AdminSessionRegistryModule> = {}): AdminSessionRegistryModule => ({
  SESSION_REGISTRY_CACHE_UPDATED_EVENT: 'ce:session-registry-cache-updated',
  registerSessionOnChain: jest.fn(async () => ({ ok: true })),
  loadSessionRegistryCache: jest.fn(async () => ({ sessions: {} })),
  sessionRegistryStore: {
    getAllSessionEntries: jest.fn(() => []),
  },
  fetchSessionFromRegistry: jest.fn(async () => ({ slug: 'top-level' })),
  upsertSessionRegistryCache: jest.fn(() => ({ ts: 1 })),
  setSessionFieldsOnChain: jest.fn(async () => ({ ok: true })),
  setResourceGatesOnChain: jest.fn(async () => ({ ok: true, txs: [] })),
  uploadSessionMetadata: jest.fn(async () => ({ metadataUri: 'ar://metadata' })),
  updateSessionMetadataOnChain: jest.fn(async () => ({ ok: true, txHash: '0xtx' })),
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

describe('admin session registry ports', () => {
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
    const ports = bindAdminSessionRegistryPorts({
      sessionRegistry: () => registryModule,
    });

    await expect(ports.reads.loadSessionRegistryCache({ force: true }))
      .resolves.toEqual({ sessions: { first: {} } });
    expect(ports.reads.getAllSessionEntries()).toEqual([['first', { slug: 'first' }]]);

    registryModule = secondModule;

    await expect(ports.reads.fetchSessionFromRegistry({ slug: 'Second' }))
      .resolves.toEqual({ slug: 'second' });
    expect(ports.reads.upsertSessionRegistryCache({ config: { slug: 'Second' } }))
      .toEqual({ ts: 99 });
    expect(ports.reads.normalizeSessionIdHex('ABC')).toBe('0xabc');
    expect(ports.reads.toRegistrySlug(' Second Slug ')).toBe('second-slug');

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
    const ports = bindAdminSessionRegistryPorts({
      sessionRegistry: () => buildRegistryModule({
        SESSION_REGISTRY_CACHE_UPDATED_EVENT: 'ce:test-cache-updated',
      }),
    });

    const unsubscribe = ports.reads.subscribeToCacheUpdates({
      addEventListener,
      removeEventListener,
    }, listener);
    unsubscribe();

    expect(addEventListener).toHaveBeenCalledWith('ce:test-cache-updated', listener);
    expect(removeEventListener).toHaveBeenCalledWith('ce:test-cache-updated', listener);
  });

  it('routes admin writes through call-time lookup and shared field normalization', async () => {
    const firstModule = buildRegistryModule({
      setSessionFieldsOnChain: jest.fn(async () => ({ ok: true, source: 'first' })),
    });
    const secondModule = buildRegistryModule({
      setResourceGatesOnChain: jest.fn(async () => ({ ok: true, source: 'second', txs: [] })),
      uploadSessionMetadata: jest.fn(async () => ({ metadataUri: 'ar://second' })),
      updateSessionMetadataOnChain: jest.fn(async () => ({ ok: true, txHash: '0xsecond' })),
    });
    let registryModule = firstModule;
    const ports = bindAdminSessionRegistryPorts({
      sessionRegistry: () => registryModule,
    });

    expect(ports.writes.buildRegistrySessionFields({
      onChainFields: {
        corsWorkerUrl: ' https://worker.example ',
        unexpected: 'skip',
      },
      sponsoredFields: {
        sponsored_ai: '1',
        sponsored_rpc: '',
      },
    })).toEqual({
      corsWorkerUrl: 'https://worker.example',
      sponsored_ai: '1',
    });

    await expect(ports.writes.setSessionFieldsOnChain({
      providerLike: 'provider',
      chainId: 84532,
      slug: 'edge',
      fields: { sponsored_ai: '1' },
    })).resolves.toEqual({ ok: true, source: 'first' });

    registryModule = secondModule;

    await expect(ports.writes.setResourceGatesOnChain({ slug: 'edge', gates: [] }))
      .resolves.toEqual({ ok: true, source: 'second', txs: [] });
    await expect(ports.writes.uploadSessionMetadata({ slug: 'edge' }, { workerUrl: 'https://worker.test' }))
      .resolves.toEqual({ metadataUri: 'ar://second' });
    await expect(ports.writes.updateSessionMetadataOnChain({ slug: 'edge' }))
      .resolves.toEqual({ ok: true, txHash: '0xsecond' });

    expect(firstModule.setSessionFieldsOnChain).toHaveBeenCalledWith({
      providerLike: 'provider',
      chainId: 84532,
      slug: 'edge',
      fields: { sponsored_ai: '1' },
    });
    expect(secondModule.setResourceGatesOnChain).toHaveBeenCalledWith({
      slug: 'edge',
      gates: [],
    });
  });
});
