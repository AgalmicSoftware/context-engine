/* eslint-disable import/first */
import fs from 'fs';
import React from 'react';
import { ethers } from 'ethers';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import {
  getContractViewerCardTestId,
  getContractViewerSourceTestId,
  getSessionWizardContractModalTriggerTestId,
  getSessionWizardContractTooltipTestId,
  WIZARD_CONTRACT_MODAL_TESTID,
} from '../ContractPage/contractMetadata.js';
import { buildContractViewerContracts } from '../ContractPage/contractViewerUtils.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';

const mockRegisterSessionOnChain = jest.fn();
const mockFetchSessionFromRegistry = jest.fn();
const mockUpsertSessionRegistryCache = jest.fn();
const mockSessionExists = jest.fn(async () => false);
const mockCreateSBT = jest.fn();
const mockFinalizeDeferredCreateSbtDraftUpload = jest.fn();
const mockDownloadDataFromArweave = jest.fn();
const mockDecryptWithPassword = jest.fn();
const mockPendingSbtAddress = ethers.utils.getAddress('0x5fbdb2315678afecb367f032d93f642f64180aa3');
const mockSecondPendingSbtAddress = ethers.utils.getAddress('0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512');
const mockReplacementSbtAddress = ethers.utils.getAddress('0x8ba1f109551bd432803012645ac136ddd64dba72');
const TEST_ADMIN_ADDRESS = '0x00000000000000000000000000000000000000aa';
const NEW_SESSION_BANNER_DISMISSED_KEY = 'ce_new_session_banner_dismissed';
const ORIGINAL_PUBLIC_URL = process.env.PUBLIC_URL;
const mockSelectorSourceFactory = '0x538A48BC439A36D2A86e63114DCD9c429d2ddEcA';
const mockSelectorSourceStartBlock = 30297069;
const buildMockSponsoredBundleEnvelope = () => JSON.stringify({
  type: 'contextengine-sponsored-bundle',
  version: 1,
  cipher: 'password-aes-gcm',
  encryptedData: 'encrypted-base64',
});
const buildMockSponsoredBundle = () => ({
  openaiKey: 'sponsored-openai',
  arweaveJwk: '{"kty":"RSA","n":"sponsored"}',
  litAccountApiKey: 'sponsored-lit-account-key',
  faucetGrantToken: 'sponsored-faucet-grant',
  deployGrantToken: 'sponsored-deploy-grant',
  meta: {
    label: 'Launch Week',
    createdAt: '2099-03-20T12:00:00.000Z',
    createdBy: '0xadmin',
    expiresAt: '2099-03-21T12:00:00.000Z',
    sourceSessionSlug: 'source-session',
    sourceWorkerUrl: 'https://source-worker.example.test',
  },
});
const buildMockPendingSbtDraft = ({
  predictedAddress = mockPendingSbtAddress,
  displayName = 'Pending SBT',
  contractName = displayName,
  symbol = 'CE-SBT-PEND',
  create2Salt = 'test/pending',
  tokenURI = 'ar://pending',
  metadataPreview = {},
  authoringPayload = { sbtName: displayName, _sessionSlug: 'general' },
  passwordList = ['claim-code-1'],
  groupPassword = 'shared-secret',
  usesInviteCodes = false,
  deployed = false,
} = {}) => ({
  id: `pending-${predictedAddress.toLowerCase()}`,
  predictedAddress,
  displayName,
  contractName,
  symbol,
  create2Salt,
  limitedNumber: 0,
  adminAddress: '0xCreator',
  mintingEndTimeUnix: 0,
  hasPasswordMintOnChain: false,
  burnAuthEnum: 0,
  hashedPasswords: [],
  tokenURI,
  metadataUploadStatus: 'ready',
  finalGroupPasswordHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
  createOptions: { useConfiguredDeterministic: true, initializeGroupPasswordHash: false },
  metadataPreview,
  authoringPayload,
  passwordList,
  groupPassword,
  usesInviteCodes,
  deployed,
});
let mockCreateSbtDraftQueue = [];

jest.mock('../SBTs/SBTSelector', () => (props) => {
  const selectedEntries = Array.isArray(props.selectedSBTs) ? props.selectedSBTs : [];
  return (
    <div
      data-testid="mock-wizard-sbt-selector"
      data-selector-id={props.id || ''}
      data-session-slug={props.sessionSlug || ''}
      data-session-config-slug={props.sessionConfig?.slug || ''}
      data-session-config-start={props.sessionConfig?.blockLimits?.start ?? ''}
      data-session-config-factory={props.sessionConfig?.contracts?.sbtFactory?.address || ''}
      data-chain-id={props.chainId ?? ''}
      data-selected-addresses={selectedEntries
        .map((entry) => (typeof entry === 'string' ? entry : entry?.address || entry?.sbtAddress || ''))
        .filter(Boolean)
        .join(',')}
    >
      <button
        type="button"
        onClick={() => props.onAddSBT?.({
          address: mockReplacementSbtAddress,
          name: 'Replacement SBT',
        })}
      >
        {`Mock add ${props.id || 'selector'} SBT`}
      </button>
      {selectedEntries.map((entry) => {
        const address = typeof entry === 'string' ? entry : entry?.address || entry?.sbtAddress || '';
        if (!address) return null;
        return (
          <button
            key={address}
            type="button"
            onClick={() => props.onRemoveSBT?.(address)}
          >
            {`Mock remove ${address} from ${props.id || 'selector'}`}
          </button>
        );
      })}
    </div>
  );
});
jest.mock('../SBTs/CreateSBTGroup', () => ({
  __esModule: true,
  default: (props) => (
    <div
      data-testid="mock-create-sbt-group"
      data-session-slug={props.sessionSlug || ''}
      data-session-config-slug={props.sessionConfigOverride?.slug || ''}
      data-arweave-jwk={props.arweaveJwkOverride || ''}
    >
      <button
        type="button"
        onClick={() => {
          const nextDraft = mockCreateSbtDraftQueue.length
            ? mockCreateSbtDraftQueue.shift()
            : buildMockPendingSbtDraft();
          props.onSaveDraft?.(JSON.parse(JSON.stringify(nextDraft)));
        }}
      >
        Save pending SBT
      </button>
    </div>
  ),
  finalizeDeferredCreateSbtDraftUpload: (...args) => mockFinalizeDeferredCreateSbtDraftUpload(...args),
}));
jest.mock('../Gates/GateMultiSelectLock', () => () => <div data-testid="mock-wizard-gate-lock" />);
jest.mock('../Shared/Json/JsonControls', () => ({
  JsonToggleButton: () => null,
  JsonPanel: () => null,
  JsonButtonRow: () => null,
}));
jest.mock('../ContractPage/contractViewerUtils.js', () => ({
  buildContractViewerContracts: jest.fn(),
}));

jest.mock('../../utilities/crypto/litProtocol.js', () => ({
  buildSbtAccessControlConditions: jest.fn(() => []),
  createLitHooks: jest.fn(() => ({ saveKey: jest.fn(), getKey: jest.fn(), litNetwork: 'chipotle' })),
  resolveLitChain: jest.fn(() => 'baseSepolia'),
  getGlobalLitHooks: jest.fn(() => null),
  setGlobalLitHooks: jest.fn(),
}));

jest.mock('../../utilities/crypto/cryptography.js', () => ({
  cryptoUtils: {
    _getProvider: jest.fn(() => ({})),
    decryptWithPassword: (...args) => mockDecryptWithPassword(...args),
  },
}));

jest.mock('../../utilities/arweave/arweaveScripts.js', () => ({
  arweaveScripts: {
    uploadDataToArweave: jest.fn(),
    downloadDataFromArweave: (...args) => mockDownloadDataFromArweave(...args),
    buildArweaveGatewayUrl: jest.fn((txId) => `https://arweave.example.test/${txId}`),
  },
}));

jest.mock('../../utilities/session/resourceKeys.js', () => ({
  getEffectiveArweaveKey: jest.fn(() => ''),
}));

jest.mock('../../utilities/web3/sessionRegistry.js', () => ({
  registerSessionOnChain: (...args) => mockRegisterSessionOnChain(...args),
  sessionRegistryUtils: {
    normalizeSlug: jest.fn((value = '') => String(value || '').trim().toLowerCase()),
    formatSessionId: jest.fn((value = '') => String(value || '').trim()),
    normalizeSessionIdHex: jest.fn((value = '') => String(value || '').trim()),
    toRegistrySlug: jest.fn((value = '') => String(value || '').trim()),
    getRegistryContract: jest.fn(() => ({
      sessionExists: (...args) => mockSessionExists(...args),
    })),
    fetchSessionFromRegistry: (...args) => mockFetchSessionFromRegistry(...args),
    upsertSessionRegistryCache: (...args) => mockUpsertSessionRegistryCache(...args),
  },
}));

jest.mock('../../utilities/web3/contractScripts.js', () => ({
  __esModule: true,
  default: {
    createSBT: (...args) => mockCreateSBT(...args),
    getSbtMetadata: jest.fn(async () => ({})),
  },
  getSessionConfigBySlugOrDefault: jest.fn((slug = '') => {
    const normalized = String(slug || '').trim().toLowerCase();
    if (normalized && normalized !== 'general') return null;
    return {
      slug: '',
      sessionName: 'Context Engine',
      networkChainId: 84532,
      contracts: {
        sbtFactory: {
          address: mockSelectorSourceFactory,
          chainId: 84532,
        },
      },
      blockLimits: {
        start: mockSelectorSourceStartBlock,
        end: null,
      },
    };
  }),
  getDemoSessionConfigBySlug: jest.fn((slug = '') => {
    const normalized = String(slug || '').trim().toLowerCase();
    if (normalized && normalized !== 'general') return null;
    return {
      slug: '',
      sessionName: 'Context Engine',
      networkChainId: 84532,
      contracts: {
        sbtFactory: {
          address: mockSelectorSourceFactory,
          chainId: 84532,
        },
      },
      blockLimits: {
        start: mockSelectorSourceStartBlock,
        end: null,
      },
    };
  }),
}));

jest.mock('../../utilities/worker/workerAuth.js', () => ({
  buildSiweMessage: jest.fn(() => 'siwe-message'),
  buildSignedBootstrapAdminAuth: jest.fn(async ({ slug }) => ({
    address: TEST_ADMIN_ADDRESS,
    message: 'bootstrap-siwe-message',
    signature: '0xbootstrap-admin-auth',
    sessionSlug: slug,
  })),
  buildSignedAdminActionAuth: jest.fn(async ({ action, slug, body }) => ({
    address: TEST_ADMIN_ADDRESS,
    signature: '0xadmin-action-signature',
    action,
    slug,
    bodyHash: '0xadmin-body-hash',
    nonce: 'wizard-admin-nonce',
    audience: 'http://localhost',
    expiration: 4102444800,
    __body: body,
  })),
  normalizeWorkerUrl: jest.fn((value = '') => String(value || '').trim()),
}));

jest.mock('../../utilities/web3/rpcReadCache.js', () => ({
  wrapEthersJsonRpcSend: jest.fn((provider) => provider),
}));

jest.mock('../../variables/appConfig.js', () => {
  const actual = jest.requireActual('../../variables/appConfig.js');
  return { ...actual };
});

import SessionWizard, {
  buildPublishedPendingSbtLinks,
  getSessionWizardPublishProgressPercent,
  REQUIRED_SESSION_SLUG_ERROR,
  RESERVED_SESSION_SLUG_ERROR,
  deploySessionWizardPendingSbtDraft,
  finalizeSessionWizardPendingSbtDraft,
  persistSessionWizardSbtRecoveryCodes,
  promotePendingSbtSelectionsAfterDeploy,
  resolveSessionWizardChipotleHookConfig,
  resolveSessionWizardSelectorSourceConfig,
  resolveSessionWizardWorkerBaseUrl,
  screen,
  selectNormalModeCard,
  createPublicWorkerVerificationResponder,
  enableAdvancedMode,
  waitFor,
} from './SessionWizard.workerPanel.testUtils';

describe('SessionWizard worker panel rendering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateSbtDraftQueue = [];
    mockCreateSBT.mockReset();
    mockFinalizeDeferredCreateSbtDraftUpload.mockReset();
    mockDownloadDataFromArweave.mockReset();
    mockDecryptWithPassword.mockReset();
    mockDownloadDataFromArweave.mockResolvedValue(buildMockSponsoredBundleEnvelope());
    mockDecryptWithPassword.mockResolvedValue(buildMockSponsoredBundle());
    if (typeof ORIGINAL_PUBLIC_URL === 'undefined') {
      delete process.env.PUBLIC_URL;
    } else {
      process.env.PUBLIC_URL = ORIGINAL_PUBLIC_URL;
    }
    window.history.replaceState({}, '', '/');
    localStorage.clear();
    sessionStorage.clear();
    buildContractViewerContracts.mockImplementation(({ sessionContracts = {} } = {}) => (
      Object.keys(sessionContracts).map((contractKey) => ({
        key: contractKey,
        name:
          contractKey === 'surveys'
            ? 'Questions and Surveys'
            : contractKey === 'sbtFactory'
              ? 'SBT Factory'
              : contractKey === 'sessionRegistry'
                ? 'Session Registry'
                : contractKey,
        explainer: `Explainer for ${contractKey}`,
        sourceFile:
          contractKey === 'surveys'
            ? 'Surveys.sol'
            : contractKey === 'sbtFactory'
              ? 'SBTFactory.sol'
              : contractKey === 'sessionRegistry'
                ? 'SessionRegistry.sol'
                : 'Contract.sol',
        source: `contract ${contractKey} {}`,
        addresses: sessionContracts[contractKey]?.address
          ? [{
              address: sessionContracts[contractKey].address,
              id: sessionContracts[contractKey].chainId || 84532,
              testnet: true,
              explorerUrl: `https://example.example.test/${contractKey}`,
            }]
          : [],
      }))
    ));
  });
  it('keeps the normal-mode worker step focused on bring-your-own worker setup while defaulting to the release bundle URL', async () => {
    const { WORKER_BUNDLE_URL } = require('../../variables/publicDeploymentConfig.js');

    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    selectNormalModeCard('Worker');

    expect(await screen.findByText('Bring your own worker')).toBeInTheDocument();
    expect(await screen.findByText('Cloudflare API token')).toBeInTheDocument();
    expect(screen.queryByText('Upload bundle file')).not.toBeInTheDocument();
    expect(screen.queryByText('Using Default Worker')).not.toBeInTheDocument();
    expect(screen.queryByText('Use My Own')).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        'Most sessions can stay on the shared default worker. Only switch to your own worker if you want to manage the infrastructure yourself.',
      ),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('How should this session run?')).not.toBeInTheDocument();
    expect(screen.queryByText('Shared hosted worker')).not.toBeInTheDocument();
    expect(screen.queryByText('Worker secrets')).not.toBeInTheDocument();
    expect(screen.queryByText('Dev: keep secrets on refresh')).not.toBeInTheDocument();
    expect(screen.queryByText('Require users to pay for usage')).not.toBeInTheDocument();
    expect(screen.queryByText('Resource gates (on-chain)')).not.toBeInTheDocument();
    expect(screen.queryByText('Worker code (unbundled, copy + paste)')).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_WORKER_URL)).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_BUNDLE_FILE_INPUT)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reset to default' })).not.toBeInTheDocument();
    expect(screen.getByText('Worker URL appears here after a successful custom worker deploy.')).toBeInTheDocument();
    expect(screen.queryByText('Deploy-helper URL')).not.toBeInTheDocument();
    expect(screen.getByText('Worker bundle URL (release asset)')).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_URL)).toHaveValue(WORKER_BUNDLE_URL);
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_URL)).toHaveAttribute('readonly');
    expect(
      screen.getByText(
        'Guided deploys use the GitHub-hosted worker bundle automatically. If a retry needs a different source, keep this Git URL as the default and add a manual bundle URL or upload below after a fetch failure.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Worker name')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Passing a Cloudflare API token to a deploy-helper requires trust.'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Worker code (unbundled, copy + paste)')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reset to default' })).not.toBeInTheDocument();
  });

  it('shows the Worker URL return field before a native Cloudflare deploy is verified', async () => {
    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    const preset = screen.getByTestId('ce-new-preset-fast_cheap_cloudflare');
    const originalConfirm = window.confirm;
    window.confirm = jest.fn(() => true);
    try {
      fireEvent.click(preset);
    } finally {
      window.confirm = originalConfirm;
    }
    await waitFor(() => {
      expect(preset).toHaveAttribute('aria-checked', 'true');
    });

    selectNormalModeCard('Worker');

    expect(await screen.findByTestId(E2E_TESTIDS.WIZARD_WORKER_URL)).toBeInTheDocument();
    expect(
      screen.queryByText('Worker URL appears here after a successful custom worker deploy.'),
    ).not.toBeInTheDocument();
  });

  it('defaults advanced custom-worker deploys to the configured release bundle URL', async () => {
    const { WORKER_BUNDLE_URL } = require('../../variables/publicDeploymentConfig.js');

    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    enableAdvancedMode();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_PANEL_TOGGLE));
    fireEvent.click(await screen.findByRole('button', { name: 'Use My Own' }));

    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_MODE_URL)).toBeChecked();
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_MODE_UPLOAD)).not.toBeChecked();
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_URL)).toHaveValue(WORKER_BUNDLE_URL);
  });

  it('builds Chipotle worker config for global Lit hooks when Lit v3 worker secrets are present', () => {
    const workerAuth = require('../../utilities/worker/workerAuth.js');
    const originalNormalizeWorkerUrl = workerAuth.normalizeWorkerUrl.getMockImplementation();
    workerAuth.normalizeWorkerUrl.mockImplementation((value = '') =>
      String(value || '')
        .trim()
        .replace(/\/+$/, ''),
    );
    try {
      expect(
        resolveSessionWizardChipotleHookConfig({
          workerSecretsEnabled: true,
          resolvedWorkerUrl: 'https://chipotle-worker.example.test/',
          draft: {
            slug: 'chipotle-hook-session',
            sessionName: 'Chipotle Hook Session',
          },
          workerSecrets: {
            litApiBase: 'https://api.chipotle.litprotocol.com',
            litGroupId: '21',
            litPkpId: '0xaeb338631a7cb716c7ac2effd22b7b69ebcd137b',
            litActionCid: 'QmYyLDMz1AQYo3mPeHbBLTyfae8fhK5muXyqPhnAedJbr4',
          },
        }),
      ).toEqual(
        expect.objectContaining({
          enabled: true,
          workerUrl: 'https://chipotle-worker.example.test',
          litCredentials: {
            litApiBase: 'https://api.chipotle.litprotocol.com',
            litActionCid: 'QmYyLDMz1AQYo3mPeHbBLTyfae8fhK5muXyqPhnAedJbr4',
            litGroupId: '21',
            litPkpId: '0xaeb338631a7cb716c7ac2effd22b7b69ebcd137b',
          },
          sessionConfig: {
            slug: 'chipotle-hook-session',
            sessionName: 'Chipotle Hook Session',
            corsWorkerUrl: 'https://chipotle-worker.example.test',
            litCredentials: {
              litApiBase: 'https://api.chipotle.litprotocol.com',
              litActionCid: 'QmYyLDMz1AQYo3mPeHbBLTyfae8fhK5muXyqPhnAedJbr4',
              litGroupId: '21',
              litPkpId: '0xaeb338631a7cb716c7ac2effd22b7b69ebcd137b',
            },
          },
        }),
      );

      expect(
        resolveSessionWizardChipotleHookConfig({
          workerSecretsEnabled: true,
          resolvedWorkerUrl: 'https://chipotle-worker.example.test',
          workerSecrets: {
            litApiBase: 'https://api.chipotle.litprotocol.com',
          },
          draft: {
            slug: 'chipotle-hook-session',
          },
        }),
      ).toBeNull();
    } finally {
      workerAuth.normalizeWorkerUrl.mockImplementation(originalNormalizeWorkerUrl);
    }
  });

  it('restores the configured release bundle URL after returning from advanced mode to normal mode', async () => {
    const originalFetch = global.fetch;
    const { WORKER_BUNDLE_URL } = require('../../variables/publicDeploymentConfig.js');
    const workerAuth = require('../../utilities/worker/workerAuth.js');
    const originalNormalizeWorkerUrl = workerAuth.normalizeWorkerUrl.getMockImplementation();
    workerAuth.normalizeWorkerUrl.mockImplementation((value = '') => String(value || '').trim());
    const respondToPublicWorkerVerification = createPublicWorkerVerificationResponder();
    global.fetch = jest.fn(async (url, options = {}) => {
      const normalizedUrl = String(url);
      if (normalizedUrl.endsWith('/deploy')) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            workerUrl: 'https://deployed.example.test',
            writesSessionConfig: true,
            writesSessionSecrets: false,
          }),
        };
      }
      if (normalizedUrl.endsWith('/auth/nonce')) {
        return { ok: true, json: async () => ({ nonce: 'wizard-admin-nonce' }) };
      }
      const publicVerificationResponse = respondToPublicWorkerVerification(normalizedUrl, options);
      if (publicVerificationResponse) return publicVerificationResponse;
      return { ok: true, json: async () => ({ ok: true }) };
    });

    try {
      renderLoggedInSessionWizard();

      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), {
        target: { value: 'Normal Mode Bundle Reset' },
      });

      enableAdvancedMode();
      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_PANEL_TOGGLE));
      fireEvent.click(await screen.findByRole('button', { name: 'Use My Own' }));

      const advancedBundleUrlInput = screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_URL);
      fireEvent.change(advancedBundleUrlInput, {
        target: { value: 'https://bundles.example.test/custom-sessionCorsWorker.bundle.js' },
      });
      await waitFor(() => {
        expect(advancedBundleUrlInput).toHaveValue('https://bundles.example.test/custom-sessionCorsWorker.bundle.js');
      });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_MODE_ADVANCED));
      selectNormalModeCard('Worker');

      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_URL)).toHaveValue(WORKER_BUNDLE_URL);
      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_URL)).toHaveAttribute('readonly');

      const cloudflareTokenInput = screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_API_TOKEN);
      const reactPropsKey = Object.keys(cloudflareTokenInput).find((key) => key.startsWith('__reactProps$'));
      act(() => {
        cloudflareTokenInput[reactPropsKey].onChange({ target: { value: 'cf-test-token' } });
      });
      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY), {
        target: { value: 'sk-normal-mode-reset' },
      });
      fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SECRET_ARWEAVE_JWK), {
        target: { value: '{"kty":"RSA","n":"normal-reset"}' },
      });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_WORKER));

      await waitFor(() => {
        expect(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_STATUS)).toHaveTextContent('Worker deployed.');
      });
      const deployCall = global.fetch.mock.calls.find(([url]) => String(url).endsWith('/deploy'));
      const deployPayload = JSON.parse(deployCall[1].body);
      expect(deployPayload.bundleUrl).toBe(WORKER_BUNDLE_URL);
      expect(deployPayload.bundleUrl).not.toBe('https://bundles.example.test/custom-sessionCorsWorker.bundle.js');
    } finally {
      global.fetch = originalFetch;
      workerAuth.normalizeWorkerUrl.mockImplementation(originalNormalizeWorkerUrl);
    }
  });

  it('clears an advanced-mode bundle file before normal-mode hosted-bundle retry UI is needed', async () => {
    const originalFetch = global.fetch;
    const { WORKER_BUNDLE_URL } = require('../../variables/publicDeploymentConfig.js');
    const workerAuth = require('../../utilities/worker/workerAuth.js');
    const originalNormalizeWorkerUrl = workerAuth.normalizeWorkerUrl.getMockImplementation();
    const advancedBundleFile = {
      name: 'advanced-sessionCorsWorker.bundle.js',
      type: 'text/javascript',
      text: async () => 'export default { async fetch() { return new Response("advanced-mode"); } };',
    };
    const deployPayloads = [];

    workerAuth.normalizeWorkerUrl.mockImplementation((value = '') => String(value || '').trim());
    global.fetch = jest.fn(async (url, options = {}) => {
      const normalizedUrl = String(url);
      if (normalizedUrl.endsWith('/deploy')) {
        const payload = JSON.parse(options.body);
        deployPayloads.push(payload);
        expect(payload.bundleUrl).toBe(WORKER_BUNDLE_URL);
        expect(payload.bundleText).toBeUndefined();
        return {
          ok: false,
          status: 502,
          json: async () => ({ error: 'Failed to fetch bundle (404).' }),
        };
      }
      if (normalizedUrl.endsWith('/auth/nonce')) {
        return { ok: true, json: async () => ({ nonce: 'wizard-admin-nonce' }) };
      }
      return { ok: true, json: async () => ({ ok: true }) };
    });

    try {
      renderLoggedInSessionWizard();

      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), {
        target: { value: 'Normal Mode Advanced File Reset' },
      });

      enableAdvancedMode();
      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_PANEL_TOGGLE));
      fireEvent.click(await screen.findByRole('button', { name: 'Use My Own' }));
      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_MODE_UPLOAD));
      fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_FILE_INPUT), {
        target: { files: [advancedBundleFile] },
      });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_MODE_NORMAL));
      selectNormalModeCard('Worker');

      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_URL)).toHaveValue(WORKER_BUNDLE_URL);
      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_URL)).toHaveAttribute('readonly');
      expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_BUNDLE_URL_OVERRIDE)).not.toBeInTheDocument();
      expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_BUNDLE_FILE_INPUT)).not.toBeInTheDocument();
      expect(screen.queryByText('Using advanced-sessionCorsWorker.bundle.js for this deploy.')).not.toBeInTheDocument();

      const cloudflareTokenInput = screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_API_TOKEN);
      const reactPropsKey = Object.keys(cloudflareTokenInput).find((key) => key.startsWith('__reactProps$'));
      act(() => {
        cloudflareTokenInput[reactPropsKey].onChange({ target: { value: 'cf-test-token' } });
      });
      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY), {
        target: { value: 'sk-normal-mode-advanced-file-reset' },
      });
      fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SECRET_ARWEAVE_JWK), {
        target: { value: '{"kty":"RSA","n":"normal-advanced-file-reset"}' },
      });

      fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_WORKER));

      await waitFor(() => {
        expect(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_STATUS)).toHaveTextContent('Failed to fetch bundle (404).');
      });

      expect(deployPayloads).toHaveLength(1);
      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_URL_OVERRIDE)).toBeInTheDocument();
      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_FILE_INPUT)).toBeInTheDocument();
      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_CLEAR_BUNDLE_FILE_DEPLOY)).toBeDisabled();
      expect(screen.queryByText('Using advanced-sessionCorsWorker.bundle.js for this deploy.')).not.toBeInTheDocument();
    } finally {
      global.fetch = originalFetch;
      workerAuth.normalizeWorkerUrl.mockImplementation(originalNormalizeWorkerUrl);
    }
  });

  it('keeps the embedded deploy-helper toggle out of Step 1 in normal /new mode', async () => {
    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);

    expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_EMBEDDED_DEPLOY_HELPER_ENABLED)).not.toBeInTheDocument();
    expect(screen.queryByText('Enable embedded deploy-helper on this worker')).not.toBeInTheDocument();
  });

  it('shows the embedded deploy-helper toggle in the normal-mode worker step and lets the user disable it', async () => {
    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    selectNormalModeCard('Worker');

    const embeddedToggle = await screen.findByTestId(E2E_TESTIDS.WIZARD_EMBEDDED_DEPLOY_HELPER_ENABLED);
    expect(embeddedToggle).toBeChecked();

    fireEvent.click(embeddedToggle);
    expect(embeddedToggle).not.toBeChecked();
  });
});
