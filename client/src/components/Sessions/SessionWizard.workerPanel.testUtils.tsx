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
} from '../DocsPage/contractMetadata.js';
import { buildContractViewerContracts } from '../DocsPage/contractViewerUtils.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import {
  clearSessionWizardPendingSbtDraftsCache,
  readSessionWizardPendingSbtDraftsCache,
} from './hooks/usePendingSbtDrafts.js';

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
const mockTestAdminAddress = '0x00000000000000000000000000000000000000aa';
const TEST_ADMIN_ADDRESS = mockTestAdminAddress;
const ORIGINAL_PUBLIC_URL = process.env.PUBLIC_URL;
const ORIGINAL_FETCH = global.fetch;
const mockSelectorSourceFactory = '0x538A48BC439A36D2A86e63114DCD9c429d2ddEcA';
const mockSelectorSourceStartBlock = 30297069;
const buildMockSponsoredBundleEnvelope = () =>
  JSON.stringify({
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
        onClick={() =>
          props.onAddSBT?.({
            address: mockReplacementSbtAddress,
            name: 'Replacement SBT',
          })
        }
      >
        {`Mock add ${props.id || 'selector'} SBT`}
      </button>
      {selectedEntries.map((entry) => {
        const address = typeof entry === 'string' ? entry : entry?.address || entry?.sbtAddress || '';
        if (!address) return null;
        return (
          <button key={address} type="button" onClick={() => props.onRemoveSBT?.(address)}>
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
jest.mock('../DocsPage/contractViewerUtils.js', () => ({
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

jest.mock('../../utilities/arweave/arweaveClient.js', () => ({
  arweaveClient: {
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
    normalizeSlug: jest.fn((value = '') =>
      String(value || '')
        .trim()
        .toLowerCase(),
    ),
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

jest.mock('../../utilities/web3/chainGateway.js', () => ({
  __esModule: true,
  default: {
    createSBT: (...args) => mockCreateSBT(...args),
    getSbtMetadata: jest.fn(async () => ({})),
  },
  getSessionConfigBySlugOrDefault: jest.fn((slug = '') => {
    const normalized = String(slug || '')
      .trim()
      .toLowerCase();
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
    const normalized = String(slug || '')
      .trim()
      .toLowerCase();
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
    address: mockTestAdminAddress,
    message: 'bootstrap-siwe-message',
    signature: '0xbootstrap-admin-auth',
    sessionSlug: slug,
  })),
  buildSignedAdminActionAuth: jest.fn(async ({ action, slug, body }) => ({
    address: mockTestAdminAddress,
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
  __test__resetSessionWizardSponsoredBundleCacheKey,
  buildPublishedPendingSbtLinks,
  getSessionWizardPublishProgressPercent,
  REQUIRED_SESSION_SLUG_ERROR,
  RESERVED_SESSION_SLUG_ERROR,
  deploySessionWizardPendingSbtDraft,
  finalizeSessionWizardPendingSbtDraft,
  persistSessionWizardSbtRecoveryCodes,
  promotePendingSbtSelectionsAfterDeploy,
  resolveSessionWizardSelectorSourceConfig,
  resolveSessionWizardWorkerBaseUrl,
} from './SessionWizard';
import { resolveSessionWizardChipotleHookConfig } from './sessionWizardWorkerSecretSupport';

const renderSessionWizard = (props = {}) => render(<SessionWizard network={{ id: 84532 }} {...props} />);
const createTooltipStore = (tooltipsEnabled = true) =>
  createStore((state = { sessionState: { tooltipsEnabled } }, action) => {
    if (action.type === 'SET_TOOLTIPS') {
      return {
        sessionState: {
          tooltipsEnabled: action.payload,
        },
      };
    }
    return state;
  });
const renderSessionWizardWithTooltipStore = ({ tooltipsEnabled = true, props = {} } = {}) => {
  const store = createTooltipStore(tooltipsEnabled);
  const view = render(
    <Provider store={store}>
      <SessionWizard network={{ id: 84532 }} {...props} />
    </Provider>,
  );
  return { store, ...view };
};
const renderLoggedInSessionWizard = (props = {}) =>
  renderSessionWizard({
    account: TEST_ADMIN_ADDRESS,
    loginComplete: true,
    toggleLoginModal: jest.fn(),
    ...props,
  });
const rerenderSessionWizard = (
  view: ReturnType<typeof render>,
  props: Omit<React.ComponentProps<typeof SessionWizard>, 'network'> = {},
) => view.rerender(<SessionWizard network={{ id: 84532 }} {...props} />);
const getWizardResourceCard = (resourceKey) =>
  screen
    .getAllByTestId(E2E_TESTIDS.WIZARD_RESOURCE_CARD)
    .find((card) => card.getAttribute('data-ce-resource-key') === resourceKey);
const SETUP_SECTION_KEYS = ['context', 'questions', 'participation', 'results', 'access', 'hosting', 'ai'];
// Every setup section but Basics starts closed behind its More button.
const openSetupSection = (key: string) => {
  const toggle = screen.queryByTestId(`ce-setup-more-${key}`);
  if (!toggle || toggle.getAttribute('aria-expanded') === 'true') return;
  fireEvent.click(toggle);
};
// The one-page layout has no advanced mode; its settings sit behind each section's More.
const enableAdvancedMode = () => SETUP_SECTION_KEYS.forEach(openSetupSection);
// The old step cards map to sections: Details is Basics (always open), Access or
// Privacy is Access, Worker is Hosting; Deploy and Publish are the Create section.
const selectNormalModeCard = (label: string) => {
  const name = String(label).toLowerCase();
  if (/access|privacy/.test(name)) openSetupSection('access');
  if (/worker/.test(name)) openSetupSection('hosting');
};
const PUBLIC_RESULTS_VISIBILITY = 'public_full_if_storage_public';
// New drafts start Worker-hosted. This takes the on-chain registry path that the
// old default (trustless) preset took; publicResults also restores that preset's
// public results and whole-session export.
const selectRegistryHosting = ({ publicResults = false } = {}) => {
  openSetupSection('hosting');
  fireEvent.change(screen.getByTestId('ce-setup-authority'), { target: { value: 'evm_registry_canonical' } });
  if (!publicResults) return;
  openSetupSection('results');
  fireEvent.change(screen.getByTestId('ce-setup-results-visibility'), {
    target: { value: PUBLIC_RESULTS_VISIBILITY },
  });
  const exportScope = document.getElementById('ce-setup-export');
  if (!exportScope) throw new Error('Export scope select not found.');
  fireEvent.change(exportScope, { target: { value: 'all_session' } });
};
const setCloudflareApiToken = (value: string) => {
  const input = screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_API_TOKEN);
  fireEvent.change(input, { target: { value } });
  return input;
};
const createPublicWorkerVerificationResponder = () => {
  type PublicWorkerVerificationConfig = {
    ai?: {
      models?: unknown;
    };
    litCredentials?: unknown;
    [key: string]: unknown;
  };
  let publicConfig: PublicWorkerVerificationConfig = {};
  return (url: unknown, options: RequestInit = {}) => {
    const normalizedUrl = String(url);
    if (normalizedUrl.endsWith('/admin/set-config')) {
      const payload = JSON.parse(String(options.body || '{}'));
      publicConfig = payload.config || publicConfig;
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    }
    if (normalizedUrl.includes('/session-config')) {
      const { litCredentials: _privateLitDescriptor, ...verifiedConfig } = publicConfig;
      if (verifiedConfig.ai) verifiedConfig.ai = { models: verifiedConfig.ai.models };
      return { ok: true, status: 200, json: async () => ({ config: verifiedConfig }) };
    }
    return null;
  };
};
const installVerifiedWorkerDeploymentFetch = (workerUrl = 'https://worker.example.test') => {
  const respondToPublicWorkerVerification = createPublicWorkerVerificationResponder();
  const fetchMock = jest.fn(async (url, options = {}) => {
    const normalizedUrl = String(url);
    if (normalizedUrl.endsWith('/deploy')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          workerUrl,
          writesSessionConfig: true,
          writesSessionSecrets: false,
        }),
      };
    }
    if (normalizedUrl.endsWith('/auth/nonce')) {
      return { ok: true, status: 200, json: async () => ({ nonce: 'wizard-admin-nonce' }) };
    }
    const publicVerificationResponse = respondToPublicWorkerVerification(normalizedUrl, options);
    if (publicVerificationResponse) return publicVerificationResponse;
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  });
  Object.defineProperty(global, 'fetch', {
    configurable: true,
    writable: true,
    value: fetchMock,
  });
  return fetchMock;
};
const deployVerifiedWorkerForCurrentDraft = async ({
  workerUrl = 'https://worker.example.test',
  openaiKey = 'sk-render-test',
  arweaveJwk = '{"kty":"RSA","n":"render-test"}',
} = {}) => {
  const fetchMock = installVerifiedWorkerDeploymentFetch(workerUrl);
  // Resource cards other than AI sit under Hosting's More; the token and AI key stay visible.
  openSetupSection('hosting');
  setCloudflareApiToken('cf-render-test-token');
  fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY), {
    target: { value: openaiKey },
  });
  const arweaveInput = screen.queryByTestId(E2E_TESTIDS.WIZARD_SECRET_ARWEAVE_JWK);
  if (arweaveInput) fireEvent.change(arweaveInput, { target: { value: arweaveJwk } });
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_WORKER));
  await waitFor(
    () => {
      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_STATUS)).toHaveTextContent('Worker deployed.');
    },
    { timeout: 8000 },
  );
  return fetchMock;
};
const getMockSelectorById = (selectorId) =>
  screen
    .queryAllByTestId('mock-wizard-sbt-selector')
    .find((node) => node.getAttribute('data-selector-id') === selectorId);
const expectSelectorAddresses = async (selectorId, expectedAddresses) => {
  await waitFor(() => {
    const selector = getMockSelectorById(selectorId);
    expect(selector).toBeTruthy();
    expect(selector).toHaveAttribute('data-selected-addresses', expectedAddresses.join(','));
  });
};
// On-chain SBT defaults (tags, featured SBTs) render under Access's More, below the gates.
const openAdvancedMoreOptions = async () => {
  openSetupSection('access');
};
const getFeaturedCreateButton = async (): Promise<HTMLElement> =>
  await waitFor(() => {
    const button = screen
      .getAllByTestId(E2E_TESTIDS.WIZARD_CREATE_SBT)
      .find((node) => node.getAttribute('data-ce-sbt-target') === 'defaultFeaturedSBTs');
    if (!button) throw new Error('Featured SBT create button not found.');
    return button;
  });
// The gates panel's Create button; on-chain sessions also show one beside featured SBTs.
const getGateCreateSbtButton = () => {
  const gatesPanel = document.getElementById('session-wizard-section-encryption');
  if (!gatesPanel) throw new Error('Access gates panel not found.');
  return within(gatesPanel).getByTestId(E2E_TESTIDS.WIZARD_CREATE_SBT);
};
const ensureGateASelectorVisible = async () => {
  openSetupSection('access');
  await waitFor(() => {
    expect(getMockSelectorById('encryption-gate-gate-1')).toBeTruthy();
  });
};
const createPendingFeaturedDraft = async () => {
  await openAdvancedMoreOptions();
  fireEvent.click(await getFeaturedCreateButton());
  fireEvent.click(await screen.findByRole('button', { name: 'Save pending SBT' }));
  await waitFor(() => {
    expect(screen.queryByTestId('mock-create-sbt-group')).not.toBeInTheDocument();
    expect(readSessionWizardPendingSbtDraftsCache()).toEqual([
      expect.objectContaining({ predictedAddress: mockPendingSbtAddress }),
    ]);
    expect(sessionStorage.getItem('ce:sessionWizardPendingSbtDrafts:v1')).toBeNull();
  });
};

const resetSessionWizardWorkerPanelTestState = () => {
  jest.clearAllMocks();
  clearSessionWizardPendingSbtDraftsCache();
  __test__resetSessionWizardSponsoredBundleCacheKey();
  if (!ethers.providers.JsonRpcProvider.prototype.getBlockNumber._isMockFunction) {
    jest.spyOn(ethers.providers.JsonRpcProvider.prototype, 'getBlockNumber');
  }
  ethers.providers.JsonRpcProvider.prototype.getBlockNumber.mockResolvedValue(mockSelectorSourceStartBlock);
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
  global.fetch = ORIGINAL_FETCH;
  localStorage.clear();
  sessionStorage.clear();
  jest.mocked(buildContractViewerContracts).mockImplementation(({ sessionContracts = {} } = {}) => {
    const normalizedSessionContracts = sessionContracts || {};
    return Object.keys(normalizedSessionContracts).map((contractKey) => ({
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
      addresses: normalizedSessionContracts[contractKey]?.address
        ? [
            {
              address: normalizedSessionContracts[contractKey].address,
              id: Number(normalizedSessionContracts[contractKey].chainId) || 84532,
              testnet: true,
              explorerUrl: `https://example.example.test/${contractKey}`,
            },
          ]
        : [],
    }));
  });
};

export {
  fs,
  React,
  ethers,
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
  Provider,
  createStore,
  E2E_TESTIDS,
  getContractViewerCardTestId,
  getContractViewerSourceTestId,
  getSessionWizardContractModalTriggerTestId,
  getSessionWizardContractTooltipTestId,
  WIZARD_CONTRACT_MODAL_TESTID,
  buildContractViewerContracts,
  buildSbtDetailPath,
  mockRegisterSessionOnChain,
  mockFetchSessionFromRegistry,
  mockUpsertSessionRegistryCache,
  mockSessionExists,
  mockCreateSBT,
  mockFinalizeDeferredCreateSbtDraftUpload,
  mockDownloadDataFromArweave,
  mockDecryptWithPassword,
  mockPendingSbtAddress,
  mockSecondPendingSbtAddress,
  mockReplacementSbtAddress,
  TEST_ADMIN_ADDRESS,
  ORIGINAL_PUBLIC_URL,
  mockSelectorSourceFactory,
  mockSelectorSourceStartBlock,
  buildMockSponsoredBundleEnvelope,
  buildMockSponsoredBundle,
  buildMockPendingSbtDraft,
  mockCreateSbtDraftQueue,
  SessionWizard,
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
  renderSessionWizard,
  createTooltipStore,
  renderSessionWizardWithTooltipStore,
  renderLoggedInSessionWizard,
  rerenderSessionWizard,
  getWizardResourceCard,
  openSetupSection,
  enableAdvancedMode,
  selectNormalModeCard,
  selectRegistryHosting,
  setCloudflareApiToken,
  createPublicWorkerVerificationResponder,
  installVerifiedWorkerDeploymentFetch,
  deployVerifiedWorkerForCurrentDraft,
  getMockSelectorById,
  expectSelectorAddresses,
  openAdvancedMoreOptions,
  getFeaturedCreateButton,
  getGateCreateSbtButton,
  ensureGateASelectorVisible,
  createPendingFeaturedDraft,
  resetSessionWizardWorkerPanelTestState,
};
