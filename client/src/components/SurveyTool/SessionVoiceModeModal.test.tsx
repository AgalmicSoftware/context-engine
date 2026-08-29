import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SessionVoiceModeModal from './SessionVoiceModeModal';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { hashInterviewQuestions, mapInterviewEvidenceToResponses } from './sessionInterview';
import { startSessionRealtimeInterview } from '../../utilities/audio/realtimeInterviewClient';

jest.mock('./SessionListeningPanel', () => (props: Record<string, unknown>) => (
  <div data-testid="mock-group-listening" data-mode={String(props.panelMode || '')} />
));

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

jest.mock('../../utilities/audio/realtimeInterviewClient', () => ({
  startSessionRealtimeInterview: jest.fn(),
}));

const baseProps = {
  isOpen: true,
  mode: null,
  onSelectMode: jest.fn(),
  onClose: jest.fn(),
  sessionSlug: 'demo',
  workerUrl: 'https://worker.example',
  questionPool: [{ id: 'q1', prompt: 'What matters?', type: 'freeform' }],
  existingResponseSlice: null,
  prefillPacket: null,
  onApplyAnswer: jest.fn(),
  onApplyAdditional: jest.fn(),
  onApplyImportance: jest.fn(),
  onApplyConviction: jest.fn(),
  onRecordProvenance: jest.fn(),
};

const mockedHashInterviewQuestions = jest.mocked(hashInterviewQuestions);
const mockedMapInterviewEvidenceToResponses = jest.mocked(mapInterviewEvidenceToResponses);
const mockedStartSessionRealtimeInterview = jest.mocked(startSessionRealtimeInterview);

describe('SessionVoiceModeModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jest.fn(async () => undefined) },
    });
    mockedHashInterviewQuestions.mockResolvedValue('a'.repeat(64));
    mockedMapInterviewEvidenceToResponses.mockResolvedValue([]);
  });

  it('offers the two large requested voice-mode choices', () => {
    render(<SessionVoiceModeModal {...baseProps} />);
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_VOICE_MODE_INTERVIEW));
    expect(baseProps.onSelectMode).toHaveBeenCalledWith('interview');
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_VOICE_MODE_GROUP));
    expect(baseProps.onSelectMode).toHaveBeenCalledWith('recordGroup');
  });

  it('opens Group Conversation directly for recordGroup mode', () => {
    render(<SessionVoiceModeModal {...baseProps} mode="recordGroup" />);
    expect(screen.getByTestId('mock-group-listening')).toHaveAttribute('data-mode', 'recordGroup');
  });

  it('keeps the copied memory prompt collapsed and confirms clipboard success with a checkmark', async () => {
    render(<SessionVoiceModeModal {...baseProps} mode="interview" />);

    expect(screen.queryByText(/A realtime voice interviewer will cover/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_CONTEXT)).not.toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveAccessibleName(
      'Interview status: Ready',
    );
    expect(screen.getByText(
      'Paste this prompt to augment interview with history from Claude or ChatGPT',
    )).toBeInTheDocument();
    const promptToggle = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_AGENT_PROMPT_TOGGLE);
    expect(promptToggle).toHaveAccessibleName('View prompt');
    expect(promptToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_AGENT_PROMPT)).not.toBeInTheDocument();
    const copyButton = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_COPY_AGENT_PROMPT);
    expect(copyButton).toHaveAccessibleName('Copy memory augmentation prompt');
    expect(copyButton).toHaveTextContent('');
    expect(screen.queryByText('Copy prompt')).not.toBeInTheDocument();

    fireEvent.click(copyButton);
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining(
      'review-only Context Engine interview prefill',
    )));
    expect(copyButton).toHaveAccessibleName('Memory augmentation prompt copied');
    expect(copyButton.querySelector('[data-icon="check"]')).toBeInTheDocument();

    fireEvent.click(promptToggle);
    expect(promptToggle).toHaveAccessibleName('Hide prompt');
    expect(promptToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_AGENT_PROMPT)).toHaveTextContent(
      /review-only Context Engine interview prefill.*https:\/\/worker\.example\/agent\/interview-catalog/,
    );

    fireEvent.click(promptToggle);
    expect(promptToggle).toHaveAccessibleName('View prompt');
    expect(promptToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_AGENT_PROMPT)).not.toBeInTheDocument();
  });

  it('shows a collapsed responder transcript disclosure after the voice interview ends', async () => {
    const stop = jest.fn(async () => ({
      transcript: 'Responder: Reversible decisions matter.',
      turns: [{ itemId: 'turn-1', text: 'Reversible decisions matter.', role: 'responder' as const }],
    }));
    mockedStartSessionRealtimeInterview.mockImplementation(async (options) => {
      options.onTranscript?.('Responder: Reversible decisions matter.', [
        { itemId: 'turn-1', text: 'Reversible decisions matter.', role: 'responder' },
      ]);
      return { stop, getTranscript: () => 'Responder: Reversible decisions matter.' };
    });

    render(<SessionVoiceModeModal {...baseProps} mode="interview" />);
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_TRANSCRIPT_TOGGLE)).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    expect(await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STOP)).toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_TRANSCRIPT_TOGGLE)).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STOP));
    const toggle = await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_TRANSCRIPT_TOGGLE);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveTextContent('4 words');
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_TRANSCRIPT)).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_TRANSCRIPT)).toHaveTextContent(
      'Responder: Reversible decisions matter.',
    );
    await waitFor(() => expect(mockedMapInterviewEvidenceToResponses).toHaveBeenCalledWith(
      expect.objectContaining({ transcript: 'Responder: Reversible decisions matter.' }),
    ));
  });

  it('maps imported context into reviewable drafts and never selects replacement of an existing draft silently', async () => {
    mockedMapInterviewEvidenceToResponses.mockResolvedValue([
      { questionId: 'q1', answer: 'Original prediction', evidence: 'Related memory', confidence: 0.81 },
    ]);
    const prefillPacket = {
      version: 1 as const,
      sessionSlug: 'demo',
      questionSetHash: 'a'.repeat(64),
      promptVersion: 'ce-interview-brief-v1',
      source: { platform: 'chatgpt' as const, modelId: 'gpt-example', verification: 'self_reported' as const },
      responderContext: { summary: 'Relevant context' },
    };
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        prefillPacket={prefillPacket}
        existingResponseSlice={{ answers: { q1: { value: 'Existing local draft' } } }}
      />,
    );

    expect(await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW)).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_CONTEXT)).toHaveValue('Relevant context');
    const replacement = screen.getByRole('button', { name: 'Replace with draft' });
    expect(replacement).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Remove draft for What matters?' })).toBeDisabled();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY)).toBeDisabled();

    fireEvent.click(replacement);
    fireEvent.change(screen.getByDisplayValue('Original prediction'), { target: { value: 'Reviewed answer' } });
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));

    await waitFor(() => expect(baseProps.onApplyAnswer).toHaveBeenCalledWith('q1', 'Reviewed answer'));
    await waitFor(() => expect(baseProps.onRecordProvenance).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ questionId: 'q1', answer: 'Original prediction' })]),
      prefillPacket.source,
      prefillPacket,
      true,
    ));
    await waitFor(() => expect(baseProps.onClose).toHaveBeenCalled());
  });

  it('reviews agent-authored predictions with confidence without remapping or misattributing them', async () => {
    const prefillPacket = {
      version: 1 as const,
      sessionSlug: 'demo',
      questionSetHash: 'a'.repeat(64),
      promptVersion: 'ce-interview-brief-v3',
      source: { platform: 'claude' as const, modelId: 'claude-example', verification: 'self_reported' as const },
      responderContext: { summary: 'A tentative related signal.' },
      responses: [{
        questionId: 'q1',
        answer: 'A cautious prediction',
        confidence: 0.22,
        evidence: 'A related but indirect statement in authorized conversation history.',
      }],
    };
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        prefillPacket={prefillPacket}
      />,
    );

    expect(await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW)).toBeInTheDocument();
    expect(screen.getByDisplayValue('A cautious prediction')).toBeInTheDocument();
    expect(screen.getByLabelText('Prediction confidence: 22% (Weak inference)')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Confidence for What matters?' })).toHaveAttribute(
      'aria-valuenow',
      '22',
    );
    expect(screen.getByText('22% confidence')).toBeInTheDocument();
    expect(screen.getByText('Weak inference')).toBeInTheDocument();
    expect(screen.queryByText(/related but indirect statement/i)).not.toBeInTheDocument();
    const basisToggle = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_DRAFT_BASIS_TOGGLE);
    expect(basisToggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(basisToggle);
    expect(basisToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/related but indirect statement/i)).toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_GENERATE)).not.toBeInTheDocument();
    expect(mockedMapInterviewEvidenceToResponses).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
    await waitFor(() => expect(baseProps.onRecordProvenance).toHaveBeenCalledWith(
      [expect.objectContaining({ questionId: 'q1', confidence: 0.22 })],
      prefillPacket.source,
      prefillPacket,
      true,
    ));
  });

  it('uses the pile-view Agree, Unsure, and Disagree control for binary drafts', async () => {
    const prefillPacket = {
      version: 1 as const,
      sessionSlug: 'demo',
      questionSetHash: 'a'.repeat(64),
      promptVersion: 'ce-interview-brief-v4',
      source: { platform: 'claude' as const, modelId: 'claude-example', verification: 'self_reported' as const },
      responderContext: {},
      responses: [{ questionId: 'q-binary', answer: 'Agree', confidence: 0.65 }],
    };
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        questionPool={[{ id: 'q-binary', prompt: 'Proceed?', type: 'binary' }]}
        prefillPacket={prefillPacket}
      />,
    );

    expect(await screen.findByLabelText('Agree')).toBeChecked();
    expect(screen.getByLabelText('Unsure')).not.toBeChecked();
    expect(screen.getByLabelText('Disagree')).not.toBeChecked();
    fireEvent.click(screen.getByLabelText('Unsure'));
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
    await waitFor(() => expect(baseProps.onApplyAnswer).toHaveBeenCalledWith('q-binary', 'Unsure'));
  });

  it('removes and restores a proposed draft with compact card controls', async () => {
    const prefillPacket = {
      version: 1 as const,
      sessionSlug: 'demo',
      questionSetHash: 'a'.repeat(64),
      promptVersion: 'ce-interview-brief-v4',
      source: { platform: 'chatgpt' as const, modelId: 'gpt-example', verification: 'self_reported' as const },
      responderContext: {},
      responses: [{ questionId: 'q1', answer: 'Draft answer', confidence: 0.7 }],
    };
    render(<SessionVoiceModeModal {...baseProps} mode="interview" prefillPacket={prefillPacket} />);

    const remove = await screen.findByRole('button', { name: 'Remove draft for What matters?' });
    expect(remove).toBeEnabled();
    fireEvent.click(remove);
    expect(screen.getByText('0 of 1 selected')).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY)).toBeDisabled();

    const restore = screen.getByRole('button', { name: 'Apply draft' });
    expect(restore).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(restore);
    expect(screen.getByText('1 of 1 selected')).toBeInTheDocument();
    expect(remove).toBeEnabled();
  });

  it('explains when the evidence is insufficient and does not offer a futile retry', async () => {
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        prefillPacket={{
          version: 1,
          sessionSlug: 'demo',
          questionSetHash: 'a'.repeat(64),
          promptVersion: 'ce-interview-brief-v1',
          source: { platform: 'chatgpt', modelId: 'gpt-example', verification: 'self_reported' },
          responderContext: { summary: 'A brief unrelated note.' },
        }}
      />,
    );

    const notice = await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_MAPPING_NOTICE);
    expect(notice).toHaveTextContent('Not enough information to generate response drafts.');
    expect(notice).toHaveTextContent('did not contain enough directly relevant detail');
    expect(notice).toHaveTextContent('Start another interview and share more detail');
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW)).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_GENERATE)).not.toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveAccessibleName(
      'Interview status: No questions had enough evidence to prefill',
    );

    fireEvent.change(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_CONTEXT), {
      target: { value: 'Detailed evidence directly related to the question.' },
    });
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_MAPPING_NOTICE)).not.toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_GENERATE)).toBeInTheDocument();
  });

  it('removes prediction provenance for applied drafts when the responder opts out', async () => {
    mockedMapInterviewEvidenceToResponses.mockResolvedValue([
      { questionId: 'q1', answer: 'Draft answer', confidence: 0.76 },
    ]);
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        prefillPacket={{
          version: 1,
          sessionSlug: 'demo',
          questionSetHash: 'a'.repeat(64),
          promptVersion: 'ce-interview-brief-v1',
          source: { platform: 'claude', modelId: 'claude-example', verification: 'self_reported' },
          responderContext: { summary: 'Relevant context' },
        }}
      />,
    );

    expect(await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Include self-reported AI platform\/model provenance/i));
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));

    await waitFor(() => expect(baseProps.onRecordProvenance).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ questionId: 'q1' })]),
      expect.objectContaining({ platform: 'claude' }),
      expect.any(Object),
      false,
    ));
    await waitFor(() => expect(baseProps.onClose).toHaveBeenCalled());
  });

  it('rejects stale imported context before calling the mapper', async () => {
    mockedHashInterviewQuestions.mockResolvedValue('b'.repeat(64));
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        prefillPacket={{
          version: 1,
          sessionSlug: 'demo',
          questionSetHash: 'a'.repeat(64),
          promptVersion: 'ce-interview-brief-v1',
          source: { platform: 'chatgpt', modelId: 'gpt-example', verification: 'self_reported' },
          responderContext: { summary: 'Relevant context' },
        }}
      />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/older or different question set/i);
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveAccessibleName(
      'Interview status: Mapping failed',
    );
    expect(mapInterviewEvidenceToResponses).not.toHaveBeenCalled();
  });
});
