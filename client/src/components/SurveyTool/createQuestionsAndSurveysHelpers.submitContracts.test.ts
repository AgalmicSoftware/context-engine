import {
  buildAuthoringEncryptionPayload,
  buildCreateSurveyGateObjectsAndRecipients,
  combineLitRecipientAccessControlConditions,
  findFirstBlankQuestionPromptIndex,
  getCreateSurveyValidationError,
  isEncryptableFieldValueEmpty,
  stableGateColor,
} from './createQuestionsAndSurveysHelpers.js';

describe('createQuestionsAndSurveysHelpers submit validation', () => {
  it('finds the first blank question prompt', () => {
    expect(findFirstBlankQuestionPromptIndex([{ prompt: 'Ready' }, { prompt: '   ' }, { prompt: '' }])).toBe(1);
  });

  it('requires a title for survey authoring before checking questions', () => {
    expect(
      getCreateSurveyValidationError({
        title: ' ',
        isStandaloneQuestion: false,
        questions: [{ prompt: '' }],
      }),
    ).toBe('Please enter a survey title.');
  });

  it('allows standalone questions without a survey title', () => {
    expect(
      getCreateSurveyValidationError({
        title: '',
        isStandaloneQuestion: true,
        questions: [{ prompt: 'Standalone prompt' }],
      }),
    ).toBe('');
  });

  it('reports the one-based index for blank prompts', () => {
    expect(
      getCreateSurveyValidationError({
        title: 'Survey title',
        isStandaloneQuestion: false,
        questions: [{ prompt: 'First prompt' }, { prompt: '\n\t' }],
      }),
    ).toBe('Question 2 prompt cannot be blank.');
  });
});

describe('createQuestionsAndSurveysHelpers encryption payloads', () => {
  it('builds the Lit v1 encryption metadata shape with a primary gate and targets', () => {
    const gates = [
      { gateId: 'gate-a', label: 'Gate A' },
      { gateId: 'gate-b', label: 'Gate B' },
    ];

    expect(
      buildAuthoringEncryptionPayload({
        gates,
        targets: { questions: true, questionTags: true },
      }),
    ).toEqual({
      enabled: true,
      status: 'lit-v1',
      gate: gates[0],
      gates,
      targets: { questions: true, questionTags: true },
    });
  });

  it('omits the gates array and keeps empty targets when no gates are provided', () => {
    expect(buildAuthoringEncryptionPayload()).toEqual({
      enabled: true,
      status: 'lit-v1',
      gate: null,
      targets: {},
    });
  });

  it('matches submit-time empty field detection before encryption', () => {
    expect(isEncryptableFieldValueEmpty(undefined)).toBe(true);
    expect(isEncryptableFieldValueEmpty('   ')).toBe(true);
    expect(isEncryptableFieldValueEmpty([])).toBe(true);
    expect(isEncryptableFieldValueEmpty([''])).toBe(false);
    expect(isEncryptableFieldValueEmpty('value')).toBe(false);
  });

  it('combines Lit recipient conditions with OR separators', () => {
    const first = [{ contractAddress: '0x1' }];
    const second = [{ contractAddress: '0x2' }];

    expect(
      combineLitRecipientAccessControlConditions([
        { accessControlConditions: first, chain: 'optimismSepolia' },
        { accessControlConditions: [], chain: 'optimismSepolia' },
        { accessControlConditions: second, chain: 'baseSepolia' },
      ]),
    ).toEqual([...first, { operator: 'or' }, ...second]);
  });

  it('plans Lit gate objects and deduped recipients without executing crypto', () => {
    const buildSbtAccessControlConditions = jest.fn(({ sbtAddresses, chainId, litChain, mode }) => [
      {
        contractAddress: sbtAddresses[0],
        chain: litChain,
        chainId,
        mode,
      },
    ]);
    const resolveLitChain = jest.fn(({ chainId, litChain }) => litChain || `chain-${chainId}`);

    const plan = buildCreateSurveyGateObjectsAndRecipients({
      buildSbtAccessControlConditions,
      chainIdFallback: 11155420,
      gateIds: ['gate-a', 'missing', 'gate-b'],
      gateMap: {
        'gate-a': {
          label: 'Gate A',
          mode: 'all',
          sbtAddresses: ['0xAAA', '0xAAA'],
        },
        'gate-b': {
          name: 'Gate B',
          mode: 'all',
          sbtAddress: '0xAAA',
        },
      },
      resolveLitChain,
    });

    expect(plan.gates).toHaveLength(2);
    expect(plan.gates[0]).toEqual(
      expect.objectContaining({
        gateId: 'gate-a',
        label: 'Gate A',
        mode: 'all',
        sbtAddress: '0xAAA',
        sbtAddresses: ['0xAAA'],
        chainId: 11155420,
        litChain: 'chain-11155420',
        type: 'sbt',
      }),
    );
    expect(plan.gates[1]).toEqual(
      expect.objectContaining({
        gateId: 'gate-b',
        label: 'Gate B',
        color: stableGateColor('gate-b'),
      }),
    );
    expect(plan.recipients).toEqual([
      {
        accessControlConditions: [
          {
            contractAddress: '0xAAA',
            chain: 'chain-11155420',
            chainId: 11155420,
            mode: 'all',
          },
        ],
        chain: 'chain-11155420',
      },
    ]);
    expect(resolveLitChain).toHaveBeenCalledTimes(2);
    expect(buildSbtAccessControlConditions).toHaveBeenCalledTimes(2);
  });
});
