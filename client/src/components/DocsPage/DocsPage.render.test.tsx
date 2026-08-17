import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import { DocsPage } from './DocsPage';
import { buildDocsContractsHref, getContractViewerSourceTestId } from './contractMetadata.js';
import { buildContractViewerContracts } from './contractViewerUtils.js';
import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';

const mockGetSessionConfigBySlug = jest.fn();
const mockGetDemoSessionConfigBySlug = jest.fn();
const mockGetSessionConfigBySlugOrDefault = jest.fn();
const mockGetAllSessionSlugs = jest.fn();

jest.mock('../../utilities/web3/chainGateway.js', () => ({
  __esModule: true,
  getSessionConfigBySlug: (...args: any[]) => mockGetSessionConfigBySlug(...args),
  getDemoSessionConfigBySlug: (...args: any[]) => mockGetDemoSessionConfigBySlug(...args),
  getSessionConfigBySlugOrDefault: (...args: any[]) => mockGetSessionConfigBySlugOrDefault(...args),
  getAllSessionSlugs: (...args: any[]) => mockGetAllSessionSlugs(...args),
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
    sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED),
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
    mockGetAllSessionSlugs.mockReturnValue(['', 'session-alpha']);
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
    expect(screen.queryByText('Source & architecture')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View Context Engine repository on GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/AgalmicSoftware/context-engine',
    );
    expect(screen.getByTestId('ce-docs-github-link')).toBe(
      screen.getByRole('link', { name: 'View Context Engine repository on GitHub' }),
    );
    expect(screen.queryByRole('link', { name: 'View Context Engine architecture on GitHub' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', {
        name: 'View the Context Engine contributing guide on GitHub',
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'View the Context Engine whitepaper on GitHub' }),
    ).not.toBeInTheDocument();

    const quickstartToggle = screen.getByRole('button', { name: 'Quickstart' });
    expect(quickstartToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('heading', { name: 'Open or create a session' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open /session/general' })).toHaveAttribute('href', '/session/general');
    expect(screen.getByRole('link', { name: 'Create a session' })).toHaveAttribute('href', '/session/new');
    fireEvent.click(quickstartToggle);
    expect(quickstartToggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(quickstartToggle);
    expect(screen.getByRole('heading', { name: 'Open or create a session' })).toBeInTheDocument();
    expect(screen.getByText('<slug>')).toHaveProperty('tagName', 'CODE');

    const guideToggle = screen.getByRole('button', { name: 'Session options guide' });
    fireEvent.click(guideToggle);
    expect(screen.getByText('networkChainId')).toHaveProperty('tagName', 'CODE');
    expect(screen.getByText('questionResponses')).toHaveProperty('tagName', 'CODE');

    const promptsToggle = screen.getByRole('button', { name: 'Prompts' });
    const faqToggle = screen.getByRole('button', { name: 'FAQ' });
    const sessionContractsGroup = screen.getByTestId('ce-docs-session-contracts-group');
    const contractSessionSelector = screen.getByRole('combobox', { name: 'Session' });
    expect(contractSessionSelector).toHaveValue('');
    expect(screen.getByText('Choose a session to view its contract deployment details.')).toBeInTheDocument();
    expect(screen.queryByTestId('ce-docs-session-context')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /smart contracts/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Advanced\/external on-chain tools/i)).not.toBeInTheDocument();
    expect(Boolean(promptsToggle.compareDocumentPosition(faqToggle) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(Boolean(faqToggle.compareDocumentPosition(sessionContractsGroup) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(
      true,
    );
    expect(sessionContractsGroup).toContainElement(contractSessionSelector);

    fireEvent.change(contractSessionSelector, { target: { value: 'session-alpha' } });
    const sessionContext = await screen.findByTestId('ce-docs-session-context');
    const contractsToggle = screen.getByRole('button', { name: /smart contracts/i });
    expect(sessionContext).toHaveTextContent('Session: Session Alpha · Chain: Base Sepolia (84532)');
    expect(Boolean(sessionContext.compareDocumentPosition(contractsToggle) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(
      true,
    );
    expect(sessionContractsGroup).toContainElement(sessionContext);
    expect(sessionContractsGroup).toContainElement(contractsToggle);
    expect(screen.queryByRole('button', { name: /\.json bundle/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^utils$/i })).not.toBeInTheDocument();
  });

  it('uses an extra-bold weight for Session Options topic titles', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'DocsPage.module.scss'), 'utf8');

    expect(scss).toMatch(/\.guideTopic\s+h2\s*\{[^}]*font-weight:\s*800;/);
  });

  it('renders the repository link as a single icon-only control', () => {
    render(<DocsPage activeSessionSlug="session-alpha" reduxActiveSessionSlug="" />);

    const projectLinks = screen.getByRole('navigation', { name: 'Project links on GitHub' });
    const repositoryLink = within(projectLinks).getByRole('link', {
      name: 'View Context Engine repository on GitHub',
    });

    expect(within(projectLinks).getAllByRole('link')).toEqual([repositoryLink]);
    expect(repositoryLink).not.toHaveAttribute('data-expanded');
    expect(within(projectLinks).queryByText('Repository')).not.toBeInTheDocument();
  });

  it('opens the matching contract source and scrolls it into view when a contract query param is present', async () => {
    const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
    const scrollSpy = jest.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollSpy;

    try {
      render(<DocsPage activeSessionSlug="session-alpha" reduxActiveSessionSlug="" />);

      fireEvent.change(screen.getByRole('combobox', { name: 'Session' }), {
        target: { value: 'session-alpha' },
      });
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
    expect(screen.getByRole('combobox', { name: 'Session' })).toHaveValue('');
    expect(screen.queryByTestId('ce-docs-session-context')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /smart contracts/i })).not.toBeInTheDocument();
  });

  it('keeps an unresolved explicit query session instead of borrowing ambient contract authority', () => {
    window.history.pushState({}, '', '/docs?session=missing-session&contract=surveys');

    render(<DocsPage activeSessionSlug="session-alpha" reduxActiveSessionSlug="" />);

    expect(screen.getByRole('combobox', { name: 'Session' })).toHaveValue('missing-session');
    expect(screen.getByText('Session details are unavailable for this selection.')).toBeInTheDocument();
    expect(screen.queryByTestId('ce-docs-session-context')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /smart contracts/i })).not.toBeInTheDocument();
    expect(window.location.search).toBe('?session=missing-session&contract=surveys');
  });

  it('keeps an explicit General session selected after URL synchronization and rerenders', async () => {
    window.history.pushState({}, '', '/docs?session=general&contract=surveys#source');

    const { rerender } = render(<DocsPage activeSessionSlug="session-alpha" reduxActiveSessionSlug="" />);

    await waitFor(() => {
      expect(window.location.search).toBe('?session=general&contract=surveys');
      expect(screen.getByRole('combobox', { name: 'Session' })).toHaveValue('__general__');
      expect(screen.getByTestId('ce-docs-session-context')).toHaveTextContent('Session: Context Engine');
    });

    rerender(<DocsPage activeSessionSlug="session-alpha" reduxActiveSessionSlug="session-alpha" />);

    await waitFor(() => {
      expect(window.location.search).toBe('?session=general&contract=surveys');
      expect(screen.getByRole('combobox', { name: 'Session' })).toHaveValue('__general__');
      expect(screen.getByTestId('ce-docs-session-context')).toHaveTextContent('Session: Context Engine');
    });
    expect(mockBuildContractViewerContracts).toHaveBeenLastCalledWith({
      sessionContracts: generalSessionConfig.contracts,
      chainId: 84532,
      includeSessionRegistry: true,
      includeCustomSBT: false,
    });
  });

  it('keeps an unresolved explicit path session instead of borrowing ambient contract authority', () => {
    window.history.pushState({}, '', '/docs/missing-path-session');

    render(<DocsPage activeSessionSlug="session-alpha" reduxActiveSessionSlug="" />);

    expect(screen.getByRole('combobox', { name: 'Session' })).toHaveValue('missing-path-session');
    expect(screen.getByText('Session details are unavailable for this selection.')).toBeInTheDocument();
    expect(screen.queryByTestId('ce-docs-session-context')).not.toBeInTheDocument();
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

    expect(screen.getByRole('combobox', { name: 'Session' })).toHaveValue('demo-sh');
    expect(screen.queryByText(/Advanced\/external on-chain tools/i)).not.toBeInTheDocument();
    expect(await screen.findByTestId('ce-docs-session-context')).toHaveTextContent('Session: Worker Demo');
    expect(screen.getByText('No contract addresses are published for this session.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /smart contracts/i })).not.toBeInTheDocument();
    expect(mockBuildContractViewerContracts).toHaveBeenLastCalledWith({
      sessionContracts: {},
      chainId: undefined,
      includeSessionRegistry: false,
      includeCustomSBT: false,
    });
    expect(screen.queryByText('Session Registry')).not.toBeInTheDocument();
    expect(screen.queryByText('Custom SBT (Template)')).not.toBeInTheDocument();
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
