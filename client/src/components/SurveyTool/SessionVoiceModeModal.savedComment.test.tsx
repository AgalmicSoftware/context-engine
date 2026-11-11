import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
