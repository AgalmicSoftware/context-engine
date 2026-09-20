import { useInterviewReadiness } from './useInterviewReadiness';
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SessionVoiceModeModal from './SessionVoiceModeModal';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import {
  buildExternalInterviewKickoff,
  hashInterviewQuestions,
  mapInterviewEvidenceToResponses,
} from './sessionInterview';
import { startSessionRealtimeInterview } from '../../utilities/audio/realtimeInterviewClient';
import { useSessionInterviewGroupRecommendations } from './useSessionInterviewGroupRecommendations';

jest.mock('./SessionInterviewRecommendedGroups', () => ({
  __esModule: true,
  default: (props: { recommendations?: unknown[] }) =>
    props.recommendations?.length ? <div data-testid="mock-group-recommendations" /> : null,
}));

jest.mock('./useSessionInterviewGroupRecommendations', () => ({
  useSessionInterviewGroupRecommendations: jest.fn(() => []),
}));

jest.mock('./CreateQuestionsAndSurveys', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-create-questions">Question creation editor</div>,
}));

jest.mock('./useInterviewReadiness', () => ({
  useInterviewReadiness: jest.fn(() => ({ state: 'ready', detail: 'Voice setup ready.', retry: jest.fn() })),
}));

jest.mock('./useInterviewOpening', () => ({
  useInterviewOpening: () => ({ opening: '', notice: '', loading: false }),
}));

jest.mock('./SessionListeningPanel', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => (
    <div
      data-testid="mock-group-listening"
      data-mode={String(props.panelMode || '')}
      data-embedded={String(Boolean(props.embeddedInModal))}
    />
  ),
  SessionListeningWaveform: () => <canvas data-testid="mock-interview-waveform" />,
  formatSessionRecordingElapsed: (seconds: number) => `0:${String(seconds).padStart(2, '0')}`,
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

jest.mock('../../utilities/audio/realtimeInterviewClient', () => ({
  startSessionRealtimeInterview: jest.fn(),
}));

const baseProps = {
  isOpen: true,
  mode: null,
  onSelectMode: jest.fn(),
  onClose: jest.fn(),
  onSubmitResponses: jest.fn(),
  toggleLoginModal: jest.fn(),
  sessionSlug: 'demo',
  account: '0x0000000000000000000000000000000000000001',
  loginComplete: true,
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
const mockedUseSessionInterviewGroupRecommendations = jest.mocked(useSessionInterviewGroupRecommendations);

const buildAllowedSuggestionSessionConfig = () => ({
  slug: 'demo',
  sessionId: `0x${'1'.repeat(32)}`,
  corsWorkerUrl: 'https://worker.example/',
  interviewMode: { suggestQuestions: true },
  sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
  workerAuthority: { version: 1, participantScopes: ['storage'], anonymousScopes: [] },
  storageProfile: {
    backend: 'cloudflare',
    resources: { questions: 'active', surveys: 'active' },
    payloadAccessControl: { gate: 'none', encryption: 'none' },
  },
});

const editableButtonName = (label: string) => `${label}. Activate to edit.`;

const expectReadableDraftText = async (label: string, value: string) => {
  const button = await screen.findByRole('button', { name: editableButtonName(label) });
  expect(button).toHaveTextContent(value);
  return button;
};

const editReadableDraftText = async (label: string, value: string) => {
  const button = await screen.findByRole('button', { name: editableButtonName(label) });
  fireEvent.click(button);
  const editor = screen.getByLabelText(label);
  fireEvent.change(editor, { target: { value } });
  fireEvent.blur(editor);
};

describe('SessionVoiceModeModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .mocked(useInterviewReadiness)
      .mockReturnValue({ state: 'ready', detail: 'Voice setup ready.', retry: jest.fn() });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jest.fn(async () => undefined) },
    });
    baseProps.onSubmitResponses.mockResolvedValue({ status: 'submitted' });
    mockedHashInterviewQuestions.mockResolvedValue('a'.repeat(64));
    mockedMapInterviewEvidenceToResponses.mockResolvedValue([]);
  });

  it.each([
    ['checking', 'Checking setup', 'pending'],
    ['unavailable', 'Setup needed', 'error'],
    ['unknown', 'Not checked', 'pending'],
  ] as const)('shows %s readiness without a misleading green pill', (state, label, tone) => {
    jest.mocked(useInterviewReadiness).mockReturnValue({ state, detail: 'Check setup.', retry: jest.fn() });
    render(<SessionVoiceModeModal {...baseProps} mode="interview" />);
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent(label);
    expect(screen.getByRole('button', { name: `Interview status: ${label}` })).toHaveAttribute('data-tone', tone);
  });

  it('shows suggested questions in an expanded section without submitting anything', async () => {
    mockedMapInterviewEvidenceToResponses.mockImplementation(async ({ onSuggestedQuestions }) => {
      onSuggestedQuestions?.([{ id: 'new', type: 'freeform', prompt: 'Which AI risks are overlooked?', tags: [] }]);
      return [];
    });
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        sessionConfig={buildAllowedSuggestionSessionConfig()}
        prefillPacket={{
          version: 1,
          sessionSlug: 'demo',
          source: { platform: 'other', modelId: 'unknown', verification: 'self_reported' },
          responderContext: { summary: 'AI risks deserve discussion.' },
        }}
      />,
    );
    const section = await screen.findByText('Suggested new questions (1)');
    expect(section.closest('details')).toHaveAttribute('open');
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent('Review drafts');
    expect(screen.getByText(/No matching answers yet. Review the suggested questions below./)).toBeInTheDocument();
    expect(baseProps.onApplyAnswer).not.toHaveBeenCalled();
    expect(baseProps.onSubmitResponses).not.toHaveBeenCalled();
  });

  it('puts collapsible responses before suggested questions and preserves edits when collapsed', async () => {
    mockedMapInterviewEvidenceToResponses.mockImplementation(async ({ onSuggestedQuestions }) => {
      onSuggestedQuestions?.([{ id: 'new', type: 'freeform', prompt: 'Which AI risks are overlooked?', tags: [] }]);
      return [{ questionId: 'q1', answer: 'Original draft', additionalComments: 'An explanation', confidence: 0.8 }];
    });
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        sessionConfig={buildAllowedSuggestionSessionConfig()}
        prefillPacket={{
          version: 1,
          sessionSlug: 'demo',
          source: { platform: 'other', modelId: 'unknown', verification: 'self_reported' },
          responderContext: { summary: 'AI risks deserve discussion.' },
        }}
      />,
    );
    const review = await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
    const suggestions = screen.getByRole('heading', { name: 'Suggested new questions (1)' }).closest('details');
    expect(review).toHaveAttribute('open');
    expect(suggestions).toHaveAttribute('open');
    expect(review.compareDocumentPosition(suggestions!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    await expectReadableDraftText('Draft answer for What matters?', 'Original draft');
    expect(screen.getByLabelText('AI-proposed response')).toBeInTheDocument();
    await editReadableDraftText('Draft answer for What matters?', 'My edited answer');
    await expectReadableDraftText('Draft answer for What matters?', 'My edited answer');
    expect(screen.queryByLabelText('AI-proposed response')).not.toBeInTheDocument();
    const summary = review.querySelector('summary')!;
    fireEvent.click(summary);
    expect(review).not.toHaveAttribute('open');
    fireEvent.click(summary);
    expect(review).toHaveAttribute('open');
    await expectReadableDraftText('Draft answer for What matters?', 'My edited answer');
    expect(screen.queryByRole('button', { name: 'Draft selected' })).not.toBeInTheDocument();
    expect(screen.queryByText('1 of 1 selected')).not.toBeInTheDocument();
    await editReadableDraftText('Additional comments for What matters?', 'My own comment');
    await expectReadableDraftText('Additional comments for What matters?', 'My own comment');
    fireEvent.click(screen.getByRole('button', { name: 'Submit responses' }));
    await waitFor(() => expect(baseProps.onApplyAnswer).toHaveBeenCalledWith('q1', 'My edited answer'));
    expect(baseProps.onApplyAdditional).toHaveBeenCalledWith('q1', 'My own comment');
  });

  it('keeps existing user comments unprefixed until edited', async () => {
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        existingResponseSlice={{ additionalComments: { q1: { value: 'My existing comment' } } }}
        prefillPacket={{
          version: 1,
          sessionSlug: 'demo',
          source: { platform: 'other', modelId: 'unknown', verification: 'self_reported' },
          responderContext: {},
          responses: [{ questionId: 'q1', answer: 'Agent draft', confidence: 0.8 }],
        }}
      />,
    );
    await expectReadableDraftText('Additional comments for What matters?', 'My existing comment');
    expect(screen.queryByLabelText('AI-proposed comment')).not.toBeInTheDocument();
    await editReadableDraftText('Additional comments for What matters?', 'My revised comment');
    await expectReadableDraftText('Additional comments for What matters?', 'My revised comment');
  });

  it('does not treat direct user context as an AI prefill for research consent', async () => {
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        prefillPacket={{
          version: 1,
          sessionSlug: 'demo',
          responderContext: { summary: 'My own context' },
          source: { platform: 'other', modelId: 'direct-user-context', verification: 'self_reported' },
          responses: [{ questionId: 'q1', answer: 'Agent: A reviewed answer', confidence: 0.8 }],
        }}
      />,
    );
    await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_PREDICTION_COMPARISON)).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'AI research metadata' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
    await waitFor(() => expect(baseProps.onApplyAnswer).toHaveBeenCalledWith('q1', 'Agent: A reviewed answer'));
    await waitFor(() =>
      expect(baseProps.onRecordProvenance).toHaveBeenCalledWith(
        [expect.objectContaining({ questionId: 'q1', answer: 'Agent: A reviewed answer' })],
        expect.any(Object),
        expect.any(Object),
        false,
        false,
        '',
        expect.arrayContaining([expect.objectContaining({ questionId: 'q1', answer: 'Agent: A reviewed answer' })]),
      ),
    );
  });

  it('shows the live status pill with setup details available in its tooltip', async () => {
    render(<SessionVoiceModeModal {...baseProps} mode="interview" />);
    const help = screen.getByRole('button', { name: 'About Interview' });
    const status = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS);
    expect(help.closest('.modal-header')).not.toBeNull();
    expect(status.closest('.modal-header')).not.toBeNull();
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(screen.queryByText(/Speak with an AI interviewer/)).not.toBeInTheDocument();
    fireEvent.focus(help);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Stopping prepares drafts for your review');
    fireEvent.blur(help);
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
    fireEvent.focus(screen.getByRole('button', { name: 'Interview status: Ready' }));
    expect(status).toHaveTextContent('Ready');
    expect(screen.getByRole('button', { name: 'Interview status: Ready' })).toHaveAttribute('data-tone', 'ready');
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Voice setup ready.');
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START)).toHaveAccessibleName('Start voice interview');
  });

  it('submits reviewed values and retains edited unselected predictions only as consented metadata', async () => {
    const prefillPacket = {
      version: 1 as const,
      sessionSlug: 'demo',
      questionSetHash: 'a'.repeat(64),
      promptVersion: 'ce-interview-brief-v4',
      source: { platform: 'claude' as const, modelId: 'example', verification: 'self_reported' as const },
      responderContext: {},
      responses: [
        { questionId: 'q1', answer: 'Original one', additionalComments: 'Relevant explanation', confidence: 0.8 },
        { questionId: 'q2', answer: 'Original two', confidence: 0.8 },
      ],
    };
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        prefillPacket={prefillPacket}
        questionPool={[...baseProps.questionPool, { id: 'q2', prompt: 'Second question?', type: 'freeform' }]}
        renderFieldLock={(id, field) => <button type="button" aria-label={`Privacy ${id} ${field}`} />}
      />,
    );
    await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
    expect(screen.getByLabelText(/Include self-reported AI platform/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Privacy q1 answer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Privacy q1 additional' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About accuracy research' })).toHaveAccessibleDescription(
      /drafts you did not select/,
    );
    const metadata = screen.getByRole('group', { name: 'AI prefill metadata' });
    expect(metadata).not.toHaveAttribute('open');
    expect(metadata.querySelector('summary')).toHaveTextContent('AI prefill metadata · example');
    fireEvent.click(metadata.querySelector('summary')!);
    expect(metadata).toHaveAttribute('open');
    expect(metadata).toHaveTextContent('Claude');
    expect(metadata).toHaveTextContent('Self-reported');
    expect(metadata).toHaveTextContent('ce-interview-brief-v4');
    expect(metadata).toHaveTextContent('a'.repeat(64));
    expect(metadata).toHaveTextContent(
      'Predictions, reviewed values, changed fields, and unselected drafts will not be included.',
    );
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_PREDICTION_COMPARISON));
    expect(metadata).toHaveTextContent('2 selected drafts and 0 unselected drafts');
    await editReadableDraftText('Draft answer for What matters?', 'Edited one');
    await editReadableDraftText('Additional comments for What matters?', 'Edited explanation');
    await editReadableDraftText('Draft answer for Second question?', 'Edited two');
    fireEvent.click(screen.getByRole('button', { name: 'Remove draft for Second question?' }));
    expect(metadata).toHaveTextContent('1 selected draft and 1 unselected draft');
    expect(baseProps.onSubmitResponses).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Submit responses' }));
    await waitFor(() => expect(baseProps.onSubmitResponses).toHaveBeenCalledTimes(1));
    expect(baseProps.onApplyAnswer).toHaveBeenCalledTimes(1);
    expect(baseProps.onApplyAnswer).toHaveBeenCalledWith('q1', 'Edited one');
    expect(baseProps.onApplyAdditional).toHaveBeenCalledWith('q1', 'Edited explanation');
    expect(baseProps.onRecordProvenance.mock.calls[0][6]).toEqual([
      expect.objectContaining({
        questionId: 'q1',
        answer: 'Edited one',
        selected: true,
        original: {
          ...prefillPacket.responses[0],
          revisions: [
            expect.objectContaining({
              revision: 1,
              answer: prefillPacket.responses[0].answer,
              modelId: prefillPacket.source.modelId,
            }),
          ],
        },
      }),
      expect.objectContaining({
        questionId: 'q2',
        answer: 'Edited two',
        selected: false,
        original: {
          ...prefillPacket.responses[1],
          revisions: [
            expect.objectContaining({
              revision: 1,
              answer: prefillPacket.responses[1].answer,
              modelId: prefillPacket.source.modelId,
            }),
          ],
        },
      }),
    ]);
    expect(baseProps.onRecordProvenance.mock.invocationCallOrder[0]).toBeLessThan(
      baseProps.onSubmitResponses.mock.invocationCallOrder[0],
    );
  });

  it('waits for an identity-bound response readiness token after login', async () => {
    mockedMapInterviewEvidenceToResponses.mockResolvedValue([
      { questionId: 'q1', answer: 'Original prediction', evidence: 'Related memory', confidence: 0.81 },
    ]);
    const onSubmitResponses = jest
      .fn()
      .mockResolvedValueOnce({ status: 'login-required' })
      .mockResolvedValueOnce({ status: 'submitted' });
    const prefillPacket = {
      version: 1 as const,
      sessionSlug: 'demo',
      questionSetHash: 'a'.repeat(64),
      promptVersion: 'ce-interview-brief-v1',
      source: { platform: 'chatgpt' as const, modelId: 'gpt-example', verification: 'self_reported' as const },
      responderContext: { summary: 'Relevant context' },
    };
    const submitContextToken = 'demo|111|worker-a|session-a';
    const account = '0x0000000000000000000000000000000000000001';
    const view = render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        loginComplete={false}
        account=""
        submitContextToken={submitContextToken}
        prefillPacket={prefillPacket}
        onSubmitResponses={onSubmitResponses}
      />,
    );

    await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
    await editReadableDraftText('Draft answer for What matters?', 'Reviewed after login');
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
    await waitFor(() => expect(onSubmitResponses).toHaveBeenCalledTimes(1));

    view.rerender(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        loginComplete
        account={account}
        isResponsesCacheReady
        responseReadinessContextToken=""
        submitContextToken={submitContextToken}
        prefillPacket={prefillPacket}
        onSubmitResponses={onSubmitResponses}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent('Waiting for session data'),
    );
    expect(baseProps.onApplyAnswer).not.toHaveBeenCalled();
    expect(onSubmitResponses).toHaveBeenCalledTimes(1);

    view.rerender(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        loginComplete
        account={account}
        isResponsesCacheReady
        responseReadinessContextToken={`${submitContextToken}|${account}|true`}
        submitContextToken={submitContextToken}
        prefillPacket={prefillPacket}
        onSubmitResponses={onSubmitResponses}
      />,
    );

    await waitFor(() => expect(baseProps.onApplyAnswer).toHaveBeenCalledWith('q1', 'Reviewed after login'));
    expect(onSubmitResponses).toHaveBeenCalledTimes(2);
  });

  it('opens the normal login modal when a logged-out draft submit is deferred', async () => {
    mockedMapInterviewEvidenceToResponses.mockResolvedValue([
      { questionId: 'q1', answer: 'Original prediction', evidence: 'Related memory', confidence: 0.81 },
    ]);
    const onSubmitResponses = jest.fn().mockResolvedValue(undefined);
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
        loginComplete={false}
        account=""
        prefillPacket={prefillPacket}
        onSubmitResponses={onSubmitResponses}
      />,
    );

    await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));

    await waitFor(() => expect(onSubmitResponses).toHaveBeenCalledTimes(1));
    expect(baseProps.toggleLoginModal).toHaveBeenCalledWith(true);
    expect(baseProps.onApplyAnswer).not.toHaveBeenCalled();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent('Log in to submit');
  });

  it('preserves reviewed drafts while logged out and submits them after login completes', async () => {
    mockedMapInterviewEvidenceToResponses.mockResolvedValue([
      { questionId: 'q1', answer: 'Original prediction', evidence: 'Related memory', confidence: 0.81 },
    ]);
    const onSubmitResponses = jest
      .fn()
      .mockResolvedValueOnce({ status: 'login-required' })
      .mockResolvedValueOnce({ status: 'submitted' });
    const prefillPacket = {
      version: 1 as const,
      sessionSlug: 'demo',
      questionSetHash: 'a'.repeat(64),
      promptVersion: 'ce-interview-brief-v1',
      source: { platform: 'chatgpt' as const, modelId: 'gpt-example', verification: 'self_reported' as const },
      responderContext: { summary: 'Relevant context' },
    };
    const view = render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        loginComplete={false}
        account=""
        prefillPacket={prefillPacket}
        onSubmitResponses={onSubmitResponses}
      />,
    );

    expect(await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW)).toBeInTheDocument();
    await editReadableDraftText('Draft answer for What matters?', 'Reviewed after login');
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));

    await waitFor(() => expect(onSubmitResponses).toHaveBeenCalledTimes(1));
    expect(baseProps.onApplyAnswer).not.toHaveBeenCalled();
    expect(baseProps.onRecordProvenance).not.toHaveBeenCalled();
    expect(baseProps.onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent('Log in to submit');
    expect(await screen.findByRole('button', { name: /Draft answer for What matters/i })).toHaveTextContent(
      'Reviewed after login',
    );

    view.rerender(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        loginComplete
        account="0x0000000000000000000000000000000000000001"
        isResponsesCacheReady={false}
        prefillPacket={prefillPacket}
        onSubmitResponses={onSubmitResponses}
      />,
    );

    await waitFor(() => expect(onSubmitResponses).toHaveBeenCalledTimes(1));
    expect(baseProps.onApplyAnswer).not.toHaveBeenCalled();

    view.rerender(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        loginComplete
        account="0x0000000000000000000000000000000000000001"
        isResponsesCacheReady
        prefillPacket={prefillPacket}
        onSubmitResponses={onSubmitResponses}
      />,
    );

    await waitFor(() => expect(baseProps.onApplyAnswer).toHaveBeenCalledWith('q1', 'Reviewed after login'));
    await waitFor(() => expect(onSubmitResponses).toHaveBeenCalledTimes(2));
    expect(baseProps.onRecordProvenance).toHaveBeenCalled();
    expect(baseProps.onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent('Responses submitted');
  });

  it('cancels deferred submit when login is dismissed before authentication', async () => {
    mockedMapInterviewEvidenceToResponses.mockResolvedValue([
      { questionId: 'q1', answer: 'Original prediction', evidence: 'Related memory', confidence: 0.81 },
    ]);
    const onSubmitResponses = jest.fn().mockResolvedValue({ status: 'login-required' });
    const prefillPacket = {
      version: 1 as const,
      sessionSlug: 'demo',
      questionSetHash: 'a'.repeat(64),
      promptVersion: 'ce-interview-brief-v1',
      source: { platform: 'chatgpt' as const, modelId: 'gpt-example', verification: 'self_reported' as const },
      responderContext: { summary: 'Relevant context' },
    };
    const view = render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        loginComplete={false}
        account=""
        prefillPacket={prefillPacket}
        onSubmitResponses={onSubmitResponses}
      />,
    );
    await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
    await waitFor(() => expect(onSubmitResponses).toHaveBeenCalledTimes(1));

    view.rerender(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        loginComplete={false}
        account=""
        loginModalToggled
        prefillPacket={prefillPacket}
        onSubmitResponses={onSubmitResponses}
      />,
    );
    view.rerender(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        loginComplete={false}
        account=""
        loginModalToggled={false}
        prefillPacket={prefillPacket}
        onSubmitResponses={onSubmitResponses}
      />,
    );
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent('Login required');

    view.rerender(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        loginComplete
        account="0x0000000000000000000000000000000000000001"
        prefillPacket={prefillPacket}
        onSubmitResponses={onSubmitResponses}
      />,
    );
    await waitFor(() => expect(onSubmitResponses).toHaveBeenCalledTimes(1));
    expect(baseProps.onApplyAnswer).not.toHaveBeenCalled();
  });

  it('does not apply signed-in drafts after the hydrated account changes', async () => {
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
    const view = render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        loginComplete
        account="0x0000000000000000000000000000000000000001"
        isResponsesCacheReady={false}
        submitContextToken="demo|111"
        prefillPacket={prefillPacket}
      />,
    );
    await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent('Waiting for session data');

    view.rerender(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        loginComplete
        account="0x0000000000000000000000000000000000000002"
        isResponsesCacheReady
        submitContextToken="demo|111"
        prefillPacket={prefillPacket}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent('Review drafts'),
    );
    expect(baseProps.onApplyAnswer).not.toHaveBeenCalled();
    expect(baseProps.onSubmitResponses).not.toHaveBeenCalled();
  });

  it('drops deferred interview drafts when the session context changes before login completes', async () => {
    mockedMapInterviewEvidenceToResponses.mockResolvedValue([
      { questionId: 'q1', answer: 'Original prediction', evidence: 'Related memory', confidence: 0.81 },
    ]);
    const onSubmitResponses = jest
      .fn()
      .mockResolvedValueOnce({ status: 'login-required' })
      .mockResolvedValueOnce({ status: 'submitted' });
    const prefillPacket = {
      version: 1 as const,
      sessionSlug: 'demo',
      questionSetHash: 'a'.repeat(64),
      promptVersion: 'ce-interview-brief-v1',
      source: { platform: 'chatgpt' as const, modelId: 'gpt-example', verification: 'self_reported' as const },
      responderContext: { summary: 'Relevant context' },
    };
    const view = render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        loginComplete={false}
        account=""
        submitContextToken="demo|1"
        prefillPacket={prefillPacket}
        onSubmitResponses={onSubmitResponses}
      />,
    );
    await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
    await waitFor(() => expect(onSubmitResponses).toHaveBeenCalledTimes(1));

    view.rerender(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        loginComplete
        account="0x0000000000000000000000000000000000000001"
        submitContextToken="other-session|1"
        prefillPacket={prefillPacket}
        onSubmitResponses={onSubmitResponses}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent('Review drafts'),
    );
    expect(onSubmitResponses).toHaveBeenCalledTimes(1);
    expect(baseProps.onApplyAnswer).not.toHaveBeenCalled();
  });

  it('drops deferred interview drafts when Worker identity changes on the same route before login completes', async () => {
    mockedMapInterviewEvidenceToResponses.mockResolvedValue([
      { questionId: 'q1', answer: 'Original prediction', evidence: 'Related memory', confidence: 0.81 },
    ]);
    const onSubmitResponses = jest
      .fn()
      .mockResolvedValueOnce({ status: 'login-required' })
      .mockResolvedValueOnce({ status: 'submitted' });
    const prefillPacket = {
      version: 1 as const,
      sessionSlug: 'demo',
      questionSetHash: 'a'.repeat(64),
      promptVersion: 'ce-interview-brief-v1',
      source: { platform: 'chatgpt' as const, modelId: 'gpt-example', verification: 'self_reported' as const },
      responderContext: { summary: 'Relevant context' },
    };
    const view = render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        loginComplete={false}
        account=""
        submitContextToken="demo|111|worker-a|session-a"
        prefillPacket={prefillPacket}
        onSubmitResponses={onSubmitResponses}
      />,
    );
    await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
    await waitFor(() => expect(onSubmitResponses).toHaveBeenCalledTimes(1));

    view.rerender(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        loginComplete
        account="0x0000000000000000000000000000000000000001"
        isResponsesCacheReady
        responseReadinessContextToken="demo|111|worker-b|session-b|0x0000000000000000000000000000000000000001|true"
        submitContextToken="demo|111|worker-b|session-b"
        prefillPacket={prefillPacket}
        onSubmitResponses={onSubmitResponses}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent('Review drafts'),
    );
    expect(onSubmitResponses).toHaveBeenCalledTimes(1);
    expect(baseProps.onApplyAnswer).not.toHaveBeenCalled();
  });

  it('keeps suggested questions mounted but read-only when the signed-in account cannot author', async () => {
    mockedMapInterviewEvidenceToResponses.mockImplementation(async ({ onSuggestedQuestions }) => {
      onSuggestedQuestions?.([{ id: 'new', type: 'freeform', prompt: 'Which AI risks are overlooked?', tags: [] }]);
      return [];
    });
    const view = render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        loginComplete={false}
        account=""
        sessionConfig={{
          interviewMode: { suggestQuestions: true },
          sessionModeProfile: { authority: { mode: 'worker_canonical' } },
          workerAuthority: { version: 1, participantScopes: ['storage'] },
          storageProfile: { backend: 'cloudflare', resources: { questions: 'active' } },
        }}
        prefillPacket={{
          version: 1,
          sessionSlug: 'demo',
          source: { platform: 'other', modelId: 'unknown', verification: 'self_reported' },
          responderContext: { summary: 'AI risks deserve discussion.' },
        }}
      />,
    );

    await screen.findByText('Suggested new questions (1)');
    expect(screen.getByTestId('mock-create-questions')).toBeVisible();

    view.rerender(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        loginComplete
        account="0x0000000000000000000000000000000000000002"
        sessionConfig={{
          interviewMode: { suggestQuestions: true },
          sessionModeProfile: { authority: { mode: 'worker_canonical' } },
          workerAuthority: { version: 1, participantScopes: ['ai'] },
          storageProfile: { backend: 'cloudflare', resources: { questions: 'active' } },
        }}
        prefillPacket={{
          version: 1,
          sessionSlug: 'demo',
          source: { platform: 'other', modelId: 'unknown', verification: 'self_reported' },
          responderContext: { summary: 'AI risks deserve discussion.' },
        }}
      />,
    );

    expect(screen.queryByRole('heading', { name: 'Suggested new questions (1)' })).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Suggested new questions (1)', hidden: true }).closest('details'),
    ).not.toBeVisible();
    expect(screen.getByTestId('mock-create-questions')).not.toBeVisible();
  });

  it('does not mount group recommendations while interview mapping is still running', async () => {
    mockedUseSessionInterviewGroupRecommendations.mockReturnValue([
      {
        groupId: 'ai-optimists',
        reason: 'They asked for accountability groups.',
        evidence: 'I want AI accountability groups.',
      },
    ]);
    let finishMapping: ((value: []) => void) | null = null;
    mockedMapInterviewEvidenceToResponses.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishMapping = resolve;
        }),
    );
    mockedStartSessionRealtimeInterview.mockImplementation(async (options) => {
      options.onStatus?.('Listening');
      options.onRecordingState?.('recording');
      return {
        mediaStream: { getTracks: () => [], getAudioTracks: () => [] } as unknown as MediaStream,
        pause: jest.fn(),
        resume: jest.fn(),
        stop: jest.fn(async () => ({
          transcript: 'Responder: I want AI accountability groups.',
          turns: [{ itemId: 'turn-1', role: 'responder' as const, text: 'I want AI accountability groups.' }],
        })),
        getTranscript: () => 'Responder: I want AI accountability groups.',
      };
    });
    render(<SessionVoiceModeModal {...baseProps} mode="interview" />);

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    await screen.findByLabelText('Pause interview');
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STOP));
    await waitFor(() => expect(mockedMapInterviewEvidenceToResponses).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('mock-group-recommendations')).not.toBeInTheDocument();

    await act(async () => {
      finishMapping?.([]);
    });
    expect(await screen.findByTestId('mock-group-recommendations')).toBeInTheDocument();
  });

  it('offers the two large requested voice-mode choices', () => {
    render(<SessionVoiceModeModal {...baseProps} />);
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_VOICE_MODE_INTERVIEW)).toHaveTextContent(
      'One person. A voice interviewer drafts responses and may suggest new questions for review.',
    );
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_VOICE_MODE_INTERVIEW));
    expect(baseProps.onSelectMode).toHaveBeenCalledWith('interview');
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_VOICE_MODE_GROUP));
    expect(baseProps.onSelectMode).toHaveBeenCalledWith('recordGroup');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(baseProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('opens Group Conversation directly as an embedded recorder', () => {
    render(<SessionVoiceModeModal {...baseProps} mode="recordGroup" />);
    expect(screen.getByTestId('mock-group-listening')).toHaveAttribute('data-mode', 'recordGroup');
    expect(screen.getByTestId('mock-group-listening')).toHaveAttribute('data-embedded', 'true');
  });

  it('prevents duplicate realtime sessions and stops a late connection after the modal closes', async () => {
    const stop = jest.fn(async () => ({ transcript: '', turns: [] }));
    let resolveSession: ((session: Awaited<ReturnType<typeof startSessionRealtimeInterview>>) => void) | null = null;
    mockedStartSessionRealtimeInterview.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSession = resolve;
        }),
    );
    const view = render(<SessionVoiceModeModal {...baseProps} mode="interview" />);
    const start = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START);

    fireEvent.click(start);
    fireEvent.click(start);

    await waitFor(() => expect(mockedStartSessionRealtimeInterview).toHaveBeenCalledTimes(1));
    expect(start).toBeDisabled();
    expect(start).toHaveTextContent('Connecting…');
    expect(screen.getByRole('button', { name: 'Interview status: Connecting' })).toHaveFocus();
    fireEvent.keyUp(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS), {
      key: 'Escape',
      keyCode: 27,
      which: 27,
    });
    expect(baseProps.onClose).toHaveBeenCalledTimes(1);

    view.unmount();
    await act(async () => {
      resolveSession?.({
        mediaStream: { getTracks: () => [], getAudioTracks: () => [] } as unknown as MediaStream,
        pause: jest.fn(),
        resume: jest.fn(),
        stop,
        getTranscript: () => '',
      });
      await Promise.resolve();
    });

    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('keeps the copied memory prompt collapsed and confirms clipboard success with a checkmark', async () => {
    render(<SessionVoiceModeModal {...baseProps} mode="interview" />);

    expect(screen.queryByText(/A realtime voice interviewer will cover/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_CONTEXT)).not.toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveAccessibleName('Interview status: Ready');
    expect(screen.getByRole('button', { name: 'Copy memory augmentation prompt' })).toBeInTheDocument();
    const promptToggle = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_AGENT_PROMPT_TOGGLE);
    expect(promptToggle).toHaveAccessibleName('Prompt');
    expect(screen.queryByRole('button', { name: 'About the interview prompt' })).not.toBeInTheDocument();
    expect(screen.queryByText(/allows your agent to predict your responses/i)).not.toBeInTheDocument();
    expect(promptToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_AGENT_PROMPT)).not.toBeInTheDocument();
    const copyButton = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_COPY_AGENT_PROMPT);
    expect(copyButton).toHaveAccessibleName('Copy memory augmentation prompt');
    expect(copyButton).toHaveTextContent('Copy and paste this prompt into Claude or ChatGPT to augment interview');
    expect(copyButton).toHaveTextContent('Copy');
    expect(screen.queryByText('Copy prompt')).not.toBeInTheDocument();

    await act(async () => fireEvent.click(copyButton));
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('review-only Context Engine interview prefill'),
      ),
    );
    expect(copyButton).toHaveAccessibleName('Memory augmentation prompt copied');
    expect(copyButton.querySelector('[data-icon="check"]')).toBeInTheDocument();
    await act(async () => fireEvent.keyDown(copyButton, { key: ' ', code: 'Space' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(2);
    const promptCard = copyButton.parentElement?.parentElement;
    expect(promptCard).not.toBeNull();
    await act(async () => fireEvent.click(promptCard!));
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(3);

    fireEvent.click(promptToggle);
    expect(promptToggle).toHaveAccessibleName('Prompt');
    const displayedPrompt = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_AGENT_PROMPT);
    expect(copyButton.closest('[class]')?.parentElement?.parentElement).toContainElement(displayedPrompt);
    const helpButton = displayedPrompt.querySelector('[aria-label="About the interview prompt"]');
    expect(helpButton).toBeInTheDocument();
    fireEvent.click(helpButton!);
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(3);
    const plainPrompt = buildExternalInterviewKickoff({
      workerUrl: baseProps.workerUrl,
      sessionSlug: baseProps.sessionSlug,
      sessionUrl: `${window.location.origin}${window.location.pathname}`,
    });
    const displayedParagraphs = Array.from(displayedPrompt.querySelectorAll('p'));
    expect(displayedParagraphs.length).toBeGreaterThan(8);
    expect(displayedPrompt.querySelectorAll('strong').length).toBeGreaterThan(3);
    expect(
      displayedParagraphs
        .map((paragraph) => paragraph.textContent)
        .join(' ')
        .replace(/\s+/g, ' '),
    ).toContain('Fetch this URL: worker.example/agent/interview-catalog…');
    const codeBlock = displayedPrompt.querySelector('pre code');
    expect(codeBlock).toBeInTheDocument();
    expect(codeBlock?.textContent).toContain('\n  "version": 1,');
    expect(codeBlock?.textContent).toContain('\n  "responses": [');
    const promptLink = displayedPrompt.querySelector('a');
    expect(promptLink).toHaveAttribute(
      'href',
      expect.stringContaining('https://worker.example/agent/interview-catalog'),
    );
    fireEvent.click(promptLink!);
    fireEvent.click(displayedPrompt);
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(3);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(plainPrompt);
    expect(plainPrompt).toContain('{"version":1,"sessionSlug":');
    expect(plainPrompt).not.toMatch(/<strong>|\*\*/);

    expect(promptToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_AGENT_PROMPT)).toHaveTextContent(
      /review-only Context Engine interview prefill.*worker\.example\/agent\/interview-catalog…/,
    );

    fireEvent.click(promptToggle);
    expect(promptToggle).toHaveAccessibleName('Prompt');
    expect(promptToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_AGENT_PROMPT)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'About the interview prompt' })).not.toBeInTheDocument();
  });

  it('shows a collapsed responder transcript disclosure after the voice interview ends', async () => {
    mockedMapInterviewEvidenceToResponses.mockResolvedValue([{ questionId: 'q1', answer: 'A relevant answer' }]);
    let interviewOptions: Parameters<typeof startSessionRealtimeInterview>[0] | null = null;
    let resolveStop: (() => void) | null = null;
    const stop = jest.fn(
      () =>
        new Promise<{
          transcript: string;
          turns: Array<{ itemId: string; text: string; role: 'responder' }>;
        }>((resolve) => {
          resolveStop = () =>
            resolve({
              transcript: 'Responder: Reversible decisions matter.',
              turns: [{ itemId: 'turn-1', text: 'Reversible decisions matter.', role: 'responder' }],
            });
        }),
    );
    const pause = jest.fn(() => {
      interviewOptions?.onRecordingState?.('paused');
      interviewOptions?.onStatus?.('Paused');
    });
    const resume = jest.fn(() => {
      interviewOptions?.onRecordingState?.('recording');
      interviewOptions?.onStatus?.('Listening');
    });
    const mediaStream = {
      getTracks: () => [],
      getAudioTracks: () => [],
    } as unknown as MediaStream;
    mockedStartSessionRealtimeInterview.mockImplementation(async (options) => {
      interviewOptions = options;
      options.onStatus?.('Listening');
      options.onRecordingState?.('recording');
      options.onTranscript?.('Responder: Reversible decisions matter.', [
        { itemId: 'turn-1', text: 'Reversible decisions matter.', role: 'responder' },
      ]);
      return {
        mediaStream,
        pause,
        resume,
        stop,
        getTranscript: () => 'Responder: Reversible decisions matter.',
      };
    });

    render(<SessionVoiceModeModal {...baseProps} mode="interview" />);
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_TRANSCRIPT_TOGGLE)).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    expect(await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STOP)).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveAccessibleName(
      'Interview status: Listening',
    );
    expect(screen.getByText('0:00')).toBeInTheDocument();
    expect(screen.getByLabelText('Pause interview')).toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_TRANSCRIPT_TOGGLE)).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Pause interview'));
    expect(pause).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveAccessibleName('Interview status: Paused');
    fireEvent.click(screen.getByLabelText('Resume interview'));
    expect(resume).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveAccessibleName(
      'Interview status: Listening',
    );

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STOP));
    expect(stop).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Pause interview')).toBeDisabled();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveAccessibleName('Interview status: Ending');
    await act(async () => {
      resolveStop?.();
      await Promise.resolve();
    });
    const toggle = await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_TRANSCRIPT_TOGGLE);
    const startControl = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START);
    const copyPromptButton = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_COPY_AGENT_PROMPT);
    expect(startControl.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(toggle.compareDocumentPosition(copyPromptButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Include self-reported AI platform/)).not.toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_PREDICTION_COMPARISON)).not.toBeChecked();
    expect(screen.getByRole('group', { name: 'AI research metadata' })).toBeInTheDocument();
    expect(baseProps.onSubmitResponses).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Pause interview')).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveTextContent('4 words');
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_TRANSCRIPT)).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const transcriptContent = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_TRANSCRIPT);
    expect(transcriptContent).toHaveTextContent('Responder: Reversible decisions matter.');
    expect(transcriptContent.compareDocumentPosition(copyPromptButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await waitFor(() =>
      expect(mockedMapInterviewEvidenceToResponses).toHaveBeenCalledWith(
        expect.objectContaining({ transcript: 'Responder: Reversible decisions matter.' }),
      ),
    );
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
    await waitFor(() =>
      expect(baseProps.onRecordProvenance).toHaveBeenCalledWith(
        expect.any(Array),
        null,
        null,
        false,
        false,
        '',
        expect.any(Array),
      ),
    );
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
        existingResponseSlice={{
          answers: { q1: { value: 'Existing local draft' } },
          additionalComments: { q1: { value: 'Existing explanation' } },
        }}
      />,
    );

    expect(await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW)).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_CONTEXT)).toHaveValue('Relevant context');
    const replacement = screen.getByRole('button', { name: 'Replace with draft' });
    expect(replacement).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Remove draft for What matters?' })).toBeDisabled();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY)).toBeDisabled();

    fireEvent.click(replacement);
    await editReadableDraftText('Draft answer for What matters?', 'Reviewed answer');
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));

    await waitFor(() => expect(baseProps.onApplyAnswer).toHaveBeenCalledWith('q1', 'Reviewed answer'));
    expect(baseProps.onApplyAdditional).toHaveBeenCalledWith('q1', 'Existing explanation');
    await waitFor(() =>
      expect(baseProps.onRecordProvenance).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ questionId: 'q1', answer: 'Original prediction' })]),
        prefillPacket.source,
        prefillPacket,
        true,
        false,
        '',
        expect.any(Array),
      ),
    );
    expect(baseProps.onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent('Responses submitted');
  });

  it('reviews agent-authored predictions with confidence without remapping or misattributing them', async () => {
    const prefillPacket = {
      version: 1 as const,
      sessionSlug: 'demo',
      questionSetHash: 'a'.repeat(64),
      promptVersion: 'ce-interview-brief-v3',
      source: {
        platform: 'claude' as const,
        modelId: 'claude-example',
        verification: 'self_reported' as const,
        researchCoverage: {
          historyChatsSearched: null,
          historyChatsUsed: 8,
          memoryItemsSearched: 20,
          memoryItemsUsed: 4,
          connectedSourcesSearched: 3,
          connectedSourcesUsed: 1,
          userStatementsUsed: 15,
          searchScopeNote: 'Chat search did not expose a total scanned count.',
        },
      },
      responderContext: { summary: 'A tentative related signal.' },
      responses: [
        {
          questionId: 'q1',
          answer: 'A cautious prediction',
          confidence: 0.22,
          evidence: 'A related but indirect statement in authorized conversation history.',
        },
      ],
    };
    render(<SessionVoiceModeModal {...baseProps} mode="interview" prefillPacket={prefillPacket} />);

    expect(await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW)).toBeInTheDocument();
    const coverage = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_RESEARCH_COVERAGE);
    expect(coverage).toHaveTextContent('Self-reported agent research coverage');
    expect(coverage).toHaveTextContent('History chats: 8 used');
    expect(coverage).toHaveTextContent('Memories: 4 used / 20 searched');
    expect(coverage).toHaveTextContent('Connected sources: 1 used / 3 searched');
    expect(coverage).toHaveTextContent('15 user statements used');
    expect(coverage).toHaveTextContent('Chat search did not expose a total scanned count.');
    const metadata = screen.getByRole('group', { name: 'AI prefill metadata' });
    fireEvent.click(metadata.querySelector('summary')!);
    expect(metadata).toHaveTextContent('Memories: 4 used / 20 searched');
    expect(metadata).toHaveTextContent('Chat search did not expose a total scanned count.');
    await expectReadableDraftText('Draft answer for What matters?', 'A cautious prediction');
    expect(screen.getByLabelText('AI-estimated confidence: 22%')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'AI-estimated confidence for What matters?' })).toHaveAttribute(
      'aria-valuenow',
      '22',
    );
    expect(screen.getByText('22% AI-estimated confidence')).toBeInTheDocument();
    expect(screen.queryByText(/Weak inference/)).not.toBeInTheDocument();
    expect(screen.queryByText(/related but indirect statement/i)).not.toBeInTheDocument();
    const basisToggle = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_DRAFT_BASIS_TOGGLE);
    expect(basisToggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(basisToggle);
    expect(basisToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('AI-estimated support: Weak inference')).toBeInTheDocument();
    expect(screen.getByText(/related but indirect statement/i)).toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_GENERATE)).not.toBeInTheDocument();
    expect(mockedMapInterviewEvidenceToResponses).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
    await waitFor(() =>
      expect(baseProps.onRecordProvenance).toHaveBeenCalledWith(
        [expect.objectContaining({ questionId: 'q1', confidence: 0.22 })],
        prefillPacket.source,
        prefillPacket,
        true,
        false,
        '',
        expect.any(Array),
      ),
    );
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

  it('reviews and submits predicted quadratic votes as an array while retaining the original prediction', async () => {
    const prefillPacket = {
      version: 1 as const,
      sessionSlug: 'demo',
      questionSetHash: 'a'.repeat(64),
      promptVersion: 'ce-interview-brief-v4',
      source: { platform: 'other' as const, modelId: 'fixture', verification: 'self_reported' as const },
      responderContext: {},
      responses: [{ questionId: 'q-quadratic', answer: [3, -4], confidence: 0.65 }],
    };
    render(<SessionVoiceModeModal {...baseProps} mode="interview"
      questionPool={[{ id: 'q-quadratic', prompt: 'Allocate project support', type: 'quadratic', options: ['Parks', 'Transit'], voiceCredits: 25 }]}
      prefillPacket={prefillPacket} />);

    expect(await screen.findByRole('slider', { name: 'Parks' })).toHaveValue('3');
    expect(screen.getByRole('slider', { name: 'Transit' })).toHaveValue('-4');
    fireEvent.change(screen.getByRole('slider', { name: 'Transit' }), { target: { value: '-2' } });
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
    await waitFor(() => expect(baseProps.onApplyAnswer).toHaveBeenCalledWith('q-quadratic', [3, -2]));
    expect(baseProps.onRecordProvenance).toHaveBeenCalledWith(
      expect.any(Array), prefillPacket.source, prefillPacket, true, false, '',
      [expect.objectContaining({ answer: [3, -2], userEditedFields: ['answer'], original: expect.objectContaining({ answer: [3, -4] }) })],
    );
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
    expect(screen.queryByText('0 of 1 selected')).not.toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY)).toBeDisabled();

    const restore = screen.getByRole('button', { name: 'Restore draft' });
    expect(restore).toBeEnabled();
    fireEvent.click(restore);
    expect(screen.queryByText('1 of 1 selected')).not.toBeInTheDocument();
    expect(remove).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Restore draft' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Draft selected' })).not.toBeInTheDocument();
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
    expect(notice).not.toHaveTextContent('did not contain enough directly relevant detail');
    expect(notice).not.toHaveTextContent('Start another interview and share more detail');
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW)).not.toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_GENERATE)).not.toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveAccessibleName('Interview status: Ready');

    fireEvent.change(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_CONTEXT), {
      target: { value: 'Detailed evidence directly related to the question.' },
    });
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_MAPPING_NOTICE)).not.toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_GENERATE)).toBeInTheDocument();
  });

  it('keeps prediction comparison off by default and records each consent independently', async () => {
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
    const includeComparison = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_PREDICTION_COMPARISON);
    expect(includeComparison).not.toBeChecked();
    fireEvent.click(screen.getByLabelText(/Include self-reported AI platform\/model provenance/i));
    const metadata = screen.getByRole('group', { name: 'AI prefill metadata' });
    fireEvent.click(metadata.querySelector('summary')!);
    expect(metadata).toHaveTextContent('Source platform and coverage details will not be included.');
    expect(metadata).not.toHaveTextContent('a'.repeat(64));
    expect(metadata).toHaveTextContent(
      'Predictions, reviewed values, changed fields, and unselected drafts will not be included.',
    );
    fireEvent.click(includeComparison);
    expect(metadata).toHaveTextContent('1 selected draft and 0 unselected drafts');
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));

    await waitFor(() =>
      expect(baseProps.onRecordProvenance).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ questionId: 'q1' })]),
        expect.objectContaining({ platform: 'claude' }),
        expect.any(Object),
        false,
        true,
        '',
        expect.any(Array),
      ),
    );
    expect(baseProps.onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent('Responses submitted');
  });

  it('keeps an imported responder name private until the responder opts in', async () => {
    const prefillPacket = {
      version: 1 as const,
      sessionSlug: 'demo',
      questionSetHash: 'a'.repeat(64),
      promptVersion: 'ce-interview-brief-v4',
      source: { platform: 'claude' as const, modelId: 'claude-example', verification: 'self_reported' as const },
      responderContext: { name: 'Ada Example' },
      responses: [{ questionId: 'q1', answer: 'Draft answer', confidence: 0.8 }],
    };
    const first = render(<SessionVoiceModeModal {...baseProps} mode="interview" prefillPacket={prefillPacket} />);

    const includeName = await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_NAME);
    expect(includeName).not.toBeChecked();
    expect(screen.getByText(/Include “Ada Example” as the responder name/i)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
    await waitFor(() =>
      expect(baseProps.onRecordProvenance).toHaveBeenCalledWith(
        expect.any(Array),
        prefillPacket.source,
        prefillPacket,
        true,
        false,
        '',
        expect.any(Array),
      ),
    );
    first.unmount();

    jest.clearAllMocks();
    jest
      .mocked(useInterviewReadiness)
      .mockReturnValue({ state: 'ready', detail: 'Voice setup ready.', retry: jest.fn() });
    render(<SessionVoiceModeModal {...baseProps} mode="interview" prefillPacket={prefillPacket} />);
    fireEvent.click(await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_NAME));
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
    await waitFor(() =>
      expect(baseProps.onRecordProvenance).toHaveBeenCalledWith(
        expect.any(Array),
        prefillPacket.source,
        prefillPacket,
        true,
        false,
        'Ada Example',
        expect.any(Array),
      ),
    );
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
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveAccessibleName('Interview status: Error');
    expect(mapInterviewEvidenceToResponses).not.toHaveBeenCalled();
  });
});

describe('Interview cancellation and recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .mocked(useInterviewReadiness)
      .mockReturnValue({ state: 'ready', detail: 'Voice setup ready.', retry: jest.fn() });
    mockedMapInterviewEvidenceToResponses.mockResolvedValue([{ questionId: 'q1', answer: 'New evidence' }]);
  });

  function sessionMock() {
    let options!: Parameters<typeof startSessionRealtimeInterview>[0];
    const stop = jest.fn(async () => ({ transcript: 'Responder: New evidence.', turns: [] }));
    mockedStartSessionRealtimeInterview.mockImplementation(async (value) => {
      options = value;
      value.onStatus?.('Listening');
      value.onRecordingState?.('recording');
      return {
        mediaStream: {} as MediaStream,
        stop,
        pause: () => {
          value.onStatus?.('Paused');
          value.onRecordingState?.('paused');
        },
        resume: () => {
          value.onStatus?.('Listening');
          value.onRecordingState?.('recording');
        },
        getTranscript: () => 'Responder: New evidence.',
      };
    });
    return { stop, options: () => options };
  }

  it('aborts startup on isOpen=false and ignores callbacks after reopening', async () => {
    let options!: Parameters<typeof startSessionRealtimeInterview>[0];
    let finish!: (session: Awaited<ReturnType<typeof startSessionRealtimeInterview>>) => void;
    mockedStartSessionRealtimeInterview.mockImplementation((value) => {
      options = value;
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    const view = render(<SessionVoiceModeModal {...baseProps} mode="interview" />);
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    await waitFor(() => expect(options).toBeDefined());
    view.rerender(<SessionVoiceModeModal {...baseProps} mode="interview" isOpen={false} />);
    expect(options.signal?.aborted).toBe(true);
    view.rerender(<SessionVoiceModeModal {...baseProps} mode="interview" />);
    const stop = jest.fn(async () => ({ transcript: 'Old transcript', turns: [] }));
    await act(async () => {
      options.onStatus?.('Listening');
      options.onRecordingState?.('recording');
      options.onTranscript?.('Old transcript', []);
      finish({ mediaStream: {} as MediaStream, stop, pause: jest.fn(), resume: jest.fn(), getTranscript: () => '' });
    });
    expect(stop).toHaveBeenCalled();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent('Ready');
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_TRANSCRIPT_TOGGLE)).not.toBeInTheDocument();
    sessionMock();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    expect(await screen.findByLabelText('Pause interview')).toBeInTheDocument();
  });

  it.each([false, true])('stops on close and never starts mapping (paused=%s)', async (paused) => {
    const h = sessionMock();
    const view = render(<SessionVoiceModeModal {...baseProps} mode="interview" />);
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    await screen.findByLabelText('Pause interview');
    if (paused) fireEvent.click(screen.getByLabelText('Pause interview'));
    view.rerender(<SessionVoiceModeModal {...baseProps} mode="interview" isOpen={false} />);
    expect(h.options().signal?.aborted).toBe(true);
    expect(h.stop).toHaveBeenCalledTimes(1);
    expect(mockedMapInterviewEvidenceToResponses).not.toHaveBeenCalled();
  });

  it('stops a paused interview, announces preparing/review, focuses drafts, and never submits', async () => {
    const h = sessionMock();
    let finish!: (drafts: { questionId: string; answer: string }[]) => void;
    mockedMapInterviewEvidenceToResponses.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(<SessionVoiceModeModal {...baseProps} mode="interview" />);
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    fireEvent.click(await screen.findByLabelText('Pause interview'));
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STOP));
    await waitFor(() =>
      expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent('Preparing responses…'),
    );
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_GENERATE)).not.toBeInTheDocument();
    act(() => {
      h.options().onStatus?.('Listening');
      h.options().onTranscript?.('Stale evidence', []);
    });
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent('Preparing responses…');
    await act(async () => finish([{ questionId: 'q1', answer: 'New evidence' }]));
    expect(screen.getByRole('heading', { name: 'Review proposed responses' }).closest('summary')).toHaveFocus();
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent('Review drafts');
    expect(baseProps.onApplyAnswer).not.toHaveBeenCalled();
    expect(baseProps.onClose).not.toHaveBeenCalled();
  });

  it('ignores stop completion after closing and exposes a retry after failure', async () => {
    const h = sessionMock();
    let finish!: () => void;
    h.stop.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ transcript: 'Responder: Old', turns: [] });
        }),
    );
    const view = render(<SessionVoiceModeModal {...baseProps} mode="interview" />);
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    await screen.findByLabelText('Pause interview');
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STOP));
    view.rerender(<SessionVoiceModeModal {...baseProps} mode="interview" isOpen={false} />);
    await act(async () => finish());
    expect(mockedMapInterviewEvidenceToResponses).not.toHaveBeenCalled();
    mockedStartSessionRealtimeInterview.mockRejectedValue(new Error('Allow microphone access and try again.'));
    view.rerender(<SessionVoiceModeModal {...baseProps} mode="interview" />);
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    expect(await screen.findByRole('alert')).toHaveTextContent('Allow microphone access');
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START)).toBeEnabled();
  });

  it('continues a validated prefill when new questions arrive during the interview', async () => {
    sessionMock();
    mockedHashInterviewQuestions.mockResolvedValue('a'.repeat(64));
    const prefillPacket = {
      version: 1 as const,
      sessionSlug: 'demo',
      questionSetHash: 'a'.repeat(64),
      source: { platform: 'other' as const, modelId: 'fixture', verification: 'self_reported' as const },
      responderContext: {},
      responses: [{ questionId: 'q1', answer: 'Imported answer', confidence: 0.8 }],
    };
    const view = render(<SessionVoiceModeModal {...baseProps} mode="interview" prefillPacket={prefillPacket} />);
    await expectReadableDraftText('Draft answer for What matters?', 'Imported answer');
    mockedHashInterviewQuestions.mockResolvedValue('b'.repeat(64));
    mockedMapInterviewEvidenceToResponses.mockResolvedValue([
      { questionId: 'q2', answer: 'Newly answered', confidence: 0.8 },
    ]);
    view.rerender(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        prefillPacket={prefillPacket}
        questionPool={[...baseProps.questionPool, { id: 'q2', prompt: 'New question?', type: 'freeform' }]}
      />,
    );
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    await screen.findByLabelText('Pause interview');
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STOP));
    await expectReadableDraftText('Draft answer for New question?', 'Newly answered');
    await expectReadableDraftText('Draft answer for What matters?', 'Imported answer');
    expect(mockedHashInterviewQuestions).toHaveBeenCalledTimes(1);
  });

  it('continues the transcript across interviews and preserves edits, removed drafts, and unmatched answers', async () => {
    const rounds: Parameters<typeof startSessionRealtimeInterview>[0][] = [];
    mockedStartSessionRealtimeInterview.mockImplementation(async (options) => {
      rounds.push(options);
      const text = `Responder: Round ${rounds.length}.`;
      options.onRecordingState?.('recording');
      options.onTranscript?.(text, []);
      return {
        mediaStream: {} as MediaStream,
        stop: jest.fn(async () => ({ transcript: text, turns: [] })),
        pause: jest.fn(),
        resume: jest.fn(),
        getTranscript: () => text,
      };
    });
    mockedMapInterviewEvidenceToResponses
      .mockResolvedValueOnce([
        { questionId: 'q1', answer: 'First answer', confidence: 0.6 },
        { questionId: 'q2', answer: 'Keep this', confidence: 0.8 },
      ])
      .mockResolvedValueOnce([
        { questionId: 'q1', answer: 'Refined AI answer', confidence: 0.9 },
        { questionId: 'q3', answer: 'Additional match', confidence: 0.8 },
      ]);
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        questionPool={[
          ...baseProps.questionPool,
          { id: 'q2', prompt: 'Second question?', type: 'freeform' },
          { id: 'q3', prompt: 'Third question?', type: 'freeform' },
        ]}
      />,
    );
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    await screen.findByLabelText('Pause interview');
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STOP));
    await editReadableDraftText('Draft answer for What matters?', 'My edit');
    fireEvent.click(screen.getAllByTestId(E2E_TESTIDS.SESSION_INTERVIEW_DRAFT_REMOVE)[1]);
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    await screen.findByLabelText('Pause interview');
    expect(rounds[1].instructions).toContain('Responder: Round 1.');
    expect(rounds[1].instructions).toContain('Continue the prior interview');
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STOP));
    await expectReadableDraftText('Draft answer for Third question?', 'Additional match');
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START)).toHaveAccessibleName('Continue interview');
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_PREDICTION_COMPARISON)).toBeInTheDocument();
    expect(mockedMapInterviewEvidenceToResponses.mock.calls.at(-1)?.[0].previousResponses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          prediction: expect.objectContaining({ answer: 'First answer' }),
          reviewed: expect.objectContaining({ answer: 'My edit' }),
        }),
      ]),
    );
    await expectReadableDraftText('Draft answer for What matters?', 'My edit');
    await expectReadableDraftText('Draft answer for Second question?', 'Keep this');
    expect(screen.getByRole('button', { name: 'Restore draft' })).toBeInTheDocument();
    expect(mockedMapInterviewEvidenceToResponses).toHaveBeenLastCalledWith(
      expect.objectContaining({ transcript: 'Responder: Round 1.\n\nResponder: Round 2.' }),
    );
    mockedStartSessionRealtimeInterview.mockImplementationOnce(async (options) => {
      options.onRecordingState?.('recording');
      return {
        mediaStream: {} as MediaStream,
        stop: jest.fn(async () => ({ transcript: '', turns: [] })),
        pause: jest.fn(),
        resume: jest.fn(),
        getTranscript: () => '',
      };
    });
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    await screen.findByLabelText('Pause interview');
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STOP));
    await expectReadableDraftText('Draft answer for What matters?', 'My edit');
    expect(mockedMapInterviewEvidenceToResponses).toHaveBeenCalledTimes(2);
    mockedStartSessionRealtimeInterview.mockRejectedValueOnce(new Error('Connection failed'));
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    expect(await screen.findByRole('alert')).toHaveTextContent('Connection failed');
    await expectReadableDraftText('Draft answer for What matters?', 'My edit');
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_TRANSCRIPT_TOGGLE));
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_TRANSCRIPT)).toHaveTextContent('Responder: Round 1.');
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_TRANSCRIPT)).toHaveTextContent('Responder: Round 2.');
  });

  it('maps new speech instead of reusing imported response predictions', async () => {
    sessionMock();
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        prefillPacket={{
          version: 1,
          sessionSlug: 'demo',
          source: { platform: 'other', modelId: 'fixture', verification: 'self_reported' },
          responderContext: {},
          responses: [{ questionId: 'q1', answer: 'Old prediction', confidence: 0.5 }],
        }}
      />,
    );
    await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY)).not.toBeInTheDocument();
    await screen.findByLabelText('Pause interview');
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STOP));
    await waitFor(() =>
      expect(mockedMapInterviewEvidenceToResponses).toHaveBeenCalledWith(
        expect.objectContaining({ transcript: 'Responder: New evidence.' }),
      ),
    );
    await expectReadableDraftText('Draft answer for What matters?', 'New evidence');
  });
});
