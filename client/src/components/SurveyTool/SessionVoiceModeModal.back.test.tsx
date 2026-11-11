import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SessionVoiceModeModal from './SessionVoiceModeModal';
import SessionInterviewModalHeader from './SessionInterviewModalHeader';
import { VoiceModeBackContext } from './SessionVoiceModeBack';
import { useSessionInterviewGroupRecommendations } from './useSessionInterviewGroupRecommendations';
import {
  joinWorkerGroup,
  loadPublicWorkerGroups,
  loadWorkerGroupOverview,
  type WorkerGroup,
} from '../../domains/worker/workerGroupPorts';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

jest.mock('./CreateQuestionsAndSurveys', () => ({ __esModule: true, default: () => null }));
jest.mock('./useInterviewReadiness', () => ({
  useInterviewReadiness: jest.fn(() => ({ state: 'ready', detail: 'Voice setup ready.', retry: jest.fn() })),
}));
jest.mock('./useInterviewOpening', () => ({
  useInterviewOpening: jest.fn(() => ({ opening: '', notice: '', loading: false })),
}));
jest.mock('./useSessionInterviewGroupRecommendations', () => ({
  useSessionInterviewGroupRecommendations: jest.fn(() => ({ availability: 'idle', recommendations: [] })),
}));
jest.mock('./sessionInterview', () => ({
  ...jest.requireActual<typeof import('./sessionInterview')>('./sessionInterview'),
  hashInterviewQuestions: jest.fn(async () => 'a'.repeat(64)),
  mapInterviewEvidenceToResponses: jest.fn(async () => [{ questionId: 'q1', answer: 'Draft answer' }]),
}));
jest.mock('../../utilities/worker/corsProxy.js', () => ({
  getCorsProxyUrlOrThrow: jest.fn(async () => 'https://worker.example'),
}));
jest.mock('../../utilities/audio/realtimeInterviewClient', () => ({ startSessionRealtimeInterview: jest.fn() }));
jest.mock('../../domains/worker/workerGroupPorts', () => ({
  ...jest.requireActual<object>('../../domains/worker/workerGroupPorts'),
  getWorkerSessionToken: jest.fn(async () => 'token'),
  joinWorkerGroup: jest.fn(),
  loadPublicWorkerGroups: jest.fn(),
  loadWorkerGroupOverview: jest.fn(),
}));
jest.mock('./SessionVoicePrefillCard', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-prefill-card" />,
}));
// Group Conversation as the dialog sees it: a close action that finishes its work, once at a time as the real
// panel's does, and the busy state it reports.
const mockFinishGroup = jest.fn();
const mockGroupWork = jest.fn(async () => {});
type MockListeningProps = {
  closeActionRef: { current: (() => Promise<void>) | null };
  onClose: () => void;
  onBusyChange: (busy: boolean) => void;
};
jest.mock('./SessionListeningPanel', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  function MockListeningPanel({ closeActionRef, onClose, onBusyChange }: MockListeningProps) {
    useEffect(() => {
      let closing = false;
      closeActionRef.current = async () => {
        if (closing) return;
        closing = true;
        try {
          mockFinishGroup();
          await mockGroupWork();
          onClose();
        } finally {
          closing = false;
        }
      };
      return () => {
        closeActionRef.current = null;
      };
    }, [closeActionRef, onClose]);
    return (
      <button type="button" onClick={() => onBusyChange(true)}>
        Start recording
      </button>
    );
  }
  return { __esModule: true, default: MockListeningPanel };
});

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
const prefillPacket = {
  version: 1 as const,
  sessionSlug: 'demo',
  source: { platform: 'other' as const, modelId: 'unknown', verification: 'self_reported' as const },
  responderContext: { summary: 'Synthetic context' },
};
const back = () => screen.getByRole('button', { name: 'Back to Voice mode' });

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useSessionInterviewGroupRecommendations).mockReturnValue({ availability: 'idle', recommendations: [] });
});

describe('Back in the Voice mode dialog', () => {
  it('has no Back on the two choices', () => {
    render(<SessionVoiceModeModal {...baseProps} />);
    expect(screen.getByTestId('mock-prefill-card')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back to Voice mode' })).toBeNull();
  });

  it('goes back from an Interview with nothing in it, which keeps the prompt card on hand', () => {
    render(<SessionVoiceModeModal {...baseProps} mode="interview" />);
    expect(screen.getByTestId('mock-prefill-card')).toBeInTheDocument();
    fireEvent.click(back());
    expect(baseProps.onSelectMode).toHaveBeenCalledWith(null);
    expect(baseProps.onClose).not.toHaveBeenCalled();
  });

  it('asks before leaving an interview with unsaved work, and goes back only once it is discarded', async () => {
    render(<SessionVoiceModeModal {...baseProps} mode="interview" prefillPacket={prefillPacket} />);
    expect(screen.queryByTestId('mock-prefill-card')).toBeNull();
    // Back stays off while the imported answers are mapped to drafts.
    expect(back()).toBeDisabled();
    await waitFor(() => expect(back()).toBeEnabled());
    fireEvent.click(back());
    const ask = await screen.findByTestId('ce-interview-discard');
    fireEvent.click(within(ask).getByRole('button', { name: 'Keep reviewing' }));
    await waitFor(() => expect(screen.queryByTestId('ce-interview-discard')).toBeNull());
    expect(baseProps.onSelectMode).not.toHaveBeenCalled();
    fireEvent.click(back());
    fireEvent.click(
      within(await screen.findByTestId('ce-interview-discard')).getByRole('button', { name: 'Discard interview' }),
    );
    expect(baseProps.onSelectMode).toHaveBeenCalledWith(null);
    expect(baseProps.onClose).not.toHaveBeenCalled();
  });

  it('asks before going back from a submit whose ticked group failed to join, which keeps its retry', async () => {
    const optimists: WorkerGroup = {
      groupId: 'ai-optimists',
      sessionSlug: 'demo',
      label: 'AI Optimists',
      joinMode: 'open',
      memberVisibility: 'session',
    };
    jest.mocked(useSessionInterviewGroupRecommendations).mockReturnValue({
      availability: 'available',
      recommendations: [{ groupId: 'ai-optimists', reason: 'Fits your answers.', confidence: 0.9 }],
    });
    jest.mocked(loadPublicWorkerGroups).mockResolvedValue([optimists]);
    jest.mocked(loadWorkerGroupOverview).mockResolvedValue({ groups: [optimists], memberships: [] });
    jest.mocked(joinWorkerGroup).mockRejectedValueOnce(new Error('worker_group_member_cap_exceeded'));
    const onInterviewProgressChange = jest.fn();
    render(
      <SessionVoiceModeModal
        {...baseProps}
        mode="interview"
        prefillPacket={prefillPacket}
        isResponsesCacheReady
        onSubmitResponses={jest.fn().mockResolvedValue({ status: 'submitted' })}
        onInterviewProgressChange={onInterviewProgressChange}
        sessionConfig={{ slug: 'demo', sessionId: `0x${'1'.repeat(32)}`, interviewMode: { joinMatchingGroups: true } }}
      />,
    );
    fireEvent.click(await screen.findByRole('checkbox', { name: /AI Optimists/ }));
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
    expect(await screen.findByText('Couldn’t join AI Optimists: it is full.')).toBeInTheDocument();
    await waitFor(() => expect(back()).toBeEnabled());
    // The dialog reopens on them too.
    expect(onInterviewProgressChange).toHaveBeenLastCalledWith(true);

    fireEvent.click(back());
    const ask = await screen.findByTestId('ce-interview-discard');
    expect(ask).toHaveTextContent(
      'Ticked groups that haven’t joined won’t be, though a join under way still finishes.',
    );
    fireEvent.click(within(ask).getByRole('button', { name: 'Keep reviewing' }));
    await waitFor(() => expect(screen.queryByTestId('ce-interview-discard')).toBeNull());
    expect(baseProps.onSelectMode).not.toHaveBeenCalled();
    jest.mocked(joinWorkerGroup).mockResolvedValue({ group: optimists, memberCount: 2 });
    fireEvent.click(screen.getByRole('button', { name: 'Join ticked groups' }));
    expect(await screen.findByText('Joined AI Optimists.')).toBeInTheDocument();

    // Joined, it goes back without asking.
    await waitFor(() => expect(onInterviewProgressChange).toHaveBeenLastCalledWith(false));
    fireEvent.click(back());
    expect(baseProps.onSelectMode).toHaveBeenCalledWith(null);
    expect(screen.queryByTestId('ce-interview-discard')).toBeNull();
  });

  it('turns Back off while an interview is under way, which going back would cut short', () => {
    const header = (idle: boolean) => (
      <VoiceModeBackContext.Provider value={jest.fn()}>
        <SessionInterviewModalHeader
          guidance="Talk with the interviewer."
          idle={idle}
          onClose={jest.fn()}
          readinessDetail="Voice setup ready."
          readinessRetry={jest.fn()}
          statusLabel={idle ? 'Ready' : 'Recording'}
          statusTone={idle ? 'ready' : 'live'}
          statusRef={React.createRef()}
        />
      </VoiceModeBackContext.Provider>
    );
    const { rerender } = render(header(false));
    expect(back()).toBeDisabled();
    rerender(header(true));
    expect(back()).toBeEnabled();
  });

  it('goes back from Group Conversation once it has finished its work, and not while it records', async () => {
    render(<SessionVoiceModeModal {...baseProps} mode="recordGroup" />);
    fireEvent.click(back());
    await waitFor(() => expect(baseProps.onSelectMode).toHaveBeenCalledWith(null));
    expect(mockFinishGroup).toHaveBeenCalledTimes(1);
    expect(baseProps.onClose).not.toHaveBeenCalled();
    // Closing still closes.
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(baseProps.onClose).toHaveBeenCalledTimes(1));
    expect(baseProps.onSelectMode).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    expect(back()).toBeDisabled();
  });

  it('lets a second Back wait for the first, which still goes back rather than closing', async () => {
    let finish = () => {};
    mockGroupWork.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    render(<SessionVoiceModeModal {...baseProps} mode="recordGroup" />);
    fireEvent.click(back());
    fireEvent.click(back());
    await act(async () => finish());
    await waitFor(() => expect(baseProps.onSelectMode).toHaveBeenCalledWith(null));
    expect(baseProps.onClose).not.toHaveBeenCalled();
    expect(mockFinishGroup).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['Interview', 'interview', E2E_TESTIDS.SESSION_VOICE_MODE_INTERVIEW],
    ['Group Conversation', 'recordGroup', E2E_TESTIDS.SESSION_VOICE_MODE_GROUP],
  ] as const)('puts focus on %s among the choices it went back to', async (_name, mode, choice) => {
    const { rerender } = render(<SessionVoiceModeModal {...baseProps} mode={mode} />);
    fireEvent.click(back());
    await waitFor(() => expect(baseProps.onSelectMode).toHaveBeenCalledWith(null));
    rerender(<SessionVoiceModeModal {...baseProps} mode={null} />);
    expect(screen.getByTestId(choice)).toHaveFocus();
  });

  it('focuses no choice when the dialog later reopens on them', async () => {
    const { rerender } = render(<SessionVoiceModeModal {...baseProps} mode="interview" />);
    fireEvent.click(back());
    rerender(<SessionVoiceModeModal {...baseProps} mode={null} />);
    rerender(<SessionVoiceModeModal {...baseProps} mode={null} isOpen={false} />);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    rerender(<SessionVoiceModeModal {...baseProps} mode={null} />);
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_VOICE_MODE_INTERVIEW)).not.toHaveFocus();
  });
});
