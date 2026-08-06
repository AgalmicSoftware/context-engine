import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DocsPage } from './DocsPage';
import { buildDocsContractsHref, getContractViewerSourceTestId } from './contractMetadata.js';
import { buildContractViewerContracts } from './contractViewerUtils.js';
import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';

const mockGetSessionConfigBySlug = jest.fn();
const mockGetDemoSessionConfigBySlug = jest.fn();
const mockGetSessionConfigBySlugOrDefault = jest.fn();

jest.mock('../../utilities/web3/chainGateway.js', () => ({
  __esModule: true,
  getSessionConfigBySlug: (...args: any[]) => mockGetSessionConfigBySlug(...args),
  getDemoSessionConfigBySlug: (...args: any[]) => mockGetDemoSessionConfigBySlug(...args),
  getSessionConfigBySlugOrDefault: (...args: any[]) => mockGetSessionConfigBySlugOrDefault(...args),
  getChainLabelById: (chainId: unknown) =>
    Number(chainId) === 84532 ? 'Base Sepolia (84532)' : `Chain ${String(chainId)}`,
}));

jest.mock('./contractViewerUtils.js', () => ({
  buildContractViewerContracts: jest.fn(),
}));

const mockBuildContractViewerContracts = buildContractViewerContracts as jest.Mock;

describe('DocsPage contract deep links', () => {
  const originalPublicUrl = process.env.PUBLIC_URL;
  const sessionConfig = {
    slug: 'session-alpha',
    sessionName: 'Session Alpha',
    networkChainId: 84532,
    contracts: {
      surveys: {
        address: '0x1111111111111111111111111111111111111111',
        chainId: 84532,
      },
      sbtFactory: {
        address: '0x2222222222222222222222222222222222222222',
        chainId: 84532,
      },
    },
    sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED),
  };
  const generalSessionConfig = {
    slug: '',
    sessionName: 'Context Engine',
    networkChainId: 84532,
    contracts: {
      surveys: {
        address: '0x3333333333333333333333333333333333333333',
        chainId: 84532,
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    if (typeof originalPublicUrl === 'undefined') {
      delete process.env.PUBLIC_URL;
    } else {
      process.env.PUBLIC_URL = originalPublicUrl;
    }
    window.history.pushState({}, '', '/docs?contract=sessionRegistry');
    mockGetSessionConfigBySlug.mockImplementation((slug = '') => (slug === 'session-alpha' ? sessionConfig : null));
    mockGetDemoSessionConfigBySlug.mockReturnValue(null);
    mockGetSessionConfigBySlugOrDefault.mockReturnValue(generalSessionConfig);
    mockBuildContractViewerContracts.mockImplementation(
      ({
        sessionContracts = {},
        includeSessionRegistry = true,
        includeCustomSBT = true,
        chainId = 84532,
      }: any = {}) => {
        const entries = Object.keys(sessionContracts).map((contractKey) => ({
          key: contractKey,
          name:
            contractKey === 'surveys'
              ? 'Questions and Surveys'
              : contractKey === 'sbtFactory'
                ? 'SBT Factory'
                : contractKey,
          explainer: `Explainer for ${contractKey}`,
          sourceFile:
            contractKey === 'surveys'
              ? 'Surveys.sol'
              : contractKey === 'sbtFactory'
                ? 'SBTFactory.sol'
                : 'Contract.sol',
          source: `contract ${contractKey} {}`,
          addresses: [
            {
              address: sessionContracts[contractKey].address,
              id: sessionContracts[contractKey].chainId || chainId,
              testnet: true,
              explorerUrl: `https://example.com/${contractKey}`,
            },
          ],
        }));

        if (includeSessionRegistry) {
          entries.push({
            key: 'sessionRegistry',
            name: 'Session Registry',
            explainer: 'Explainer for sessionRegistry',
            sourceFile: 'SessionRegistry.sol',
            source: 'contract sessionRegistry {}',
            addresses: [
              {
                address: '0x4444444444444444444444444444444444444444',
                id: chainId,
                testnet: true,
                explorerUrl: 'https://example.com/sessionRegistry',
              },
            ],
          });
        }

        if (includeCustomSBT) {
          entries.push({
            key: 'customSBT',
            name: 'Custom SBT (Template)',
            explainer: 'Explainer for customSBT',
            sourceFile: 'CustomSBT.sol',
            source: 'contract customSBT {}',
            addresses: [],
          });
        }

        return entries;
      },
    );
  });

  it('renders the user guide, session context, and no longer exposes the bundle or converters', async () => {
    render(<DocsPage activeSessionSlug="session-alpha" reduxActiveSessionSlug="" />);

    expect(screen.getByTestId('ce-page-docs-root')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Docs' })).toBeInTheDocument();

    const quickstartToggle = screen.getByRole('button', { name: 'Quickstart' });
    expect(quickstartToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('heading', { name: 'Open a session' })).toBeInTheDocument();
    fireEvent.click(quickstartToggle);
    expect(quickstartToggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(quickstartToggle);
    expect(screen.getByRole('heading', { name: 'Open a session' })).toBeInTheDocument();

    expect(await screen.findByTestId('ce-docs-session-context')).toHaveTextContent(
      'Session: Session Alpha · Chain: Base Sepolia (84532)',
    );
    expect(screen.queryByRole('button', { name: /\.json bundle/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^utils$/i })).not.toBeInTheDocument();
  });

  it('opens the matching contract source and scrolls it into view when a contract query param is present', async () => {
    const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
    const scrollSpy = jest.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollSpy;

    try {
      render(<DocsPage activeSessionSlug="session-alpha" reduxActiveSessionSlug="" />);

      const contractsToggle = await screen.findByRole('button', { name: /smart contracts/i });
      expect(contractsToggle).toHaveAttribute('aria-expanded', 'true');
      expect(await screen.findByTestId(getContractViewerSourceTestId('sessionRegistry'))).toBeInTheDocument();
      expect(screen.getByTestId('ce-contract-view-source-sessionRegistry')).toHaveAttribute(
        'href',
        'https://github.com/AgalmicSoftware/context-engine/blob/main/contracts/SessionRegistry.sol',
      );
      expect(await screen.findByText('Groups list', { selector: 'button' })).toBeInTheDocument();
      await waitFor(() => {
        expect(scrollSpy).toHaveBeenCalled();
      });
    } finally {
      window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  it('keeps contract links and canonical URLs under PUBLIC_URL subpaths', async () => {
    process.env.PUBLIC_URL = '/ce/';
    window.history.pushState({}, '', '/ce/contracts?contract=surveys&sessionSlug=session-alpha#source');

    expect(
      buildDocsContractsHref({
        contractKey: 'surveys',
        sessionSlug: 'session-alpha',
      }),
    ).toBe('/ce/docs?contract=surveys&session=session-alpha');

    render(<DocsPage activeSessionSlug="session-alpha" reduxActiveSessionSlug="" />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/ce/docs');
      expect(window.location.search).toBe('?contract=surveys&session=session-alpha');
      expect(window.location.hash).toBe('#source');
    });
  });

  it('does not inject ambient session state into a contract-only legacy deep link', async () => {
    process.env.PUBLIC_URL = '/ce/';
    window.history.pushState({}, '', '/ce/contracts?contract=surveys#source');

    render(<DocsPage activeSessionSlug="session-alpha" reduxActiveSessionSlug="" />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/ce/docs');
      expect(window.location.search).toBe('?contract=surveys');
      expect(window.location.hash).toBe('#source');
    });
    expect(await screen.findByTestId(getContractViewerSourceTestId('surveys'))).toBeInTheDocument();
  });

  it('keeps a Worker session legacy chain and contracts out of the global Advanced viewer', async () => {
    const workerSessionConfig = {
      slug: 'demo-sh',
      sessionName: 'Worker Demo',
      networkChainId: 11155420,
      contracts: {
        sessionRegistry: {
          address: '0x5555555555555555555555555555555555555555',
          chainId: 11155420,
        },
      },
      sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
    };
    window.history.pushState({}, '', '/docs?session=demo-sh');
    mockGetSessionConfigBySlug.mockImplementation((slug = '') => (slug === 'demo-sh' ? workerSessionConfig : null));

    render(<DocsPage activeSessionSlug="demo-sh" reduxActiveSessionSlug="" />);

    expect(await screen.findByTestId('ce-contracts-advanced-external-notice')).toHaveTextContent(
      /Advanced\/external on-chain tools/i,
    );
    expect(screen.getByTestId('ce-contracts-advanced-external-notice')).toHaveTextContent(
      /not part of this session's Worker-native Groups or authority/i,
    );
    expect(mockBuildContractViewerContracts).toHaveBeenLastCalledWith({
      sessionContracts: {},
      chainId: undefined,
      includeSessionRegistry: false,
      includeCustomSBT: true,
    });
    expect(screen.queryByText('Session Registry')).not.toBeInTheDocument();
    expect(screen.getByText('Custom SBT (Template)')).toBeInTheDocument();
  });

  it('redirects the legacy contracts route to docs without losing its deep link', async () => {
    window.history.pushState({}, '', '/contracts?contract=surveys&session=session-alpha#source');

    render(<DocsPage activeSessionSlug="session-alpha" reduxActiveSessionSlug="" />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/docs');
      expect(window.location.search).toBe('?contract=surveys&session=session-alpha');
      expect(window.location.hash).toBe('#source');
    });
  });
});
