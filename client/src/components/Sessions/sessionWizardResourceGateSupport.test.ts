import {
  buildSessionWizardGateOptions,
  normalizeSessionWizardGateIds,
  resolveSessionWizardResourceGate,
  resolveSessionWizardResourceGateIds,
  resolveSessionWizardResourceGateSelectionState,
  resolveSessionWizardResourceGateSelectionUpdate,
} from './sessionWizardResourceGateSupport';

describe('sessionWizardResourceGateSupport', () => {
  const gates = [
    {
      id: 'gate-1',
      label: 'Gate 1',
      color: '#111111',
      mode: 'any',
      chainId: 84532,
      perMemberLimit: 2,
      sbts: [{ address: '0xaaa', name: 'A' }],
    },
    {
      id: 'gate-2',
      label: 'Gate 2',
      color: '#222222',
      mode: 'all',
      chainId: 11155420,
      perMemberLimit: 4,
      sbts: [{ address: '0xbbb', name: 'B' }],
    },
  ];

  it('builds gate option labels for selectors', () => {
    expect(buildSessionWizardGateOptions(gates)).toEqual([
      { id: 'gate-1', label: 'Gate 1', color: '#111111' },
      { id: 'gate-2', label: 'Gate 2', color: '#222222' },
    ]);
  });

  it('normalizes gate ids and falls back to available/default gates', () => {
    expect(normalizeSessionWizardGateIds([' gate-1 ', '', null])).toEqual(['gate-1']);
    expect(normalizeSessionWizardGateIds(' gate-2 ')).toEqual(['gate-2']);
    expect(resolveSessionWizardResourceGateIds(['missing'], 'gate-2', gates)).toEqual(['gate-2']);
    expect(resolveSessionWizardResourceGateIds([], '', gates)).toEqual(['gate-1']);
  });

  it('plans resource card gate selection state from available gate options', () => {
    expect(
      resolveSessionWizardResourceGateSelectionState({
        value: [' gate-1 ', 'missing', 'gate-2'],
        fallbackGateId: '',
        gateOptions: [
          { value: 'gate-1', label: 'Gate 1' },
          { value: 'gate-2', label: 'Gate 2' },
        ],
      }),
    ).toEqual({
      availableGateIds: ['gate-1', 'gate-2'],
      disabled: false,
      fallbackGateId: 'gate-1',
      selectedGateIds: ['gate-1', 'gate-2'],
    });
  });

  it('falls back when planning a resource card with no saved gate selection', () => {
    expect(
      resolveSessionWizardResourceGateSelectionState({
        value: '',
        fallbackGateId: 'gate-2',
        gateOptions: [
          { value: 'gate-1', label: 'Gate 1' },
          { value: 'gate-2', label: 'Gate 2' },
        ],
      }),
    ).toEqual({
      availableGateIds: ['gate-1', 'gate-2'],
      disabled: false,
      fallbackGateId: 'gate-2',
      selectedGateIds: ['gate-2'],
    });
  });

  it('plans normalized resource gate selection updates', () => {
    expect(
      resolveSessionWizardResourceGateSelectionUpdate({
        nextIds: ['gate-1', 'missing', 'gate-2'],
        availableGateIds: ['gate-1', 'gate-2'],
        fallbackGateId: 'gate-1',
      }),
    ).toEqual(['gate-1', 'gate-2']);

    expect(
      resolveSessionWizardResourceGateSelectionUpdate({
        nextIds: ['gate-2'],
        availableGateIds: ['gate-1', 'gate-2'],
        fallbackGateId: 'gate-1',
      }),
    ).toBe('gate-2');

    expect(
      resolveSessionWizardResourceGateSelectionUpdate({
        nextIds: ['missing'],
        availableGateIds: ['gate-1', 'gate-2'],
        fallbackGateId: 'gate-1',
      }),
    ).toBe('gate-1');
  });

  it('resolves resource gates and reports conflicts across multiple gates', () => {
    expect(resolveSessionWizardResourceGate(['gate-1', 'gate-2'], 'gate-1', gates)).toEqual({
      gateId: 'gate-1',
      gateIds: ['gate-1', 'gate-2'],
      sbts: [
        { address: '0xaaa', name: '0xaaa' },
        { address: '0xbbb', name: '0xbbb' },
      ],
      mode: 'any',
      chainId: 84532,
      perMemberLimit: 2,
      hasConflicts: true,
      conflictSummary: {
        modeConflicts: true,
        chainIdConflicts: true,
        perMemberLimitConflicts: true,
      },
      registryRepresentable: false,
      registryUnsupportedReason: 'multiple gates with All semantics cannot be encoded as one registry gate',
    });
  });

  it('marks same-mode All multi-gate groups as unrepresentable by the registry', () => {
    const allGates = [
      {
        id: 'gate-a',
        mode: 'all',
        chainId: 84532,
        perMemberLimit: 0,
        sbts: [{ address: '0xaaa', name: 'A' }],
      },
      {
        id: 'gate-b',
        mode: 'all',
        chainId: 84532,
        perMemberLimit: 0,
        sbts: [{ address: '0xbbb', name: 'B' }],
      },
    ];

    expect(resolveSessionWizardResourceGate(['gate-a', 'gate-b'], 'gate-a', allGates)).toEqual({
      gateId: 'gate-a',
      gateIds: ['gate-a', 'gate-b'],
      sbts: [
        { address: '0xaaa', name: '0xaaa' },
        { address: '0xbbb', name: '0xbbb' },
      ],
      mode: 'all',
      chainId: 84532,
      perMemberLimit: 0,
      hasConflicts: false,
      conflictSummary: {
        modeConflicts: false,
        chainIdConflicts: false,
        perMemberLimitConflicts: false,
      },
      registryRepresentable: false,
      registryUnsupportedReason: 'multiple gates with All semantics cannot be encoded as one registry gate',
    });
  });

  it('returns null when no gate can be resolved', () => {
    expect(resolveSessionWizardResourceGate([], '', [])).toBeNull();
  });
});
