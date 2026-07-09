import { createSurveyQuestionsResponseGatePolicyRuntime } from './surveyQuestionsResponseGatePolicyRuntime';

const normalizeSessionSlugValue = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase();

describe('surveyQuestionsResponseGatePolicyRuntime', () => {
  it('builds response gate policy cache entries through the injected signature helper', () => {
    const cfg = {
      sessionName: 'Edge Session',
      contracts: {
        surveys: {
          chainId: 11155420,
        },
      },
    };
    const buildResponseGateConfigSignature = jest.fn(() => 'sig:edge');
    const buildResponseGatePolicy = jest.fn(() => ({
      recipients: [{ chain: 'optimismSepolia' }],
      allowFallbackConditions: false,
    }));
    const inst = {
      _responseGatePolicyCache: null,
    };

    const runtime = createSurveyQuestionsResponseGatePolicyRuntime({
      buildResponseGateConfigSignature,
      buildResponseGatePolicy,
      buildResponseGatePolicyCacheKeyFromInputs: jest.fn((input) =>
        [
          input.singleQuestionMode ? 'question' : 'survey',
          input.questionID || '',
          input.surveyId || '',
          input.hintedSessionSlug || '',
          input.effectiveSessionSlug || '',
          input.networkId || '',
        ].join('|'),
      ),
      getSessionSlugHintFromProps: jest.fn((props) => props.sessionSlug || ''),
      inst,
      normalizeSessionSlugValue,
      parseQuestionSessionSlugFromSearch: jest.fn(() => ''),
      propsRef: {
        current: {
          isStandalone: true,
          networkChainId: 11155420,
          questionID: 'Question-ABC',
          sessionSlug: 'Edge',
          singleQuestionMode: true,
          surveyId: 'Survey-Ignored',
        },
      },
      resolveEffectiveResponseGateConfig: jest.fn(() => cfg),
      resolveEffectiveSlug: jest.fn(() => 'fallback-edge'),
      resolveSessionChainId: jest.fn(() => 11155420),
      resolveSlugForIds: jest.fn(() => 'question-derived-edge'),
    });

    expect(runtime.getResponseGatePolicy()).toEqual({
      recipients: [{ chain: 'optimismSepolia' }],
      allowFallbackConditions: false,
    });

    expect(buildResponseGateConfigSignature).toHaveBeenCalledWith(cfg);
    expect(buildResponseGateConfigSignature).toHaveBeenCalledTimes(1);
    expect(buildResponseGatePolicy).toHaveBeenCalledWith({
      cfg,
      fallbackChainId: 11155420,
      isQuestionResponseFlow: true,
    });
    expect(inst._responseGatePolicyCache).toEqual(
      expect.objectContaining({
        cfg,
        cfgSignature: 'sig:edge',
        key: 'question|Question-ABC|Survey-Ignored|edge|edge|11155420',
        value: {
          recipients: [{ chain: 'optimismSepolia' }],
          allowFallbackConditions: false,
        },
      }),
    );
  });
});
