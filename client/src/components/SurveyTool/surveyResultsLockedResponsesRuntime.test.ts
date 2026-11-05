import { clearDecryptCaches } from '../../utilities/crypto/cryptography';
import { buildSurveyResultsHtmlReportAnswersForExport } from './surveyResultsHtmlReportDataModel';
import { createSurveyResultsLockedResponsesRuntime } from './surveyResultsLockedResponsesRuntime';
import { createInitialSurveyResultsState } from './surveyResultsState';
import type { SurveyResultsProps } from './SurveyResults';

const sessionConfig = { sessionId: 'example-session-id', corsWorkerUrl: 'https://worker.example' };

type DecryptPort = Parameters<typeof createSurveyResultsLockedResponsesRuntime>[0]['ports']['decryptEnvelopeValue'];

const lockedRow = (responder: string, extra: Record<string, unknown> = {}) => ({
  responder,
  response: {
    questionID: 'q1',
    answer: {
      value: '*',
      encrypted: true,
      encryptionAudience: 'self_admin',
      encryptedPortion: '{"v":1,"recipients":[]}',
    },
    ...extra,
  },
});

const runtimeState: { current: Record<string, unknown> } = { current: {} };

const buildRuntime = (
  decryptEnvelopeValue: DecryptPort,
  applyStatePatch = jest.fn(),
  rows = [lockedRow('0x1111111111111111111111111111111111111111', { importanceEncrypted: '{"v":1,"recipients":[]}' })],
) => {
  const props: SurveyResultsProps = {
    account: '0x2222222222222222222222222222222222222222',
    loginComplete: true,
    network: { id: 11155420 },
    provider: 'admin-provider',
  };
  const state = {
    ...createInitialSurveyResultsState(props),
    viewMode: 'questions',
    sbtFilteredAggregatorQuestionResponses: { q1: rows },
  };
  runtimeState.current = state;
  return createSurveyResultsLockedResponsesRuntime({
    instance: { _lockedResponsesModelMemo: {} },
    ports: {
      applyStatePatch,
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
  it('gives a report the answer this reader decrypted, under the key the decrypt saved it', async () => {
    const responder = '0x1111111111111111111111111111111111111111';
    const row = lockedRow(responder);
    const runtime = buildRuntime(
      jest.fn<ReturnType<DecryptPort>, Parameters<DecryptPort>>().mockResolvedValue('Agree'),
      jest.fn((patch) => Object.assign(runtimeState.current, patch)),
      [row],
    );
    const report = () =>
      buildSurveyResultsHtmlReportAnswersForExport({
        aggregatorQuestionResponses: { q1: [row] },
        applyDecryptedOverride: (response, who, questionId, surveyId) =>
          runtime.applyDecryptedOverrideToRow(response, who, questionId, surveyId),
      });

    expect(report()).toEqual([]);
    await runtime.handleDecryptLockedResponses();
    expect(report()).toEqual([{ questionId: 'q1', responder, answer: 'Agree', comment: '' }]);
  });

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
  it('drops values decrypted for an account that changed while the decrypt was running', async () => {
    let release: () => void = () => {};
    const unlocked = new Promise<void>((resolve) => (release = resolve));
    const decryptEnvelopeValue = jest.fn<ReturnType<DecryptPort>, Parameters<DecryptPort>>(async () => {
      await unlocked;
      return 'previous reader plaintext';
    });
    const applyStatePatch = jest.fn();
    const run = buildRuntime(decryptEnvelopeValue, applyStatePatch).handleDecryptLockedResponses();
    await Promise.resolve();
    // AppShell clears the decrypt caches on every account change and sign-out.
    clearDecryptCaches();
    release();
    await run;

    expect(decryptEnvelopeValue).toHaveBeenCalled();
    expect(applyStatePatch.mock.calls.map(([patch]) => patch)).toEqual([
      { lockedResponsesDecrypting: true, alertMessage: '' },
    ]);
  });
  it('asks the new account to decrypt nothing once the account changes', async () => {
    const decryptEnvelopeValue = jest.fn<ReturnType<DecryptPort>, Parameters<DecryptPort>>(async () => {
      // AppShell clears the decrypt caches on every account change and sign-out.
      clearDecryptCaches();
      return 'previous reader plaintext';
    });
    const rows = ['0x1111111111111111111111111111111111111111', '0x3333333333333333333333333333333333333333'].map(
      (responder) => lockedRow(responder),
    );

    await buildRuntime(decryptEnvelopeValue, jest.fn(), rows).handleDecryptLockedResponses();

    expect(decryptEnvelopeValue).toHaveBeenCalledTimes(1);
  });
});
