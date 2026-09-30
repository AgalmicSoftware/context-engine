import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SessionVoiceModeModal from './SessionVoiceModeModal';
import { createSurveyQuestionsResponseEditingRuntime } from './surveyQuestionsResponseEditingRuntime';
import { buildAdditionalUpdatePlan, buildAnswerUpdatePlan } from './surveyToolResponseMutationController';
import { responseValuesEqual } from './responseValueEquality';
import { getQuestionConvictionSliderValue, getQuestionImportanceSliderValue } from './surveyToolSliderState';
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

// The pile's real importance/conviction mutation path, as wired at
// SurveyPileViewMode.tsx onApplyImportance/onApplyConviction (engine.handleImportance / handleConviction).
const createPileRuntime = () => {
  const stateRef: { current: Record<string, any> } = {
    current: { surveysResponseState: [{ answers: {}, additionalComments: {}, importance: {}, conviction: {} }] },
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
    buildInheritedAdditionalFieldState: (add: object) => ({ ...add, audienceMode: 'inherit' }),
    buildSurveyUserEditResponseStatePatch: (surveysResponseState: unknown) => ({ surveysResponseState }),
    getEffectiveRecipientsForQid: () => [],
    getQuestionById: (qid: string) => ({ id: qid, type: 'binary' }),
    inst: { _draftDirtyQids: new Set<string>() },
    invalidateDiffCaches: () => {},
    isQuestionLockedForResponse: () => false,
    normalizeFieldAudienceMode: (value: string) => value || 'explicit',
    normalizeQuestionIdKey: (value: unknown) =>
      String(value || '')
        .trim()
        .toLowerCase(),
    persistDraftSafely: () => {},
    propsRef: { current: { isStandalone: false, singleQuestionMode: false } },
    resolveFieldEncryptionAudience: () => 'self',
    resolveFieldEncryptionGateId: () => null,
    scheduleJsonPreviewUpdate: () => {},
    setState: (updater: any, callback?: () => void) => {
      const patch = typeof updater === 'function' ? updater(stateRef.current) : updater;
      stateRef.current = { ...stateRef.current, ...patch };
      callback?.();
    },
    stateRef,
    updateSubmittedSinceLastEdit: () => false,
    utils: { keccak256: () => '0xhash', toUtf8Bytes: (value: string) => value },
    valuesEqual: (a: unknown, b: unknown) => responseValuesEqual(a, b, true),
  });
  return { stateRef, runtime };
};

it('interview importance/conviction land on the pile slider scale the reviewer saw', async () => {
  const { stateRef, runtime } = createPileRuntime();
  const onSubmitResponses = jest.fn().mockResolvedValue({ status: 'submitted' });
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
      questionPool={[{ id: 'q1', prompt: 'Proceed?', type: 'binary' }]}
      prefillPacket={{
        version: 1,
        sessionSlug: 'demo',
        questionSetHash: 'a'.repeat(64),
        promptVersion: 'ce-interview-brief-v4',
        source: { platform: 'claude', modelId: 'claude-example', verification: 'self_reported' },
        responderContext: {},
        // The documented prefill contract: importance/conviction range 0-100.
        responses: [{ questionId: 'q1', answer: 'Agree', importance: 60, conviction: 80, confidence: 0.8 }],
      }}
      onApplyAnswer={(questionId: string, answer: unknown) =>
        new Promise<void>((resolve) =>
          runtime.handleAnswer(0, questionId, answer, { persistDraft: false, afterUpdate: resolve }),
        )
      }
      onApplyAdditional={jest.fn()}
      onApplyImportance={(questionId: string, importance: number) =>
        new Promise<void>((resolve) =>
          runtime.handleImportance(0, questionId, importance, { persistDraft: false, afterUpdate: resolve }),
        )
      }
      onApplyConviction={(questionId: string, conviction: number) =>
        new Promise<void>((resolve) =>
          runtime.handleConviction(0, questionId, conviction, { persistDraft: false, afterUpdate: resolve }),
        )
      }
      onRecordProvenance={jest.fn()}
      onSubmitResponses={onSubmitResponses}
    />,
  );
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  // The review card shows the AI proposal on the shared 0-10 conviction/importance slider.
  fireEvent.click(screen.getByRole('button', { name: 'Conviction / importance' }));
  expect(screen.getByRole('button', { name: /Conviction/ })).toHaveTextContent('8');
  expect(screen.getByRole('slider')).toHaveValue('8');

  fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
  await waitFor(() => expect(onSubmitResponses).toHaveBeenCalledTimes(1));

  // After submit the pile (and the uploaded payload, surveyToolResponsePayloadController.ts:248-250)
  // reads these raw values back on its 0-10 slider (ConvictionImportanceSliderControl min 0 / max 10).
  const slice = stateRef.current.surveysResponseState[0];
  expect(getQuestionConvictionSliderValue(slice, 'q1')).toBe(8);
  expect(getQuestionImportanceSliderValue(slice, 'q1')).toBe(6);
});
