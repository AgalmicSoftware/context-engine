import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SessionVoiceModeModal from './SessionVoiceModeModal';

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

// An AI draft without a comment: review shows the saved comment, or an empty one.
const renderDraftWithoutAiComment = (existingResponseSlice: Record<string, unknown> | null) =>
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
      questionPool={[{ id: 'q-text', prompt: 'Why?', type: 'freeform' }]}
      existingResponseSlice={existingResponseSlice}
      prefillPacket={{
        version: 1,
        sessionSlug: 'demo',
        questionSetHash: 'a'.repeat(64),
        promptVersion: 'ce-interview-brief-v4',
        source: { platform: 'claude', modelId: 'claude-example', verification: 'self_reported' },
        responderContext: {},
        responses: [{ questionId: 'q-text', answer: 'Drafted answer', confidence: 0.65 }],
      }}
      onApplyAnswer={jest.fn()}
      onApplyAdditional={jest.fn()}
      onApplyImportance={jest.fn()}
      onApplyConviction={jest.fn()}
      onRecordProvenance={jest.fn()}
      onSubmitResponses={jest.fn()}
    />,
  );

const editComment = (value: string) =>
  fireEvent.change(screen.getByRole('textbox', { name: /Additional comments for Why\?/ }), { target: { value } });

describe('interview draft comments', () => {
  it('counts clearing the saved comment shown for a draft as a human edit', async () => {
    renderDraftWithoutAiComment({
      answers: { 'q-text': { value: 'Saved answer' } },
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
