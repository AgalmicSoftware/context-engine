import { createSurveyQuestionsLockAudienceRuntime } from './surveyQuestionsLockAudienceRuntime';

describe('surveyQuestionsLockAudienceRuntime', () => {
  it('derives lock audience display state with normalized keys and expanded gate details', () => {
    const buildLockAudienceDisplayState = jest.fn((input) => ({
      ...input,
      effectiveFieldKey: input.fieldKey,
      hasAudienceMenu: true,
    }));
    const runtime = createSurveyQuestionsLockAudienceRuntime({
      SurveyQuestionsLockAudienceControl: () => null,
      buildLockAudienceDisplayState,
      buildLockAudienceGateDetailsState: jest.fn(),
      buildLockAudienceMenuState: jest.fn(),
      isQuestionLockedForResponse: jest.fn(() => true),
      normalizeFieldAudienceMode: jest.fn(() => 'inherit'),
      normalizeGateLabelText: jest.fn((value) => String(value || '').trim()),
      resolveFieldEncryptionAudience: jest.fn(() => 'gate'),
      resolveFieldEncryptionGateId: jest.fn(() => 'gate-a'),
      resolveQuestionGateOption: jest.fn(() => ({
        gateDetails: [{ gateId: 'gate-a', label: 'Gate A' }],
      })),
      stateRef: {
        current: {
          lockAudienceGateDetailsByQuestion: {
            'q1:additional': ' gate-a ',
          },
          lockAudienceMenuByQuestion: {
            'q1:additional': true,
          },
        },
      },
    });

    expect(
      runtime.getLockAudienceDisplayState({
        questionId: 'Q1',
        fieldKey: 'additional',
        field: { encrypted: true, audienceMode: 'inherit' },
        selfAudienceLabel: ' only me ',
      }),
    ).toEqual(
      expect.objectContaining({
        currentAudience: 'gate',
        currentAudienceMode: 'inherit',
        currentGateId: 'gate-a',
        effectiveFieldKey: 'additional',
        expandedGateId: 'gate-a',
        menuOpen: true,
      }),
    );
    expect(buildLockAudienceDisplayState).toHaveBeenCalledWith(
      expect.objectContaining({
        fieldKey: 'additional',
        forcedGate: true,
        hasGateOption: true,
        menuOpen: true,
        questionId: 'q1',
        selfAudienceLabel: 'only me',
      }),
    );
  });

  it('routes lock audience menu toggles through the normalized state key', () => {
    const buildLockAudienceMenuState = jest.fn((prev, key, forceOpen) => ({
      ...prev,
      lockAudienceMenuByQuestion: {
        ...(prev.lockAudienceMenuByQuestion || {}),
        [key]: forceOpen,
      },
    }));
    const setState = jest.fn((updater) => updater({ lockAudienceMenuByQuestion: {} }));
    const runtime = createSurveyQuestionsLockAudienceRuntime({
      SurveyQuestionsLockAudienceControl: () => null,
      buildLockAudienceGateDetailsState: jest.fn(),
      buildLockAudienceMenuState,
      normalizeGateLabelText: jest.fn((value) => String(value || '').trim()),
      setState,
      stateRef: {
        current: {
          lockAudienceMenuByQuestion: {},
        },
      },
    });

    runtime.toggleLockAudienceMenu('Q1', true, 'additional');

    expect(buildLockAudienceMenuState).toHaveBeenCalledWith({ lockAudienceMenuByQuestion: {} }, 'q1:additional', true);
  });
});
