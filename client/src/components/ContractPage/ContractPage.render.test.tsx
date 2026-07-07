import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { ContractPage } from './ContractPage';
import { buildContractsPageHref, getContractViewerSourceTestId } from './contractMetadata.js';
import { buildContractViewerContracts } from './contractViewerUtils.js';

const mockGetSessionConfigBySlug = jest.fn();
const mockGetDemoSessionConfigBySlug = jest.fn();
const mockGetSessionConfigBySlugOrDefault = jest.fn();

jest.mock('../../utilities/web3/chainGateway.js', () => ({
  __esModule: true,
  default: {
    hexToBase64url: jest.fn(() => ''),
    base64urlToHex: jest.fn(() => ''),
    base64urlToBase64: jest.fn(() => ''),
  },
  getSessionConfigBySlug: (...args: any[]) => mockGetSessionConfigBySlug(...args),
  getDemoSessionConfigBySlug: (...args: any[]) => mockGetDemoSessionConfigBySlug(...args),
  getSessionConfigBySlugOrDefault: (...args: any[]) => mockGetSessionConfigBySlugOrDefault(...args),
}));

jest.mock('./contractViewerUtils.js', () => ({
  buildContractViewerContracts: jest.fn(),
}));

const mockBuildContractViewerContracts = buildContractViewerContracts as jest.Mock;

describe('ContractPage contract deep links', () => {
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
    window.history.pushState({}, '', '/contracts?contract=sessionRegistry');
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

  it('opens the matching contract source and scrolls it into view when a contract query param is present', async () => {
    const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
    const scrollSpy = jest.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollSpy;

    try {
      render(<ContractPage activeSessionSlug="session-alpha" reduxActiveSessionSlug="" />);

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
      buildContractsPageHref({
        contractKey: 'surveys',
        sessionSlug: 'session-alpha',
      }),
    ).toBe('/ce/contracts?contract=surveys&session=session-alpha');

    render(<ContractPage activeSessionSlug="session-alpha" reduxActiveSessionSlug="" />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/ce/contracts');
      expect(window.location.search).toBe('?contract=surveys&session=session-alpha');
      expect(window.location.hash).toBe('#source');
    });
  });
});
