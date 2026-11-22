import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SessionVoiceModeModal from './SessionVoiceModeModal';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import type { TranscriptClaim } from './sessionTranscriptClaim';

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
type Who = { account?: string; loginComplete?: boolean; shareByDefault?: boolean };
const onSubmitResponses = jest.fn();
const onApplyAnswer = jest.fn();
const modal = (
  { account = alice, loginComplete = true, shareByDefault = false }: Who = {},
  packet: unknown = null,
  claim: TranscriptClaim | null = null,
) => (
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
    sessionConfig={{ interviewMode: { shareDraftChangesByDefault: shareByDefault } }}
    questionPool={questionPool}
    prefillPacket={packet as typeof prefillPacket | null}
    claim={claim}
    onApplyAnswer={onApplyAnswer}
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
  onApplyAnswer.mockReset();
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

// A #prefillz= link unpacks after the page opens, and a link opened in a tab already open arrives late too.
it('replaces a restored review whole when a link with other evidence arrives after it shows', async () => {
  (await startReview()).unmount();
  const view = render(modal());
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  expect(answer('b1')).toHaveValue('Disagree');
  const replacement = { ...prefillPacket, responses: [{ questionId: 'b1', answer: 'Agree', confidence: 0.9 }] };
  view.rerender(modal({}, replacement));
  await waitFor(() => expect(answer('b1')).toHaveValue('Agree'));
  expect(screen.queryByDisplayValue('Disagree')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Answer b2')).not.toBeInTheDocument();
  // The old review is gone from this browser too, so it can't come back on the next visit.
  expect(kept(`account:${alice}`) || '').not.toContain('Disagree');
  // Only the new link's drafts are submitted.
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
  await waitFor(() => expect(onSubmitResponses).toHaveBeenCalled());
  expect(onApplyAnswer.mock.calls).toEqual([['b1', 'Agree']]);
});

it('keeps a restored review and its edits when the same link arrives after it shows', async () => {
  (await startReview()).unmount();
  const view = render(modal());
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  view.rerender(modal({}, structuredClone(prefillPacket)));
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  expect(answer('b1')).toHaveValue('Disagree');
  expect(answer('b2')).toHaveValue('Agree');
});

const share = () => screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_PREDICTION_COMPARISON);

it.each([true, false])('keeps the Share for research choice against a default of %s', async (shareByDefault) => {
  const first = render(modal({ shareByDefault }, prefillPacket));
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  expect(share()).toHaveProperty('checked', shareByDefault);
  fireEvent.click(share());
  await waitFor(() => expect(kept(`account:${alice}`)).toContain(`"included":${!shareByDefault}`));
  first.unmount();
  render(modal({ shareByDefault }));
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  expect(share()).toHaveProperty('checked', !shareByDefault);
});

it('keeps the review through a submit that fails', async () => {
  onSubmitResponses.mockResolvedValue({ status: 'failed', message: 'Try again.' });
  await startReview();
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
  await waitFor(() => expect(onSubmitResponses).toHaveBeenCalled());
  await new Promise((resolve) => setTimeout(resolve, 400));
  expect(kept(`account:${alice}`)).toContain('Disagree');
});

it('counts the day from when the review was first kept, not from each restore', async () => {
  (await startReview()).unmount();
  const firstKept = JSON.parse(kept(`account:${alice}`)!).savedAt;
  render(modal());
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  fireEvent.change(answer('b2'), { target: { value: 'Disagree' } });
  await waitFor(() => expect(kept(`account:${alice}`)).toMatch(/"editedDrafts":\{[^]*"b2"/));
  expect(JSON.parse(kept(`account:${alice}`)!).savedAt).toBe(firstKept);
});

it('clears the account’s kept review on discard after signing out', async () => {
  const view = await startReview();
  view.rerender(modal({ account: '', loginComplete: false }, prefillPacket));
  fireEvent.click(screen.getByRole('button', { name: 'Discard interview' }));
  const confirmation = await screen.findByRole('dialog', { name: 'Discard this interview?' });
  fireEvent.click(within(confirmation).getByRole('button', { name: 'Discard interview' }));
  await waitFor(() => expect(kept(`account:${alice}`)).toBeNull());
});

it('takes a restored review that moved to an account off the screen when that account signs out', async () => {
  (await startReview({ account: '', loginComplete: false }, 'browser')).unmount();
  const view = render(modal({ account: '', loginComplete: false }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue it' }));
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  view.rerender(modal());
  await waitFor(() => expect(kept(`account:${alice}`)).toContain('Disagree'));
  view.rerender(modal({ account: '', loginComplete: false }));
  await waitFor(() => expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW)).not.toBeInTheDocument());
  expect(kept(`account:${alice}`)).toContain('Disagree');
  expect(kept('browser')).toBeNull();
});

describe('a review kept signed out, on a phone that may be shared', () => {
  const signedOut = { account: '', loginComplete: false };
  const keptSignedOut = async () => (await startReview(signedOut, 'browser')).unmount();

  it('asks first and shows nothing of it until they continue', async () => {
    await keptSignedOut();
    render(modal(signedOut));
    expect(screen.getByText('This device has an unsubmitted interview review.')).toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW)).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START)).not.toBeInTheDocument();
    expect(document.body.querySelectorAll('input, textarea')).toHaveLength(0);
    expect(document.body.textContent).not.toMatch(/Disagree|Synthetic context|Statement one/);
    fireEvent.click(screen.getByRole('button', { name: 'Continue it' }));
    await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
    expect(answer('b1')).toHaveValue('Disagree');
  });

  it('asks first even when the same link brings it back', async () => {
    await keptSignedOut();
    render(modal(signedOut, prefillPacket));
    expect(screen.getByRole('button', { name: 'Continue it' })).toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW)).not.toBeInTheDocument();
  });

  it('clears it when they discard it and start fresh', async () => {
    await keptSignedOut();
    render(modal(signedOut, prefillPacket));
    fireEvent.click(screen.getByRole('button', { name: 'Discard and start fresh' }));
    expect(kept('browser')).toBeNull();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START)).toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW)).not.toBeInTheDocument();
  });

  it('clears it when a new interview starts from a link with other evidence', async () => {
    await keptSignedOut();
    const replacement = { ...prefillPacket, responses: [{ questionId: 'b1', answer: 'Agree', confidence: 0.9 }] };
    render(modal(signedOut, replacement));
    expect(kept('browser')).toBeNull();
    await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
    expect(answer('b1')).toHaveValue('Agree');
  });

  it('clears it when a link or a code arrives while it asks', async () => {
    const claim = { sessionSlug: 'demo', person: 'Sam', transcript: 'Responder: Mine.' };
    for (const arriving of [
      (view: ReturnType<typeof render>) => view.rerender(modal(signedOut, null, claim)),
      (view: ReturnType<typeof render>) =>
        view.rerender(modal(signedOut, { ...prefillPacket, responses: [{ questionId: 'b2', answer: 'Agree' }] })),
    ]) {
      await keptSignedOut();
      const view = render(modal(signedOut));
      expect(screen.getByRole('button', { name: 'Continue it' })).toBeInTheDocument();
      arriving(view);
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Continue it' })).not.toBeInTheDocument());
      expect(kept('browser')).toBeNull();
      expect(screen.queryByDisplayValue('Disagree')).not.toBeInTheDocument();
      view.unmount();
      window.localStorage.clear();
    }
  });

  it('clears it when a new interview starts from a code', async () => {
    await keptSignedOut();
    render(modal(signedOut, null, { sessionSlug: 'demo', person: 'Sam', transcript: 'Responder: Mine.' }));
    expect(kept('browser')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Continue it' })).not.toBeInTheDocument();
  });

  // Answers copied from a browser where sign-in failed, opened on a phone that is already signed in.
  describe('copied from another browser', () => {
    const copy = async () => {
      await keptSignedOut();
      const record = JSON.parse(kept('browser')!);
      window.localStorage.setItem(keyFor('browser'), JSON.stringify({ ...record, copied: true }));
    };

    it('is offered, asking first, to an account with no review of its own', async () => {
      await copy();
      render(modal());
      expect(screen.getByText('This device has an unsubmitted interview review.')).toBeInTheDocument();
      expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW)).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Continue it' }));
      await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
      expect(answer('b1')).toHaveValue('Disagree');
      // Continued signed in, it becomes the account's own.
      fireEvent.change(answer('b2'), { target: { value: 'Disagree' } });
      await waitFor(() => expect(kept(`account:${alice}`)).toContain('Disagree'));
      expect(kept('browser')).toBeNull();
    });

    it('is still offered when the sign-in comes back after the page opens', async () => {
      await copy();
      const view = render(modal({ loginComplete: false }));
      view.rerender(modal());
      expect(await screen.findByRole('button', { name: 'Continue it' })).toBeInTheDocument();
    });

    it('is cleared from this browser when discarded', async () => {
      await copy();
      render(modal());
      fireEvent.click(screen.getByRole('button', { name: 'Discard and start fresh' }));
      expect(kept('browser')).toBeNull();
    });

    it("gives way to the account's own review", async () => {
      (await startReview()).unmount();
      await copy();
      render(modal());
      await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
      expect(screen.queryByRole('button', { name: 'Continue it' })).not.toBeInTheDocument();
    });
  });

  it('never offers it to someone who signs in before choosing', async () => {
    await keptSignedOut();
    const view = render(modal(signedOut));
    view.rerender(modal());
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Continue it' })).not.toBeInTheDocument());
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW)).not.toBeInTheDocument();
    expect(kept(`account:${alice}`)).toBeNull();
  });
});
