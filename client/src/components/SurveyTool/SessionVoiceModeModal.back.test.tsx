import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SessionVoiceModeModal from './SessionVoiceModeModal';
import SessionInterviewModalHeader from './SessionInterviewModalHeader';
import { VoiceModeBackContext } from './SessionVoiceModeBack';

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
jest.mock('./SessionVoicePrefillCard', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-prefill-card" />,
}));
// Group Conversation as the dialog sees it: a close action that finishes its work, and the capture it reports.
const mockFinishGroup = jest.fn();
type MockListeningProps = {
  closeActionRef: { current: (() => Promise<void>) | null };
  onClose: () => void;
  onCaptureChange: (capturing: boolean) => void;
};
jest.mock('./SessionListeningPanel', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  function MockListeningPanel({ closeActionRef, onClose, onCaptureChange }: MockListeningProps) {
    useEffect(() => {
      closeActionRef.current = async () => {
        mockFinishGroup();
        onClose();
      };
      return () => {
        closeActionRef.current = null;
      };
    }, [closeActionRef, onClose]);
    return (
      <button type="button" onClick={() => onCaptureChange(true)}>
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
const back = () => screen.getByRole('button', { name: 'Back' });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Back in the Voice mode dialog', () => {
  it('has no Back on the two choices', () => {
    render(<SessionVoiceModeModal {...baseProps} />);
    expect(screen.getByTestId('mock-prefill-card')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
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
});
