import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SessionVoiceModeModal from './SessionVoiceModeModal';
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
jest.mock('../../utilities/worker/corsProxy.js', () => ({
  getCorsProxyUrlOrThrow: jest.fn(async () => 'https://worker.example'),
}));
jest.mock('../../utilities/audio/realtimeInterviewClient', () => ({ startSessionRealtimeInterview: jest.fn() }));
jest.mock('./sessionInterview', () => ({
  ...jest.requireActual<typeof import('./sessionInterview')>('./sessionInterview'),
  mapInterviewEvidenceToResponses: jest.fn(),
}));

const alice = `0x${'a'.repeat(40)}`;
const bob = `0x${'b'.repeat(40)}`;
const questionPool = [
  { id: 'b1', prompt: 'Statement one?', type: 'binary' },
  { id: 'b2', prompt: 'Statement two?', type: 'binary' },
];
const prefillPacket = {
  version: 1 as const,
  sessionSlug: 'demo',
  source: { platform: 'claude' as const, modelId: 'claude-test', verification: 'self_reported' as const },
  responderContext: { summary: 'Synthetic context' },
  responses: [
    { questionId: 'b1', answer: 'Agree', confidence: 0.8 },
    { questionId: 'b2', answer: 'Agree', confidence: 0.7 },
  ],
};
type Who = { account?: string; loginComplete?: boolean };
const onSubmitResponses = jest.fn();
const modal = ({ account = alice, loginComplete = true }: Who = {}, packet: unknown = null) => (
  <SessionVoiceModeModal
    isOpen
    mode="interview"
    onSelectMode={jest.fn()}
    onClose={jest.fn()}
    toggleLoginModal={jest.fn()}
    sessionSlug="demo"
    account={account}
    loginComplete={loginComplete}
    workerUrl="https://worker.example"
    sessionConfig={{ interviewMode: { shareDraftChangesByDefault: false } }}
    questionPool={questionPool}
    prefillPacket={packet as typeof prefillPacket | null}
    onApplyAnswer={jest.fn()}
    onApplyAdditional={jest.fn()}
    onApplyImportance={jest.fn()}
    onApplyConviction={jest.fn()}
    onRecordProvenance={jest.fn()}
    onSubmitResponses={onSubmitResponses}
    renderAnswerInput={(questionId, value, onChange) => (
      <input
        aria-label={`Answer ${questionId}`}
        value={value === undefined || value === null ? '' : String(value)}
        onChange={(event) => onChange(event.target.value)}
      />
    )}
  />
);
const keyFor = (owner: string) => `ce:interview-review:v1:demo:${owner}`;
const kept = (owner: string) => window.localStorage.getItem(keyFor(owner));
const answer = (questionId: string) => screen.getByLabelText(`Answer ${questionId}`);
// Reviews the AI's drafts and changes one, then waits for the browser to keep it.
const startReview = async (who: Who = {}, owner = `account:${alice}`) => {
  const view = render(modal(who, prefillPacket));
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  fireEvent.change(answer('b1'), { target: { value: 'Disagree' } });
  await waitFor(() => expect(kept(owner)).toContain('Disagree'));
  return view;
};

beforeEach(() => {
  window.localStorage.clear();
  onSubmitResponses.mockReset().mockResolvedValue({ status: 'submitted' });
});

it('brings a review back after a reload, with its edits, though the link has dropped its prefill', async () => {
  const first = await startReview();
  first.unmount();
  // A reload: the page's memory is gone and the link's fragment was removed after the first load.
  render(modal());
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  expect(answer('b1')).toHaveValue('Disagree');
  expect(answer('b2')).toHaveValue('Agree');
  expect(JSON.parse(kept(`account:${alice}`)!).review.packet.sessionSlug).toBe('demo');
});

it('waits for the sign-in to come back after a reload before restoring an account’s review', async () => {
  (await startReview()).unmount();
  const view = render(modal({ loginComplete: false }));
  expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW)).not.toBeInTheDocument();
  view.rerender(modal());
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  expect(answer('b1')).toHaveValue('Disagree');
});

it('clears the kept review once it is submitted', async () => {
  (await startReview()).unmount();
  render(modal());
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
  await waitFor(() => expect(onSubmitResponses).toHaveBeenCalled());
  await waitFor(() => expect(kept(`account:${alice}`)).toBeNull());
});

it('clears the kept review on discard, so the next visit starts empty', async () => {
  const view = await startReview();
  fireEvent.click(screen.getByRole('button', { name: 'Discard interview' }));
  const confirmation = await screen.findByRole('dialog', { name: 'Discard this interview?' });
  fireEvent.click(within(confirmation).getByRole('button', { name: 'Discard interview' }));
  await waitFor(() => expect(kept(`account:${alice}`)).toBeNull());
  view.unmount();
  render(modal());
  expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW)).not.toBeInTheDocument();
  expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START)).toBeInTheDocument();
});

it('never shows one account’s kept review to another account or to someone signed out', async () => {
  (await startReview()).unmount();
  const asBob = render(modal({ account: bob }));
  expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW)).not.toBeInTheDocument();
  asBob.unmount();
  const signedOut = render(modal({ account: '', loginComplete: false }));
  expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW)).not.toBeInTheDocument();
  signedOut.unmount();
  // Restored for Alice, then the page signs in as Bob: it leaves the screen and stays kept for Alice.
  const view = render(modal());
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  view.rerender(modal({ account: bob }));
  await waitFor(() => expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW)).not.toBeInTheDocument());
  expect(kept(`account:${alice}`)).toContain('Disagree');
  expect(kept(`account:${bob}`)).toBeNull();
});

it('keeps a signed-out review in this browser and moves it to the account that signs in', async () => {
  const view = await startReview({ account: '', loginComplete: false }, 'browser');
  view.rerender(modal({}, prefillPacket));
  await waitFor(() => expect(kept(`account:${alice}`)).toContain('Disagree'));
  expect(kept('browser')).toBeNull();
  expect(answer('b1')).toHaveValue('Disagree');
});

it('starts afresh when a link brings different evidence', async () => {
  (await startReview()).unmount();
  const replacement = { ...prefillPacket, responses: [{ questionId: 'b1', answer: 'Agree', confidence: 0.9 }] };
  render(modal({}, replacement));
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  expect(answer('b1')).toHaveValue('Agree');
});
