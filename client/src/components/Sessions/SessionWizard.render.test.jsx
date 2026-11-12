// Remaining broad SessionWizard render coverage owns section visibility, setup sections, slug validation, tooltips, and login guards.
import fs from 'fs';
import React from 'react';
import { ethers } from 'ethers';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';
import { buildContractViewerContracts } from '../DocsPage/contractViewerUtils.js';
import { SESSION_SLUG_AVAILABILITY_DEBOUNCE_MS } from './hooks/useSessionSlugState.js';
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

import SessionWizard, { REQUIRED_SESSION_SLUG_ERROR, RESERVED_SESSION_SLUG_ERROR } from './SessionWizard';

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
const SETUP_SECTION_KEYS = ['context', 'questions', 'participation', 'results', 'access', 'hosting', 'ai'];
// Every setup section but Basics starts closed behind its More button.
const openSetupSection = (key) => {
  const toggle = screen.queryByTestId(`ce-setup-more-${key}`);
  if (!toggle || toggle.getAttribute('aria-expanded') === 'true') return;
  fireEvent.click(toggle);
};
const enableAdvancedMode = () => SETUP_SECTION_KEYS.forEach(openSetupSection);
// Old step cards: Access or Privacy is the Access section, Worker is Hosting.
const selectNormalModeCard = (label) => {
  const name = String(label).toLowerCase();
  if (/access|privacy/.test(name)) openSetupSection('access');
  if (/worker/.test(name)) openSetupSection('hosting');
};
// New drafts start Worker-hosted; this takes the on-chain registry path the old
// default (trustless) preset took.
const selectRegistryHosting = () => {
  openSetupSection('hosting');
  fireEvent.click(screen.getByRole('radio', { name: 'Decentralized' }));
};
const setCloudflareApiToken = (value) => {
  fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_CLOUDFLARE_API_TOKEN), { target: { value } });
};
const deployVerifiedWorkerForCurrentDraft = async () => {
  let publicConfig = {};
  global.fetch = jest.fn(async (url, options = {}) => {
    const normalizedUrl = String(url);
    if (normalizedUrl.endsWith('/deploy')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          workerUrl: 'https://worker.example.test',
          writesSessionConfig: true,
          writesSessionSecrets: false,
        }),
      };
    }
    if (normalizedUrl.endsWith('/auth/nonce')) {
      return { ok: true, status: 200, json: async () => ({ nonce: 'wizard-admin-nonce' }) };
    }
    if (normalizedUrl.endsWith('/admin/set-config')) {
      publicConfig = JSON.parse(String(options.body || '{}')).config || publicConfig;
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    }
    if (normalizedUrl.includes('/session-config')) {
      const { litCredentials: _privateLitDescriptor, ...verifiedConfig } = publicConfig;
      if (verifiedConfig.ai) verifiedConfig.ai = { models: verifiedConfig.ai.models };
      return { ok: true, status: 200, json: async () => ({ config: verifiedConfig }) };
    }
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  });

  // The token and AI key stay visible; the Arweave key card sits under Hosting's More.
  openSetupSection('hosting');
  setCloudflareApiToken('cf-render-test-token');
  fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY), {
    target: { value: 'sk-render-test' },
  });
  fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SECRET_ARWEAVE_JWK), {
    target: { value: '{"kty":"RSA","n":"render-test"}' },
  });
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_WORKER));
  await waitFor(
    () => {
      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_DEPLOY_STATUS)).toHaveTextContent('Worker deployed.');
    },
    { timeout: 8000 },
  );
};
const getMockSelectorById = (selectorId) =>
  screen
    .queryAllByTestId('mock-wizard-sbt-selector')
    .find((node) => node.getAttribute('data-selector-id') === selectorId);
// On-chain SBT defaults (tags, featured SBTs) render under Access's More, below the gates.
const openAdvancedMoreOptions = async () => {
  openSetupSection('access');
};
const getFeaturedCreateButton = async () =>
  await waitFor(() => {
    const button = screen
      .getAllByTestId(E2E_TESTIDS.WIZARD_CREATE_SBT)
      .find((node) => node.getAttribute('data-ce-sbt-target') === 'defaultFeaturedSBTs');
    expect(button).toBeTruthy();
    return button;
  });
const getGateCreateButton = () => {
  const button = screen
    .getAllByTestId(E2E_TESTIDS.WIZARD_CREATE_SBT)
    .find((node) => node.getAttribute('data-ce-sbt-target') !== 'defaultFeaturedSBTs');
  if (!button) throw new Error('Gate create-SBT button not found.');
  return button;
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
  });
  expect(readSessionWizardPendingSbtDraftsCache()).toEqual([
    expect.objectContaining({ predictedAddress: mockPendingSbtAddress }),
  ]);
  await ensureGateASelectorVisible();
  await waitFor(() => {
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_PENDING_SBT)).toHaveAttribute(
      'data-ce-sbt-address',
      mockPendingSbtAddress.toLowerCase(),
    );
    expect(sessionStorage.getItem('ce:sessionWizardPendingSbtDrafts:v1')).toBeNull();
  });
};

describe('SessionWizard rendered validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearSessionWizardPendingSbtDraftsCache();
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
    buildContractViewerContracts.mockImplementation(({ sessionContracts = {} } = {}) =>
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
          ? [
              {
                address: sessionContracts[contractKey].address,
                id: sessionContracts[contractKey].chainId || 84532,
                testnet: true,
                explorerUrl: `https://example.example.test/${contractKey}`,
              },
            ]
          : [],
      })),
    );
  });

  it('shows Basics open and keeps every other section closed until its More is opened', async () => {
    renderSessionWizard({
      account: TEST_ADMIN_ADDRESS,
      toggleLoginModal: jest.fn(),
    });

    const sessionNameInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    expect(screen.queryByText('Private')).not.toBeInTheDocument();
    expect(sessionNameInput).toBeInTheDocument();
    expect(screen.queryByText('view .json')).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_SLUG)).not.toBeInTheDocument();
    SETUP_SECTION_KEYS.forEach((key) => {
      expect(screen.getByTestId(`ce-setup-more-${key}`)).toHaveAttribute('aria-expanded', 'false');
    });
    expect(screen.queryByTestId('ce-setup-encryption')).not.toBeInTheDocument();

    selectNormalModeCard('Privacy');

    expect(await screen.findByTestId('ce-setup-encryption')).toBeInTheDocument();
    expect(screen.getByTestId('ce-setup-more-access')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME)).toBeInTheDocument();
  });

  it('prefers the configured default registry chain on a fresh wizard with no wallet network', async () => {
    renderSessionWizard({ network: null });

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    selectRegistryHosting();

    const defaultChainId = require('../../variables/appConfig.js').DEFAULT_CHAIN_ID;
    expect(document.getElementById('ce-setup-chain')).toHaveValue(String(defaultChainId));
  });

  it('defaults auto-feature session groups to enabled for fresh /new drafts', async () => {
    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    selectRegistryHosting();
    await openAdvancedMoreOptions();

    expect(screen.getByRole('checkbox', { name: /Auto-feature Session/i })).toBeChecked();
  });

  it('defaults auto-feature session groups to enabled for sponsored /new drafts', async () => {
    renderSessionWizard({
      initialSponsoredBundleId: 'sponsor_tx_id',
    });

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    selectRegistryHosting();
    await openAdvancedMoreOptions();

    expect(screen.getByRole('checkbox', { name: /Auto-feature Session/i })).toBeChecked();
  });

  it('keeps the Telegram-only session checkbox hidden in public session setup', async () => {
    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);

    expect(screen.queryByRole('checkbox', { name: /telegram-only session/i })).not.toBeInTheDocument();
  });

  it('uses noopener noreferrer on every blank-target anchor in the source', () => {
    const sourceFiles = [
      './SessionWizard',
      './SessionPublishResultLinks',
      './SessionWizardModals',
      './setup/SetupWorkerQuick',
    ];
    const anchors = sourceFiles.flatMap((ref) => {
      const source = fs.readFileSync(require.resolve(ref), 'utf8');
      return source.match(/<a[\s\S]*?<\/a>/g) || [];
    });
    const blankTargetAnchors = anchors.filter((anchor) => anchor.includes('target="_blank"'));

    expect(blankTargetAnchors.length).toBeGreaterThan(0);
    blankTargetAnchors.forEach((anchor) => {
      expect(anchor).toContain('rel="noopener noreferrer"');
    });
  });

  it('seeds default SBT tags for new on-chain session drafts', async () => {
    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    selectRegistryHosting();
    await openAdvancedMoreOptions();

    expect(
      within(screen.getByTestId('ce-setup-section-access')).getByDisplayValue(
        'group, event, idea, demographic, location',
      ),
    ).toBeInTheDocument();
  });

  it('labels only protected setup fields with an access badge', async () => {
    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    selectRegistryHosting();
    enableAdvancedMode();

    const badges = Array.from(document.querySelectorAll('.lockBadge'), (badge) => badge.textContent);
    // Fields without an access rule show no badge (the slug's private-URL badge left with the slug field).
    expect(badges).toEqual([]);
  });

  it('keeps group creation policy and interview settings under Participation and colors under Basics’ Appearance', async () => {
    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    const participationMore = screen.getByTestId('ce-setup-more-participation');
    expect(participationMore).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_GROUP_CREATION_POLICY)).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_INTERVIEW_REALTIME_MODEL)).not.toBeInTheDocument();
    const basics = screen.getByTestId('ce-setup-section-basics');
    expect(within(basics).queryByTestId(E2E_TESTIDS.WIZARD_SESSION_COLOR_SCHEME)).not.toBeInTheDocument();
    fireEvent.click(within(basics).getByRole('button', { name: 'Appearance' }));
    expect(within(basics).getByTestId(E2E_TESTIDS.WIZARD_SESSION_COLOR_SCHEME)).toHaveValue('context-engine');

    fireEvent.click(participationMore);

    expect(participationMore).toHaveAttribute('aria-expanded', 'true');
    const participation = screen.getByTestId('ce-setup-section-participation');
    const policy = within(participation).getByTestId(E2E_TESTIDS.WIZARD_GROUP_CREATION_POLICY);
    expect(policy).toHaveAccessibleName('Who can create groups');
    expect(policy).toHaveValue('participants');
    expect(screen.queryByRole('textbox', { name: 'Who can create groups' })).not.toBeInTheDocument();
    const interviewToggle = within(participation).getByTestId('ce-setup-interviews');
    expect(interviewToggle).toBeChecked();
    const realtimeModel = within(participation).getByTestId(E2E_TESTIDS.WIZARD_INTERVIEW_REALTIME_MODEL);
    expect(realtimeModel).toHaveValue('gpt-live-1');
    fireEvent.change(realtimeModel, { target: { value: 'gpt-realtime-2' } });
    expect(realtimeModel).toHaveValue('gpt-realtime-2');
    fireEvent.click(interviewToggle);
    expect(within(participation).queryByTestId(E2E_TESTIDS.WIZARD_INTERVIEW_REALTIME_MODEL)).not.toBeInTheDocument();
    expect(policy).toBeInTheDocument();
    // Results analysis lives in its own section, apart from the interview settings.
    expect(within(participation).queryByText('Results analysis')).not.toBeInTheDocument();
    openSetupSection('results');
    expect(within(screen.getByTestId('ce-setup-section-results')).getByText('Results analysis')).toBeInTheDocument();
    fireEvent.click(interviewToggle);
    expect(within(participation).getByTestId(E2E_TESTIDS.WIZARD_INTERVIEW_REALTIME_MODEL)).toHaveValue(
      'gpt-realtime-2',
    );

    fireEvent.change(policy, { target: { value: 'admin_only' } });
    expect(policy).toHaveValue('admin_only');
  });

  it('keeps session details open after filling both fields in normal mode', async () => {
    renderSessionWizard();

    const sessionNameInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    const sessionInfoInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_INFO);

    jest.useFakeTimers();

    try {
      fireEvent.change(sessionNameInput, {
        target: { value: 'Edge Cases & Signals' },
      });
      fireEvent.change(sessionInfoInput, {
        target: { value: 'A short description for the session.' },
      });

      act(() => {
        jest.advanceTimersByTime(2000);
      });

      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME)).toBeInTheDocument();
      expect(screen.queryByText('Privacy & Access')).not.toBeInTheDocument();
      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_INFO)).toBeInTheDocument();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('switches the gate add affordance from ghost card to full-width rail after adding a second gate', async () => {
    renderSessionWizard();
    selectRegistryHosting();
    selectNormalModeCard('Privacy');

    const addGateButton = await screen.findByTestId(E2E_TESTIDS.WIZARD_ADD_GATE);
    expect(addGateButton).toHaveAttribute('data-ce-gate-add-kind', 'ghost');

    fireEvent.click(addGateButton);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Access Rule B')).toBeInTheDocument();
      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_ADD_GATE)).toHaveAttribute('data-ce-gate-add-kind', 'rail');
    });
  });

  it('auto-generates the slug from the session name', async () => {
    renderSessionWizard();

    const sessionNameInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);

    fireEvent.change(sessionNameInput, {
      target: { value: 'Edge Cases & Signals' },
    });

    await waitFor(() => {
      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_SLUG)).toHaveTextContent(
        `${window.location.origin}/session/edge-cases--signals`,
      );
    });
  });

  it('pins the slug after a pending SBT draft is queued', async () => {
    renderLoggedInSessionWizard();
    selectRegistryHosting();

    const sessionNameInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    fireEvent.change(sessionNameInput, {
      target: { value: 'Queued Session' },
    });

    selectNormalModeCard('Privacy');
    fireEvent.click(getGateCreateButton());
    fireEvent.click(await screen.findByRole('button', { name: 'Save pending SBT' }));

    expect(await screen.findByTestId(E2E_TESTIDS.WIZARD_PENDING_SBT)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_SLUG)).toHaveTextContent(/\/session\/queued-session$/);
    });

    fireEvent.change(sessionNameInput, {
      target: { value: 'Queued Session Updated' },
    });

    await waitFor(() => {
      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_SLUG)).toHaveTextContent(/\/session\/queued-session$/);
    });
  });

  it('renders non-worker session wizard tooltips through the same explainer toggle path', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.useFakeTimers();
    try {
      const { store } = renderSessionWizardWithTooltipStore();
      selectRegistryHosting();
      selectNormalModeCard('Privacy');

      const encryptionTooltipTrigger = await screen.findByTestId('ce-wizard-tooltip-gw-encryption-visibility');
      fireEvent.mouseOver(encryptionTooltipTrigger);
      expect(await screen.findByText(/control who can decrypt locked fields/i)).toBeInTheDocument();
      fireEvent.mouseOut(encryptionTooltipTrigger);

      act(() => {
        store.dispatch({ type: 'SET_TOOLTIPS', payload: false });
      });

      await waitFor(() => {
        expect(screen.queryByTestId('ce-wizard-tooltip-gw-encryption-visibility')).not.toBeInTheDocument();
      });

      act(() => {
        store.dispatch({ type: 'SET_TOOLTIPS', payload: true });
      });

      expect(await screen.findByTestId('ce-wizard-tooltip-gw-encryption-visibility')).toBeInTheDocument();
    } finally {
      act(() => {
        jest.runOnlyPendingTimers();
      });
      jest.useRealTimers();
      consoleErrorSpy.mockRestore();
    }
  });

  it('blocks publish with a required-slug status message when the slug is blank', async () => {
    renderLoggedInSessionWizard();

    // A name without letters or digits leaves the derived slug blank.
    fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), {
      target: { value: '!!!' },
    });
    expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_SLUG)).not.toBeInTheDocument();
    setCloudflareApiToken('cf-render-test-token');
    fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY), {
      target: { value: 'sk-render-test' },
    });
    const publishButton = screen.getByTestId(E2E_TESTIDS.WIZARD_PUBLISH);
    await waitFor(() => {
      expect(publishButton).not.toBeDisabled();
    });

    fireEvent.click(publishButton);

    expect(await screen.findByText(REQUIRED_SESSION_SLUG_ERROR, {}, { timeout: 8000 })).toBeInTheDocument();
    expect(mockRegisterSessionOnChain).not.toHaveBeenCalled();
  });

  it('keeps the pure Worker /new profile off registry and block-RPC ports', async () => {
    const blockNumberSpy = jest
      .spyOn(ethers.providers.JsonRpcProvider.prototype, 'getBlockNumber')
      .mockResolvedValue(mockSelectorSourceStartBlock);
    try {
      window.history.replaceState({}, '', '/new');
      renderSessionWizard();

      fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME), {
        target: { value: 'Worker Port Check' },
      });
      expect(await screen.findByTestId(E2E_TESTIDS.WIZARD_SLUG)).toHaveTextContent('/session/worker-port-check');
      enableAdvancedMode();
      expect(screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_ENDS_AT)).toBeInTheDocument();
      expect(screen.getByLabelText('Group tags')).toBeInTheDocument();
      expect(screen.queryByText('Start block')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Smart Contracts (expand|collapse)/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /faucet (expand|collapse)/i })).not.toBeInTheDocument();
      expect(document.getElementById('ce-setup-chain')).toBeNull();
      // On-chain SBT defaults (tag suggestions, auto-feature) stay off the Worker profile.
      const access = screen.getByTestId('ce-setup-section-access');
      expect(within(access).queryByDisplayValue('group, event, idea, demographic, location')).not.toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: /Auto-feature Session/i })).not.toBeInTheDocument();

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 350));
      });
      const persistedDraft = JSON.parse(sessionStorage.getItem('ce:sessionWizardDraft:v1')).draft;
      expect(Number(persistedDraft.networkChainId || 0)).not.toBe(84532);
      expect(persistedDraft.sessionModeProfile.evm.registryChainId).toBeNull();
      expect(mockSessionExists).not.toHaveBeenCalled();
      expect(blockNumberSpy).not.toHaveBeenCalled();
    } finally {
      blockNumberSpy.mockRestore();
    }
  });

  it('queues Worker Groups before Cloudflare session deployment and restores them from wizard state', async () => {
    window.history.replaceState({}, '', '/new');
    renderSessionWizard();

    selectNormalModeCard('Session Access');
    const groupDrafts = await screen.findByTestId('ce-new-worker-group-drafts');
    expect(within(groupDrafts).getByText(/created after this session/i)).toBeInTheDocument();
    fireEvent.change(within(groupDrafts).getByTestId('ce-new-worker-group-name'), {
      target: { value: 'Research team' },
    });
    fireEvent.click(within(groupDrafts).getByTestId('ce-new-worker-group-add'));

    expect(within(groupDrafts).getByDisplayValue('Research team')).toBeInTheDocument();
    fireEvent.change(within(groupDrafts).getByLabelText(/Description/i), {
      target: { value: 'Reviews research questions.' },
    });
    fireEvent.change(within(groupDrafts).getByLabelText('Who can join'), {
      target: { value: 'admin_add' },
    });

    await waitFor(
      () => {
        const cached = JSON.parse(sessionStorage.getItem('ce:sessionWizardDraft:v1'));
        expect(cached.pendingWorkerGroupDrafts).toEqual([
          expect.objectContaining({
            groupId: expect.any(String),
            label: 'Research team',
            description: 'Reviews research questions.',
            joinMode: 'admin_add',
            memberVisibility: 'session',
          }),
        ]);
      },
      { timeout: 8000 },
    );
  });

  it('keeps a cached custom profile on /new instead of replacing it with the default', async () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    profile.surfaces.agentHttp = true;
    sessionStorage.setItem(
      'ce:sessionWizardDraft:v1',
      JSON.stringify({
        draft: {
          sessionName: 'Saved custom session',
          sessionModeProfile: profile,
          storageProfile: { backend: 'cloudflare' },
        },
      }),
    );
    window.history.replaceState({}, '', '/new');

    renderSessionWizard();

    expect(await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME)).toHaveValue('Saved custom session');
    openSetupSection('hosting');
    expect(document.getElementById('ce-setup-agent-http')).toBeChecked();
  });

  it('checks session slug collisions before publish upload or register side effects', async () => {
    const { arweaveClient } = require('../../utilities/arweave/arweaveClient.js');
    let publishClicked = false;
    mockSessionExists.mockImplementation(async () => publishClicked);
    jest.useFakeTimers();
    const view = renderLoggedInSessionWizard();
    try {
      selectRegistryHosting();
      const sessionNameInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);

      fireEvent.change(sessionNameInput, {
        target: { value: 'Duplicate Session' },
      });
      // Settle the preview debounce before testing the independent publish-time check.
      await act(async () => {
        await jest.advanceTimersByTimeAsync(SESSION_SLUG_AVAILABILITY_DEBOUNCE_MS);
      });
      expect(mockSessionExists).toHaveBeenCalledWith('duplicate-session');
      jest.clearAllTimers();
      jest.useRealTimers();
      await createPendingFeaturedDraft();
      await deployVerifiedWorkerForCurrentDraft();

      const publishButton = screen.getByTestId(E2E_TESTIDS.WIZARD_PUBLISH);
      fireEvent.change(screen.getByPlaceholderText(/ar:\/\/<txId>/i), {
        target: { value: `ar://${'a'.repeat(43)}` },
      });
      await waitFor(
        () => {
          expect(publishButton).not.toBeDisabled();
        },
        { timeout: 8000 },
      );
      mockSessionExists.mockClear();
      publishClicked = true;
      fireEvent.click(publishButton);

      expect(
        await screen.findByText('Session slug already exists on-chain: duplicate-session', {}, { timeout: 8000 }),
      ).toBeInTheDocument();
      expect(mockSessionExists).toHaveBeenCalledWith('duplicate-session');
      expect(mockSessionExists).toHaveBeenCalledTimes(1);
      expect(mockCreateSBT).not.toHaveBeenCalled();
      expect(arweaveClient.uploadDataToArweave).not.toHaveBeenCalled();
      expect(mockRegisterSessionOnChain).not.toHaveBeenCalled();
    } finally {
      view.unmount();
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('shows and clears the reserved slug error in the rendered form', async () => {
    renderSessionWizard();

    const sessionNameInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);

    fireEvent.change(sessionNameInput, { target: { value: 'General' } });
    expect(screen.getByText(RESERVED_SESSION_SLUG_ERROR)).toBeInTheDocument();

    fireEvent.change(sessionNameInput, { target: { value: 'Edge Custom' } });
    expect(screen.queryByText(RESERVED_SESSION_SLUG_ERROR)).not.toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_SLUG)).toHaveTextContent('/session/edge-custom');
  });
});
