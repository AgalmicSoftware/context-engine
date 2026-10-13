import { createSurveyResultsLockedResponsesRuntime } from './surveyResultsLockedResponsesRuntime';
import { createInitialSurveyResultsState } from './surveyResultsState';
import type { SurveyResultsProps } from './SurveyResults';

const sessionConfig = { sessionId: 'example-session-id', corsWorkerUrl: 'https://worker.example' };

type DecryptPort = Parameters<typeof createSurveyResultsLockedResponsesRuntime>[0]['ports']['decryptEnvelopeValue'];

const buildRuntime = (decryptEnvelopeValue: DecryptPort) => {
  const props: SurveyResultsProps = {
    account: '0x2222222222222222222222222222222222222222',
    loginComplete: true,
    network: { id: 11155420 },
    provider: 'admin-provider',
  };
  const state = {
    ...createInitialSurveyResultsState(props),
    viewMode: 'questions',
    sbtFilteredAggregatorQuestionResponses: {
      q1: [
        {
          responder: '0x1111111111111111111111111111111111111111',
          response: {
            questionID: 'q1',
            answer: {
              value: '*',
              encrypted: true,
              encryptionAudience: 'self_admin',
              encryptedPortion: '{"v":1,"recipients":[]}',
            },
            importanceEncrypted: '{"v":1,"recipients":[]}',
          },
        },
      ],
    },
  };
  return createSurveyResultsLockedResponsesRuntime({
    instance: { _lockedResponsesModelMemo: {} },
    ports: {
      applyStatePatch: jest.fn(),
      decryptEnvelopeValue,
      getEffectiveSessionContext: () => ({ sessionConfig, sessionSlug: 'example' }),
      getEffectiveSlug: () => 'example',
      getNetworkQuestionsForCurrentContext: () => ({}),
      getProps: () => props,
      getState: () => state,
      logWarn: jest.fn(),
      resolveSbtDisplayLabel: () => '',
      resolveSessionContext: () => ({ sessionConfig, sessionSlug: 'example' }),
    },
  });
};

describe('SurveyResults locked response decrypt', () => {
  it('passes the verified session context so Worker-held keys can unwrap', async () => {
    const decryptEnvelopeValue = jest.fn<ReturnType<DecryptPort>, Parameters<DecryptPort>>().mockResolvedValue('7');
    await buildRuntime(decryptEnvelopeValue).handleDecryptLockedResponses();

    // One call for the answer and one for the importance envelope.
    expect(decryptEnvelopeValue).toHaveBeenCalledTimes(2);
    decryptEnvelopeValue.mock.calls.forEach(([, options]) => {
      expect(options).toEqual(
        expect.objectContaining({
          account: '0x2222222222222222222222222222222222222222',
          chainId: 11155420,
          providerLike: 'admin-provider',
          sessionConfig,
          sessionSlug: 'example',
        }),
      );
    });
  });
  it('binds rating decrypts to the rating and question they were encrypted for', async () => {
    const decryptEnvelopeValue = jest.fn<ReturnType<DecryptPort>, Parameters<DecryptPort>>().mockResolvedValue('7');
    await buildRuntime(decryptEnvelopeValue).handleDecryptLockedResponses();

    const [[, answerOptions], [, importanceOptions]] = decryptEnvelopeValue.mock.calls;
    expect(answerOptions).not.toHaveProperty('expectedQId');
    expect(importanceOptions).toEqual(expect.objectContaining({ expectedQId: 'importance:q1' }));
  });
});
