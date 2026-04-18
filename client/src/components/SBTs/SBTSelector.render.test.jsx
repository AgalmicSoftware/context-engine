import React, { act } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const GENERAL_ADDRESS = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const EDGE_FACTORY_ADDRESS = '0x1111111111111111111111111111111111111111';
const GENERAL_FACTORY_ADDRESS = '0x2222222222222222222222222222222222222222';

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

jest.mock('../Shared/AsyncSearchSelect.jsx', () => ({
  __esModule: true,
  default: ({
    options = [],
    isLoading = false,
    noOptionsMessage,
    loadingMessage,
    placeholder,
  }) => (
    <div data-testid="mock-sbt-select">
      {placeholder ? (
        <div data-testid="mock-sbt-select-placeholder">{placeholder}</div>
      ) : null}
      {isLoading && (
        <div data-testid="mock-sbt-select-loading">
          {typeof loadingMessage === 'function' ? loadingMessage() : 'Loading'}
        </div>
      )}
      {!isLoading && options.length === 0 && (
        <div data-testid="mock-sbt-select-empty">
          {typeof noOptionsMessage === 'function' ? noOptionsMessage() : null}
        </div>
      )}
      {options.length > 0 && (
        <div data-testid="mock-sbt-select-options">
          {options.map((option) => (
            <div key={option.value}>{option.label}</div>
          ))}
        </div>
      )}
    </div>
  ),
}));

jest.mock('../../utilities/cache/cacheScripts.js', () => {
  let store = {};
  return {
    __esModule: true,
    __resetSbtCacheStore: () => {
      store = {};
    },
    __getSbtCacheStore: () => store,
    readCache: jest.fn(),
    writeCache: jest.fn(),
    peekCacheSync: jest.fn((_namespace, slug = '', { clone = true } = {}) => {
      const value = store[String(slug || '')];
      if (!value) return null;
      return clone ? JSON.parse(JSON.stringify(value)) : value;
    }),
    listNamespaceEntriesSync: jest.fn(({ cloneValues = true } = {}) => (
      Object.entries(store).map(([slug, value]) => ({
        slug,
        value: cloneValues ? JSON.parse(JSON.stringify(value)) : value,
      }))
    )),
    subscribeCacheUpdates: jest.fn(() => () => {}),
  };
});

jest.mock('../../utilities/sbt/sbtDisplayNames.js', () => ({
  __esModule: true,
  getSbtMaskedFieldValue: jest.fn(() => '[encrypted]'),
  hasSbtDisplayName: jest.fn((info) => !!String(info?.name || '').trim()),
  hydrateSbtDisplayNameTargeted: jest.fn(async ({ address }) => ({
    info: {
      name: String(address || '').toLowerCase() === GENERAL_ADDRESS
        ? 'General Badge'
        : 'Edge Badge',
      sessionSlug: String(address || '').toLowerCase() === GENERAL_ADDRESS ? '' : 'edge',
      sessionSlugExplicit: true,
      unlisted: false,
    },
  })),
  isSbtFieldLocked: jest.fn(() => false),
  isTargetedSbtMetadataLookupEnabled: jest.fn(() => true),
  resolveSbtDisplayLabel: jest.fn(({ address, sbtInfo }) => sbtInfo?.name || address || ''),
  warmSbtDisplayNamesTargeted: jest.fn(async () => []),
}));

jest.mock('../../utilities/web3/sessionRegistry.js', () => ({
  __esModule: true,
  loadSessionRegistryCache: jest.fn(async () => null),
}));

jest.mock('../../utilities/web3/contractScripts.js', () => {
  const normalizeSessionSlug = (raw = '') => {
    const normalized = String(raw ?? '').trim().toLowerCase();
    if (!normalized || normalized === 'general') return '';
    return normalized === 'legacyedge' ? 'edge' : normalized;
  };
  const generalConfig = {
    slug: '',
    sessionName: 'Context Engine',
    networkChainId: 84532,
    contracts: {
      sbtFactory: {
        address: GENERAL_FACTORY_ADDRESS,
        chainId: 84532,
      },
    },
    blockLimits: {
      start: 30297069,
      end: null,
    },
  };
  const edgeConfig = {
    slug: 'edge',
    sessionName: 'Edge',
    networkChainId: 84532,
    contracts: {
      sbtFactory: {
        address: EDGE_FACTORY_ADDRESS,
        chainId: 84532,
      },
    },
    blockLimits: {
      start: 32000000,
      end: null,
    },
  };
  const getConfigForSlug = (raw = '') => (
    normalizeSessionSlug(raw) === '' ? generalConfig : edgeConfig
  );

  return {
    __esModule: true,
    default: {
      getAllSbtAddressesCached: jest.fn(),
    },
    getAllSessionSlugs: jest.fn(() => ['edge']),
    getDemoSessionConfigBySlug: jest.fn((slug) => getConfigForSlug(slug)),
    getSessionChainId: jest.fn(() => 84532),
    getSessionConfigBySlugOrDefault: jest.fn((slug) => getConfigForSlug(slug)),
    getSessionLists: jest.fn(() => ({ featured_SBTs_LIST: [], ignored_SBTs_LIST: [] })),
    getSessionSlugByName: jest.fn(() => null),
    normalizeSessionSlug,
  };
});

import SBTSelector from './SBTSelector.jsx';
import contractScripts, * as contractScriptsUtils from '../../utilities/web3/contractScripts.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import * as sessionRegistryUtils from '../../utilities/web3/sessionRegistry.js';
import * as sbtDisplayNameUtils from '../../utilities/sbt/sbtDisplayNames.js';
import * as sessionScanScopeUtils from '../../utilities/session/sessionScanScope.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';

describe('SBTSelector rendered cold-load lifecycle', () => {
  beforeEach(() => {
    try { window.history.replaceState({}, '', '/'); } catch (_) {}
    localStorage.clear();
    sessionStorage.clear();
    globalThis.CE_SESSION_SCAN_SCOPE = 'active';
    globalThis.CE_SESSION_SCAN_SLUGS = [];
    try { delete globalThis.CE_SBT_SELECTOR_AUTO_SEARCH_OTHER_SESSIONS; } catch (_) {}
    cacheScripts.__resetSbtCacheStore();
    jest.clearAllMocks();
    cacheScripts.readCache.mockImplementation(async (_namespace, slug = '') => (
      cacheScripts.__getSbtCacheStore()[String(slug || '')] || {}
    ));
    cacheScripts.writeCache.mockImplementation(async (_namespace, slug = '', value) => {
      cacheScripts.__getSbtCacheStore()[String(slug || '')] = JSON.parse(JSON.stringify(value));
      return true;
    });
    contractScriptsUtils.getAllSessionSlugs.mockReturnValue(['edge']);
    contractScriptsUtils.getSessionLists.mockReturnValue({ featured_SBTs_LIST: [], ignored_SBTs_LIST: [] });
    contractScriptsUtils.getSessionChainId.mockReturnValue(84532);
    contractScriptsUtils.getSessionSlugByName.mockReturnValue(null);
    sessionRegistryUtils.loadSessionRegistryCache.mockResolvedValue(null);
    sbtDisplayNameUtils.warmSbtDisplayNamesTargeted.mockResolvedValue([]);
  });

  it('keeps list-scope general-session discovery in loading state until the default-session options arrive', async () => {
    try { window.history.replaceState({}, '', '/'); } catch (_) {}
    localStorage.setItem('ce:sessionScanScope', 'list');
    localStorage.setItem('ce:sessionScanSlugs', JSON.stringify(['general']));

    const generalDiscovery = createDeferred();
    const ref = React.createRef();
    contractScripts.getAllSbtAddressesCached.mockImplementation(async (_provider, groupRef) => {
      const slug = contractScriptsUtils.normalizeSessionSlug(groupRef?.slug || '');
      if (slug === '') return generalDiscovery.promise;
      return [];
    });

    render(
      <SBTSelector
        ref={ref}
        id="rendered-list-scope"
        selectedSBTs={[]}
        onAddSBT={jest.fn()}
        onRemoveSBT={jest.fn()}
        sessionSlug="edge"
        network={{ id: 84532 }}
        defaultFeaturedSBTs={[]}
        variant="admin"
      />
    );

    expect(screen.getByText('Select Groups')).toBeInTheDocument();
    expect(screen.getByTestId('mock-sbt-select-placeholder')).toHaveTextContent('Select Group...');
    expect(screen.queryByText('No Groups')).not.toBeInTheDocument();
    expect(screen.getByTestId('mock-sbt-select-loading')).toBeInTheDocument();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByText('No Groups')).not.toBeInTheDocument();
    expect(screen.getByTestId('mock-sbt-select-loading')).toBeInTheDocument();

    await act(async () => {
      generalDiscovery.resolve([GENERAL_ADDRESS]);
      await generalDiscovery.promise;
    });

    await waitFor(() => {
      const discoveredSlugs = contractScripts.getAllSbtAddressesCached.mock.calls
        .map(([, groupRef]) => contractScriptsUtils.normalizeSessionSlug(groupRef?.slug || ''));
      expect(discoveredSlugs).toEqual(['']);
    });

    await waitFor(() => {
      const writtenSlugs = cacheScripts.writeCache.mock.calls.map(([, slug]) => String(slug || ''));
      expect(writtenSlugs).toContain('');
    });

    await waitFor(() => {
      expect(ref.current?.state?.sbtOptions || []).toEqual(expect.arrayContaining([
        expect.objectContaining({
          address: GENERAL_ADDRESS,
          sessionSlug: '',
        }),
      ]));
    });
    expect(screen.queryByText('No Groups')).not.toBeInTheDocument();
  });

  it('opens selected SBT external links with the session-aware detail path', async () => {
    contractScripts.getAllSbtAddressesCached.mockResolvedValue([]);
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    const { container } = render(
      <SBTSelector
        id="selected-link"
        selectedSBTs={[{ address: GENERAL_ADDRESS, name: 'General Badge' }]}
        onAddSBT={jest.fn()}
        onRemoveSBT={jest.fn()}
        sessionSlug="edge"
        network={{ id: 84532 }}
        defaultFeaturedSBTs={[]}
        variant="admin"
      />
    );

    await screen.findByTestId(E2E_TESTIDS.SBT_SELECTOR_SELECTED);
    const externalLinkIcon = container.querySelector('[data-icon="external-link-alt"]');
    expect(externalLinkIcon).not.toBeNull();

    fireEvent.click(externalLinkIcon);

    expect(openSpy).toHaveBeenCalledWith(
      buildSbtDetailPath(GENERAL_ADDRESS, 'edge'),
      '_blank'
    );
    openSpy.mockRestore();
  });

  it('prefers metadata-derived session hints for selected SBT external links', async () => {
    contractScripts.getAllSbtAddressesCached.mockResolvedValue([]);
    contractScriptsUtils.getSessionSlugByName.mockImplementation((name) => (
      name === 'Demo Session' ? 'demo' : null
    ));
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    const { container } = render(
      <SBTSelector
        id="selected-link-metadata-hint"
        selectedSBTs={[{
          address: GENERAL_ADDRESS,
          name: 'General Badge',
          sessionName: 'Demo Session',
        }]}
        onAddSBT={jest.fn()}
        onRemoveSBT={jest.fn()}
        sessionSlug="edge"
        network={{ id: 84532 }}
        defaultFeaturedSBTs={[]}
        variant="admin"
      />
    );

    await screen.findByTestId(E2E_TESTIDS.SBT_SELECTOR_SELECTED);
    const externalLinkIcon = container.querySelector('[data-icon="external-link-alt"]');
    expect(externalLinkIcon).not.toBeNull();

    fireEvent.click(externalLinkIcon);

    expect(openSpy).toHaveBeenCalledWith(
      buildSbtDetailPath(GENERAL_ADDRESS, 'demo'),
      '_blank'
    );
    openSpy.mockRestore();
  });

  it('renders linked in-scope live SBTs from known cache buckets instead of falling through to No SBTs in list scope', async () => {
    localStorage.setItem('ce:sessionScanScope', 'list');
    localStorage.setItem('ce:sessionScanSlugs', JSON.stringify(['demo']));

    const linkedAddress = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    cacheScripts.listNamespaceEntriesSync.mockImplementation(() => ([
      {
        namespace: 'sbtCache',
        slug: 'archive',
        key: 'dg:sbtCache:archive',
        value: {
          '84532': {
            sbtList: {
              [linkedAddress]: {
                sbtAddress: linkedAddress,
                sbtInfo: {
                  name: 'Linked Demo Badge',
                  sessionSlug: 'demo',
                  sessionSlugExplicit: true,
                  unlisted: false,
                },
                slug: 'archive',
              },
            },
            nameLookupState: {},
          },
        },
      },
    ]));
    contractScripts.getAllSbtAddressesCached.mockResolvedValue([]);
    const scopeSpy = jest
      .spyOn(sessionScanScopeUtils, 'readSessionScanScope')
      .mockReturnValue('list');
    const slugsSpy = jest
      .spyOn(sessionScanScopeUtils, 'readSessionScanSlugs')
      .mockReturnValue(['demo']);

    try {
      render(
        <SBTSelector
          id="rendered-linked-list-scope"
          selectedSBTs={[]}
          onAddSBT={jest.fn()}
          onRemoveSBT={jest.fn()}
          sessionSlug=""
          network={{ id: 84532 }}
          defaultFeaturedSBTs={[]}
          variant="admin"
        />
      );

      await waitFor(() => {
        expect(screen.getByText(linkedAddress)).toBeInTheDocument();
      });
      expect(screen.queryByText('No Groups')).not.toBeInTheDocument();
    } finally {
      slugsSpy.mockRestore();
      scopeSpy.mockRestore();
    }
  });

  it('limits list-scope dropdown options to invoked sessions and exposes other sessions as opt-in buttons', async () => {
    const demoAddress = '0xdddddddddddddddddddddddddddddddddddddddd';
    const edgeAddress = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    localStorage.setItem('ce:sessionScanScope', 'list');
    localStorage.setItem('ce:sessionScanSlugs', JSON.stringify(['demo']));
    cacheScripts.__getSbtCacheStore().demo = {
      '84532': {
        sbtList: {
          [demoAddress]: {
            sbtAddress: demoAddress,
            sbtInfo: {
              name: 'Demo Badge',
              sessionSlug: 'demo',
              sessionSlugExplicit: true,
              unlisted: false,
            },
            slug: 'demo',
          },
        },
        nameLookupState: {},
      },
    };
    cacheScripts.__getSbtCacheStore().edge = {
      '84532': {
        sbtList: {
          [edgeAddress]: {
            sbtAddress: edgeAddress,
            sbtInfo: {
              name: 'Edge Badge',
              sessionSlug: 'edge',
              sessionSlugExplicit: true,
              unlisted: false,
            },
            slug: 'edge',
          },
        },
        nameLookupState: {},
      },
    };
    contractScripts.getAllSbtAddressesCached.mockResolvedValue([]);
    contractScriptsUtils.getAllSessionSlugs.mockReturnValue(['edge']);

    render(
      <SBTSelector
        id="rendered-list-scope-session-buttons"
        selectedSBTs={[]}
        onAddSBT={jest.fn()}
        onRemoveSBT={jest.fn()}
        sessionSlug="edge"
        network={{ id: 84532 }}
        defaultFeaturedSBTs={[]}
        enableGroupSelect
        variant="admin"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(demoAddress)).toBeInTheDocument();
    });
    expect(screen.queryByText(edgeAddress)).not.toBeInTheDocument();

    const edgeButton = await screen.findByTestId('ce-sbt-selector-session-source-edge');
    await act(async () => {
      fireEvent.click(edgeButton);
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.queryByText(demoAddress)).not.toBeInTheDocument();
      expect(screen.getByText(edgeAddress)).toBeInTheDocument();
      expect(screen.getByTestId('ce-sbt-selector-session-source-active')).toBeInTheDocument();
      expect(screen.queryByTestId('ce-sbt-selector-session-source-edge')).not.toBeInTheDocument();
    });
  });

  it('hides the opt-in other-session buttons when selector auto-search is disabled', async () => {
    const demoAddress = '0xdddddddddddddddddddddddddddddddddddddddd';
    localStorage.setItem('ce:sessionScanScope', 'list');
    localStorage.setItem('ce:sessionScanSlugs', JSON.stringify(['demo']));
    globalThis.CE_SBT_SELECTOR_AUTO_SEARCH_OTHER_SESSIONS = false;
    cacheScripts.__getSbtCacheStore().demo = {
      '84532': {
        sbtList: {
          [demoAddress]: {
            sbtAddress: demoAddress,
            sbtInfo: {
              name: 'Demo Badge',
              sessionSlug: 'demo',
              sessionSlugExplicit: true,
              unlisted: false,
            },
            slug: 'demo',
          },
        },
        nameLookupState: {},
      },
    };
    contractScripts.getAllSbtAddressesCached.mockResolvedValue([]);
    contractScriptsUtils.getAllSessionSlugs.mockReturnValue(['edge']);

    render(
      <SBTSelector
        id="rendered-list-scope-no-auto-search-buttons"
        selectedSBTs={[]}
        onAddSBT={jest.fn()}
        onRemoveSBT={jest.fn()}
        sessionSlug="edge"
        network={{ id: 84532 }}
        defaultFeaturedSBTs={[]}
        enableGroupSelect
        variant="admin"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(demoAddress)).toBeInTheDocument();
    });
    expect(screen.queryByTestId('ce-sbt-selector-session-source-edge')).not.toBeInTheDocument();
  });

  it('rejects manual non-featured addresses when limitToFeatured is enabled', async () => {
    const featuredAddress = '0xf111111111111111111111111111111111111111';
    const nonFeaturedAddress = '0xf222222222222222222222222222222222222222';
    const onAddSBT = jest.fn();
    const ref = React.createRef();
    contractScripts.getAllSbtAddressesCached.mockResolvedValue([]);

    render(
      <SBTSelector
        ref={ref}
        id="rendered-featured-manual-reject"
        selectedSBTs={[]}
        onAddSBT={onAddSBT}
        onRemoveSBT={jest.fn()}
        sessionSlug="edge"
        network={{ id: 84532 }}
        defaultFeaturedSBTs={[]}
        limitToFeatured
        variant="admin"
      />
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    act(() => {
      ref.current.setState({ scopeFeaturedAddresses: [featuredAddress.toLowerCase()] });
    });
    sbtDisplayNameUtils.hydrateSbtDisplayNameTargeted.mockClear();

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SBT_SELECTOR_MANUAL_TOGGLE));
    expect(screen.getByPlaceholderText('Enter Group Ethereum address')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId(E2E_TESTIDS.SBT_SELECTOR_MANUAL_INPUT), {
      target: { value: nonFeaturedAddress },
    });
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SBT_SELECTOR_MANUAL_ADD));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Only featured Groups can be added by address in this selector.');
    });
    expect(onAddSBT).not.toHaveBeenCalled();
    expect(sbtDisplayNameUtils.hydrateSbtDisplayNameTargeted).not.toHaveBeenCalled();
  });
});
