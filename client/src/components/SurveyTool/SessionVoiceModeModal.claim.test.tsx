import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SessionVoiceModeModal from './SessionVoiceModeModal';
import { mapInterviewEvidenceToResponses } from './sessionInterview';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

const mockGroupClose = jest.fn(async () => undefined);
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
jest.mock('./SessionListeningPanel', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  const { createPortal } = jest.requireActual<typeof import('react-dom')>('react-dom');
  const MockListeningPanel = ({
    closeActionRef,
    onBusyChange,
    headerActionsSlot,
  }: {
    closeActionRef: { current: unknown };
    onBusyChange: (busy: boolean) => void;
    headerActionsSlot?: HTMLElement | null;
  }) => {
    useEffect(() => {
      closeActionRef.current = mockGroupClose;
    }, [closeActionRef]);
    return (
      <>
        <button type="button" onClick={() => onBusyChange(true)}>
          Start capturing
        </button>
        <button type="button" onClick={() => onBusyChange(false)}>
          Stop capturing
        </button>
        {headerActionsSlot ? createPortal(<button type="button">Add input</button>, headerActionsSlot) : null}
      </>
    );
  };
  return {
    __esModule: true,
    default: MockListeningPanel,
    SessionListeningWaveform: () => null,
    formatSessionRecordingElapsed: (seconds: number) => `0:${seconds}`,
  };
});
jest.mock('./SessionTranscriptClaimScanner', () => ({
  __esModule: true,
  default: ({
    firstFrame,
    onClaim,
    onCancel,
  }: Record<string, (...args: unknown[]) => void> & { firstFrame?: unknown }) => (
    <div data-testid="mock-scanner" data-first={JSON.stringify(firstFrame ?? null)}>
      <button
        type="button"
        onClick={() => onClaim({ sessionSlug: 'demo', person: 'Person 2', transcript: 'Responder: No.' })}
      >
        Finish scan
      </button>
      <button type="button" onClick={onCancel}>
        Cancel scan
      </button>
    </div>
  ),
}));
jest.mock('./sessionInterview', () => ({
  ...jest.requireActual<typeof import('./sessionInterview')>('./sessionInterview'),
  mapInterviewEvidenceToResponses: jest.fn(),
}));
jest.mock('../../utilities/worker/corsProxy.js', () => ({
  getCorsProxyUrlOrThrow: jest.fn(async () => 'https://worker.example'),
}));
jest.mock('../../utilities/audio/realtimeInterviewClient', () => ({ startSessionRealtimeInterview: jest.fn() }));

const mapped = jest.mocked(mapInterviewEvidenceToResponses);
const claim = {
  sessionSlug: 'demo',
  person: 'Person 2',
  transcript: 'Other person: Fund the garden?\nResponder: No, not this year.',
};
const baseProps = {
  isOpen: true,
  onSelectMode: jest.fn(),
  onClose: jest.fn(),
  toggleLoginModal: jest.fn(),
  sessionSlug: 'demo',
  account: '0x0000000000000000000000000000000000000001',
  loginComplete: true,
  workerUrl: 'https://worker.example',
  questionPool: [
    { id: 'q1', prompt: 'Fund the garden?', type: 'freeform' },
    { id: 'q2', prompt: 'Who runs it?', type: 'freeform' },
  ],
  existingResponseSlice: null,
  prefillPacket: null,
  onApplyAnswer: jest.fn(),
  onApplyAdditional: jest.fn(),
  onApplyImportance: jest.fn(),
  onApplyConviction: jest.fn(),
  onRecordProvenance: jest.fn(),
  onSubmitResponses: jest.fn(),
  onClaim: jest.fn(),
  onClaimFrameDone: jest.fn(),
} as unknown as React.ComponentProps<typeof SessionVoiceModeModal>;

const saved = (values: Record<string, string>) => ({
  answers: Object.fromEntries(Object.entries(values).map(([id, value]) => [id, { value }])),
  additionalComments: {},
  importance: {},
  conviction: {},
});

describe('scanning a part of a conversation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mapped.mockResolvedValue([]);
  });

  it.each([['recordGroup'], [null]] as const)('offers Scan code in the dialog’s header in %s mode', async (mode) => {
    render(<SessionVoiceModeModal {...baseProps} mode={mode} />);
    const scan = screen.getByTestId(E2E_TESTIDS.SESSION_CLAIM_SCAN);
    expect(scan.closest('.modal-header')).not.toBeNull();
    // An icon alone, named for screen readers.
    expect(scan).toHaveAccessibleName('Scan code');
    expect(scan).toHaveTextContent(/^$/);
    fireEvent.click(scan);
    expect(await screen.findByTestId('mock-scanner')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel scan' }));
    await waitFor(() => expect(screen.queryByTestId('mock-scanner')).toBeNull());
  });

  it('gives Group Conversation a spot in the header beside Scan code for its +', async () => {
    render(<SessionVoiceModeModal {...baseProps} mode="recordGroup" />);
    const add = await screen.findByRole('button', { name: 'Add input' });
    const scan = screen.getByTestId(E2E_TESTIDS.SESSION_CLAIM_SCAN);
    expect(add.closest('.modal-header')).not.toBeNull();
    expect(add.parentElement?.parentElement).toBe(scan.parentElement);
    // The dialog is named by its title, not the icons beside it.
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Group Conversation');
  });

  it('holds scanning back while the dialog is capturing a recording', () => {
    render(<SessionVoiceModeModal {...baseProps} mode="recordGroup" />);
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_CLAIM_SCAN)).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Start capturing' }));
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_CLAIM_SCAN)).toBeDisabled();
  });

  it('holds a code opened in a tab that’s recording until the recording stops', async () => {
    const frame = { id: 'ab12', index: 0, total: 3, data: 'x' };
    const { rerender } = render(<SessionVoiceModeModal {...baseProps} mode="recordGroup" />);
    fireEvent.click(screen.getByRole('button', { name: 'Start capturing' }));
    rerender(<SessionVoiceModeModal {...baseProps} mode="recordGroup" claimFrame={frame} />);
    expect(screen.queryByTestId('mock-scanner')).toBeNull();
    expect(mockGroupClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Stop capturing' }));
    expect(await screen.findByTestId('mock-scanner')).toBeInTheDocument();
  });

  it('carries on from the code that opened the page, and finishes a recording before the part arrives', async () => {
    const frame = { id: 'ab12', index: 0, total: 3, data: 'x' };
    const { rerender } = render(<SessionVoiceModeModal {...baseProps} mode="recordGroup" claimFrame={frame} />);
    expect(await screen.findByTestId('mock-scanner')).toHaveAttribute('data-first', JSON.stringify(frame));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Finish scan' })));
    expect(mockGroupClose).toHaveBeenCalled();
    expect(baseProps.onClaimFrameDone).toHaveBeenCalled();
    await waitFor(() =>
      expect(baseProps.onClaim).toHaveBeenCalledWith(expect.objectContaining({ person: 'Person 2' })),
    );
    rerender(<SessionVoiceModeModal {...baseProps} mode="recordGroup" claimFrame={null} />);
    expect(screen.queryByTestId('mock-scanner')).toBeNull();
  });
});

describe('drafting from a claimed part', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mapped.mockResolvedValue([]);
  });
  const interview = (props: Record<string, unknown> = {}) => (
    <SessionVoiceModeModal {...baseProps} mode="interview" claim={claim} {...props} />
  );

  it('drafts straight away for someone signed out, from their part alone', async () => {
    render(interview({ account: '', loginComplete: false }));
    await waitFor(() => expect(mapped).toHaveBeenCalledTimes(1));
    expect(mapped.mock.calls[0][0]).toMatchObject({
      transcript: claim.transcript,
      reconsideration: { earlierAnswers: [], ownContext: '' },
    });
    expect(screen.getByTestId('ce-session-interview-claim')).toHaveTextContent('Person 2');
  });

  it('waits for a signed-in person’s saved answers, then reconsiders them', async () => {
    let finishLoad = (_slice: unknown) => {};
    const onLoadSavedResponses = jest.fn(() => new Promise((resolve) => (finishLoad = resolve)));
    const { rerender } = render(interview({ onLoadSavedResponses }));
    await waitFor(() => expect(onLoadSavedResponses).toHaveBeenCalled());
    expect(mapped).not.toHaveBeenCalled();
    expect(screen.getByTestId('ce-session-interview-claim')).toHaveTextContent(
      /^Waiting for your saved answers before drafting from Person 2’s part of the conversation\./,
    );

    const slice = saved({ q1: 'Yes, fund it' });
    rerender(interview({ onLoadSavedResponses, existingResponseSlice: slice }));
    await act(async () => finishLoad(slice));
    await waitFor(() => expect(mapped).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('ce-session-interview-claim')).toHaveTextContent(
      /^Drafting from Person 2’s part of the conversation\./,
    );
    expect(mapped.mock.calls[0][0].reconsideration).toEqual({
      earlierAnswers: [{ questionId: 'q1', answer: 'Yes, fund it' }],
      ownContext: '',
    });
  });

  it('holds drafting while saved answers can’t be read, until a retry reads them', async () => {
    const slice = saved({ q1: 'Yes, fund it' });
    const onLoadSavedResponses = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(slice);
    render(interview({ onLoadSavedResponses, existingResponseSlice: slice }));
    const retry = await screen.findByRole('button', { name: 'Retry saved answers' });
    expect(screen.getByText(/Could not load your saved answers: offline/)).toBeInTheDocument();
    expect(screen.getByTestId('ce-session-interview-claim')).toHaveTextContent(/^Waiting for your saved answers/);
    await act(async () => undefined);
    expect(mapped).not.toHaveBeenCalled();

    fireEvent.click(retry);
    await waitFor(() => expect(mapped).toHaveBeenCalledTimes(1));
    expect(onLoadSavedResponses).toHaveBeenCalledTimes(2);
    expect(mapped.mock.calls[0][0].reconsideration?.earlierAnswers).toEqual([
      { questionId: 'q1', answer: 'Yes, fund it' },
    ]);
  });

  it('shows a change to a saved answer for review, and says when others still fit', async () => {
    mapped.mockResolvedValue([
      { questionId: 'q1', answer: 'No, not this year', evidence: 'said so', confidence: 0.8 },
      { questionId: 'q2', answer: 'The neighbours', evidence: 'as before', confidence: 0.8 },
    ]);
    const slice = saved({ q1: 'Yes, fund it', q2: 'The neighbours' });
    const onLoadSavedResponses = jest.fn(async () => slice);
    render(interview({ onLoadSavedResponses, existingResponseSlice: slice }));
    expect(await screen.findByText('One of your answers still fits, so it stays as it is.')).toBeInTheDocument();
    expect(screen.getByText('Fund the garden?')).toBeInTheDocument();
    expect(screen.queryByText('Who runs it?')).toBeNull();
  });

  it('says only answers the AI compared still fit, never a locked one', async () => {
    mapped.mockResolvedValue(
      ['q1', 'q2', 'q3'].map((questionId) => ({ questionId, answer: 'Yes', evidence: 'as before', confidence: 0.8 })),
    );
    const slice = {
      // q2 was unlocked on the page and q3 is still locked: neither goes to the AI.
      answers: { q1: { value: 'Yes' }, q2: { value: 'Yes', encrypted: true }, q3: { value: '*', encrypted: true } },
      additionalComments: {},
      importance: {},
      conviction: {},
    };
    render(
      interview({
        questionPool: [...(baseProps.questionPool as object[]), { id: 'q3', prompt: 'When?', type: 'freeform' }],
        onLoadSavedResponses: jest.fn(async () => slice),
        existingResponseSlice: slice,
      }),
    );
    expect(
      await screen.findByText(
        'One of your answers still fits, so it stays as it is. Left out 2 drafts for questions you’ve already answered.',
      ),
    ).toBeInTheDocument();
    expect(mapped.mock.calls[0][0].reconsideration?.earlierAnswers).toEqual([{ questionId: 'q1', answer: 'Yes' }]);
  });

  it('lets an encrypted answer stand, unquoted, even once unlocked on the page', async () => {
    mapped.mockResolvedValue([{ questionId: 'q1', answer: 'No, not this year', evidence: 'said so', confidence: 0.8 }]);
    const slice = { ...saved({}), answers: { q1: { value: 'My private yes', encrypted: true } } };
    render(interview({ onLoadSavedResponses: jest.fn(async () => slice), existingResponseSlice: slice }));
    expect(await screen.findByText('You’ve already answered the question this draft covers.')).toBeInTheDocument();
    expect(screen.queryByText('Fund the garden?')).toBeNull();
    expect(document.body).not.toHaveTextContent('My private yes');
  });

  it('keeps a kept answer’s new comment for review', async () => {
    mapped.mockResolvedValue([
      { questionId: 'q2', answer: 'The neighbours', additionalComments: 'With a small rota', confidence: 0.8 },
    ]);
    const slice = saved({ q2: 'The neighbours' });
    render(interview({ onLoadSavedResponses: jest.fn(async () => slice), existingResponseSlice: slice }));
    expect(await screen.findByText('Who runs it?')).toBeInTheDocument();
  });

  it.each([
    ['a locked comment', '*'],
    ['an encrypted comment unlocked on the page', 'Secret reason'],
  ])('offers a new comment beside %s, keeping theirs unless they choose the AI’s', async (_label, value) => {
    mapped.mockResolvedValue([
      { questionId: 'q2', answer: 'The neighbours', additionalComments: 'With a small rota', confidence: 0.8 },
    ]);
    const slice = { ...saved({ q2: 'The neighbours' }), additionalComments: { q2: { value, encrypted: true } } };
    render(interview({ onLoadSavedResponses: jest.fn(async () => slice), existingResponseSlice: slice }));
    expect(await screen.findByText('Who runs it?')).toBeInTheDocument();
    const choices = screen.getByRole('group', { name: 'Comment to submit' });
    expect(within(choices).getByRole('button', { name: 'Mine' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(choices).getByRole('button', { name: 'AI’s' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText(/still fit/)).toBeNull();
    expect(document.body).not.toHaveTextContent('Secret reason');
    expect(JSON.stringify(mapped.mock.calls)).not.toContain('Secret reason');
  });

  it('adds to what they said here, keeps drafts in review, and takes a part in only once', async () => {
    mapped.mockResolvedValue([{ questionId: 'q1', answer: 'No', evidence: 'said so', confidence: 0.8 }]);
    const { rerender } = render(interview({ claim: null }));
    rerender(interview());
    await waitFor(() => expect(mapped).toHaveBeenCalledTimes(1));
    await screen.findByText('Fund the garden?');
    rerender(interview());
    await act(async () => undefined);
    expect(mapped).toHaveBeenCalledTimes(1);
    const second = { ...claim, person: 'Person 1', transcript: 'Responder: Later I said yes.' };
    rerender(interview({ claim: second }));
    await waitFor(() => expect(mapped).toHaveBeenCalledTimes(2));
    const next = mapped.mock.calls[1][0];
    expect(next.transcript).toBe(`${claim.transcript}\n\n${second.transcript}`);
    expect(JSON.stringify(next.previousResponses)).toContain('"questionId":"q1"');
  });

  it('a discarded interview doesn’t bring its part back', async () => {
    const { rerender } = render(interview({ account: '', loginComplete: false }));
    await waitFor(() => expect(mapped).toHaveBeenCalledTimes(1));
    fireEvent.click(await screen.findByRole('button', { name: /Discard/ }));
    fireEvent.click(await screen.findByTestId('ce-interview-discard-confirm'));
    await act(async () => undefined);
    rerender(interview({ account: '', loginComplete: false }));
    await act(async () => undefined);
    expect(mapped).toHaveBeenCalledTimes(1);
  });
});
