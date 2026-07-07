import {
  fireEvent,
  render,
  screen,
  within,
  CreateSBTGroup,
  gateLockStyles,
  E2E_TESTIDS,
  makeInstance,
  setupCreateSBTGroupTestLifecycle,
} from './CreateSBTGroup.testUtils';

describe('CreateSBTGroup authoring UI rendering', () => {
  setupCreateSBTGroupTestLifecycle();

  it('renders GateMultiSelectLock beside the description field', () => {
    const instance = makeInstance({
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    instance.state.tokenInfoCollapsed = false;

    render(instance.render());

    const descriptionRow = screen.getByTestId(E2E_TESTIDS.SBT_CREATE_DESCRIPTION_LOCK_ROW);
    expect(within(descriptionRow).getByTestId(E2E_TESTIDS.GATE_LOCK)).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_NAME_LOCK_ROW)).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_IMAGE_LOCK_ROW)).toBeInTheDocument();
    expect(screen.getAllByTestId(E2E_TESTIDS.GATE_LOCK)).toHaveLength(5);
  });

  it('renders metadata field locks without SBT badge text or inline gate dots', () => {
    const instance = makeInstance({
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    instance.state = {
      ...instance.state,
      tokenInfoCollapsed: false,
      metadataLockGateIds: {
        ...instance.state.metadataLockGateIds,
        description: ['gate-1', 'gate-2'],
      },
    };
    instance.resolveLockGateOptions = jest.fn(() => ({
      gateOptions: [
        { id: 'gate-1', label: 'Alpha Gate', badgeLabel: 'Alpha Gate', color: '#5affc2' },
        { id: 'gate-2', label: 'Beta Gate', badgeLabel: 'Beta Gate', color: '#5b8cff' },
      ],
      defaultGateId: 'gate-1',
    }));

    render(instance.render());

    const descriptionRow = screen.getByTestId(E2E_TESTIDS.SBT_CREATE_DESCRIPTION_LOCK_ROW);
    const lock = within(descriptionRow).getByTestId(E2E_TESTIDS.GATE_LOCK);

    expect(within(lock).getByTestId(E2E_TESTIDS.GATE_LOCK_BUTTON)).toBeInTheDocument();
    expect(within(lock).queryByText(/\bSBT\b/i)).not.toBeInTheDocument();
    expect(within(lock).queryByText(/Alpha Gate/i)).not.toBeInTheDocument();
    expect(within(lock).queryByText(/Beta Gate/i)).not.toBeInTheDocument();
    expect(within(lock).queryByText(/\b\d+\s+gates?\b/i)).not.toBeInTheDocument();
    expect(lock.querySelector(`.${gateLockStyles.dots}`)).toBeNull();
  });

  it('keeps option guidance out of inline copy and in tooltips only', () => {
    const instance = makeInstance({
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    instance.state = {
      ...instance.state,
      tokenInfoCollapsed: false,
      distributionOptionsCollapsed: false,
    };

    render(instance.render());

    expect(screen.queryByText('Choose who can remove this Group after collect.')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Override the deployer if a different burn admin should manage revocation.'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Pick the chain where the Group contract will be deployed.')).not.toBeInTheDocument();
    expect(screen.queryByText('This draft is pinned to the session chain.')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Use deterministic deployment so the final Group address is known ahead of time.'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Generate a unique claim link for each participant.')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Hide this group from the public list while keeping direct access intact.'),
    ).not.toBeInTheDocument();
  });

  it('shows a pending group-name message before deterministic preview inputs are complete', () => {
    const instance = makeInstance({
      account: '0xCreator',
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    instance.state = {
      ...instance.state,
      mintOptionsCollapsed: false,
      predictableAddressEnabled: true,
    };

    render(instance.render());

    expect(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_PREDICTED_ADDRESS)).toHaveTextContent('Pending group name…');
    expect(screen.queryByText('Enter a group name to preview the address.')).not.toBeInTheDocument();
    expect(screen.queryByText(/Salt auto-generated from this session and group name:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Deterministic contract symbol:/)).not.toBeInTheDocument();
    expect(screen.queryByText('Customize salt')).not.toBeInTheDocument();
  });

  it('shows a pending admin-account message when the creator wallet is still missing', () => {
    const instance = makeInstance({
      account: '',
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    instance.state = {
      ...instance.state,
      mintOptionsCollapsed: false,
      predictableAddressEnabled: true,
      sbtName: 'Alpha',
    };

    render(instance.render());

    expect(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_PREDICTED_ADDRESS)).toHaveTextContent('Pending admin account…');
    expect(screen.queryByText('Connect a wallet to preview the address.')).not.toBeInTheDocument();
  });

  it('renders the time-limited mint input as a native datetime field and updates the end time', () => {
    const instance = makeInstance({
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    instance.state = {
      ...instance.state,
      mintOptionsCollapsed: false,
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        isTimeLimited: true,
        mintingEndTime: new Date('2026-04-06T12:30:00'),
      },
    };

    const { container } = render(instance.render());

    const input = container.querySelector('input[type="datetime-local"]');
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('2026-04-06T12:30');

    fireEvent.change(input, { target: { value: '2026-04-06T13:45' } });

    expect(instance.state.sbtDistribution.mintingEndTime).toBeInstanceOf(Date);
    expect(instance.state.sbtDistribution.mintingEndTime.getFullYear()).toBe(2026);
    expect(instance.state.sbtDistribution.mintingEndTime.getMonth()).toBe(3);
    expect(instance.state.sbtDistribution.mintingEndTime.getDate()).toBe(6);
    expect(instance.state.sbtDistribution.mintingEndTime.getHours()).toBe(13);
    expect(instance.state.sbtDistribution.mintingEndTime.getMinutes()).toBe(45);
  });

  it('syncs the connected account into the admin defaults when login finishes later', () => {
    const connectedAccount = '0x00000000000000000000000000000000000000aa';
    const instance = makeInstance({
      account: '',
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    instance.state = {
      ...instance.state,
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        burnAdmin: '',
        adminAddress: '',
      },
    };

    const prevProps = { ...instance.props };
    const prevState = {
      ...instance.state,
      sbtDistribution: { ...instance.state.sbtDistribution },
    };
    instance.props = {
      ...instance.props,
      account: connectedAccount,
    };

    instance.componentDidUpdate(prevProps, prevState);

    expect(instance.state.sbtDistribution.burnAdmin).toBe(connectedAccount);
    expect(instance.state.sbtDistribution.adminAddress).toBe(connectedAccount);
  });

  it('preserves a custom admin address when a new wallet connects', () => {
    const previousAccount = '0x00000000000000000000000000000000000000aa';
    const customAdmin = '0x00000000000000000000000000000000000000bb';
    const nextAccount = '0x00000000000000000000000000000000000000cc';
    const instance = makeInstance({
      account: previousAccount,
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    instance.state = {
      ...instance.state,
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        burnAdmin: customAdmin,
        adminAddress: customAdmin,
      },
    };

    const prevProps = { ...instance.props };
    const prevState = {
      ...instance.state,
      sbtDistribution: { ...instance.state.sbtDistribution },
    };
    instance.props = {
      ...instance.props,
      account: nextAccount,
    };

    instance.componentDidUpdate(prevProps, prevState);

    expect(instance.state.sbtDistribution.burnAdmin).toBe(customAdmin);
    expect(instance.state.sbtDistribution.adminAddress).toBe(customAdmin);
  });

  it('intentionally collapses CreateSBT lock options to the canonical default session gate', () => {
    const instance = makeInstance({
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    instance.getSessionConfigForNetwork = jest.fn(() => ({
      sessionName: 'FOR TEST 12',
      networkChainId: 84532,
      sponsored: {
        defaultGateId: 'default_gate',
        gates: {
          default_gate: {
            label: 'Default Gate',
            sbtAddresses: ['0x2222222222222222222222222222222222222222'],
            chainId: 84532,
            litChain: 'baseSepolia',
          },
          ai_gate: {
            label: 'AI Gate',
            sbtAddresses: ['0x1111111111111111111111111111111111111111'],
            chainId: 84532,
            litChain: 'baseSepolia',
          },
          doc_gate: {
            label: 'Docs Gate',
            sbtAddresses: ['0x3333333333333333333333333333333333333333'],
            chainId: 84532,
            litChain: 'baseSepolia',
          },
        },
      },
      lit: {
        defaultGateId: 'default_gate',
      },
      __registry: {
        gateAuthority: 'onchain',
        gatesByResource: {
          default: {
            gateId: 'default_gate',
            sbtAddresses: ['0x2222222222222222222222222222222222222222'],
            lookupStatus: 'ok',
            chainId: 84532,
          },
          ai: {
            gateId: 'ai_gate',
            sbtAddresses: ['0x1111111111111111111111111111111111111111'],
            lookupStatus: 'ok',
            chainId: 84532,
          },
          docUrls: {
            gateId: 'doc_gate',
            sbtAddresses: ['0x3333333333333333333333333333333333333333'],
            lookupStatus: 'ok',
            chainId: 84532,
          },
        },
      },
    }));
    instance.state = {
      ...instance.state,
      tokenInfoCollapsed: false,
      openLockKey: 'name',
      metadataLockGateIds: {
        ...instance.state.metadataLockGateIds,
        name: ['default_gate'],
      },
    };

    const { gateOptions, defaultGateId } = instance.resolveLockGateOptions();

    expect(defaultGateId).toBe('default_gate');
    expect(gateOptions).toEqual([
      expect.objectContaining({
        id: 'default_gate',
        label: 'FOR TEST 12',
        displayLabel: 'FOR TEST 12',
        badgeLabel: 'FOR TEST 12',
        secondaryLabel: '',
        sbtAddress: '0x2222222222222222222222222222222222222222',
      }),
    ]);

    render(instance.render());

    const popover = screen.getByTestId(E2E_TESTIDS.GATE_LOCK_POPOVER);
    expect(within(popover).getAllByTestId(E2E_TESTIDS.GATE_LOCK_ROW)).toHaveLength(1);
    expect(within(popover).getByText('FOR TEST 12')).toBeInTheDocument();
    expect(within(popover).queryByText('FOR TEST 12 (ai)')).not.toBeInTheDocument();
    expect(within(popover).queryByText('FOR TEST 12 (default)')).not.toBeInTheDocument();
    expect(within(popover).queryByText('FOR TEST 12 (docs)')).not.toBeInTheDocument();
  });

  it('keeps the simplified distribution options visible and the shared lock popover mounted through the gate lock button slot', () => {
    const instance = makeInstance({
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    instance.getSessionConfigForNetwork = jest.fn(() => ({
      sessionName: 'FOR TEST 12',
      networkChainId: 84532,
      sponsored: {
        defaultGateId: 'default_gate',
        gates: {
          default_gate: {
            label: 'Default Gate',
            sbtAddresses: ['0x2222222222222222222222222222222222222222'],
            chainId: 84532,
            litChain: 'baseSepolia',
          },
        },
      },
      lit: {
        defaultGateId: 'default_gate',
      },
      __registry: {
        gateAuthority: 'onchain',
        gatesByResource: {
          default: {
            gateId: 'default_gate',
            sbtAddresses: ['0x2222222222222222222222222222222222222222'],
            lookupStatus: 'ok',
            chainId: 84532,
          },
        },
      },
    }));
    instance.state = {
      ...instance.state,
      tokenInfoCollapsed: false,
      distributionOptionsCollapsed: false,
      openLockKey: 'name',
      metadataLockGateIds: {
        ...instance.state.metadataLockGateIds,
        name: ['default_gate'],
      },
    };

    render(instance.render());

    expect(screen.getByText('One-use URLs')).toBeInTheDocument();
    expect(screen.getByText('Group Password')).toBeInTheDocument();
    expect(screen.getByText('public URL')).toBeInTheDocument();
    expect(screen.getByText('Unlisted')).toBeInTheDocument();

    const nameRow = screen.getByTestId(E2E_TESTIDS.SBT_CREATE_NAME_LOCK_ROW);
    expect(within(nameRow).getByTestId(E2E_TESTIDS.GATE_LOCK_BUTTON)).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.GATE_LOCK_POPOVER)).toBeInTheDocument();
    expect(within(screen.getByTestId(E2E_TESTIDS.GATE_LOCK_POPOVER)).getByText('FOR TEST 12')).toBeInTheDocument();
  });

  it('exposes stable section header hooks for deferred deploy E2E flows', () => {
    const instance = makeInstance({
      deferredDeploy: true,
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });

    render(instance.render());

    expect(
      document.querySelector(
        `[data-testid="${E2E_TESTIDS.SBT_CREATE_SECTION_HEADER}"][data-ce-section-key="tokenInfoCollapsed"]`,
      ),
    ).not.toBeNull();
    expect(
      document.querySelector(
        `[data-testid="${E2E_TESTIDS.SBT_CREATE_SECTION_HEADER}"][data-ce-section-key="mintOptionsCollapsed"]`,
      ),
    ).not.toBeNull();
  });

  it('surfaces the visible error banner through a stable E2E hook', () => {
    const instance = makeInstance({
      deferredDeploy: true,
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    instance.state = {
      ...instance.state,
      error: 'Upload metadata before adding this Group to the session.',
    };

    render(instance.render());

    expect(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_ERROR)).toHaveTextContent(
      'Upload metadata before adding this Group to the session.',
    );
  });
});
