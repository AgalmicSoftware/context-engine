import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { SBTsPage } from './SBTsPage';
import { peekCacheSync } from '../../utilities/cache/cacheScripts.js';
import { getDemoSessionConfigBySlug, getSessionLists } from '../../utilities/web3/contractScripts.js';
import { getShortenedAddress } from '../../utilities/ui/displayHelpers.js';
import { readSessionScanScope, readSessionScanSlugs } from '../../utilities/session/sessionScanScope.js';
import { sbtsListPath, t } from '../../utilities/ui/terminology.js';
import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';

const mockSBTPage = jest.fn();
const mockSBTsList = jest.fn();
const mockCreateGroup = jest.fn();
const mockWorkerGroupCreate = jest.fn();
const mockIsCryptoMode = jest.fn(() => true);

jest.mock('./SBTsList', () => (props) => {
  mockSBTsList(props);
  return null;
});
jest.mock('./CreateSBTGroup', () => (props) => {
  mockCreateGroup(props);
  return (
    <div data-testid="create-group-panel" data-network-name={props.network?.name || ''}>
      Create Group Panel
    </div>
  );
});
jest.mock('../OnePageSession/WorkerSessionGroupsPanel', () => (props) => {
  mockWorkerGroupCreate(props);
  return (
    <div data-testid="worker-group-create-panel">
      <span>Active session</span>
      <span>{props.sessionName}</span>
      <span>/{props.sessionSlug}</span>
    </div>
  );
});
jest.mock('./SBTPage', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: (props) => {
      mockSBTPage(props);
      return React.createElement('div', { 'data-testid': 'mock-sbt-page' });
    },
  };
});

jest.mock('../../utilities/cache/cacheScripts.js', () => ({
  peekCacheSync: jest.fn(),
}));

jest.mock('../../utilities/session/sessionScanScope.js', () => ({
  readSessionScanScope: jest.fn(() => 'active'),
  readSessionScanSlugs: jest.fn(() => []),
}));

jest.mock('../../utilities/ui/terminology.js', () => {
  const actual = jest.requireActual('../../utilities/ui/terminology.js');
  return {
    __esModule: true,
    ...actual,
    isCryptoMode: (...args) => mockIsCryptoMode(...args),
  };
});

jest.mock('../../utilities/web3/chainGateway.js', () => {
  const actual = jest.requireActual('../../utilities/web3/chainGateway.js');
  return {
    __esModule: true,
    ...actual,
    default: actual.default,
    getSessionConfigBySlug: jest.fn(() => ({ slug: 'alpha' })),
    getDemoSessionConfigBySlug: jest.fn(() => null),
    getSessionConfigBySlugOrDefault: jest.fn(() => ({ slug: 'alpha' })),
    getSessionLists: jest.fn(() => ({ featured_SBTs_LIST: [], ignored_SBTs_LIST: [] })),
  };
});

const createSubject = (props = {}) =>
  new SBTsPage({
    sbtCacheRevision: 0,
    ...props,
  });

describe('SBTsPage auto-feature flag', () => {
  const originalPublicUrl = process.env.PUBLIC_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    if (typeof originalPublicUrl === 'undefined') {
      delete process.env.PUBLIC_URL;
    } else {
      process.env.PUBLIC_URL = originalPublicUrl;
    }
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/');
    getSessionLists.mockReturnValue({ featured_SBTs_LIST: [], ignored_SBTs_LIST: [] });
    getDemoSessionConfigBySlug.mockReturnValue(null);
    readSessionScanScope.mockReturnValue('active');
    readSessionScanSlugs.mockReturnValue([]);
    mockIsCryptoMode.mockReturnValue(true);
  });

  it('keeps demo-only list-route slugs instead of collapsing back to general', () => {
    const contractScripts = jest.requireMock('../../utilities/web3/contractScripts.js');
    contractScripts.getSessionConfigBySlug.mockImplementation((slug) =>
      String(slug || '') === '' ? { slug: '' } : null,
    );
    contractScripts.getSessionConfigBySlugOrDefault.mockReturnValue({ slug: '' });
    getDemoSessionConfigBySlug.mockImplementation((slug) => (String(slug || '') === 'edge' ? { slug: 'edge' } : null));
    window.history.replaceState({}, '', `${sbtsListPath()}/edge`);

    const subject = createSubject();
    const resolved = subject.getResolvedRouting();

    expect(resolved).toEqual(
      expect.objectContaining({
        canonicalSlug: 'edge',
        onSbtsRoute: true,
        urlHasNoSlug: false,
        isCreateRoute: false,
      }),
    );
    expect(getDemoSessionConfigBySlug).toHaveBeenCalledWith('edge', { allowDemoFallback: true });
  });

  it('keeps an explicit demo alias as the cache slug when display config falls back to general', () => {
    const contractScripts = jest.requireMock('../../utilities/web3/contractScripts.js');
    const demoAutoAddress = '0x0000000000000000000000000000000000000d0a';
    contractScripts.getSessionConfigBySlug.mockImplementation((slug) =>
      String(slug || '') === '' ? { slug: '' } : null,
    );
    contractScripts.getSessionConfigBySlugOrDefault.mockReturnValue({ slug: '' });
    getDemoSessionConfigBySlug.mockImplementation((slug) =>
      String(slug || '') === 'demo'
        ? {
            slug: '',
            featured_SBTs_LIST: [],
          }
        : null,
    );
    peekCacheSync.mockImplementation((cacheName, slug) => {
      if (cacheName !== 'sbtCache' || slug !== 'demo') return null;
      return {
        84532: {
          sbtList: {
            [demoAutoAddress.toLowerCase()]: {
              sbtAddress: demoAutoAddress,
              sbtInfo: {
                sessionSlug: 'demo',
              },
            },
          },
        },
      };
    });

    render(
      <SBTsPage
        sbtCacheRevision={0}
        provider="wagmi"
        network={{ id: 84532, name: 'Base Sepolia' }}
        account=""
        loginComplete={false}
        toggleLoginModal={jest.fn()}
        isSBTCacheReady={true}
        defaultFeaturedSBTs={[]}
        sessionSlug="demo"
        sessionConfig={{ slug: 'demo', autoFeatureSBTsBySessionSlug: true }}
      />,
    );

    expect(peekCacheSync).toHaveBeenCalledWith('sbtCache', 'demo', { clone: false });
    expect(mockSBTPage).toHaveBeenCalledWith(
      expect.objectContaining({
        SBTAddress: demoAutoAddress,
        sessionSlug: 'demo',
      }),
    );
    expect(getDemoSessionConfigBySlug).toHaveBeenCalledWith('demo', { allowDemoFallback: true });
  });

  it('uses explicit active session slugs when the list route rewrites to a session slug', () => {
    const contractScripts = jest.requireMock('../../utilities/web3/chainGateway.js');
    contractScripts.getSessionConfigBySlug.mockImplementation((slug) => {
      const normalized = String(slug || '');
      if (normalized === '') return { slug: '' };
      if (normalized === 'rxc') return { slug: 'rxc' };
      return null;
    });
    contractScripts.getSessionConfigBySlugOrDefault.mockReturnValue({ slug: '' });
    window.history.replaceState({}, '', sbtsListPath());
    const replaceStateSpy = jest.spyOn(window.history, 'replaceState');

    const subject = createSubject({ activeSessionSlug: 'rxc' });
    const resolved = subject.getResolvedRouting();

    expect(resolved).toEqual(
      expect.objectContaining({
        canonicalSlug: 'rxc',
        onSbtsRoute: true,
        urlHasNoSlug: false,
        isCreateRoute: false,
      }),
    );
    expect(replaceStateSpy).toHaveBeenCalledWith(null, '', `${sbtsListPath()}/rxc`);
    replaceStateSpy.mockRestore();
  });

  it('recognizes and canonicalizes PUBLIC_URL-prefixed groups routes', () => {
    const contractScripts = jest.requireMock('../../utilities/web3/contractScripts.js');
    process.env.PUBLIC_URL = '/ce/';
    contractScripts.getSessionConfigBySlug.mockImplementation((slug) => {
      const normalized = String(slug || '');
      if (normalized === '') return { slug: '' };
      if (normalized === 'rxc') return { slug: 'rxc' };
      return null;
    });
    contractScripts.getSessionConfigBySlugOrDefault.mockReturnValue({ slug: '' });
    window.history.replaceState({}, '', '/ce/groups');
    const replaceStateSpy = jest.spyOn(window.history, 'replaceState');

    const subject = createSubject({ activeSessionSlug: 'rxc' });
    const resolved = subject.getResolvedRouting();

    expect(resolved).toEqual(
      expect.objectContaining({
        canonicalSlug: 'rxc',
        onSbtsRoute: true,
        urlHasNoSlug: false,
        isCreateRoute: false,
      }),
    );
    expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/ce/groups/rxc');
    replaceStateSpy.mockRestore();
  });

  it('uses an explicitly supplied Worker session for session-scoped group creation', () => {
    const contractScripts = jest.requireMock('../../utilities/web3/chainGateway.js');
    const workerSessionConfig = {
      slug: 'demo-sh',
      groupCreationPolicy: 'participants',
      networkChainId: 11155420,
      sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
    };
    contractScripts.getSessionConfigBySlug.mockImplementation((slug) =>
      String(slug || '') === '' ? { slug: '' } : null,
    );
    contractScripts.getSessionConfigBySlugOrDefault.mockReturnValue({ slug: '' });
    getDemoSessionConfigBySlug.mockReturnValue(null);
    window.history.replaceState({}, '', '/groups/new');

    render(
      <SBTsPage
        sessionSlug="demo-sh"
        sessionConfig={workerSessionConfig}
        network={{ id: 84532, name: 'Base Sepolia' }}
        provider="wagmi"
        account=""
        loginComplete={false}
        toggleLoginModal={jest.fn()}
      />,
    );

    expect(screen.getByTestId('worker-group-create-panel')).toHaveTextContent('Active session');
    expect(screen.getByTestId('worker-group-create-panel')).toHaveTextContent('/demo-sh');
    expect(screen.queryByText(/on-chain|contract address|gas|RPC/i)).not.toBeInTheDocument();
    expect(mockWorkerGroupCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        createOnly: true,
        sessionConfig: workerSessionConfig,
        sessionSlug: 'demo-sh',
        showCreate: true,
      }),
    );
    expect(mockCreateGroup).not.toHaveBeenCalled();
    expect(contractScripts.getSessionConfigBySlug).not.toHaveBeenCalledWith('demo-sh');
    expect(getDemoSessionConfigBySlug).not.toHaveBeenCalledWith('demo-sh', { allowDemoFallback: true });
  });

  it('normalizes a legacy hash-scoped Worker detail route before asynchronous session discovery completes', () => {
    const contractScripts = jest.requireMock('../../utilities/web3/chainGateway.js');
    const workerSessionConfig = {
      slug: 'demo-sh',
      sessionId: '0xb822b3eca85bdc35cf83cb947bceb6b2',
      sessionName: 'Demo Session',
      groupCreationPolicy: 'participants',
      sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
    };
    contractScripts.getSessionConfigBySlug.mockReturnValue(null);
    contractScripts.getSessionConfigBySlugOrDefault.mockReturnValue({ slug: '' });
    getDemoSessionConfigBySlug.mockImplementation((slug) =>
      String(slug || '') === 'demo-sh' ? workerSessionConfig : null,
    );
    window.history.replaceState({}, '', '/groups?sessionName=demo-sh#group-public-reviewers');

    render(
      <SBTsPage
        provider="wagmi"
        network={null}
        account=""
        loginComplete={false}
        toggleLoginModal={jest.fn()}
        isSBTCacheReady={false}
        sessionSlug="demo-sh"
        sessionConfig={null}
      />,
    );

    expect(mockSBTsList).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe('/group/public-reviewers');
    expect(window.location.search).toBe('?sessionName=demo-sh');
    expect(window.location.hash).toBe('');
    expect(mockWorkerGroupCreate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        createOnly: false,
        networkChainId: null,
        selectedGroupId: 'public-reviewers',
        sessionConfig: workerSessionConfig,
        sessionName: 'Demo Session',
        sessionSlug: 'demo-sh',
        showCreate: false,
      }),
    );
  });

  it('preserves a legacy address-shaped Worker detail hash instead of canonicalizing it as an SBT', () => {
    const contractScripts = jest.requireMock('../../utilities/web3/chainGateway.js');
    const legacyAddressGroupId = '0x1234567890abcdef1234567890abcdef12345678';
    const workerSessionConfig = {
      slug: 'demo-sh',
      sessionId: '0xb822b3eca85bdc35cf83cb947bceb6b2',
      sessionName: 'Demo Session',
      groupCreationPolicy: 'participants',
      sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
    };
    contractScripts.getSessionConfigBySlug.mockReturnValue(null);
    contractScripts.getSessionConfigBySlugOrDefault.mockReturnValue({ slug: '' });
    getDemoSessionConfigBySlug.mockImplementation((slug) =>
      String(slug || '') === 'demo-sh' ? workerSessionConfig : null,
    );
    window.history.replaceState({}, '', `/groups?sessionName=demo-sh#group-${legacyAddressGroupId}`);

    render(
      <SBTsPage
        provider="wagmi"
        network={null}
        account=""
        loginComplete={false}
        toggleLoginModal={jest.fn()}
        isSBTCacheReady={false}
        sessionSlug="demo-sh"
        sessionConfig={null}
      />,
    );

    expect(window.location.pathname).toBe('/groups');
    expect(window.location.search).toBe('?sessionName=demo-sh');
    expect(window.location.hash).toBe(`#group-${legacyAddressGroupId}`);
    expect(mockWorkerGroupCreate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        createOnly: false,
        selectedGroupId: legacyAddressGroupId,
        sessionConfig: workerSessionConfig,
        sessionName: 'Demo Session',
        sessionSlug: 'demo-sh',
        showCreate: false,
      }),
    );
  });

  it('renders the canonical Worker detail route from its path group id and session query', () => {
    const contractScripts = jest.requireMock('../../utilities/web3/chainGateway.js');
    const workerSessionConfig = {
      slug: 'demo-sh',
      sessionId: '0xb822b3eca85bdc35cf83cb947bceb6b2',
      sessionName: 'Demo Session',
      groupCreationPolicy: 'participants',
      sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
    };
    contractScripts.getSessionConfigBySlug.mockReturnValue(null);
    contractScripts.getSessionConfigBySlugOrDefault.mockReturnValue({ slug: '' });
    getDemoSessionConfigBySlug.mockImplementation((slug) =>
      String(slug || '') === 'demo-sh' ? workerSessionConfig : null,
    );
    window.history.replaceState({}, '', '/group/public-reviewers?sessionName=demo-sh');

    render(
      <SBTsPage
        provider="wagmi"
        network={null}
        account=""
        loginComplete={false}
        toggleLoginModal={jest.fn()}
        isSBTCacheReady={false}
        sessionSlug="demo-sh"
        sessionConfig={null}
        workerGroupId="public-reviewers"
      />,
    );

    expect(window.location.pathname).toBe('/group/public-reviewers');
    expect(window.location.search).toBe('?sessionName=demo-sh');
    expect(window.location.hash).toBe('');
    expect(mockWorkerGroupCreate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        createOnly: false,
        selectedGroupId: 'public-reviewers',
        sessionConfig: workerSessionConfig,
        sessionName: 'Demo Session',
        sessionSlug: 'demo-sh',
        showCreate: false,
      }),
    );
  });

  it('fails closed instead of re-resolving a mismatched explicit standalone session config', () => {
    const contractScripts = jest.requireMock('../../utilities/web3/chainGateway.js');
    const workerSessionConfig = {
      slug: 'other-session',
      networkChainId: 11155420,
      sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
    };
    contractScripts.getSessionConfigBySlug.mockImplementation((slug) =>
      String(slug || '') === 'demo-sh'
        ? {
            slug: 'demo-sh',
            networkChainId: 84532,
            __registry: {
              sessionIdHex: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            },
          }
        : String(slug || '') === ''
          ? { slug: '' }
          : null,
    );
    contractScripts.getSessionConfigBySlugOrDefault.mockReturnValue({ slug: '' });
    window.history.replaceState({}, '', '/sbts/new');

    render(
      <SBTsPage
        sessionSlug="demo-sh"
        sessionConfig={workerSessionConfig}
        network={{ id: 84532, name: 'Base Sepolia' }}
        provider="wagmi"
        account=""
        loginComplete={false}
        toggleLoginModal={jest.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/session context could not be verified/i);
    expect(mockCreateGroup).not.toHaveBeenCalled();
    expect(contractScripts.getSessionConfigBySlug).not.toHaveBeenCalledWith('demo-sh');
  });

  it.each([
    ['missing', { slug: 'broken-session', networkChainId: 84532 }],
    ['invalid', { slug: 'broken-session', sessionModeProfile: { authority: { mode: 'worker_canonical' } } }],
  ])('fails closed for an explicit concrete %s-profile standalone context', (_label, sessionConfig) => {
    const contractScripts = jest.requireMock('../../utilities/web3/chainGateway.js');
    contractScripts.getSessionConfigBySlug.mockImplementation((slug) =>
      String(slug || '') === '' ? { slug: '' } : null,
    );
    contractScripts.getSessionConfigBySlugOrDefault.mockReturnValue({ slug: '' });
    window.history.replaceState({}, '', '/sbts/new');

    render(
      <SBTsPage
        sessionSlug="broken-session"
        sessionConfig={sessionConfig}
        network={{ id: 84532, name: 'Base Sepolia' }}
        provider="wagmi"
        account=""
        loginComplete={false}
        toggleLoginModal={jest.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/session context could not be verified/i);
    expect(mockCreateGroup).not.toHaveBeenCalled();
    expect(contractScripts.getSessionConfigBySlug).not.toHaveBeenCalledWith('broken-session');
  });

  it('keeps the unscoped global standalone SBT tool available without a session profile', () => {
    const contractScripts = jest.requireMock('../../utilities/web3/chainGateway.js');
    contractScripts.getSessionConfigBySlug.mockImplementation((slug) =>
      String(slug || '') === '' ? { slug: '' } : null,
    );
    contractScripts.getSessionConfigBySlugOrDefault.mockReturnValue({ slug: '' });
    window.history.replaceState({}, '', '/sbts/new');

    render(
      <SBTsPage
        sessionConfig={{}}
        network={{ id: 84532, name: 'Base Sepolia' }}
        provider="wagmi"
        account=""
        loginComplete={false}
        toggleLoginModal={jest.fn()}
      />,
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(mockCreateGroup).toHaveBeenCalledWith(
      expect.objectContaining({
        network: expect.objectContaining({ id: 84532 }),
        sessionSlug: '',
      }),
    );
  });

  it('accepts an explicitly supplied legacy registry config for standalone authoring', () => {
    const contractScripts = jest.requireMock('../../utilities/web3/chainGateway.js');
    const registrySessionConfig = {
      slug: 'legacy-session',
      networkChainId: 84532,
      __registry: {
        sessionIdHex: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      },
    };
    contractScripts.getSessionConfigBySlug.mockImplementation((slug) =>
      String(slug || '') === '' ? { slug: '' } : null,
    );
    contractScripts.getSessionConfigBySlugOrDefault.mockReturnValue({ slug: '' });
    window.history.replaceState({}, '', '/sbts/new');

    render(
      <SBTsPage
        sessionSlug="legacy-session"
        sessionConfig={registrySessionConfig}
        network={{ id: 84532, name: 'Base Sepolia' }}
        provider="wagmi"
        account=""
        loginComplete={false}
        toggleLoginModal={jest.fn()}
      />,
    );

    expect(mockCreateGroup).toHaveBeenCalledWith(
      expect.objectContaining({
        preferConnectedNetworkForAuthoring: false,
        sessionConfigOverride: registrySessionConfig,
        sessionSlug: 'legacy-session',
      }),
    );
  });

  it('auto-features SBTs whose metadata sessionSlug matches the active session', () => {
    const manualAddress = '0x0000000000000000000000000000000000000011';
    const matchingInfoAddress = '0x00000000000000000000000000000000000000a1';
    const matchingTopLevelAddress = '0x00000000000000000000000000000000000000a2';
    const otherSessionAddress = '0x00000000000000000000000000000000000000b1';

    peekCacheSync.mockReturnValue({
      84532: {
        sbtList: {
          [matchingInfoAddress.toLowerCase()]: {
            sbtAddress: matchingInfoAddress,
            sbtInfo: {
              sessionSlug: 'alpha',
            },
          },
          [matchingTopLevelAddress.toLowerCase()]: {
            sbtAddress: matchingTopLevelAddress,
            sessionSlug: 'alpha',
          },
          [otherSessionAddress.toLowerCase()]: {
            sbtAddress: otherSessionAddress,
            sbtInfo: {
              sessionSlug: 'beta',
            },
          },
        },
      },
    });

    const subject = createSubject();
    const result = subject.getMemoizedFeaturedList({
      baseFeaturedList: [manualAddress],
      effectiveSessionSlug: 'alpha',
      autoFeature: true,
      isSBTCacheReady: true,
    });

    expect(result).toEqual([manualAddress, matchingInfoAddress, matchingTopLevelAddress]);
  });

  it('auto-features default-session SBTs even when the target slug normalizes to general', () => {
    const generalAddress = '0x00000000000000000000000000000000000000c1';
    const otherSessionAddress = '0x00000000000000000000000000000000000000c2';

    peekCacheSync.mockReturnValue({
      84532: {
        sbtList: {
          [generalAddress.toLowerCase()]: {
            sbtAddress: generalAddress,
            sbtInfo: {
              sessionSlug: 'general',
            },
          },
          [otherSessionAddress.toLowerCase()]: {
            sbtAddress: otherSessionAddress,
            sbtInfo: {
              sessionSlug: 'alpha',
            },
          },
        },
      },
    });

    const subject = createSubject();
    const result = subject.getMemoizedFeaturedList({
      baseFeaturedList: [],
      effectiveSessionSlug: '',
      autoFeature: true,
      isSBTCacheReady: true,
    });

    expect(peekCacheSync).toHaveBeenCalledTimes(1);
    expect(result).toEqual([generalAddress]);
  });

  it('only auto-features authoritative or legacy metadata session slugs', () => {
    const legacySlugAddress = '0x00000000000000000000000000000000000000d1';
    const inferredMatchAddress = '0x00000000000000000000000000000000000000d2';
    const sourceBucketOnlyAddress = '0x00000000000000000000000000000000000000d3';
    const explicitOtherSessionAddress = '0x00000000000000000000000000000000000000d4';

    peekCacheSync.mockReturnValue({
      84532: {
        sbtList: {
          [legacySlugAddress.toLowerCase()]: {
            sbtAddress: legacySlugAddress,
            sbtInfo: {
              slug: 'alpha',
            },
          },
          [inferredMatchAddress.toLowerCase()]: {
            sbtAddress: inferredMatchAddress,
            slug: 'alpha',
            sbtInfo: {
              sessionSlug: 'alpha',
              sessionSlugExplicit: false,
            },
          },
          [sourceBucketOnlyAddress.toLowerCase()]: {
            sbtAddress: sourceBucketOnlyAddress,
            slug: 'alpha',
          },
          [explicitOtherSessionAddress.toLowerCase()]: {
            sbtAddress: explicitOtherSessionAddress,
            sbtInfo: {
              sessionSlug: 'beta',
              sessionSlugExplicit: true,
            },
          },
        },
      },
    });

    const subject = createSubject();
    const result = subject.getMemoizedFeaturedList({
      baseFeaturedList: [],
      effectiveSessionSlug: 'alpha',
      autoFeature: true,
      isSBTCacheReady: true,
    });

    expect(result).toEqual([legacySlugAddress]);
  });

  it('strict auto-feature mode only accepts explicit session bindings', () => {
    const explicitAddress = '0x0000000000000000000000000000000000000e11';
    const unflaggedAddress = '0x0000000000000000000000000000000000000e12';
    const legacySlugAddress = '0x0000000000000000000000000000000000000e13';
    const inferredAddress = '0x0000000000000000000000000000000000000e14';

    peekCacheSync.mockReturnValue({
      84532: {
        sbtList: {
          [explicitAddress.toLowerCase()]: {
            sbtAddress: explicitAddress,
            sbtInfo: {
              sessionSlug: 'alpha',
              sessionSlugExplicit: true,
            },
          },
          [unflaggedAddress.toLowerCase()]: {
            sbtAddress: unflaggedAddress,
            sbtInfo: {
              sessionSlug: 'alpha',
            },
          },
          [legacySlugAddress.toLowerCase()]: {
            sbtAddress: legacySlugAddress,
            sbtInfo: {
              slug: 'alpha',
            },
          },
          [inferredAddress.toLowerCase()]: {
            sbtAddress: inferredAddress,
            sbtInfo: {
              sessionSlug: 'alpha',
              sessionSlugExplicit: false,
            },
          },
        },
      },
    });

    const subject = createSubject();
    const result = subject.getMemoizedFeaturedList({
      baseFeaturedList: [explicitAddress, unflaggedAddress, legacySlugAddress, inferredAddress],
      effectiveSessionSlug: 'alpha',
      autoFeature: true,
      requireExplicitSessionSlug: true,
      isSBTCacheReady: true,
    });

    expect(result).toEqual([explicitAddress]);
  });

  it('does not auto-feature demo E2E fixture SBTs in the public demo session', () => {
    const visibleAddress = '0x0000000000000000000000000000000000000d11';
    const fixtureAddress = '0x0000000000000000000000000000000000000d12';

    peekCacheSync.mockReturnValue({
      84532: {
        sbtList: {
          [visibleAddress.toLowerCase()]: {
            sbtAddress: visibleAddress,
            sbtInfo: {
              name: 'd/acc',
              sessionSlug: 'demo',
              sessionSlugExplicit: true,
            },
          },
          [fixtureAddress.toLowerCase()]: {
            sbtAddress: fixtureAddress,
            sbtInfo: {
              name: 'AI Gate Test SBT 16-May-2026-11-23-AM [e2e-default-20260516-112229] #1',
              sessionSlug: 'demo',
              sessionSlugExplicit: true,
            },
          },
        },
      },
    });

    const result = createSubject().getMemoizedFeaturedList({
      baseFeaturedList: [],
      effectiveSessionSlug: 'demo',
      autoFeature: true,
      requireExplicitSessionSlug: true,
      isSBTCacheReady: true,
    });

    expect(result).toEqual([visibleAddress]);
  });

  it('does not auto-feature bucket-only or inferred fallback session matches', () => {
    const inferredMatchAddress = '0x00000000000000000000000000000000000000e1';
    const bucketOnlyAddress = '0x00000000000000000000000000000000000000e2';

    peekCacheSync.mockReturnValue({
      84532: {
        sbtList: {
          [inferredMatchAddress.toLowerCase()]: {
            sbtAddress: inferredMatchAddress,
            slug: 'alpha',
            sbtInfo: {
              sessionSlug: 'alpha',
              sessionSlugExplicit: false,
            },
          },
          [bucketOnlyAddress.toLowerCase()]: {
            sbtAddress: bucketOnlyAddress,
            slug: 'alpha',
          },
        },
      },
    });

    const subject = createSubject();
    const result = subject.getMemoizedFeaturedList({
      baseFeaturedList: [],
      effectiveSessionSlug: 'alpha',
      autoFeature: true,
      isSBTCacheReady: true,
    });

    expect(result).toEqual([]);

    const generalSubject = createSubject();
    const generalResult = generalSubject.getMemoizedFeaturedList({
      baseFeaturedList: [],
      effectiveSessionSlug: '',
      autoFeature: true,
      isSBTCacheReady: true,
    });

    expect(generalResult).toEqual([]);
  });

  it('does not render embedded featured cards from inferred session cache bindings', () => {
    const inferredAddress = '0x00000000000000000000000000000000000000e3';

    peekCacheSync.mockReturnValue({
      84532: {
        sbtList: {
          [inferredAddress.toLowerCase()]: {
            sbtAddress: inferredAddress,
            slug: 'alpha',
            sessionSlug: 'alpha',
            sessionSlugExplicit: false,
            sbtInfo: {
              name: 'Inferred Alpha Group',
              sessionSlug: 'alpha',
              sessionSlugExplicit: false,
            },
          },
        },
      },
    });

    expect(
      createSubject().getMemoizedFeaturedList({
        baseFeaturedList: [],
        effectiveSessionSlug: 'alpha',
        autoFeature: true,
        isSBTCacheReady: false,
      }),
    ).toEqual([]);

    render(
      <SBTsPage
        sbtCacheRevision={0}
        provider="wagmi"
        network={{ id: 84532, name: 'Base Sepolia' }}
        account=""
        loginComplete={false}
        toggleLoginModal={jest.fn()}
        isSBTCacheReady={false}
        defaultFeaturedSBTs={[]}
        sessionSlug="alpha"
        sessionConfig={{ slug: 'alpha', autoFeatureSBTsBySessionSlug: true }}
        miniaturized={true}
        hideMiniActionRow={true}
        preferCacheBackedFeaturedCards={true}
      />,
    );

    expect(screen.queryByText('Inferred Alpha Group')).not.toBeInTheDocument();
    expect(screen.queryByTestId(`cache-featured-sbt-link-${inferredAddress.toLowerCase()}`)).not.toBeInTheDocument();
    expect(screen.queryByTestId('mock-sbt-page')).not.toBeInTheDocument();
  });

  it('keeps configured featured cards when strict embedded auto-feature filtering is enabled', () => {
    const contractScripts = jest.requireMock('../../utilities/web3/contractScripts.js');
    const configuredAddress = '0x000000000000000000000000000000000000d001';
    contractScripts.getSessionConfigBySlug.mockImplementation((slug) =>
      String(slug || '') === 'demo-1' ? { slug: 'demo-1' } : null,
    );
    contractScripts.getSessionConfigBySlugOrDefault.mockReturnValue({ slug: '' });
    peekCacheSync.mockReturnValue({});

    render(
      <SBTsPage
        sbtCacheRevision={0}
        provider="wagmi"
        network={{ id: 11155420, name: 'OP Sepolia' }}
        account=""
        loginComplete={false}
        toggleLoginModal={jest.fn()}
        isSBTCacheReady={false}
        defaultFeaturedSBTs={[configuredAddress]}
        sessionSlug="demo-1"
        sessionConfig={{ slug: 'demo-1', autoFeatureSBTsBySessionSlug: false }}
        miniaturized={true}
        hideMiniActionRow={true}
        preferCacheBackedFeaturedCards={true}
        requireExplicitAutoFeatureSessionSlug={true}
      />,
    );

    expect(screen.getByTestId('embedded-featured-spinner')).toBeInTheDocument();
    expect(screen.getAllByTestId('mock-sbt-page')).toHaveLength(1);
    const latestProps = mockSBTPage.mock.calls[mockSBTPage.mock.calls.length - 1][0];
    expect(latestProps.SBTAddress).toBe(configuredAddress);
    expect(latestProps.sessionSlug).toBe('demo-1');
  });

  it('does not auto-feature session matches when the flag is disabled', () => {
    peekCacheSync.mockReturnValue({
      84532: {
        sbtList: {
          '0x00000000000000000000000000000000000000a1': {
            sbtAddress: '0x00000000000000000000000000000000000000a1',
            sbtInfo: {
              sessionSlug: 'alpha',
            },
          },
        },
      },
    });

    const subject = createSubject();
    const result = subject.getMemoizedFeaturedList({
      baseFeaturedList: [],
      effectiveSessionSlug: 'alpha',
      autoFeature: false,
      isSBTCacheReady: true,
    });

    expect(result).toEqual([]);
    expect(peekCacheSync).not.toHaveBeenCalled();
  });

  it('keeps cache-backed auto-feature matches available while readiness is still false', () => {
    const cachedAddress = '0x00000000000000000000000000000000000000f0';

    peekCacheSync.mockReturnValue({
      84532: {
        sbtList: {
          [cachedAddress.toLowerCase()]: {
            sbtAddress: cachedAddress,
            sbtInfo: {
              sessionSlug: 'alpha',
            },
          },
        },
      },
    });

    const subject = createSubject();
    const result = subject.getMemoizedFeaturedList({
      baseFeaturedList: [],
      effectiveSessionSlug: 'alpha',
      autoFeature: true,
      isSBTCacheReady: false,
    });

    expect(result).toEqual([cachedAddress]);
  });

  it('uses per-session auto-feature toggles when aggregating list-scope featured entries', () => {
    const contractScripts = jest.requireMock('../../utilities/web3/chainGateway.js');
    const alphaManualAddress = '0x00000000000000000000000000000000000000a1';
    const alphaAutoAddress = '0x00000000000000000000000000000000000000a2';
    const betaManualAddress = '0x00000000000000000000000000000000000000b1';
    const betaAutoAddress = '0x00000000000000000000000000000000000000b2';
    const gammaAutoAddress = '0x00000000000000000000000000000000000000c1';
    const deltaAutoAddress = '0x00000000000000000000000000000000000000d1';

    contractScripts.getSessionConfigBySlug.mockImplementation((slug) => {
      const normalized = String(slug || '');
      if (normalized === 'alpha') {
        return {
          slug: 'alpha',
          featured_SBTs_LIST: [alphaManualAddress],
          autoFeatureSBTsWithFeaturedSbtTags: true,
        };
      }
      if (normalized === 'beta') {
        return {
          slug: 'beta',
          featured_SBTs_LIST: [betaManualAddress],
          autoFeatureSBTsBySessionSlug: false,
        };
      }
      if (normalized === 'gamma') {
        return {
          slug: 'gamma',
          featured_SBTs_LIST: [],
          autoFeatureSBTsBySessionSlug: true,
          autoFeatureSBTsWithFeaturedSbtTags: false,
        };
      }
      if (normalized === 'delta') {
        return {
          slug: 'delta',
          featured_SBTs_LIST: [],
          autoFeatureSBTsWithFeaturedSbtTags: true,
        };
      }
      return null;
    });

    peekCacheSync.mockImplementation((cacheName, slug) => {
      if (cacheName !== 'sbtCache') return null;
      if (slug === 'alpha') {
        return {
          84532: {
            sbtList: {
              [alphaAutoAddress.toLowerCase()]: {
                sbtAddress: alphaAutoAddress,
                sbtInfo: {
                  sessionSlug: 'alpha',
                },
              },
            },
          },
        };
      }
      if (slug === 'beta') {
        return {
          84532: {
            sbtList: {
              [betaAutoAddress.toLowerCase()]: {
                sbtAddress: betaAutoAddress,
                sbtInfo: {
                  sessionSlug: 'beta',
                },
              },
            },
          },
        };
      }
      if (slug === 'gamma') {
        return {
          84532: {
            sbtList: {
              [gammaAutoAddress.toLowerCase()]: {
                sbtAddress: gammaAutoAddress,
                sbtInfo: {
                  sessionSlug: 'gamma',
                },
              },
            },
          },
        };
      }
      if (slug === 'delta') {
        return {
          84532: {
            sbtList: {
              [deltaAutoAddress.toLowerCase()]: {
                sbtAddress: deltaAutoAddress,
                sbtInfo: {
                  sessionSlug: 'delta',
                },
              },
            },
          },
        };
      }
      return null;
    });

    const subject = createSubject();
    const result = subject.getMemoizedFeaturedEntries({
      baseFeaturedList: [alphaManualAddress],
      effectiveSessionSlug: 'alpha',
      effectiveSessionAutoFeature: true,
      isSBTCacheReady: true,
      includeListScopeSessions: true,
      listScopeSessionSlugs: ['alpha', 'beta', 'gamma', 'delta'],
    });

    expect(result).toEqual([
      { address: alphaManualAddress, sessionSlug: 'alpha' },
      { address: alphaAutoAddress, sessionSlug: 'alpha' },
      { address: betaManualAddress, sessionSlug: 'beta' },
      { address: gammaAutoAddress, sessionSlug: 'gamma' },
      { address: deltaAutoAddress, sessionSlug: 'delta' },
    ]);
    expect(peekCacheSync.mock.calls.map((args) => args[1])).toEqual(['alpha', 'gamma', 'delta']);
  });

  it('supports externally controlled embedded create state while hiding the mini action row', () => {
    const workerSessionConfig = {
      slug: 'alpha',
      groupCreationPolicy: 'participants',
      sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
    };
    render(
      <SBTsPage
        sbtCacheRevision={0}
        provider="wagmi"
        network={{ id: 84532, name: 'Base Sepolia' }}
        account=""
        loginComplete={false}
        toggleLoginModal={jest.fn()}
        isSBTCacheReady={true}
        defaultFeaturedSBTs={[]}
        sessionSlug="alpha"
        sessionConfig={workerSessionConfig}
        sessionName="Alpha"
        sessionInfo="Alpha session"
        hideMiniActionRow={true}
        showCreateGroupExternal={true}
      />,
    );

    expect(screen.queryByRole('button', { name: /^View All$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Create$/i })).not.toBeInTheDocument();
    expect(screen.getByTestId('worker-group-create-panel')).toHaveTextContent('Alpha');
    expect(screen.getByTestId('worker-group-create-panel')).toHaveTextContent('/alpha');
    expect(screen.queryByText(/on-chain|contract address|gas|RPC/i)).not.toBeInTheDocument();
  });

  it('renders the active Worker session groups when embedded in the home explorer', () => {
    const workerSessionConfig = {
      slug: 'demo-sh',
      groupCreationPolicy: 'participants',
      sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
    };

    render(
      <SBTsPage
        sbtCacheRevision={0}
        provider="wagmi"
        network={{ id: 84532, name: 'Base Sepolia' }}
        account=""
        loginComplete={false}
        toggleLoginModal={jest.fn()}
        isSBTCacheReady={true}
        defaultFeaturedSBTs={[]}
        sessionSlug="demo-sh"
        activeSessionSlug="demo-sh"
        sessionConfig={workerSessionConfig}
        sessionName="Demo Session"
        sessionInfo="Demo session"
        hideMiniActionRow={true}
        embeddedWorkerGroups={true}
        showCreateGroupExternal={false}
      />,
    );

    expect(screen.getByTestId('worker-group-create-panel')).toHaveTextContent('Demo Session');
    expect(screen.getByTestId('worker-group-create-panel')).toHaveTextContent('/demo-sh');
    expect(mockWorkerGroupCreate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        createOnly: false,
        sessionConfig: workerSessionConfig,
        sessionSlug: 'demo-sh',
        showCreate: false,
      }),
    );
    expect(mockSBTsList).not.toHaveBeenCalled();
    expect(mockSBTPage).not.toHaveBeenCalled();
  });

  it('routes an unregistered Worker /groups/:slug list directly to the active Worker session', () => {
    const contractScripts = jest.requireMock('../../utilities/web3/chainGateway.js');
    contractScripts.getSessionConfigBySlug.mockReturnValue(null);
    contractScripts.getSessionConfigBySlugOrDefault.mockReturnValue({ slug: '' });
    const workerSessionConfig = {
      slug: 'unregistered-worker',
      groupCreationPolicy: 'participants',
      sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
    };
    window.history.replaceState({}, '', '/groups/unregistered-worker');

    render(
      <SBTsPage
        sbtCacheRevision={0}
        provider="wagmi"
        network={{ id: 84532, name: 'Base Sepolia' }}
        account=""
        loginComplete={true}
        toggleLoginModal={jest.fn()}
        isSBTCacheReady={true}
        defaultFeaturedSBTs={[]}
        sessionSlug="unregistered-worker"
        sessionConfig={workerSessionConfig}
      />,
    );

    expect(mockSBTsList).not.toHaveBeenCalled();
    expect(mockWorkerGroupCreate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        createOnly: false,
        sessionConfig: workerSessionConfig,
        sessionSlug: 'unregistered-worker',
        showCreate: false,
      }),
    );
    fireEvent.click(screen.getByTestId('ce-sbts-create-toggle'));
    expect(screen.getByTestId('worker-group-create-panel')).toHaveTextContent('/unregistered-worker');
    expect(mockWorkerGroupCreate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        createOnly: false,
        sessionConfig: workerSessionConfig,
        sessionSlug: 'unregistered-worker',
        showCreate: true,
      }),
    );
  });

  it('prefers an exact Worker route config over a same-slug registry config', () => {
    const contractScripts = jest.requireMock('../../utilities/web3/chainGateway.js');
    const workerSessionConfig = {
      slug: 'shared-slug',
      groupCreationPolicy: 'participants',
      sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
    };
    const registrySessionConfig = {
      slug: 'shared-slug',
      sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED),
    };
    contractScripts.getSessionConfigBySlug.mockReturnValue(registrySessionConfig);
    window.history.replaceState({}, '', '/groups/shared-slug');

    render(
      <SBTsPage
        sbtCacheRevision={0}
        provider="wagmi"
        network={{ id: 84532, name: 'Base Sepolia' }}
        account=""
        loginComplete={true}
        toggleLoginModal={jest.fn()}
        isSBTCacheReady={true}
        defaultFeaturedSBTs={[]}
        sessionSlug="shared-slug"
        sessionConfig={workerSessionConfig}
      />,
    );

    expect(mockSBTsList).not.toHaveBeenCalled();
    expect(mockWorkerGroupCreate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        createOnly: false,
        sessionConfig: workerSessionConfig,
        sessionSlug: 'shared-slug',
        showCreate: false,
      }),
    );
    fireEvent.click(screen.getByTestId('ce-sbts-create-toggle'));
    expect(screen.getByTestId('worker-group-create-panel')).toHaveTextContent('/shared-slug');
    expect(mockWorkerGroupCreate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        createOnly: false,
        sessionConfig: workerSessionConfig,
        sessionSlug: 'shared-slug',
        showCreate: true,
      }),
    );
  });

  it('enforces the selected registry-session creation policy in Context Engine routes', () => {
    const contractScripts = jest.requireMock('../../utilities/web3/chainGateway.js');
    const adminAddress = '0x00000000000000000000000000000000000000aa';
    const participantAddress = '0x00000000000000000000000000000000000000bb';
    const registryConfig = {
      slug: 'restricted',
      groupCreationPolicy: 'admin_only',
      sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED),
      __registry: {
        registryChainId: 11155420,
        adminAddress,
        sessionIdHex: '0x00112233445566778899aabbccddeeff',
      },
    };
    contractScripts.getSessionConfigBySlug.mockReturnValue(registryConfig);
    window.history.replaceState({}, '', '/groups/restricted');

    const { rerender } = render(
      <SBTsPage
        sbtCacheRevision={0}
        provider="wagmi"
        network={{ id: 11155420, name: 'OP Sepolia' }}
        account={participantAddress}
        loginComplete={true}
        isSBTCacheReady={true}
        sessionSlug="restricted"
        sessionConfig={registryConfig}
      />,
    );

    expect(screen.queryByTestId('ce-sbts-create-toggle')).not.toBeInTheDocument();

    window.history.replaceState({}, '', `${sbtsListPath()}/new`);
    rerender(
      <SBTsPage
        sbtCacheRevision={0}
        provider="wagmi"
        network={{ id: 11155420, name: 'OP Sepolia' }}
        account={participantAddress}
        loginComplete={true}
        isSBTCacheReady={true}
        sessionSlug="restricted"
        sessionConfig={registryConfig}
      />,
    );
    expect(screen.getByTestId('ce-session-group-creation-policy-denied')).toBeInTheDocument();
    expect(screen.queryByTestId('create-group-panel')).not.toBeInTheDocument();

    rerender(
      <SBTsPage
        sbtCacheRevision={0}
        provider="wagmi"
        network={{ id: 11155420, name: 'OP Sepolia' }}
        account={adminAddress}
        loginComplete={true}
        isSBTCacheReady={true}
        sessionSlug="restricted"
        sessionConfig={registryConfig}
      />,
    );
    expect(screen.getByTestId('create-group-panel')).toBeInTheDocument();
  });

  it('uses terminology-aware back button text on the create route', () => {
    window.history.replaceState({}, '', `${sbtsListPath()}/new`);

    render(
      <SBTsPage
        sbtCacheRevision={0}
        provider="wagmi"
        network={{ id: 84532, name: 'Base Sepolia' }}
        account=""
        loginComplete={false}
        toggleLoginModal={jest.fn()}
        isSBTCacheReady={true}
        defaultFeaturedSBTs={[]}
        sessionSlug="alpha"
        sessionName="Alpha"
        sessionInfo="Alpha session"
      />,
    );

    expect(screen.getByRole('button', { name: /^Back to Groups$/i })).toBeInTheDocument();
  });

  it('can render the embedded create panel above featured SBT cards when requested', () => {
    const featuredAddress = '0x00000000000000000000000000000000000000a1';

    render(
      <SBTsPage
        sbtCacheRevision={0}
        provider="wagmi"
        network={{ id: 84532, name: 'Base Sepolia' }}
        account=""
        loginComplete={false}
        toggleLoginModal={jest.fn()}
        isSBTCacheReady={true}
        defaultFeaturedSBTs={[featuredAddress]}
        sessionSlug="alpha"
        sessionConfig={{
          slug: 'alpha',
          groupCreationPolicy: 'participants',
          sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED),
        }}
        sessionName="Alpha"
        sessionInfo="Alpha session"
        hideMiniActionRow={true}
        showCreateGroupExternal={true}
        showCreateGroupAboveFeatured={true}
      />,
    );

    const createPanel = screen.getByTestId('create-group-panel');
    const firstFeaturedCard = screen.getAllByTestId('mock-sbt-page')[0];

    expect(createPanel.compareDocumentPosition(firstFeaturedCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('uses demo-only featured SBT lists for embedded display readers when registry config is missing', () => {
    const contractScripts = jest.requireMock('../../utilities/web3/chainGateway.js');
    const demoFeaturedAddress = '0x00000000000000000000000000000000000000de';
    contractScripts.getSessionConfigBySlug.mockImplementation((slug) =>
      String(slug || '') === '' ? { slug: '' } : null,
    );
    contractScripts.getSessionConfigBySlugOrDefault.mockReturnValue({ slug: '' });
    getDemoSessionConfigBySlug.mockImplementation((slug) =>
      String(slug || '') === 'edge'
        ? {
            slug: 'edge',
            featured_SBTs_LIST: [demoFeaturedAddress],
          }
        : null,
    );
    getSessionLists.mockReturnValue({ featured_SBTs_LIST: [], ignored_SBTs_LIST: [] });

    render(
      <SBTsPage
        sbtCacheRevision={0}
        provider="wagmi"
        network={{ id: 84532, name: 'Base Sepolia' }}
        account=""
        loginComplete={false}
        toggleLoginModal={jest.fn()}
        isSBTCacheReady={true}
        defaultFeaturedSBTs={[]}
        sessionSlug="edge"
        sessionConfig={{ autoFeatureSBTsWithFeaturedSbtTags: false }}
      />,
    );

    const renderedCards = mockSBTPage.mock.calls.map(([props]) => ({
      address: props.SBTAddress,
      sessionSlug: props.sessionSlug,
    }));

    expect(renderedCards).toEqual(expect.arrayContaining([{ address: demoFeaturedAddress, sessionSlug: 'edge' }]));
    expect(getDemoSessionConfigBySlug).toHaveBeenCalledWith('edge', { allowDemoFallback: true });
  });

  it('renders interactive mini SBT readers once cache-backed featured cards are ready', () => {
    const featuredAddress = '0x00000000000000000000000000000000000000ab';
    peekCacheSync.mockReturnValue({
      84532: {
        sbtList: {
          [featuredAddress.toLowerCase()]: {
            sbtAddress: featuredAddress,
            sbtInfo: {
              sessionSlug: 'alpha',
              name: 'Cache First Group',
              description: 'Fast path card',
            },
          },
        },
      },
    });

    render(
      <SBTsPage
        sbtCacheRevision={0}
        provider="wagmi"
        network={{ id: 84532, name: 'Base Sepolia' }}
        account=""
        loginComplete={false}
        toggleLoginModal={jest.fn()}
        isSBTCacheReady={true}
        defaultFeaturedSBTs={[featuredAddress]}
        sessionSlug="alpha"
        miniaturized={true}
        hideMiniActionRow={true}
        preferCacheBackedFeaturedCards={true}
      />,
    );

    expect(screen.queryByTestId(`cache-featured-sbt-link-${featuredAddress.toLowerCase()}`)).not.toBeInTheDocument();
    expect(screen.getAllByTestId('mock-sbt-page')).toHaveLength(1);
    expect(mockSBTPage.mock.calls[mockSBTPage.mock.calls.length - 1][0]).toEqual(
      expect.objectContaining({
        SBTAddress: featuredAddress,
        miniaturized: true,
        miniMintable: true,
      }),
    );
  });

  it('falls back to mini SBT readers immediately when cache-backed featured cards are unavailable on cold start', () => {
    const featuredAddress = '0x00000000000000000000000000000000000000ac';
    peekCacheSync.mockReturnValue({});

    render(
      <SBTsPage
        sbtCacheRevision={0}
        provider="wagmi"
        network={{ id: 84532, name: 'Base Sepolia' }}
        account=""
        loginComplete={false}
        toggleLoginModal={jest.fn()}
        isSBTCacheReady={false}
        defaultFeaturedSBTs={[featuredAddress]}
        sessionSlug="alpha"
        miniaturized={true}
        hideMiniActionRow={true}
        preferCacheBackedFeaturedCards={true}
      />,
    );

    expect(screen.getByTestId('embedded-featured-spinner')).toBeInTheDocument();
    expect(screen.getAllByTestId('mock-sbt-page')).toHaveLength(1);
    expect(mockSBTPage.mock.calls[mockSBTPage.mock.calls.length - 1][0]).toEqual(
      expect.objectContaining({
        SBTAddress: featuredAddress,
      }),
    );
  });

  it('keeps cache-backed featured cards visible without a readiness spinner once they are already cached', () => {
    const featuredAddress = '0x00000000000000000000000000000000000000ad';
    peekCacheSync.mockReturnValue({
      84532: {
        sbtList: {
          [featuredAddress.toLowerCase()]: {
            sbtAddress: featuredAddress,
            sbtInfo: {
              sessionSlug: 'alpha',
              name: 'Warm Cache Group',
              description: 'Cached before readiness flips.',
              image: 'https://example.test/warm-cache-group.png',
            },
          },
        },
      },
    });

    render(
      <SBTsPage
        sbtCacheRevision={0}
        provider="wagmi"
        network={{ id: 84532, name: 'Base Sepolia' }}
        account=""
        loginComplete={false}
        toggleLoginModal={jest.fn()}
        isSBTCacheReady={false}
        defaultFeaturedSBTs={[featuredAddress]}
        sessionSlug="alpha"
        miniaturized={true}
        hideMiniActionRow={true}
        preferCacheBackedFeaturedCards={true}
      />,
    );

    expect(screen.getByTestId(`cache-featured-sbt-link-${featuredAddress.toLowerCase()}`)).toBeInTheDocument();
    expect(screen.getByText('Warm Cache Group')).toBeInTheDocument();
    expect(screen.getByLabelText(`${t('minting')} Live`)).toBeInTheDocument();
    expect(screen.queryByTestId('embedded-featured-spinner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mock-sbt-page')).not.toBeInTheDocument();
  });

  it('falls back to mini SBT readers when cached featured metadata is missing its image', () => {
    const contractScripts = jest.requireMock('../../utilities/web3/contractScripts.js');
    const featuredAddress = '0x00000000000000000000000000000000000000b2';
    contractScripts.getSessionConfigBySlug.mockImplementation((slug) =>
      String(slug || '') === 'alpha' ? { slug: 'alpha' } : null,
    );
    contractScripts.getSessionConfigBySlugOrDefault.mockReturnValue({ slug: '' });
    peekCacheSync.mockReturnValue({
      84532: {
        sbtList: {
          [featuredAddress.toLowerCase()]: {
            sbtAddress: featuredAddress,
            sbtInfo: {
              sessionSlug: 'alpha',
              name: 'Partial Cache Group',
              description: 'Discovered before tokenURI metadata hydrated.',
            },
          },
        },
      },
    });

    render(
      <SBTsPage
        sbtCacheRevision={0}
        provider="wagmi"
        network={{ id: 84532, name: 'Base Sepolia' }}
        account=""
        loginComplete={false}
        toggleLoginModal={jest.fn()}
        isSBTCacheReady={false}
        defaultFeaturedSBTs={[featuredAddress]}
        sessionSlug="alpha"
        miniaturized={true}
        hideMiniActionRow={true}
        preferCacheBackedFeaturedCards={true}
      />,
    );

    expect(screen.queryByTestId(`cache-featured-sbt-link-${featuredAddress.toLowerCase()}`)).not.toBeInTheDocument();
    expect(screen.getAllByTestId('mock-sbt-page')).toHaveLength(1);
    expect(mockSBTPage.mock.calls[mockSBTPage.mock.calls.length - 1][0]).toEqual(
      expect.objectContaining({
        SBTAddress: featuredAddress,
        sessionSlug: 'alpha',
      }),
    );
  });

  it('hides cache-backed featured card addresses in plain mode', () => {
    const featuredAddress = '0x00000000000000000000000000000000000000b3';
    const cryptoModeSpy = jest.spyOn(terminology, 'isCryptoMode').mockReturnValue(false);
    const shortenedAddress = proposalScripts.getShortenedAddress(featuredAddress, false);

    peekCacheSync.mockReturnValue({
      84532: {
        sbtList: {
          [featuredAddress.toLowerCase()]: {
            sbtAddress: featuredAddress,
            sbtInfo: {
              sessionSlug: 'alpha',
              name: 'Plain Mode Group',
              image: 'https://example.test/plain-mode-group.png',
            },
          },
        },
      },
    });

    render(
      <SBTsPage
        sbtCacheRevision={0}
        provider="wagmi"
        network={{ id: 84532, name: 'Base Sepolia' }}
        account=""
        loginComplete={false}
        toggleLoginModal={jest.fn()}
        isSBTCacheReady={false}
        defaultFeaturedSBTs={[featuredAddress]}
        sessionSlug="alpha"
        miniaturized={true}
        hideMiniActionRow={true}
        preferCacheBackedFeaturedCards={true}
      />,
    );

    expect(screen.getByTestId(`cache-featured-sbt-link-${featuredAddress.toLowerCase()}`)).toBeInTheDocument();
    expect(screen.getByText('Plain Mode Group')).toBeInTheDocument();
    expect(screen.queryByText(shortenedAddress)).not.toBeInTheDocument();

    cryptoModeSpy.mockRestore();
  });

  it('shows cache-backed featured card addresses in crypto mode', () => {
    const featuredAddress = '0x00000000000000000000000000000000000000b4';
    const cryptoModeSpy = jest.spyOn(terminology, 'isCryptoMode').mockReturnValue(true);
    const shortenedAddress = proposalScripts.getShortenedAddress(featuredAddress, false);

    peekCacheSync.mockReturnValue({
      84532: {
        sbtList: {
          [featuredAddress.toLowerCase()]: {
            sbtAddress: featuredAddress,
            sbtInfo: {
              sessionSlug: 'alpha',
              name: 'Crypto Mode Group',
              image: 'https://example.test/crypto-mode-group.png',
            },
          },
        },
      },
    });

    render(
      <SBTsPage
        sbtCacheRevision={0}
        provider="wagmi"
        network={{ id: 84532, name: 'Base Sepolia' }}
        account=""
        loginComplete={false}
        toggleLoginModal={jest.fn()}
        isSBTCacheReady={false}
        defaultFeaturedSBTs={[featuredAddress]}
        sessionSlug="alpha"
        miniaturized={true}
        hideMiniActionRow={true}
        preferCacheBackedFeaturedCards={true}
      />,
    );

    expect(screen.getByTestId(`cache-featured-sbt-link-${featuredAddress.toLowerCase()}`)).toBeInTheDocument();
    expect(screen.getByText('Crypto Mode Group')).toBeInTheDocument();
    expect(screen.getByText(shortenedAddress)).toBeInTheDocument();

    cryptoModeSpy.mockRestore();
  });

  it('uses terminology-aware ended minting aria labels on cache-backed featured cards', () => {
    const featuredAddress = '0x00000000000000000000000000000000000000b0';
    peekCacheSync.mockReturnValue({
      84532: {
        sbtList: {
          [featuredAddress.toLowerCase()]: {
            sbtAddress: featuredAddress,
            sbtInfo: {
              sessionSlug: 'alpha',
              name: 'Ended Group',
              image: 'https://example.test/ended-group.png',
              mintingEndTime: 1,
            },
          },
        },
      },
    });

    render(
      <SBTsPage
        sbtCacheRevision={0}
        provider="wagmi"
        network={{ id: 84532, name: 'Base Sepolia' }}
        account=""
        loginComplete={false}
        toggleLoginModal={jest.fn()}
        isSBTCacheReady={false}
        defaultFeaturedSBTs={[featuredAddress]}
        sessionSlug="alpha"
        miniaturized={true}
        hideMiniActionRow={true}
        preferCacheBackedFeaturedCards={true}
      />,
    );

    expect(screen.getByLabelText(`${t('minting')} Ended`)).toBeInTheDocument();
  });

  it('uses terminology-aware fallback names for unnamed cache-backed featured cards', () => {
    const featuredAddress = '0x00000000000000000000000000000000000000af';
    peekCacheSync.mockReturnValue({
      84532: {
        sbtList: {
          [featuredAddress.toLowerCase()]: {
            sbtAddress: featuredAddress,
            sbtInfo: {
              sessionSlug: 'alpha',
              sessionName: '',
              name: '',
              title: '',
              symbol: '',
              contractName: '',
              image: 'https://example.test/unnamed-group.png',
            },
          },
        },
      },
    });

    render(
      <SBTsPage
        sbtCacheRevision={0}
        provider="wagmi"
        network={{ id: 84532, name: 'Base Sepolia' }}
        account=""
        loginComplete={false}
        toggleLoginModal={jest.fn()}
        isSBTCacheReady={false}
        defaultFeaturedSBTs={[featuredAddress]}
        sessionSlug="alpha"
        miniaturized={true}
        hideMiniActionRow={true}
        preferCacheBackedFeaturedCards={true}
      />,
    );

    expect(screen.getByTestId(`cache-featured-sbt-link-${featuredAddress.toLowerCase()}`)).toBeInTheDocument();
    expect(screen.getByText('Unnamed Group')).toBeInTheDocument();
  });

  it('recomputes cache-backed featured cards when scan progress advances even without a cache revision bump', () => {
    const featuredAddress = '0x00000000000000000000000000000000000000ae';
    let cacheSnapshot = {};
    peekCacheSync.mockImplementation(() => cacheSnapshot);
    const subject = createSubject({ sbtCacheRevision: 0 });
    const featuredEntries = [{ address: featuredAddress, sessionSlug: 'alpha' }];

    const coldStart = subject.getMemoizedFeaturedCacheCards({
      featuredEntries,
      isSBTCacheReady: false,
      progressBySlug: {},
    });

    expect(coldStart).toEqual([]);

    cacheSnapshot = {
      84532: {
        sbtList: {
          [featuredAddress.toLowerCase()]: {
            sbtAddress: featuredAddress,
            sbtInfo: {
              sessionSlug: 'alpha',
              name: 'Progressive Cache Group',
              description: 'Discovered mid-scan.',
              image: 'https://example.test/progressive-cache-group.png',
            },
          },
        },
      },
    };

    const warmDuringScan = subject.getMemoizedFeaturedCacheCards({
      featuredEntries,
      isSBTCacheReady: false,
      progressBySlug: {
        alpha: {
          currentBlock: 105,
          latestBlock: 112,
        },
      },
    });

    expect(warmDuringScan).toEqual([
      expect.objectContaining({
        address: featuredAddress,
        sessionSlug: 'alpha',
        sbt: expect.objectContaining({
          sbtInfo: expect.objectContaining({
            name: 'Progressive Cache Group',
          }),
        }),
      }),
    ]);
  });

  it('aggregates embedded featured cards across all listed sessions in list scope', () => {
    const contractScripts = jest.requireMock('../../utilities/web3/chainGateway.js');
    const alphaAddress = '0x00000000000000000000000000000000000000a1';
    const betaAddress = '0x00000000000000000000000000000000000000b2';

    window.history.replaceState({}, '', '/explorer');
    readSessionScanScope.mockReturnValue('list');
    readSessionScanSlugs.mockReturnValue(['alpha', 'beta']);
    contractScripts.getSessionConfigBySlug.mockImplementation((slug) => {
      const normalized = String(slug || '');
      if (normalized === 'alpha') {
        return { slug: 'alpha', featured_SBTs_LIST: [alphaAddress] };
      }
      if (normalized === 'beta') {
        return { slug: 'beta', featured_SBTs_LIST: [betaAddress] };
      }
      return null;
    });
    contractScripts.getSessionConfigBySlugOrDefault.mockReturnValue({ slug: '' });
    getSessionLists.mockReturnValue({ featured_SBTs_LIST: [], ignored_SBTs_LIST: [] });

    render(
      <SBTsPage
        sbtCacheRevision={0}
        provider="wagmi"
        network={{ id: 84532, name: 'Base Sepolia' }}
        account=""
        loginComplete={false}
        toggleLoginModal={jest.fn()}
        isSBTCacheReady={true}
        defaultFeaturedSBTs={[]}
        sessionSlug="alpha"
        sessionConfig={{ autoFeatureSBTsWithFeaturedSbtTags: false }}
      />,
    );

    const renderedCards = mockSBTPage.mock.calls.map(([props]) => ({
      address: props.SBTAddress,
      sessionSlug: props.sessionSlug,
    }));

    expect(renderedCards).toEqual([
      { address: alphaAddress, sessionSlug: 'alpha' },
      { address: betaAddress, sessionSlug: 'beta' },
    ]);
  });

  it('keeps mini embedded SBT views scoped to the active session even when explorer list scope is active', () => {
    const contractScripts = jest.requireMock('../../utilities/web3/chainGateway.js');
    const alphaAddress = '0x00000000000000000000000000000000000000c1';
    const betaAddress = '0x00000000000000000000000000000000000000d2';

    window.history.replaceState({}, '', '/explorer');
    readSessionScanScope.mockReturnValue('list');
    readSessionScanSlugs.mockReturnValue(['alpha', 'beta']);
    contractScripts.getSessionConfigBySlug.mockImplementation((slug) => {
      const normalized = String(slug || '');
      if (normalized === 'alpha') {
        return { slug: 'alpha', featured_SBTs_LIST: [alphaAddress] };
      }
      if (normalized === 'beta') {
        return { slug: 'beta', featured_SBTs_LIST: [betaAddress] };
      }
      return null;
    });
    contractScripts.getSessionConfigBySlugOrDefault.mockReturnValue({ slug: '' });
    getSessionLists.mockReturnValue({ featured_SBTs_LIST: [], ignored_SBTs_LIST: [] });

    render(
      <SBTsPage
        sbtCacheRevision={0}
        provider="wagmi"
        network={{ id: 84532, name: 'Base Sepolia' }}
        account=""
        loginComplete={false}
        toggleLoginModal={jest.fn()}
        isSBTCacheReady={true}
        defaultFeaturedSBTs={[]}
        sessionSlug="alpha"
        sessionConfig={{ autoFeatureSBTsBySessionSlug: false }}
        miniaturized={true}
      />,
    );

    const renderedCards = mockSBTPage.mock.calls.map(([props]) => ({
      address: props.SBTAddress,
      sessionSlug: props.sessionSlug,
    }));

    expect(renderedCards).toEqual([{ address: alphaAddress, sessionSlug: 'alpha' }]);
  });

  it('keeps discovered embedded cards visible and shows a corner spinner during background refreshes', () => {
    const visibleAddress = '0x00000000000000000000000000000000000000f1';
    const contractScripts = jest.requireMock('../../utilities/web3/chainGateway.js');
    contractScripts.getSessionConfigBySlug.mockImplementation((slug) => {
      const normalized = String(slug || '');
      if (normalized === 'alpha') return { slug: 'alpha' };
      if (normalized === '') return { slug: '' };
      return null;
    });
    contractScripts.getSessionConfigBySlugOrDefault.mockReturnValue({ slug: '' });

    render(
      <SBTsPage
        sbtCacheRevision={0}
        provider="wagmi"
        network={{ id: 84532, name: 'Base Sepolia' }}
        account=""
        loginComplete={false}
        toggleLoginModal={jest.fn()}
        isSBTCacheReady={false}
        defaultFeaturedSBTs={[visibleAddress]}
        sessionSlug="alpha"
        sessionConfig={{ autoFeatureSBTsWithFeaturedSbtTags: false }}
        sbtScanProgressBySlug={{
          alpha: {
            currentBlock: 101,
            latestBlock: 112,
          },
        }}
      />,
    );

    expect(screen.getByTestId('embedded-featured-spinner')).toBeInTheDocument();
    expect(screen.getAllByTestId('mock-sbt-page')).toHaveLength(1);
    expect(mockSBTPage.mock.calls[mockSBTPage.mock.calls.length - 1][0]).toEqual(
      expect.objectContaining({
        SBTAddress: visibleAddress,
        sessionSlug: 'alpha',
      }),
    );
  });
});
