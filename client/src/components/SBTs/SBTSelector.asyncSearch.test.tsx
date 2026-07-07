import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import SBTSelector from './SBTSelector';
import * as contractScriptsUtils from '../../utilities/web3/contractScripts.js';
import * as sessionRegistryUtils from '../../utilities/web3/sessionRegistry.js';

const GENERAL_FACTORY_ADDRESS = '0x2222222222222222222222222222222222222222';

jest.mock('../../utilities/cache/cacheScripts.js', () => {
  let store: Record<string, unknown> = {};
  return {
    __esModule: true,
    __resetSbtCacheStore: () => {
      store = {};
    },
    readCache: jest.fn(async (_namespace: string, slug = '') => store[String(slug || '')] || {}),
    writeCache: jest.fn(async (_namespace: string, slug = '', value: unknown) => {
      store[String(slug || '')] = JSON.parse(JSON.stringify(value));
      return true;
    }),
    peekCacheSync: jest.fn(() => null),
    listNamespaceEntriesSync: jest.fn(() => []),
    subscribeCacheUpdates: jest.fn(() => () => {}),
  };
});

jest.mock('../../utilities/sbt/sbtDisplayNames.js', () => ({
  __esModule: true,
  getSbtMaskedFieldValue: jest.fn(() => '[encrypted]'),
  hasSbtDisplayName: jest.fn((info: any) => !!String(info?.name || '').trim()),
  hydrateSbtDisplayNameTargeted: jest.fn(async ({ address }: { address?: string }) => ({
    info: {
      name: `Hydrated ${String(address || '').toLowerCase()}`,
      sessionSlug: 'edge',
      sessionSlugExplicit: true,
      unlisted: false,
    },
  })),
  isSbtFieldLocked: jest.fn(() => false),
  isTargetedSbtMetadataLookupEnabled: jest.fn(() => true),
  resolveSbtDisplayLabel: jest.fn(({ address, sbtInfo }: any) => sbtInfo?.name || address || ''),
  warmSbtDisplayNamesTargeted: jest.fn(async () => []),
}));

jest.mock('../../utilities/web3/sessionRegistry.js', () => ({
  __esModule: true,
  loadSessionRegistryCache: jest.fn(async () => null),
}));

jest.mock('../../utilities/web3/contractScripts.js', () => {
  const normalizeSessionSlug = (raw: unknown = '') => {
    const normalized = String(raw ?? '')
      .trim()
      .toLowerCase();
    if (!normalized || normalized === 'general') return '';
    return normalized;
  };

  const buildConfig = (slug: unknown = '') => ({
    slug: normalizeSessionSlug(slug),
    sessionName: normalizeSessionSlug(slug) || 'Context Engine',
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
  });

  return {
    __esModule: true,
    default: {
      getAllSbtAddressesCached: jest.fn(async () => []),
    },
    getAllSessionSlugs: jest.fn(() => ['edge']),
    getDemoSessionConfigBySlug: jest.fn((slug) => buildConfig(slug)),
    getSessionChainId: jest.fn(() => 84532),
    getSessionConfigBySlugOrDefault: jest.fn((slug) => buildConfig(slug)),
    getSessionLists: jest.fn(() => ({ featured_SBTs_LIST: [], ignored_SBTs_LIST: [] })),
    getSessionSlugByName: jest.fn(() => null),
    normalizeSessionSlug,
  };
});

const mockGetAllSessionSlugs = contractScriptsUtils.getAllSessionSlugs as jest.Mock;
const mockGetSessionChainId = contractScriptsUtils.getSessionChainId as jest.Mock;
const mockGetSessionLists = contractScriptsUtils.getSessionLists as jest.Mock;
const mockGetSessionSlugByName = contractScriptsUtils.getSessionSlugByName as jest.Mock;
const mockLoadSessionRegistryCache = sessionRegistryUtils.loadSessionRegistryCache as jest.Mock;

describe('SBTSelector AsyncSearchSelect integration', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    jest.clearAllMocks();
    mockGetAllSessionSlugs.mockReturnValue(['edge']);
    mockGetSessionChainId.mockReturnValue(84532);
    mockGetSessionLists.mockReturnValue({ featured_SBTs_LIST: [], ignored_SBTs_LIST: [] });
    mockGetSessionSlugByName.mockReturnValue(null);
    mockLoadSessionRegistryCache.mockResolvedValue(null);
  });

  it('supports address search, selection, and tab-close behavior with the real async select', async () => {
    const onAddSBT = jest.fn();
    const alphaAddress = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const betaAddress = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

    render(
      <div>
        <SBTSelector
          id="integration-select"
          selectedSBTs={[]}
          onAddSBT={onAddSBT}
          onRemoveSBT={jest.fn()}
          sessionSlug="edge"
          network={{ id: 84532 }}
          defaultFeaturedSBTs={[]}
          additionalSBTOptions={[
            { address: alphaAddress, name: 'Alpha Badge' },
            { sbtAddress: betaAddress, label: 'Beta Badge' },
          ]}
          variant="admin"
        />
        <button type="button">outside</button>
      </div>,
    );

    await waitFor(() => {
      expect(screen.queryByTestId('ce-async-select-control-spinner')).not.toBeInTheDocument();
    });

    const trigger = screen.getByRole('button', { name: /select group/i });
    fireEvent.click(trigger);

    const searchInput = screen.getByRole('textbox', { name: /search options/i });
    fireEvent.change(searchInput, { target: { value: betaAddress } });

    expect(screen.queryByRole('option', { name: 'Alpha Badge' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: 'Beta Badge' }));

    await waitFor(() => {
      expect(onAddSBT).toHaveBeenCalledWith(
        expect.objectContaining({
          address: betaAddress.toLowerCase(),
          name: 'Beta Badge',
        }),
      );
    });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole('textbox', { name: /search options/i }), { key: 'Tab' });

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });
});
