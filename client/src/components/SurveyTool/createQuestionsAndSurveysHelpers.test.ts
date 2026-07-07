import {
  buildCreateSurveyGateOptions,
  buildCreateSurveyNewQuestionDraft,
  buildCreateSurveyQuestionFieldUpdateList,
  buildCreateSurveyQuestionOptionList,
  buildCreateSurveySubmitGatePlan,
  buildCreateSurveyStandaloneToggleState,
  formatAiPromptModelLabel,
  getCreateSurveyValidationError,
  isMultichoiceQuestionType,
  normalizeAuthoringQuestionOptions,
  normalizePayloadQuestionOptions,
  removeDuplicateCreateSurveyQuestions,
  resolvePayloadSingleSelect,
  resolveQuestionSingleSelect,
} from './createQuestionsAndSurveysHelpers.js';
import { buildCreateSurveyHashValue } from './createQuestionsAndSurveysSignatureHelpers';

describe('createQuestionsAndSurveysHelpers question options', () => {
  it('keeps empty authoring option rows for multichoice drafts', () => {
    expect(normalizeAuthoringQuestionOptions('multichoice', ['Alpha', '', '  '])).toEqual(['Alpha', '', '  ']);
  });

  it('provides an empty authoring option list for multichoice drafts without options', () => {
    expect(normalizeAuthoringQuestionOptions('multichoice', undefined)).toEqual([]);
  });

  it('omits options for non-multichoice authoring drafts', () => {
    expect(normalizeAuthoringQuestionOptions('freeform', ['Alpha'])).toBeUndefined();
  });

  it('filters blank options only for submit and JSON payloads', () => {
    expect(normalizePayloadQuestionOptions('multichoice', ['Alpha', '', '  ', 'Beta'])).toEqual(['Alpha', 'Beta']);
  });

  it('rejects duplicate multichoice option labels during authoring validation', () => {
    expect(
      getCreateSurveyValidationError({
        title: 'Survey',
        questions: [
          {
            type: 'multichoice',
            prompt: 'Pick one',
            options: ['Alpha', 'Beta', ' alpha '],
          },
        ],
      }),
    ).toBe('Question 1 has duplicate multichoice option "alpha". Option labels must be unique.');
  });

  it('omits payload options when a multichoice question has no option array', () => {
    expect(normalizePayloadQuestionOptions('multichoice', undefined)).toBeUndefined();
  });

  it('updates multichoice draft options and regenerates the question id', () => {
    const generateQuestionId = jest.fn(
      (type, prompt, options, singleSelect) =>
        `${type}:${prompt}:${(options as unknown[]).join(',')}:${singleSelect ? 'one' : 'many'}`,
    );
    const questions = [
      {
        id: 'old-id',
        type: 'multichoice',
        prompt: 'Pick one',
        options: ['Alpha', 'Beta'],
        singleSelect: true,
      },
    ];

    const changed = buildCreateSurveyQuestionOptionList({
      generateQuestionId,
      operation: 'change',
      optionIndex: 1,
      questionIndex: 0,
      questions,
      value: 'Gamma',
    });
    expect(changed[0]).toMatchObject({
      id: 'multichoice:Pick one:Alpha,Gamma:one',
      options: ['Alpha', 'Gamma'],
    });
    expect(changed).not.toBe(questions);
    expect(changed[0]).not.toBe(questions[0]);

    const added = buildCreateSurveyQuestionOptionList({
      generateQuestionId,
      operation: 'add',
      questionIndex: 0,
      questions,
    });
    expect(added[0]).toMatchObject({
      id: 'multichoice:Pick one:Alpha,Beta,:one',
      options: ['Alpha', 'Beta', ''],
    });

    const removed = buildCreateSurveyQuestionOptionList({
      generateQuestionId,
      operation: 'remove',
      optionIndex: 0,
      questionIndex: 0,
      questions,
    });
    expect(removed[0]).toMatchObject({
      id: 'multichoice:Pick one:Beta:one',
      options: ['Beta'],
    });
  });

  it('updates question fields and only regenerates ids for identity fields', () => {
    const generateQuestionId = jest.fn(
      (type, prompt, options, singleSelect) =>
        `${type}:${prompt}:${(options as unknown[]).join(',')}:${singleSelect ? 'one' : 'many'}`,
    );
    const questions = [
      {
        id: 'old-id',
        type: 'multichoice',
        prompt: 'Pick one',
        options: ['Alpha'],
        singleSelect: false,
        associatedSurveyId: '',
      },
    ];

    const promptUpdated = buildCreateSurveyQuestionFieldUpdateList({
      generateQuestionId,
      key: 'prompt',
      questionIndex: 0,
      questions,
      value: 'Pick many',
    });
    expect(promptUpdated[0]).toMatchObject({
      id: 'multichoice:Pick many:Alpha:many',
      prompt: 'Pick many',
    });

    const surveyUpdated = buildCreateSurveyQuestionFieldUpdateList({
      generateQuestionId,
      key: 'associatedSurveyId',
      questionIndex: 0,
      questions,
      value: 'survey-1',
    });
    expect(surveyUpdated[0]).toMatchObject({
      id: 'old-id',
      associatedSurveyId: 'survey-1',
    });
    expect(surveyUpdated).not.toBe(questions);
    expect(surveyUpdated[0]).not.toBe(questions[0]);
  });

  it('builds new authoring question drafts with stable testable ui keys', () => {
    const generateQuestionId = jest.fn(
      (type, prompt, options, singleSelect) =>
        `${type}:${prompt}:${(options as unknown[]).join(',')}:${singleSelect ? 'one' : 'many'}`,
    );

    expect(
      buildCreateSurveyNewQuestionDraft({
        addingQuestionType: 'multichoice',
        generateQuestionId,
        isStandaloneQuestion: true,
        now: () => 12345,
        questionCount: 2,
        random: () => 0.5,
      }),
    ).toEqual({
      uiKey: 'new-2-12345-i',
      question: {
        id: 'multichoice:::many',
        uiKey: 'new-2-12345-i',
        type: 'multichoice',
        prompt: '',
        options: [],
        singleSelect: false,
        associatedSurveyId: '',
        tags: [],
        aiGeneratedTagsFromSource: [],
        currentTagInputValue: '',
        isGeneratingTags: false,
        lockGateIds: [],
      },
    });

    expect(
      buildCreateSurveyNewQuestionDraft({
        addingQuestionType: 'freeform',
        generateQuestionId,
        isStandaloneQuestion: false,
        now: () => 1,
        questionCount: 0,
        random: () => 0,
      })?.question,
    ).toMatchObject({
      type: 'freeform',
      options: undefined,
      singleSelect: undefined,
      lockGateIds: null,
    });

    expect(
      buildCreateSurveyNewQuestionDraft({
        addingQuestionType: 'Question Type',
      }),
    ).toBeNull();
  });

  it('builds standalone toggle state while normalizing question lock gates', () => {
    expect(
      buildCreateSurveyStandaloneToggleState({
        isStandaloneQuestion: false,
        surveyLockGateIds: [' survey-gate '],
        questions: [
          { id: 'q1', lockGateIds: null },
          { id: 'q2', lockGateIds: [' gate-a ', '', 'gate-b'] },
        ],
      }),
    ).toMatchObject({
      isStandaloneQuestion: true,
      surveyAddedSuccessfully: false,
      questionsAddedSuccessfully: false,
      submissionError: '',
      lastSubmittedSurveyId: '',
      lastSubmittedSurveyArweaveTxId: '',
      openLockKey: '',
      surveyLockGateIds: [],
      questions: [
        { id: 'q1', lockGateIds: [] },
        { id: 'q2', lockGateIds: ['gate-a', 'gate-b'] },
      ],
    });

    expect(
      buildCreateSurveyStandaloneToggleState({
        isStandaloneQuestion: true,
        surveyLockGateIds: [' survey-gate '],
        questions: [
          { id: 'q1', lockGateIds: [] },
          { id: 'q2', lockGateIds: [' gate-a '] },
          { id: 'q3', lockGateIds: null },
        ],
      }),
    ).toMatchObject({
      isStandaloneQuestion: false,
      surveyLockGateIds: ['survey-gate'],
      questions: [
        { id: 'q1', lockGateIds: null },
        { id: 'q2', lockGateIds: ['gate-a'] },
        { id: 'q3', lockGateIds: null },
      ],
    });
  });

  it('derives submit-time lock gates for survey and standalone modes', () => {
    const surveyPlan = buildCreateSurveySubmitGatePlan({
      defaultGateId: 'default-gate',
      gateMap: {
        'default-gate': {},
        'survey-gate': {},
        'question-gate': {},
      },
      isStandaloneQuestion: false,
      surveyLockGateIds: [],
      questions: [
        { id: 'q1', lockGateIds: null },
        { id: 'q2', lockGateIds: [' question-gate ', 'missing-gate'] },
      ],
    });

    expect(surveyPlan.defaultSubmitGateIds).toEqual(['default-gate']);
    expect(surveyPlan.resolvedSurveyLockGateIds).toEqual(['default-gate']);
    expect(surveyPlan.resolveQuestionSubmitGateIds({ id: 'q1', lockGateIds: null })).toEqual(['default-gate']);
    expect(
      surveyPlan.resolveQuestionSubmitGateIds({ id: 'q2', lockGateIds: [' question-gate ', 'missing-gate'] }),
    ).toEqual(['question-gate']);
    expect(surveyPlan.needsLit).toBe(true);

    const standalonePlan = buildCreateSurveySubmitGatePlan({
      defaultGateId: 'default-gate',
      gateMap: {
        'default-gate': {},
        'question-gate': {},
      },
      isStandaloneQuestion: true,
      surveyLockGateIds: ['default-gate'],
      questions: [
        { id: 'q1', lockGateIds: [] },
        { id: 'q1-public', lockGateIds: [], lockGateIdsTouched: true },
        { id: 'q2', lockGateIds: ['question-gate'] },
      ],
    });

    expect(standalonePlan.resolvedSurveyLockGateIds).toEqual([]);
    expect(standalonePlan.resolveQuestionSubmitGateIds({ id: 'q1', lockGateIds: [] })).toEqual(['default-gate']);
    expect(
      standalonePlan.resolveQuestionSubmitGateIds({ id: 'q1-public', lockGateIds: [], lockGateIdsTouched: true }),
    ).toEqual([]);
    expect(standalonePlan.resolveQuestionSubmitGateIds({ id: 'q-missing-lock' })).toEqual(['default-gate']);
    expect(standalonePlan.resolveQuestionSubmitGateIds({ id: 'q2', lockGateIds: ['question-gate'] })).toEqual([
      'question-gate',
    ]);
    expect(standalonePlan.needsLit).toBe(true);
  });

  it('derives authoring gate options for survey and standalone response resources', () => {
    const cfg = {
      sessionName: 'FOR TEST 12',
      __registry: {
        gateAuthority: 'onchain',
        gatesByResource: {
          surveyResponses: {
            gateId: 'survey_gate',
            sbtAddresses: ['0x1111111111111111111111111111111111111111'],
            lookupStatus: 'ok',
          },
          questionResponses: {
            gateId: 'question_gate',
            sbtAddresses: ['0x2222222222222222222222222222222222222222'],
            lookupStatus: 'ok',
          },
          default: {
            gateId: 'default_gate',
            sbtAddresses: ['0x3333333333333333333333333333333333333333'],
            lookupStatus: 'ok',
          },
          docUrls: {
            gateId: 'doc_gate',
            sbtAddresses: ['0x4444444444444444444444444444444444444444'],
            lookupStatus: 'ok',
          },
        },
      },
      sponsored: {
        gates: {
          survey_gate: {
            mode: 'all',
            sbtAddresses: ['0x1111111111111111111111111111111111111111'],
          },
          question_gate: {
            mode: 'any',
            sbtAddresses: ['0x2222222222222222222222222222222222222222'],
          },
          default_gate: {
            mode: 'any',
            sbtAddresses: ['0x3333333333333333333333333333333333333333'],
          },
          doc_gate: {
            mode: 'all',
            sbtAddresses: ['0x4444444444444444444444444444444444444444'],
          },
        },
      },
    };

    const surveyOptions = buildCreateSurveyGateOptions({
      cfg,
      isStandaloneQuestion: false,
      sessionLabel: 'FOR TEST 12',
    });
    expect(surveyOptions.defaultGateId).toBe('survey_gate');
    expect(surveyOptions.gateOptions.map((option) => option.id)).toEqual(['default_gate', 'survey_gate']);
    expect(surveyOptions.gateOptions.map((option) => option.displayLabel)).toEqual([
      'FOR TEST 12 (default)',
      'FOR TEST 12 (survey)',
    ]);
    expect(surveyOptions.gateOptions.find((option) => option.id === 'survey_gate')).toMatchObject({
      mode: 'all',
      resourceKey: 'surveyResponses',
      sbtAddress: '0x1111111111111111111111111111111111111111',
    });

    const standaloneOptions = buildCreateSurveyGateOptions({
      cfg,
      isStandaloneQuestion: true,
      sessionLabel: 'FOR TEST 12',
    });
    expect(standaloneOptions.defaultGateId).toBe('question_gate');
    expect(standaloneOptions.gateOptions.map((option) => option.id)).toEqual(['default_gate', 'question_gate']);
    expect(standaloneOptions.gateOptions.map((option) => option.displayLabel)).toEqual([
      'FOR TEST 12 (default)',
      'FOR TEST 12 (questions)',
    ]);
  });

  it('removes duplicate survey questions by id while preserving first occurrences', () => {
    const first = { id: 'q1', prompt: 'First' };
    const duplicate = { id: 'q1', prompt: 'Duplicate' };
    const missingId = { prompt: 'Missing id' };
    const secondMissingId = { prompt: 'Second missing id' };

    expect(
      removeDuplicateCreateSurveyQuestions([
        first,
        { id: 'q2', prompt: 'Second' },
        duplicate,
        missingId,
        secondMissingId,
      ]),
    ).toEqual([first, { id: 'q2', prompt: 'Second' }, missingId]);
    expect(removeDuplicateCreateSurveyQuestions([])).toEqual([]);
  });
});

describe('createQuestionsAndSurveysHelpers single-select selection', () => {
  it('recognizes the canonical multichoice type without widening legacy comparisons', () => {
    expect(isMultichoiceQuestionType('multichoice')).toBe(true);
    expect(isMultichoiceQuestionType(' MultiChoice ')).toBe(false);
    expect(isMultichoiceQuestionType('binary')).toBe(false);
  });

  it('normalizes legacy oneSelectionOnly into singleSelect for authoring state', () => {
    expect(resolveQuestionSingleSelect({ oneSelectionOnly: true })).toBe(true);
    expect(resolveQuestionSingleSelect({ singleSelect: false, oneSelectionOnly: false })).toBe(false);
  });

  it('emits payload singleSelect only for multichoice questions', () => {
    expect(resolvePayloadSingleSelect('multichoice', true)).toBe(true);
    expect(resolvePayloadSingleSelect('freeform', true)).toBeUndefined();
  });
});

describe('createQuestionsAndSurveysHelpers AI prompt labels', () => {
  it('formats known provider and model labels', () => {
    expect(formatAiPromptModelLabel({ provider: 'openai', model: 'gpt-4o' })).toBe('OpenAI gpt-4o');
    expect(formatAiPromptModelLabel({ provider: 'anthropic', model: 'claude-sonnet' })).toBe('Anthropic claude-sonnet');
  });

  it('falls back to provider, model, or configured model text', () => {
    expect(formatAiPromptModelLabel({ provider: 'custom', model: '' })).toBe('Custom');
    expect(formatAiPromptModelLabel({ provider: '', model: 'local-model' })).toBe('local-model');
    expect(formatAiPromptModelLabel({ provider: 'bespoke', model: 'model-a' })).toBe('Bespoke model-a');
    expect(formatAiPromptModelLabel({})).toBe('Configured model');
  });
});

describe('createQuestionsAndSurveysHelpers survey signatures', () => {
  it('builds survey hash values from title and sanitized document URLs', () => {
    const digest = jest.fn((value: unknown) => ({
      toString: () => `digest:${value}`,
    }));
    const scriptUrl = ['java', 'script:alert(1)'].join('');

    expect(
      buildCreateSurveyHashValue({
        digest,
        documentURLs: [' https://docs.example/a ', 'HTTPS://docs.example/a', '/local/doc', scriptUrl],
        title: 'Survey title',
      }),
    ).toBe('0xdigest:{"title":"Survey title","documentURLs":["https://docs.example/a","/local/doc"]}');

    expect(digest).toHaveBeenCalledWith(
      JSON.stringify({
        title: 'Survey title',
        documentURLs: ['https://docs.example/a', '/local/doc'],
      }),
    );
  });

  it('keeps standalone question mode hashless without calling the digest', () => {
    const digest = jest.fn((value: unknown) => ({
      toString: () => `digest:${value}`,
    }));

    expect(
      buildCreateSurveyHashValue({
        digest,
        isStandaloneQuestion: true,
        title: 'Standalone prompt',
      }),
    ).toBe('');
    expect(digest).not.toHaveBeenCalled();
  });
});
