import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SessionVoiceModeModal from './SessionVoiceModeModal';
import { mapInterviewEvidenceToResponses } from './sessionInterview';
import { startSessionRealtimeInterview } from '../../utilities/audio/realtimeInterviewClient';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import type { InterviewSavedSlice } from './sessionInterviewSavedAnswers';
import type { InterviewSavedAnswerLoader } from './useInterviewSavedAnswers';

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

// An AI draft, with a comment or without; review starts from the form's comment, joined with the AI's.
const modal = (
  existingResponseSlice: Record<string, unknown> | null,
  aiComment = '',
  onApplyAdditional = jest.fn(),
  extra: Partial<React.ComponentProps<typeof SessionVoiceModeModal>> = {},
) => (
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
    questionPool={[{ id: 'q-text', prompt: 'Why?', type: 'freeform' }]}
    existingResponseSlice={existingResponseSlice}
    prefillPacket={{
      version: 1,
      sessionSlug: 'demo',
      questionSetHash: 'a'.repeat(64),
      promptVersion: 'ce-interview-brief-v4',
      source: { platform: 'claude', modelId: 'claude-example', verification: 'self_reported' },
      responderContext: {},
      responses: [
        {
          questionId: 'q-text',
          answer: 'Drafted answer',
          confidence: 0.65,
          ...(aiComment ? { additionalComments: aiComment } : {}),
        },
      ],
    }}
    onApplyAnswer={jest.fn()}
    onApplyAdditional={onApplyAdditional}
    onApplyImportance={jest.fn()}
    onApplyConviction={jest.fn()}
    onRecordProvenance={jest.fn()}
    onSubmitResponses={jest.fn(async () => ({ status: 'submitted' as const }))}
    {...extra}
  />
);
const renderDraftWithoutAiComment = (existingResponseSlice: Record<string, unknown> | null) =>
  render(modal(existingResponseSlice));
// A comment on a question without an answer yet, so its draft is offered.
const withComment = (value: string, encrypted = false) => ({
  additionalComments: { 'q-text': { value, ...(encrypted ? { encrypted: true } : {}) } },
});
const choose = (name: string) =>
  fireEvent.click(within(screen.getByRole('group', { name: 'Comment to submit' })).getByRole('button', { name }));
const submit = async () => {
  await act(async () => fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY)));
  await waitFor(() =>
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY)).toHaveTextContent('Responses submitted'),
  );
};
// One voice round: what the voice interviewer was told, then what the next mapping was given as reviewed.
const talk = async () => {
  let instructions = '';
  jest.mocked(mapInterviewEvidenceToResponses).mockResolvedValue([]);
  jest.mocked(startSessionRealtimeInterview).mockImplementation(async (options) => {
    instructions = options.instructions;
    options.onRecordingState?.('recording');
    options.onTranscript?.('Responder: Tell me more.', []);
    return {
      mediaStream: {} as MediaStream,
      stop: jest.fn(async () => ({ transcript: 'Responder: Tell me more.', turns: [] })),
      pause: jest.fn(),
      resume: jest.fn(),
      getTranscript: () => 'Responder: Tell me more.',
    };
  });
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
  await screen.findByLabelText('Pause interview');
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STOP));
  await waitFor(() => expect(mapInterviewEvidenceToResponses).toHaveBeenCalled());
  return {
    instructions,
    reviewed: JSON.stringify(jest.mocked(mapInterviewEvidenceToResponses).mock.calls.at(-1)?.[0].previousResponses),
  };
};

const editComment = (value: string) =>
  fireEvent.change(screen.getByRole('textbox', { name: /Additional comments for Why\?/ }), { target: { value } });

describe('interview draft comments', () => {
  it('counts clearing the saved comment shown for a draft as a human edit', async () => {
    // A comment on a question without an answer yet, so its draft is offered.
    renderDraftWithoutAiComment({
      additionalComments: { 'q-text': { value: 'Saved note' } },
    });

    await screen.findByRole('button', { name: /Draft answer for Why\?/ });
    expect(screen.getByLabelText('AI-proposed response')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Additional comments for Why\?/ }));
    editComment('');
    expect(screen.queryByLabelText('AI-proposed response')).not.toBeInTheDocument();
    editComment('Saved note');
    expect(screen.getByLabelText('AI-proposed response')).toBeInTheDocument();
  });

  it('keeps an untouched draft unedited after a comment is added and removed', async () => {
    renderDraftWithoutAiComment(null);

    await screen.findByRole('button', { name: /Draft answer for Why\?/ });
    fireEvent.click(screen.getByRole('button', { name: 'Additional comments' }));
    fireEvent.click(screen.getByRole('button', { name: /Additional comments for Why\?/ }));
    editComment('x');
    expect(screen.queryByLabelText('AI-proposed response')).not.toBeInTheDocument();
    editComment('');
    expect(screen.getByLabelText('AI-proposed response')).toBeInTheDocument();
  });
});

describe('an AI comment beside the person’s own', () => {
  it('submits their comment with the AI’s after it', async () => {
    const onApplyAdditional = jest.fn();
    render(modal(withComment('Saved note'), 'From my AI', onApplyAdditional));
    expect(await screen.findByRole('button', { name: /Additional comments for Why\?/ })).toHaveTextContent(
      'Saved note From my AI',
    );
    await submit();
    expect(onApplyAdditional).toHaveBeenCalledTimes(1);
    expect(onApplyAdditional).toHaveBeenCalledWith('q-text', 'Saved note\n\nFrom my AI');
  });

  it('leaves their comment alone when they keep only theirs, and sends only the AI’s when chosen', async () => {
    const onApplyAdditional = jest.fn();
    const { unmount } = render(modal(withComment('Saved note'), 'From my AI', onApplyAdditional));
    await screen.findByRole('group', { name: 'Comment to submit' });
    choose('Mine');
    await submit();
    expect(onApplyAdditional).not.toHaveBeenCalled();
    unmount();

    render(modal(withComment('Saved note'), 'From my AI', onApplyAdditional));
    await screen.findByRole('group', { name: 'Comment to submit' });
    choose('AI’s');
    await submit();
    expect(onApplyAdditional).toHaveBeenCalledWith('q-text', 'From my AI');
  });

  it('keeps a locked comment unless they choose the AI’s', async () => {
    const onApplyAdditional = jest.fn();
    const { unmount } = render(modal(withComment('*', true), 'From my AI', onApplyAdditional));
    await screen.findByRole('group', { name: 'Comment to submit' });
    await submit();
    expect(onApplyAdditional).not.toHaveBeenCalled();
    unmount();

    render(modal(withComment('*', true), 'From my AI', onApplyAdditional));
    await screen.findByRole('group', { name: 'Comment to submit' });
    choose('AI’s');
    await submit();
    expect(onApplyAdditional).toHaveBeenCalledWith('q-text', 'From my AI');
  });

  it('joins a comment that loads after the drafts, rather than replacing it unseen', async () => {
    const onApplyAdditional = jest.fn();
    const { rerender } = render(modal(null, 'From my AI', onApplyAdditional));
    const comment = await screen.findByRole('button', { name: /Additional comments for Why\?/ });
    expect(comment).toHaveTextContent(/^From my AI$/);
    rerender(modal(withComment('Saved note'), 'From my AI', onApplyAdditional));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Additional comments for Why\?/ })).toHaveTextContent(
        'Saved note From my AI',
      ),
    );
    await submit();
    expect(onApplyAdditional).toHaveBeenCalledWith('q-text', 'Saved note\n\nFrom my AI');
  });
});

describe('a submit pressed before saved answers load', () => {
  // Saved answers that load only when the test says, with the session's response cache not ready either.
  // Rerenders change only the form's answers, as the pile's do.
  const later = (
    onApplyAdditional: jest.Mock,
    onSubmitResponses: NonNullable<React.ComponentProps<typeof SessionVoiceModeModal>['onSubmitResponses']>,
  ) => {
    let finish: (slice: InterviewSavedSlice) => void = () => {};
    const onLoadSavedResponses: InterviewSavedAnswerLoader = () => new Promise((resolve) => (finish = resolve));
    const base = modal(null, 'From my AI', onApplyAdditional, {
      onLoadSavedResponses,
      isResponsesCacheReady: false,
      onSubmitResponses,
    });
    return {
      element: (slice: Record<string, unknown> | null) => React.cloneElement(base, { existingResponseSlice: slice }),
      finish: (slice: InterviewSavedSlice) => act(async () => finish(slice)),
    };
  };
  const savedComment = (comment: Record<string, unknown>) => ({
    answers: {},
    importance: {},
    conviction: {},
    additionalComments: { 'q-text': comment },
  });
  const press = () => act(async () => fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY)));

  it.each([
    ['an untouched card', '', { value: 'Saved note' }],
    ['an edited card', 'Typed in review', { value: 'Saved note' }],
    ['a card beside a locked comment', '', { value: '*', encrypted: true }],
  ])('waits for the person to check %s when a comment loads first', async (_label, typed, loaded) => {
    const onApplyAdditional = jest.fn();
    const onSubmitResponses = jest.fn(async () => ({ status: 'submitted' as const }));
    const saved = later(onApplyAdditional, onSubmitResponses);
    const view = render(saved.element(null));
    fireEvent.click(await screen.findByRole('button', { name: /Additional comments for Why\?/ }));
    if (typed) editComment(typed);
    await press();
    // As in the pile, the form takes the saved comment before the read finishes.
    const slice = savedComment(loaded);
    view.rerender(saved.element(slice));
    await saved.finish(slice);
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent(
      'Saved answers loaded. Check drafts that change an earlier answer, then submit.',
    );
    expect(onSubmitResponses).not.toHaveBeenCalled();
    expect(onApplyAdditional).not.toHaveBeenCalled();
  });

  it('submits an untouched card with the comment that loaded, once checked', async () => {
    const onApplyAdditional = jest.fn();
    const onSubmitResponses = jest.fn(async () => ({ status: 'submitted' as const }));
    const saved = later(onApplyAdditional, onSubmitResponses);
    // Without a form, review reads the saved answers themselves.
    render(saved.element(null));
    await screen.findByRole('button', { name: /Additional comments for Why\?/ });
    await press();
    await saved.finish(savedComment({ value: 'Saved note' }));
    expect(onSubmitResponses).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Additional comments for Why\?/ })).toHaveTextContent(
      'Saved note From my AI',
    );
    await submit();
    expect(onApplyAdditional).toHaveBeenCalledWith('q-text', 'Saved note\n\nFrom my AI');
  });
});

describe('research on a card left out', () => {
  it('records the AI’s comment, never a comment of theirs from the page they haven’t submitted', async () => {
    const onRecordProvenance = jest.fn();
    const base = modal(
      { additionalComments: { 'q-two': { value: 'My private note', unsubmitted: true } } },
      '',
      jest.fn(),
      { onRecordProvenance },
    );
    const packet = base.props.prefillPacket;
    const second = { questionId: 'q-two', answer: 'The neighbours', additionalComments: 'AI note', confidence: 0.6 };
    render(
      React.cloneElement(base, {
        questionPool: [...base.props.questionPool, { id: 'q-two', prompt: 'Who?', type: 'freeform' }],
        prefillPacket: { ...packet, responses: [...packet.responses, second] },
      }),
    );
    expect(await screen.findByRole('button', { name: /Additional comments for Who\?/ })).toHaveTextContent(
      'My private note AI note',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove draft for Who?' }));
    await submit();
    const review = onRecordProvenance.mock.calls[0][6] as Array<{ questionId: string }>;
    expect(review.find(({ questionId }) => questionId === 'q-two')).toMatchObject({
      selected: false,
      additionalComments: 'AI note',
    });
    expect(JSON.stringify(onRecordProvenance.mock.calls)).not.toContain('My private note');
  });
});

describe('what someone encrypted stays out of review and every AI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ['proposes a comment', 'From my AI'],
    ['proposes none', ''],
  ])(
    'counts an encrypted comment unlocked on the page as locked when the AI %s, and tells no AI what it says',
    async (_label, aiComment) => {
      const onApplyAdditional = jest.fn();
      render(modal(withComment('Secret reason', true), aiComment, onApplyAdditional));
      await screen.findByRole('button', { name: /Draft answer for Why\?/ });
      // With nothing to choose between, the comment row opens as for any locked comment.
      if (!aiComment) fireEvent.click(screen.getByRole('button', { name: 'Additional comments' }));
      expect(screen.getByRole('button', { name: /Additional comments for Why\?/ })).toHaveTextContent(
        'Your locked comment stays.',
      );
      expect(document.body).not.toHaveTextContent('Secret reason');
      if (aiComment) {
        // It can't be joined, so Both isn't offered: theirs is kept unless they choose the AI's.
        const choices = screen.getByRole('group', { name: 'Comment to submit' });
        expect(within(choices).queryByRole('button', { name: 'Both' })).toBeNull();
        expect(within(choices).getByRole('button', { name: 'Mine' })).toHaveAttribute('aria-pressed', 'true');
        choose('Mine');
      }

      const heard = await talk();
      expect(heard.instructions).toContain('Drafted answer');
      expect(heard.instructions).not.toContain('Secret reason');
      expect(heard.reviewed).toContain('"questionId":"q-text"');
      expect(heard.reviewed).not.toContain('Secret reason');

      // Kept, it is submitted exactly as it was.
      await submit();
      expect(onApplyAdditional).not.toHaveBeenCalled();
    },
  );

  it('says a card changes an encrypted answer without quoting it, even once unlocked on the page', async () => {
    let finish: (slice: InterviewSavedSlice) => void = () => {};
    const onLoadSavedResponses: InterviewSavedAnswerLoader = () => new Promise((resolve) => (finish = resolve));
    render(modal(null, '', jest.fn(), { onLoadSavedResponses }));
    // Their own answer in review stays when the saved one loads.
    fireEvent.click(await screen.findByRole('button', { name: /Draft answer for Why\?/ }));
    fireEvent.change(screen.getByRole('textbox', { name: /Draft answer for Why\?/ }), {
      target: { value: 'Typed answer' },
    });
    const answers = { 'q-text': { value: 'My private yes', encrypted: true } };
    await act(async () => finish({ answers, additionalComments: {}, importance: {}, conviction: {} }));
    expect(screen.getByText('Changes your earlier answer')).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('My private yes');
  });

  it('keeps what someone types into encrypted fields out of the voice context and the next mapping', async () => {
    // The answer was locked before anything was typed, and the comment follows its lock.
    render(modal({ answers: { 'q-text': { value: '', encrypted: true, audienceMode: 'explicit' } } }, 'From my AI'));
    fireEvent.click(await screen.findByRole('button', { name: /Draft answer for Why\?/ }));
    fireEvent.change(screen.getByRole('textbox', { name: /Draft answer for Why\?/ }), {
      target: { value: 'My private answer' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Additional comments for Why\?/ }));
    editComment('My private note');

    const heard = await talk();
    for (const typed of ['My private answer', 'My private note']) {
      expect(heard.instructions).not.toContain(typed);
      expect(heard.reviewed).not.toContain(typed);
    }
    expect(heard.reviewed).toContain('"questionId":"q-text"');
  });
});
