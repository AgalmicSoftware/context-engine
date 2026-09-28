import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SessionVoiceModeModal from './SessionVoiceModeModal';
import { applySessionInterviewAnswer } from './SurveyPileViewMode';
import type { PileViewModeEngine } from './surveyPileRuntimeBinding';
import { createSurveyQuestionsResponseEditingRuntime } from './surveyQuestionsResponseEditingRuntime';
import { buildAdditionalUpdatePlan, buildAnswerUpdatePlan } from './surveyToolResponseMutationController';
import { responseValuesEqual } from './responseValueEquality';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

jest.mock('./SessionInterviewRecommendedGroups', () => ({ __esModule: true, default: () => null }));
jest.mock('./useSessionInterviewGroupRecommendations', () => ({
  useSessionInterviewGroupRecommendations: jest.fn(() => ({ availability: 'idle', recommendations: [] })),
}));
jest.mock('./CreateQuestionsAndSurveys', () => ({ __esModule: true, default: () => null }));
jest.mock('./useInterviewReadiness', () => ({
  useInterviewReadiness: jest.fn(() => ({ state: 'ready', detail: 'Voice setup ready.', retry: jest.fn() })),
}));
jest.mock('./useInterviewOpening', () => ({
  useInterviewOpening: () => ({ opening: '', notice: '', loading: false }),
}));
jest.mock('./SessionListeningPanel', () => ({
  __esModule: true,
  default: () => null,
  SessionListeningWaveform: () => null,
  formatSessionRecordingElapsed: (seconds: number) => `0:${seconds}`,
}));
jest.mock('./sessionInterview', () => {
  const actual = jest.requireActual<typeof import('./sessionInterview')>('./sessionInterview');
  return {
    ...actual,
    hashInterviewQuestions: jest.fn(async () => 'a'.repeat(64)),
    mapInterviewEvidenceToResponses: jest.fn(),
  };
});
jest.mock('../../utilities/worker/corsProxy.js', () => ({
  getCorsProxyUrlOrThrow: jest.fn(async () => 'https://worker.example'),
}));
jest.mock('../../utilities/audio/realtimeInterviewClient', () => ({ startSessionRealtimeInterview: jest.fn() }));

type PileState = { surveysResponseState: Array<{ answers: Record<string, { value?: unknown }> }> };

// The pile's real answer mutation path: handleAnswer -> buildAnswerUpdatePlan,
// including the binary "same value clears the answer" toggle.
const createPileEngine = () => {
  const stateRef: { current: PileState } = {
    current: { surveysResponseState: [{ answers: {} }] },
  };
  const runtime = createSurveyQuestionsResponseEditingRuntime({
    buildAnswerUpdatePlan,
    buildAdditionalUpdatePlan,
    buildEmptyResponseFieldState: () => ({
      value: '',
      encrypted: false,
      encryptionAudience: 'self',
      encryptionGateId: null,
      audienceMode: 'explicit',
      hash: '',
      encryptedPortion: '',
    }),
    buildInheritedAdditionalFieldState: (additional: object) => ({ ...additional, audienceMode: 'inherit' }),
    buildSurveyUserEditResponseStatePatch: (surveysResponseState: unknown) => ({ surveysResponseState }),
    getEffectiveRecipientsForQid: () => [],
    getQuestionById: (questionId: string) => ({ id: questionId, type: 'binary' }),
    inst: { _draftDirtyQids: new Set<string>() },
    invalidateDiffCaches: () => {},
    isQuestionLockedForResponse: () => false,
    normalizeFieldAudienceMode: (value: string) => value || 'explicit',
    normalizeQuestionIdKey: (value: unknown) => String(value || '').trim(),
    persistDraftSafely: () => {},
    propsRef: { current: { isStandalone: false, singleQuestionMode: false } },
    resolveFieldEncryptionAudience: () => 'self',
    resolveFieldEncryptionGateId: () => null,
    scheduleJsonPreviewUpdate: () => {},
    setState: (updater: unknown, callback?: () => void) => {
      const patch = typeof updater === 'function' ? updater(stateRef.current) : updater;
      stateRef.current = { ...stateRef.current, ...patch };
      callback?.();
    },
    stateRef,
    updateSubmittedSinceLastEdit: () => false,
    utils: { keccak256: () => '0xhash', toUtf8Bytes: (value: string) => value },
    valuesEqual: (a: unknown, b: unknown) => responseValuesEqual(a, b, true),
  });
  const engine = {
    get state() {
      return stateRef.current;
    },
    valuesEqual: (a: unknown, b: unknown) => responseValuesEqual(a, b, true),
    handleAnswerPile: (questionId: string, answer: unknown, options?: object) =>
      runtime.handleAnswer(0, questionId, answer, options),
  } as unknown as PileViewModeEngine;
  const answerOf = (questionId: string) => stateRef.current.surveysResponseState[0].answers[questionId]?.value;
  return { engine, answerOf };
};

const renderBinaryInterview = (
  engine: PileViewModeEngine,
  onSubmitResponses: React.ComponentProps<typeof SessionVoiceModeModal>['onSubmitResponses'],
) =>
  render(
    <SessionVoiceModeModal
      isOpen
      mode="interview"
      onSelectMode={jest.fn()}
      onClose={jest.fn()}
      toggleLoginModal={jest.fn()}
      sessionSlug="demo"
      account="0x0000000000000000000000000000000000000001"
      loginComplete
      workerUrl="https://worker.example"
      questionPool={[{ id: 'q-binary', prompt: 'Proceed?', type: 'binary' }]}
      prefillPacket={{
        version: 1,
        sessionSlug: 'demo',
        questionSetHash: 'a'.repeat(64),
        promptVersion: 'ce-interview-brief-v4',
        source: { platform: 'claude', modelId: 'claude-example', verification: 'self_reported' },
        responderContext: {},
        responses: [{ questionId: 'q-binary', answer: 'Agree', confidence: 0.65 }],
      }}
      onApplyAnswer={(questionId, answer) => applySessionInterviewAnswer(engine, questionId, answer)}
      onApplyAdditional={jest.fn()}
      onApplyImportance={jest.fn()}
      onApplyConviction={jest.fn()}
      onRecordProvenance={jest.fn()}
      onSubmitResponses={onSubmitResponses}
    />,
  );

describe('interview draft resubmission', () => {
  it('keeps a binary draft when Submit is retried after a cancelled signature', async () => {
    const { engine, answerOf } = createPileEngine();
    const onSubmitResponses = jest
      .fn()
      .mockResolvedValueOnce({ status: 'failed', message: 'Signature cancelled.' })
      .mockResolvedValue({ status: 'submitted' });
    renderBinaryInterview(engine, onSubmitResponses);

    expect(await screen.findByLabelText('Agree')).toBeChecked();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
    await screen.findByText('Signature cancelled.');
    expect(answerOf('q-binary')).toBe('Agree');

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
    await waitFor(() => expect(onSubmitResponses).toHaveBeenCalledTimes(2));
    expect(answerOf('q-binary')).toBe('Agree');
  });

  it('keeps a binary draft that is removed, restored and submitted again', async () => {
    const { engine, answerOf } = createPileEngine();
    const onSubmitResponses = jest.fn().mockResolvedValue({ status: 'submitted' });
    renderBinaryInterview(engine, onSubmitResponses);

    expect(await screen.findByLabelText('Agree')).toBeChecked();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
    await waitFor(() => expect(onSubmitResponses).toHaveBeenCalledTimes(1));
    expect(answerOf('q-binary')).toBe('Agree');

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_DRAFT_REMOVE));
    fireEvent.click(screen.getByRole('button', { name: 'Restore draft' }));
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
    await waitFor(() => expect(onSubmitResponses).toHaveBeenCalledTimes(2));
    expect(answerOf('q-binary')).toBe('Agree');
  });

  it('applies drafts idempotently while still applying changed values', async () => {
    const { engine, answerOf } = createPileEngine();

    await applySessionInterviewAnswer(engine, 'q-binary', 'Agree');
    expect(answerOf('q-binary')).toBe('Agree');
    await applySessionInterviewAnswer(engine, 'q-binary', 'Agree');
    expect(answerOf('q-binary')).toBe('Agree');

    await applySessionInterviewAnswer(engine, 'q-binary', 'Disagree');
    expect(answerOf('q-binary')).toBe('Disagree');
  });

  it('leaves the ordinary binary input toggle unchanged', () => {
    const { engine, answerOf } = createPileEngine();

    engine.handleAnswerPile('q-binary', 'Agree', { persistDraft: false });
    expect(answerOf('q-binary')).toBe('Agree');
    engine.handleAnswerPile('q-binary', 'Agree', { persistDraft: false });
    expect(answerOf('q-binary')).toBe('');
  });
});
