import React from 'react';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import SessionVoiceModeModal from './SessionVoiceModeModal';
import { useSessionAgentUse } from './SessionInterviewAgentUse';
import { readSessionAgentStatus, setSessionAgentOptOut } from '../OnePageSession/sessionAgentRequests';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

jest.mock('../OnePageSession/sessionAgentRequests', () => ({
  readSessionAgentStatus: jest.fn(),
  setSessionAgentOptOut: jest.fn(),
}));
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

const readStatus = jest.mocked(readSessionAgentStatus);
const setOptOut = jest.mocked(setSessionAgentOptOut);
const ACCOUNT = '0x0000000000000000000000000000000000000001';
const AGENT_ON = { sessionAgent: { audiences: [] } };
const status = (optedOut = false, on = true) => ({ on, answers: null, audience: null, optedOut });

const renderReview = (sessionConfig: Record<string, unknown>) => {
  const onSubmitResponses = jest.fn(async () => ({ status: 'submitted' as const }));
  render(
    <SessionVoiceModeModal
      isOpen
      mode="interview"
      onSelectMode={jest.fn()}
      onClose={jest.fn()}
      sessionSlug="demo"
      sessionConfig={sessionConfig}
      account={ACCOUNT}
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
        responses: [{ questionId: 'q1', answer: 'Agree', confidence: 0.8 }],
      }}
      onApplyAnswer={jest.fn()}
      onApplyAdditional={jest.fn()}
      onApplyImportance={jest.fn()}
      onApplyConviction={jest.fn()}
      onRecordProvenance={jest.fn()}
      onSubmitResponses={onSubmitResponses}
    />,
  );
  return { onSubmitResponses };
};

// Only these two: the other mocks keep the implementations their factories gave them.
afterEach(() => {
  readStatus.mockReset();
  setOptOut.mockReset();
});

it('says nothing about the Session Agent on a session without one', async () => {
  renderReview({});
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  expect(screen.queryByTestId('ce-interview-session-agent-use')).not.toBeInTheDocument();
  expect(readStatus).not.toHaveBeenCalled();
});

it('shows the Session Agent line in the interview dialog while it is on, with the switch as the person left it', async () => {
  readStatus.mockResolvedValue(status(true));
  renderReview(AGENT_ON);
  const use = await screen.findByLabelText('Session Agent may use my answers and files');
  // Before the Worker answers, it is on, as it is for everyone who hasn't said otherwise.
  await waitFor(() => expect(use).not.toBeChecked());
  expect(readStatus).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('ce-session-agent-notice-switch')).toHaveAccessibleDescription(
    expect.stringContaining('never naming you'),
  );
});

it('hides the line once an admin has turned the Session Agent off', async () => {
  readStatus.mockResolvedValue(status(false, false));
  renderReview(AGENT_ON);
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  await waitFor(() => expect(screen.queryByTestId('ce-interview-session-agent-use')).not.toBeInTheDocument());
});

it('saves a choice at once, and submits nothing until a choice that failed to save is saved', async () => {
  readStatus.mockResolvedValue(status());
  const { onSubmitResponses } = renderReview(AGENT_ON);
  const use = await screen.findByLabelText('Session Agent may use my answers and files');
  expect(use).toBeChecked();
  setOptOut.mockRejectedValueOnce(new Error('down'));
  fireEvent.click(use);
  expect(await screen.findByRole('alert')).toHaveTextContent('Not saved. Try again.');
  expect(setOptOut).toHaveBeenLastCalledWith(true, expect.objectContaining({ sessionSlug: 'demo', account: ACCOUNT }));
  expect(use).not.toBeChecked();

  // Submit tries the save again first; while it fails, no answer goes in.
  setOptOut.mockRejectedValueOnce(new Error('still down'));
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
  await waitFor(() => expect(setOptOut).toHaveBeenCalledTimes(2));
  expect(await screen.findByText(/so nothing was submitted/)).toBeInTheDocument();
  expect(onSubmitResponses).not.toHaveBeenCalled();

  setOptOut.mockResolvedValueOnce(true);
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
  await waitFor(() => expect(onSubmitResponses).toHaveBeenCalledTimes(1));
  expect(setOptOut).toHaveBeenCalledTimes(3);
  expect(screen.queryByText('Not saved. Try again.')).not.toBeInTheDocument();
});

it('holds a choice made before sign-in and saves it once signed in, ahead of the answers', async () => {
  readStatus.mockResolvedValue(status());
  const { result, rerender } = renderHook(
    ({ account }) => useSessionAgentUse({ sessionSlug: 'demo', sessionConfig: AGENT_ON, account }),
    { initialProps: { account: '' } },
  );
  expect(result.current.shown).toBe(true);
  act(() => result.current.change(false));
  expect(result.current.allowed).toBe(false);
  expect(setOptOut).not.toHaveBeenCalled();
  expect(await result.current.settle()).toBe(true);

  rerender({ account: ACCOUNT });
  // The Worker still has them in; their choice here stands.
  await waitFor(() => expect(readStatus).toHaveBeenCalledTimes(1));
  expect(result.current.allowed).toBe(false);
  setOptOut.mockResolvedValueOnce(true);
  let settled = false;
  await act(async () => {
    settled = await result.current.settle();
  });
  expect(settled).toBe(true);
  expect(setOptOut).toHaveBeenCalledWith(true, expect.objectContaining({ account: ACCOUNT }));
  // Saved, so a second submit saves nothing again.
  await act(async () => {
    await result.current.settle();
  });
  expect(setOptOut).toHaveBeenCalledTimes(1);
});
