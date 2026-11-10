import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import SessionVoiceModeModal from './SessionVoiceModeModal';
import type { TranscriptClaim } from './sessionTranscriptClaim';

jest.mock('./CreateQuestionsAndSurveys', () => ({ __esModule: true, default: () => null }));
jest.mock('./SessionListeningPanel', () => ({ __esModule: true, default: () => null }));
jest.mock('./SessionVoicePrefillCard', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-prefill-card" />,
}));
// The interview as the dialog sees it: its Back, the claimed part it was given, and a review it reports.
type MockInterviewProps = { claim: unknown; onReviewStateChange: (unsaved: boolean) => void };
jest.mock('./SessionInterviewPanel', () => {
  const { useContext } = jest.requireActual<typeof import('react')>('react');
  const { VoiceModeBackContext } =
    jest.requireActual<typeof import('./SessionVoiceModeBack')>('./SessionVoiceModeBack');
  function MockInterviewPanel({ claim, onReviewStateChange }: MockInterviewProps) {
    const back = useContext(VoiceModeBackContext);
    return (
      <div data-testid="mock-interview" data-claimed={claim ? 'yes' : 'no'}>
        <button type="button" onClick={() => back?.()}>
          Back to Voice mode
        </button>
        <button type="button" onClick={() => onReviewStateChange(true)}>
          Make a review
        </button>
      </div>
    );
  }
  return { __esModule: true, default: MockInterviewPanel };
});

const baseProps = {
  isOpen: true,
  mode: 'interview' as const,
  onSelectMode: jest.fn(),
  onClose: jest.fn(),
  onSubmitResponses: jest.fn(),
  onInterviewProgressChange: jest.fn(),
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
const claim = { sessionSlug: 'demo' } as unknown as TranscriptClaim;
const card = () => screen.queryByTestId('mock-prefill-card');

beforeEach(() => {
  jest.clearAllMocks();
});

it('keeps the AI prompt card out of a review in progress', () => {
  render(<SessionVoiceModeModal {...baseProps} />);
  expect(card()).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Make a review' }));
  expect(card()).toBeNull();
});

it('keeps the card out while a claimed part is open, and Back drops the claim so Interview starts afresh', () => {
  const { rerender } = render(<SessionVoiceModeModal {...baseProps} claim={claim} />);
  expect(card()).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Back to Voice mode' }));
  expect(baseProps.onSelectMode).toHaveBeenCalledWith(null);
  rerender(<SessionVoiceModeModal {...baseProps} mode={null} claim={claim} />);
  rerender(<SessionVoiceModeModal {...baseProps} claim={claim} />);
  expect(screen.getByTestId('mock-interview')).toHaveAttribute('data-claimed', 'no');
  expect(card()).toBeInTheDocument();
});

it('clears the page’s resume flag when a review is discarded on the way back', async () => {
  render(<SessionVoiceModeModal {...baseProps} />);
  fireEvent.click(screen.getByRole('button', { name: 'Make a review' }));
  expect(baseProps.onInterviewProgressChange).toHaveBeenLastCalledWith(true);
  fireEvent.click(screen.getByRole('button', { name: 'Back to Voice mode' }));
  fireEvent.click(
    within(await screen.findByTestId('ce-interview-discard')).getByRole('button', { name: 'Discard interview' }),
  );
  expect(baseProps.onSelectMode).toHaveBeenCalledWith(null);
  expect(baseProps.onInterviewProgressChange).toHaveBeenLastCalledWith(false);
});
