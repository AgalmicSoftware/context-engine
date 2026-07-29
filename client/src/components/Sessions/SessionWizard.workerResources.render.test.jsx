import {
  E2E_TESTIDS,
  act,
  ethers,
  fireEvent,
  getWizardResourceCard,
  mockRegisterSessionOnChain,
  renderLoggedInSessionWizard,
  renderSessionWizard,
  renderSessionWizardWithTooltipStore,
  resetSessionWizardWorkerPanelTestState,
  screen,
  selectNormalModeCard,
  enableAdvancedMode,
  waitFor,
  within,
} from './SessionWizard.workerPanel.testUtils';

describe('SessionWizard worker resource rendering', () => {
  beforeEach(resetSessionWizardWorkerPanelTestState);

  const openPublishSection = async () => {
    fireEvent.click(screen.getByText('Publish').closest('button'));
    return screen.findByTestId(E2E_TESTIDS.WIZARD_PUBLISH);
  };

  const selectPreset = async (presetId) => {
    const testId = `ce-new-preset-${presetId}`;
    const originalConfirm = window.confirm;
    window.confirm = jest.fn(() => true);
    try {
      fireEvent.click(screen.getByTestId(testId));
    } finally {
      window.confirm = originalConfirm;
    }
    await waitFor(() => {
      expect(screen.getByTestId(testId)).toHaveAttribute('aria-checked', 'true');
    });
  };

  const selectFastCheapPreset = async () => selectPreset('fast_cheap_cloudflare');
  const selectTrustlessPublicPreset = async () => selectPreset('trustless_public_decentralized');
  const selectLitProfile = async (selectBasePreset) => {
    await selectBasePreset();
    enableAdvancedMode();
    const encryptionOptions = within(screen.getByRole('radiogroup', { name: /encryption/i }));
    fireEvent.click(encryptionOptions.getByRole('radio', { name: 'Lit' }));
    await waitFor(() => {
      expect(encryptionOptions.getByRole('radio', { name: 'Lit' })).toHaveAttribute('aria-checked', 'true');
    });
  };
  const selectCloudflareLitProfile = async () => selectLitProfile(selectFastCheapPreset);
  const selectDecentralizedLitProfile = async () => selectLitProfile(selectTrustlessPublicPreset);

  it('shows only the AI resource for the default Cloudflare two-key profile', async () => {
    renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    await selectFastCheapPreset();
    selectNormalModeCard('Worker');

    await waitFor(() => {
      expect(screen.getAllByTestId(E2E_TESTIDS.WIZARD_RESOURCE_CARD)).toHaveLength(1);
    });
    expect(getWizardResourceCard('ai')).toBeTruthy();
    expect(getWizardResourceCard('arweave')).toBeUndefined();
    expect(getWizardResourceCard('rpc')).toBeUndefined();
    expect(getWizardResourceCard('txGas')).toBeUndefined();
    expect(getWizardResourceCard('lit')).toBeUndefined();
  });

  it('preserves decentralized resource requirements while leaving Lit opt-in', async () => {
    renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    await selectTrustlessPublicPreset();
    selectNormalModeCard('Worker');

    await waitFor(() => {
      expect(screen.getAllByTestId(E2E_TESTIDS.WIZARD_RESOURCE_CARD)).toHaveLength(4);
    });
    expect(getWizardResourceCard('ai')).toBeTruthy();
    expect(getWizardResourceCard('arweave')).toBeTruthy();
    expect(getWizardResourceCard('rpc')).toBeTruthy();
    expect(getWizardResourceCard('txGas')).toBeTruthy();
    expect(getWizardResourceCard('lit')).toBeUndefined();
  });

  it('uses the Privacy storage control instead of a second Session Storage editor', async () => {
    renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    expect(screen.queryByText('Session Storage')).not.toBeInTheDocument();

    enableAdvancedMode();
    const storageOptions = within(await screen.findByRole('radiogroup', { name: 'Data storage' }));
    const arweaveOption = storageOptions.getByRole('radio', { name: 'Arweave' });
    const cloudflareOption = storageOptions.getByRole('radio', { name: 'Cloudflare' });
    expect(arweaveOption).toHaveAttribute('aria-checked', 'true');
    expect(cloudflareOption).toHaveAttribute('aria-checked', 'false');
    expect(screen.queryByText('Session Storage')).not.toBeInTheDocument();

    fireEvent.click(cloudflareOption);

    await waitFor(() => {
      expect(arweaveOption).toHaveAttribute('aria-checked', 'false');
      expect(cloudflareOption).toHaveAttribute('aria-checked', 'true');
    });
    expect(screen.queryByRole('radio', { name: 'Public read' })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Worker SBT gate' })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Lit encrypted' })).not.toBeInTheDocument();
  });

  it('shows Lit-encrypted Cloudflare copy while keeping Arweave credentials in worker resources', async () => {
    renderLoggedInSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    enableAdvancedMode();
    fireEvent.click(screen.getByRole('button', { name: 'Session Storage expand' }));

    fireEvent.click(screen.getByRole('radio', { name: 'Cloudflare' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Lit encrypted' }));

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'Lit encrypted' })).toHaveAttribute('aria-checked', 'true');
    });
    expect(
      screen.getByText(/Lit-encrypted mode is configured for encrypted Cloudflare payload envelopes/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_PANEL_TOGGLE));

    const arweaveCard = await waitFor(() => {
      const card = getWizardResourceCard('arweave');
      expect(card).toBeTruthy();
      return card;
    });
    expect(within(arweaveCard).getByText('Arweave JWK *')).toBeInTheDocument();
    expect(within(arweaveCard).getByTestId(E2E_TESTIDS.WIZARD_SECRET_ARWEAVE_JWK)).toBeInTheDocument();
  });

  it('blocks publishing worker resources with unrepresentable All gate groups', async () => {
    sessionStorage.setItem(
      'ce:sessionWizardDraft:v1',
      JSON.stringify({
        draft: {
          sessionName: 'Unrepresentable All Gates',
          slug: 'unrepresentable-all-gates',
          networkChainId: 11155420,
        },
        encryptionGates: [
          {
            id: 'gate-all-a',
            label: 'All A',
            mode: 'all',
            chainId: 11155420,
            sbts: [{ address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', name: 'All A SBT' }],
          },
          {
            id: 'gate-all-b',
            label: 'All B',
            mode: 'all',
            chainId: 11155420,
            sbts: [{ address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', name: 'All B SBT' }],
          },
        ],
        defaultGateId: 'gate-all-a',
        resourceGateMap: {
          ai: ['gate-all-a', 'gate-all-b'],
        },
      }),
    );

    renderLoggedInSessionWizard();
    enableAdvancedMode();

    const publishButton = await openPublishSection();
    fireEvent.click(screen.getByLabelText('Advanced publish settings'));
    fireEvent.change(screen.getByPlaceholderText(/ar:\/\/<txId>/i), {
      target: { value: `ar://${'c'.repeat(43)}` },
    });

    await waitFor(() => {
      expect(publishButton).not.toBeDisabled();
    });

    fireEvent.click(publishButton);

    expect(await screen.findByText(/Resource "ai" uses multiple gate groups with All semantics/i)).toBeInTheDocument();
    expect(mockRegisterSessionOnChain).not.toHaveBeenCalled();
  });

  it('hides Lit worker inputs for Cloudflare worker SBT gate mode and restores them for Lit encrypted mode', async () => {
    sessionStorage.setItem(
      'ce:sessionWizardDraft:v1',
      JSON.stringify({
        draft: {
          storageProfile: {
            backend: 'cloudflare',
            payloadAccessControl: { mode: 'worker_sbt_gate' },
          },
        },
        workerSecretsEnabled: true,
      }),
    );

    const firstRender = renderLoggedInSessionWizard();
    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    selectNormalModeCard('Worker');
    await waitFor(() => {
      expect(getWizardResourceCard('lit')).toBeUndefined();
    });
    expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_SECRET_LIT_ACCOUNT_API_KEY)).not.toBeInTheDocument();

    firstRender.unmount();
    sessionStorage.setItem(
      'ce:sessionWizardDraft:v1',
      JSON.stringify({
        draft: {
          storageProfile: {
            backend: 'cloudflare',
            payloadAccessControl: { mode: 'lit_encrypted' },
          },
        },
        workerSecretsEnabled: true,
      }),
    );

    renderLoggedInSessionWizard();
    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    selectNormalModeCard('Worker');

    const litCard = await waitFor(() => getWizardResourceCard('lit'));
    expect(litCard).toBeTruthy();
    expect(within(litCard).getByText('Lit API key')).toBeInTheDocument();
  });

  it('shows GitHub worker links instead of raw source in advanced mode', async () => {
    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    enableAdvancedMode();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_PANEL_TOGGLE));

    expect(await screen.findByText('Worker Deployment')).toBeInTheDocument();
    expect(
      screen.getByText('Sessions use a Cloudflare Worker for CORS proxy, AI, and faucet services.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('The default hosted worker is used automatically unless a custom worker URL is configured.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /worker source/i })).toHaveAttribute(
      'href',
      expect.stringContaining('/tree/main/workers/sessionCorsWorker'),
    );
    expect(screen.getByRole('link', { name: /worker source/i })).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('link', { name: /deploy helper/i })).toHaveAttribute(
      'href',
      expect.stringContaining('/tree/main/workers/deploy-helper'),
    );
    expect(screen.getByRole('link', { name: /deploy helper/i })).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('link', { name: /worker docs/i })).toHaveAttribute(
      'href',
      expect.stringContaining('/blob/main/docs/session-cors-worker.md'),
    );
    expect(screen.getByRole('link', { name: /worker docs/i })).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.queryByText('Worker code (unbundled, copy + paste)')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /copy worker code/i })).not.toBeInTheDocument();
  });

  it('disables worker secret inputs when user-paid mode is enabled and restores them when turned off in advanced mode', async () => {
    renderSessionWizard();
    enableAdvancedMode();
    fireEvent.click(await screen.findByTestId(E2E_TESTIDS.WIZARD_WORKER_PANEL_TOGGLE));

    const openAiKeyInput = await screen.findByTestId(E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY);
    const requirePayToggle = screen.getByTestId(E2E_TESTIDS.WIZARD_WORKER_SECRETS_REQUIRE_PAY);

    expect(openAiKeyInput).toBeEnabled();
    expect(requirePayToggle).not.toBeChecked();

    fireEvent.change(openAiKeyInput, { target: { value: 'sk-test' } });
    fireEvent.click(requirePayToggle);

    await waitFor(() => {
      expect(requirePayToggle).toBeChecked();
      expect(openAiKeyInput).toBeDisabled();
    });

    fireEvent.click(requirePayToggle);

    await waitFor(() => {
      expect(requirePayToggle).not.toBeChecked();
      expect(openAiKeyInput).toBeEnabled();
    });
  });

  it('renders only the Chipotle Lit API key in the normal-mode worker secret view', async () => {
    renderSessionWizard();

    selectNormalModeCard('Worker');
    const litCard = (await screen.findByText('LIT')).closest(`[data-testid="${E2E_TESTIDS.WIZARD_RESOURCE_CARD}"]`);

    expect(litCard).not.toBeNull();
    expect(within(litCard).getByText('Lit API key')).toBeInTheDocument();
    expect(within(litCard).queryByText('Lit API base')).not.toBeInTheDocument();
    expect(within(litCard).queryByText('Lit group ID')).not.toBeInTheDocument();
    expect(within(litCard).queryByText('Lit PKP ID')).not.toBeInTheDocument();
    expect(within(litCard).queryByText('Lit Action CID')).not.toBeInTheDocument();
    expect(within(litCard).queryByText('Lit usage API key')).not.toBeInTheDocument();
    expect(within(litCard).queryByText('Private key')).not.toBeInTheDocument();
  });

  it('does not enable Chipotle wizard hooks while only bootstrap authority fields are present', async () => {
    const litProtocol = require('../../utilities/crypto/litProtocol.js');
    litProtocol.createLitHooks.mockClear();
    renderSessionWizard();
    selectNormalModeCard('Worker');

    fireEvent.change(await screen.findByTestId(E2E_TESTIDS.WIZARD_SECRET_LIT_ACCOUNT_API_KEY), {
      target: { value: 'account-secret' },
    });

    await waitFor(() => {
      expect(litProtocol.createLitHooks).not.toHaveBeenCalled();
    });
  });

  it('waits for a worker URL before enabling Chipotle wizard hooks', async () => {
    const litProtocol = require('../../utilities/crypto/litProtocol.js');
    litProtocol.createLitHooks.mockClear();
    sessionStorage.setItem(
      'ce:sessionWizardDraft:v1',
      JSON.stringify({
        workerSecretsEnabled: true,
        workerSecrets: {
          litApiBase: 'https://api.chipotle.litprotocol.com',
          litGroupId: 'group_123',
          litPkpId: 'pkp_123',
          litActionCid: 'bafy123',
        },
      }),
    );

    renderSessionWizard();

    await screen.findByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    selectNormalModeCard('Worker');
    expect(await screen.findByTestId(E2E_TESTIDS.WIZARD_SECRET_LIT_ACCOUNT_API_KEY)).toBeInTheDocument();

    await waitFor(() => {
      expect(litProtocol.createLitHooks).not.toHaveBeenCalled();
    });
  });

  it('uses the current Chipotle Lit tooltip copy in the worker panel', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.useFakeTimers();
    try {
      renderSessionWizard();
      selectNormalModeCard('Worker');

      const trigger = await screen.findByTestId('ce-wizard-resource-tooltip-lit');
      fireEvent.mouseOver(trigger);
      expect(
        await screen.findByText(
          'Worker-mediated Lit Chipotle setup. Paste one Lit API key; the worker derives the scoped group, PKP, and CE action after deploy.',
        ),
      ).toBeInTheDocument();
      fireEvent.mouseOut(trigger);
    } finally {
      act(() => {
        jest.runOnlyPendingTimers();
      });
      jest.useRealTimers();
      consoleErrorSpy.mockRestore();
    }
  });

  it('renders worker resource tooltips for each visible secret section', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.useFakeTimers();
    try {
      renderSessionWizard();
      selectNormalModeCard('Worker');

      const tooltipCases = [
        ['ai', 'Session-funded OpenAI key used for text generation and transcription.'],
        ['rpc', 'Authenticated RPC endpoint used by the worker for chain reads and related operations.'],
        ['arweave', 'Account used to pay for Arweave uploads and storage.'],
        ['txGas', 'Faucet signer used to send small testnet funding grants.'],
        [
          'lit',
          'Worker-mediated Lit Chipotle setup. Paste one Lit API key; the worker derives the scoped group, PKP, and CE action after deploy.',
        ],
      ];

      for (const [resourceKey, copy] of tooltipCases) {
        const trigger = await screen.findByTestId(`ce-wizard-resource-tooltip-${resourceKey}`);
        fireEvent.mouseOver(trigger);
        expect(await screen.findByText(copy)).toBeInTheDocument();
        fireEvent.mouseOut(trigger);
      }
    } finally {
      act(() => {
        jest.runOnlyPendingTimers();
      });
      jest.useRealTimers();
      consoleErrorSpy.mockRestore();
    }
  });

  it('hides and restores worker step tooltip triggers when explainers are toggled', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.useFakeTimers();
    try {
      const { store } = renderSessionWizardWithTooltipStore();
      selectNormalModeCard('Worker');

      const rpcTooltipTrigger = await screen.findByTestId('ce-wizard-resource-tooltip-rpc');
      const allowedOriginsTrigger = await screen.findByTestId('ce-wizard-worker-tooltip-gw-allowed-origins');

      fireEvent.mouseOver(rpcTooltipTrigger);
      expect(
        await screen.findByText(
          'Authenticated RPC endpoint used by the worker for chain reads and related operations.',
        ),
      ).toBeInTheDocument();
      fireEvent.mouseOut(rpcTooltipTrigger);

      expect(allowedOriginsTrigger).toBeInTheDocument();

      act(() => {
        store.dispatch({ type: 'SET_TOOLTIPS', payload: false });
      });

      await waitFor(() => {
        expect(screen.queryByTestId('ce-wizard-resource-tooltip-rpc')).not.toBeInTheDocument();
        expect(screen.queryByTestId('ce-wizard-worker-tooltip-gw-allowed-origins')).not.toBeInTheDocument();
      });

      act(() => {
        store.dispatch({ type: 'SET_TOOLTIPS', payload: true });
      });

      const restoredTrigger = await screen.findByTestId('ce-wizard-resource-tooltip-rpc');
      expect(await screen.findByTestId('ce-wizard-worker-tooltip-gw-allowed-origins')).toBeInTheDocument();

      fireEvent.click(restoredTrigger);
      expect(
        await screen.findByText(
          'Authenticated RPC endpoint used by the worker for chain reads and related operations.',
        ),
      ).toBeInTheDocument();
    } finally {
      act(() => {
        jest.runOnlyPendingTimers();
      });
      jest.useRealTimers();
      consoleErrorSpy.mockRestore();
    }
  });

  it('shows the effective default worker RPC URL as the RPC field placeholder without extra helper copy', async () => {
    const defaultPocketRpcUrl = 'https://op-sepolia-testnet.api.pocket.network'; // intentional: production default worker RPC placeholder
    renderSessionWizard();
    selectNormalModeCard('Worker');

    const rpcCard = await waitFor(() => {
      const card = getWizardResourceCard('rpc');
      expect(card).toBeTruthy();
      return card;
    });
    const rpcInput = within(rpcCard).getByRole('textbox');

    expect(rpcInput).toHaveValue('');
    expect(rpcInput).toHaveAttribute('placeholder', defaultPocketRpcUrl);
    expect(within(rpcCard).queryByText(`Default worker RPC: ${defaultPocketRpcUrl}`)).not.toBeInTheDocument();
  });

  it('keeps Chipotle Lit UI visible while stripping cached legacy payer secrets from saved drafts', async () => {
    const litProtocol = require('../../utilities/crypto/litProtocol.js');
    const cachedLitKey = '0x59c6995e998f97a5a0044976f84ce7de5d9d7f17b2f6a6a5f76f8864c8ad88f5';
    sessionStorage.setItem(
      'ce:sessionWizardDraft:v1',
      JSON.stringify({
        workerSecretsEnabled: true,
        workerSecrets: {
          litPayerPrivateKey: cachedLitKey,
          litPayerAddress: ethers.utils.computeAddress(cachedLitKey),
        },
        provisionedSponsoredContext: {
          sessionSlug: 'edge',
          workerUrl: 'https://deployed.example.test',
          fields: {
            sponsored_lit: '1',
          },
        },
      }),
    );

    renderSessionWizard();
    selectNormalModeCard('Worker');

    expect(screen.getByText('LIT')).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_SECRET_LIT_ACCOUNT_API_KEY)).toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_SECRET_LIT_API_BASE)).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_SECRET_LIT_PAYER_PRIVATE_KEY)).not.toBeInTheDocument();
    expect(screen.getByTestId('ce-wizard-resource-tooltip-lit')).toBeInTheDocument();

    await waitFor(() => {
      expect(litProtocol.createLitHooks).not.toHaveBeenCalled();
    });

    await waitFor(() => {
      const cached = JSON.parse(sessionStorage.getItem('ce:sessionWizardDraft:v1') || '{}');
      expect(cached.workerSecrets?.litPayerPrivateKey).toBeUndefined();
      expect(cached.workerSecrets?.litPayerAddress).toBeUndefined();
      expect(cached.provisionedSponsoredContext?.fields?.sponsored_lit).toBe('1');
    });
  });

  it('keeps the custom AI RPC field empty until the admin sets it', async () => {
    renderSessionWizard();
    selectNormalModeCard('Worker');

    const customRpcLabel = await screen.findByText('Custom RPC URL');
    const customRpcGroup = customRpcLabel.closest('.resourceInput') || customRpcLabel.parentElement?.parentElement;
    const customRpcInput = within(customRpcGroup).getByRole('textbox');

    expect(customRpcInput).toHaveValue('');
  });
});
