import {
  __test__getSbtDisplayNameLookupStats,
  __test__resetSbtDisplayNameLookups,
  getSbtDisplayName,
  getSbtDescriptionText,
  hasSbtDisplayName,
  hydrateSbtDisplayNameTargeted,
  isSbtFieldLocked,
  resolveSbtDisplayNameFromCaches,
  resolveSbtDisplayLabel,
} from './sbtDisplayNames.js';
import contractScripts, {
  getDemoSessionConfigBySlug,
  getSessionConfigBySlugOrDefault,
} from '../web3/chainGateway.js';
import {
  initCacheManager,
  listNamespaceEntriesSync,
  removeCache,
  writeCache,
  readCache,
} from '../cache/cacheScripts.js';

jest.mock('../web3/chainGateway.js', () => ({
  __esModule: true,
  default: {
    getSbtMetadata: jest.fn(),
  },
  getSessionConfigBySlugOrDefault: jest.fn(() => ({})),
  getDemoSessionConfigBySlug: jest.fn(() => null),
}));

const clearSbtCache = async () => {
  await initCacheManager();
  const entries = listNamespaceEntriesSync('sbtCache');
  await Promise.all(entries.map((entry) => removeCache('sbtCache', entry?.slug || '')));
  await removeCache('sbtCache', '');
};

describe('sbtDisplayNames helpers', () => {
  const addrA = '0x1111111111111111111111111111111111111111';
  const addrB = '0x2222222222222222222222222222222222222222';

  beforeEach(async () => {
    jest.clearAllMocks();
    await clearSbtCache();
    __test__resetSbtDisplayNameLookups();
    try {
      delete globalThis.ENABLE_TARGETED_SBT_METADATA_LOOKUP;
    } catch (_) {
      globalThis.ENABLE_TARGETED_SBT_METADATA_LOOKUP = undefined;
    }
  });

  it('uses explicit chain context instead of demo fallback when resolving cross-slug cache labels in live mode', async () => {
    getSessionConfigBySlugOrDefault.mockReturnValue(null);
    getDemoSessionConfigBySlug.mockReturnValue({
      slug: 'edge',
      networkChainId: 84532,
    });
    await writeCache('sbtCache', 'other', {
      84532: {
        sbtList: {
          [addrB.toLowerCase()]: {
            sbtAddress: addrB,
            sbtInfo: { name: 'Edge Chain Name', chainID: 84532 },
          },
        },
      },
      10: {
        sbtList: {
          [addrB.toLowerCase()]: {
            sbtAddress: addrB,
            sbtInfo: { name: 'Wrong Chain Name', chainID: 10 },
          },
        },
      },
    });

    const hit = resolveSbtDisplayNameFromCaches({
      address: addrB,
      preferredSlug: 'edge',
      chainId: 84532,
    });

    expect(hit?.name).toBe('Edge Chain Name');
    expect(hit?.source).toBe('cross-slug-cache');
    expect(getDemoSessionConfigBySlug).not.toHaveBeenCalled();
  });

  it('does not fall through to demo config when strict lookup returns an unresolved placeholder in live mode', async () => {
    getSessionConfigBySlugOrDefault.mockReturnValue({
      slug: 'legacyEdge',
      contracts: {},
      __unresolved: true,
    });
    getDemoSessionConfigBySlug.mockReturnValue({
      slug: 'edge',
      networkChainId: 84532,
    });
    await writeCache('sbtCache', 'other', {
      84532: {
        sbtList: {
          [addrB.toLowerCase()]: {
            sbtAddress: addrB,
            sbtInfo: { name: 'Edge Chain Name', chainID: 84532 },
          },
        },
      },
    });

    const hit = resolveSbtDisplayNameFromCaches({
      address: addrB,
      preferredSlug: 'legacyEdge',
      chainId: 84532,
    });

    expect(hit?.name).toBe('Edge Chain Name');
    expect(getDemoSessionConfigBySlug).not.toHaveBeenCalled();
  });

  it('resolves display name from cache when available', async () => {
    await writeCache('sbtCache', 'edge', {
      84532: {
        sbtList: {
          [addrA.toLowerCase()]: {
            sbtAddress: addrA,
            sbtInfo: { name: 'Alpha Group' },
          },
        },
      },
    });

    const hit = resolveSbtDisplayNameFromCaches({ address: addrA, preferredSlug: 'edge' });
    expect(hit?.name).toBe('Alpha Group');
    expect(hit?.source).toBe('preferred-slug-cache');
  });

  it('returns masked display text for locked metadata instead of contract placeholders', async () => {
    await writeCache('sbtCache', 'edge', {
      84532: {
        sbtList: {
          [addrA.toLowerCase()]: {
            sbtAddress: addrA,
            sbtInfo: {
              name: '',
              contractName: 'CE-SBT-12',
              nameLocked: true,
              description: '',
              descriptionLocked: true,
            },
          },
        },
      },
    });

    const hit = resolveSbtDisplayNameFromCaches({ address: addrA, preferredSlug: 'edge' });
    expect(hit?.name).toBe('[encrypted]');
    expect(getSbtDescriptionText({ description: '', descriptionLocked: true })).toBe('[encrypted]');
  });

  it('honors legacy encrypted-field aliases without mutating metadata', () => {
    const info = {
      name: '',
      title: 'Visible title',
      symbol: 'VISIBLE',
      contractName: 'VisibleContract',
      description: '',
      encryptedName: true,
      encryptedDescription: true,
      encryptedTags: true,
      encryptedImage: true,
    };
    const before = JSON.stringify(info);

    expect(isSbtFieldLocked(info, 'name')).toBe(true);
    expect(isSbtFieldLocked(info, 'description')).toBe(true);
    expect(isSbtFieldLocked(info, 'tags')).toBe(true);
    expect(isSbtFieldLocked(info, 'image')).toBe(true);
    expect(getSbtDisplayName(info)).toBe('[encrypted]');
    expect(getSbtDescriptionText(info)).toBe('[encrypted]');
    expect(JSON.stringify(info)).toBe(before);
  });

  it('preserves display-name fallback order and address fallback handling', () => {
    expect(getSbtDisplayName({ name: '', title: 'Title Name', symbol: 'SYM', contractName: 'Contract' })).toBe(
      'Title Name',
    );
    expect(getSbtDisplayName({ name: '', title: '', symbol: 'SYM', contractName: 'Contract' })).toBe('SYM');
    expect(getSbtDisplayName({ name: '', title: '', symbol: '', contractName: 'Contract' })).toBe('Contract');
    expect(hasSbtDisplayName({ name: '', title: '', symbol: '', contractName: '' })).toBe(false);
    expect(
      resolveSbtDisplayLabel({
        address: addrA,
        sbtInfo: {},
        fallback: 'address',
      }),
    ).toBe(addrA);
    expect(
      resolveSbtDisplayLabel({
        address: 'not-an-address',
        sbtInfo: { name: 'Ignored' },
      }),
    ).toBe('');
  });

  it('invalidates memoized display labels after sbt cache writes', async () => {
    await writeCache('sbtCache', 'edge', {
      84532: {
        sbtList: {
          [addrA.toLowerCase()]: {
            sbtAddress: addrA,
            sbtInfo: { name: 'Alpha Group', chainID: 84532 },
          },
        },
      },
    });

    expect(
      resolveSbtDisplayNameFromCaches({
        address: addrA,
        preferredSlug: 'edge',
        chainId: 84532,
      })?.name,
    ).toBe('Alpha Group');

    await writeCache('sbtCache', 'edge', {
      84532: {
        sbtList: {
          [addrA.toLowerCase()]: {
            sbtAddress: addrA,
            sbtInfo: { name: 'Renamed Group', chainID: 84532 },
          },
        },
      },
    });

    expect(
      resolveSbtDisplayNameFromCaches({
        address: addrA,
        preferredSlug: 'edge',
        chainId: 84532,
      })?.name,
    ).toBe('Renamed Group');
  });

  it('hydrates missing display name from targeted metadata lookup when enabled', async () => {
    globalThis.ENABLE_TARGETED_SBT_METADATA_LOOKUP = true;
    contractScripts.getSbtMetadata.mockResolvedValue({
      name: 'Beta Group',
      chainID: 84532,
    });

    const result = await hydrateSbtDisplayNameTargeted({
      address: addrB,
      preferredSlug: 'edge',
      metadataLookupConfig: { slug: 'edge', networkChainId: 84532 },
    });

    expect(contractScripts.getSbtMetadata).toHaveBeenCalledTimes(1);
    expect(result?.name).toBe('Beta Group');

    const cache = await readCache('sbtCache', 'edge');
    expect(cache?.['84532']?.sbtList?.[addrB.toLowerCase()]?.sbtInfo?.name).toBe('Beta Group');
  });

  it('ignores cross-slug cache names from other chains', async () => {
    globalThis.ENABLE_TARGETED_SBT_METADATA_LOOKUP = true;
    await writeCache('sbtCache', 'other', {
      10: {
        sbtList: {
          [addrB.toLowerCase()]: {
            sbtAddress: addrB,
            sbtInfo: { name: 'Wrong Chain Name', chainID: 10 },
          },
        },
      },
    });
    contractScripts.getSbtMetadata.mockResolvedValue({
      name: 'Edge Chain Name',
      chainID: 84532,
    });

    const cacheHit = resolveSbtDisplayNameFromCaches({
      address: addrB,
      preferredSlug: 'edge',
      chainId: 84532,
    });
    expect(cacheHit).toBeNull();

    const result = await hydrateSbtDisplayNameTargeted({
      address: addrB,
      preferredSlug: 'edge',
      metadataLookupConfig: { slug: 'edge', networkChainId: 84532 },
    });

    expect(contractScripts.getSbtMetadata).toHaveBeenCalledTimes(1);
    expect(result?.name).toBe('Edge Chain Name');
  });

  it('writes metadata into the preferred chain bucket when address exists on another chain', async () => {
    globalThis.ENABLE_TARGETED_SBT_METADATA_LOOKUP = true;
    await writeCache('sbtCache', 'edge', {
      10: {
        sbtList: {
          [addrA.toLowerCase()]: {
            sbtAddress: addrA,
            sbtInfo: { name: 'Optimism Name', chainID: 10 },
          },
        },
      },
      84532: {
        sbtList: {},
      },
    });
    contractScripts.getSbtMetadata.mockResolvedValue({
      name: 'Base Name',
      chainID: 84532,
    });

    const result = await hydrateSbtDisplayNameTargeted({
      address: addrA,
      preferredSlug: 'edge',
      chainId: 84532,
      metadataLookupConfig: { slug: 'edge', networkChainId: 84532 },
    });

    expect(result?.name).toBe('Base Name');
    const cache = await readCache('sbtCache', 'edge');
    expect(cache?.['84532']?.sbtList?.[addrA.toLowerCase()]?.sbtInfo?.name).toBe('Base Name');
    expect(cache?.['10']?.sbtList?.[addrA.toLowerCase()]?.sbtInfo?.name).toBe('Optimism Name');
  });

  it('uses explicit chain context for targeted lookup when strict shared config is missing in live mode', async () => {
    globalThis.ENABLE_TARGETED_SBT_METADATA_LOOKUP = true;
    getSessionConfigBySlugOrDefault.mockReturnValue(null);
    getDemoSessionConfigBySlug.mockReturnValue({
      slug: 'edge',
      networkChainId: 84532,
      __registry: { chainId: 84532 },
    });
    contractScripts.getSbtMetadata.mockResolvedValue({
      name: 'Demo Edge Name',
      chainID: 84532,
    });

    const result = await hydrateSbtDisplayNameTargeted({
      address: addrB,
      preferredSlug: 'edge',
      chainId: 84532,
    });

    expect(result?.name).toBe('Demo Edge Name');
    expect(contractScripts.getSbtMetadata).toHaveBeenCalledWith(
      'none',
      addrB,
      expect.objectContaining({
        slug: 'edge',
        networkChainId: 84532,
        __registry: expect.objectContaining({ chainId: 84532 }),
      }),
    );
    expect(getDemoSessionConfigBySlug).not.toHaveBeenCalled();
  });

  it('skips targeted metadata lookup when policy is disabled', async () => {
    globalThis.ENABLE_TARGETED_SBT_METADATA_LOOKUP = false;

    const result = await hydrateSbtDisplayNameTargeted({
      address: addrB,
      preferredSlug: 'edge',
      metadataLookupConfig: { slug: 'edge', networkChainId: 84532 },
    });

    expect(result).toBeNull();
    expect(contractScripts.getSbtMetadata).not.toHaveBeenCalled();
  });

  it('prunes stale retry-state entries during later lookups', async () => {
    globalThis.ENABLE_TARGETED_SBT_METADATA_LOOKUP = true;
    contractScripts.getSbtMetadata.mockRejectedValue(new Error('metadata failed'));
    const nowSpy = jest.spyOn(Date, 'now');
    try {
      nowSpy.mockReturnValue(1_000);
      await hydrateSbtDisplayNameTargeted({
        address: addrA,
        preferredSlug: 'edge',
        metadataLookupConfig: { slug: 'edge', networkChainId: 84532 },
      });
      expect(__test__getSbtDisplayNameLookupStats().retrySize).toBe(1);

      nowSpy.mockReturnValue(1_000 + 8 * 24 * 60 * 60 * 1000);
      await hydrateSbtDisplayNameTargeted({
        address: addrB,
        preferredSlug: 'edge',
        metadataLookupConfig: { slug: 'edge', networkChainId: 84532 },
      });
      expect(__test__getSbtDisplayNameLookupStats().retrySize).toBe(1);
    } finally {
      nowSpy.mockRestore();
    }
  });
});
