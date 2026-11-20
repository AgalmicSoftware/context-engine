import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SessionVoiceModeModal from '../SurveyTool/SessionVoiceModeModal';
import SessionAgentUseOption from './SessionAgentUseOption';
import { readSessionAgentStatus, setSessionAgentOptOut } from './sessionAgentRequests';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

jest.mock('./sessionAgentRequests', () => ({
  readSessionAgentStatus: jest.fn(),
  setSessionAgentOptOut: jest.fn(),
}));
jest.mock('../SurveyTool/SessionInterviewRecommendedGroups', () => ({ __esModule: true, default: () => null }));
jest.mock('../SurveyTool/useSessionInterviewGroupRecommendations', () => ({
  useSessionInterviewGroupRecommendations: jest.fn(() => ({ availability: 'idle', recommendations: [] })),
}));
jest.mock('../SurveyTool/CreateQuestionsAndSurveys', () => ({ __esModule: true, default: () => null }));
jest.mock('../SurveyTool/useInterviewReadiness', () => ({
  useInterviewReadiness: jest.fn(() => ({ state: 'ready', detail: 'Voice setup ready.', retry: jest.fn() })),
}));
jest.mock('../SurveyTool/useInterviewOpening', () => ({
  useInterviewOpening: () => ({ opening: '', notice: '', loading: false }),
}));
jest.mock('../SurveyTool/SessionListeningPanel', () => ({
  __esModule: true,
  default: () => null,
  SessionListeningWaveform: () => null,
  formatSessionRecordingElapsed: (seconds: number) => `0:${seconds}`,
}));
jest.mock('../SurveyTool/sessionInterview', () => {
  const actual = jest.requireActual<typeof import('../SurveyTool/sessionInterview')>('../SurveyTool/sessionInterview');
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
const status = (optedOut = false, on = true) => ({
  on,
  answers: null,
  audience: null,
  optedOut,
  unattributed: false,
  closed: null,
  recording: false,
  signedOut: false,
});

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

const OTHER = '0x0000000000000000000000000000000000000002';
const renderOption = (account = ACCOUNT) =>
  render(<SessionAgentUseOption sessionSlug="demo" sessionConfig={AGENT_ON} account={account} />);
const box = () => screen.queryByLabelText('Session Agent may use my answers and files');

it('leaves the Session Agent choice out of the interview dialog', async () => {
  readStatus.mockResolvedValue(status(true));
  const { onSubmitResponses } = renderReview(AGENT_ON);
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  expect(box()).not.toBeInTheDocument();
  expect(readStatus).not.toHaveBeenCalled();
  // Submitting saves no Session Agent choice: the Worker keeps the one they made, opted out included.
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
  await waitFor(() => expect(onSubmitResponses).toHaveBeenCalledTimes(1));
  expect(setOptOut).not.toHaveBeenCalled();
});

it('shows nothing to someone signed out, and asks the Worker nothing', () => {
  renderOption('');
  expect(box()).not.toBeInTheDocument();
  expect(readStatus).not.toHaveBeenCalled();
});

it('shows the stored choice, so someone who opted out stays opted out', async () => {
  readStatus.mockResolvedValue(status(true));
  renderOption();
  // Until the Worker answers it can't be changed, so it never claims a choice it hasn't read.
  expect(box()).toBeDisabled();
  await waitFor(() => expect(box()).not.toBeChecked());
  expect(box()).toBeEnabled();
  expect(readStatus).toHaveBeenCalledWith(expect.objectContaining({ sessionSlug: 'demo', account: ACCOUNT }));
  expect(screen.getByTestId('ce-session-agent-notice-switch')).toHaveAccessibleDescription(
    expect.stringContaining('never naming you'),
  );
});

it('hides when the stored choice can’t be read', async () => {
  readStatus.mockRejectedValue(new Error('down'));
  renderOption();
  await waitFor(() => expect(box()).not.toBeInTheDocument());
});

it('hides once an admin has turned the Session Agent off', async () => {
  readStatus.mockResolvedValue(status(false, false));
  renderOption();
  await waitFor(() => expect(box()).not.toBeInTheDocument());
});

it('saves a change at once, and shows what is still stored when the save fails', async () => {
  readStatus.mockResolvedValue(status());
  renderOption();
  await waitFor(() => expect(box()).toBeEnabled());
  setOptOut.mockResolvedValueOnce(true);
  fireEvent.click(box()!);
  await waitFor(() => expect(setOptOut).toHaveBeenCalledWith(true, expect.objectContaining({ account: ACCOUNT })));
  await waitFor(() => expect(box()).not.toBeChecked());
  setOptOut.mockRejectedValueOnce(new Error('down'));
  fireEvent.click(box()!);
  expect(await screen.findByRole('alert')).toHaveTextContent('Not saved. Try again.');
  expect(box()).not.toBeChecked();
});

it('reads the next person’s own choice when someone else signs in', async () => {
  readStatus.mockResolvedValueOnce(status(true)).mockResolvedValueOnce(status(false));
  const { rerender } = renderOption();
  await waitFor(() => expect(box()).not.toBeChecked());
  rerender(<SessionAgentUseOption sessionSlug="demo" sessionConfig={AGENT_ON} account={OTHER} />);
  await waitFor(() => expect(readStatus).toHaveBeenLastCalledWith(expect.objectContaining({ account: OTHER })));
  await waitFor(() => expect(box()).toBeChecked());
});
