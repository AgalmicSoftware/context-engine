import React, { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SessionVoiceModeModal from './SessionVoiceModeModal';
import { transcribeAudio } from '../../utilities/ai/aiClient.js';
import type { RecordingChunk } from '../../utilities/audio/recordingChunkStore';
const mockRecords = new Map<string, RecordingChunk>();
const savedSegments = () => [...mockRecords.values()].map((record) => record.segment);
const savedTranscript = () =>
  savedSegments()
    .map((segment) => segment.text)
    .join(' ');
jest.mock('../../utilities/audio/recordingChunkStore', () => ({
  listRecordingChunks: jest.fn(async (scope: string) =>
    [...mockRecords.values()].filter((record) => record.scope === scope),
  ),
  putRecordingChunk: jest.fn(async (record: RecordingChunk) => {
    mockRecords.set(record.segment.id, { ...record, segment: { ...record.segment } });
  }),
  clearRecordingChunks: jest.fn(async () => mockRecords.clear()),
}));

jest.mock('../../utilities/ai/aiSettings', () => ({
  getEffectiveTranscriptionConfig: jest.fn(async () => ({ provider: 'custom' })),
}));
jest.mock('../../utilities/ai/aiClient.js', () => ({ transcribeAudio: jest.fn() }));
jest.mock('./sessionListeningQuestions', () => ({
  LISTENING_QUESTION_COUNT: 10,
  generateQuestionsFromListeningTranscript: jest.fn(),
}));
jest.mock('./CreateQuestionsAndSurveys', () => ({ __esModule: true, default: () => null }));
jest.mock('./useInterviewReadiness', () => ({ useInterviewReadiness: jest.fn() }));
jest.mock('./useInterviewOpening', () => ({ useInterviewOpening: jest.fn() }));

const transcript = 'The last words are saved.';
const mockStopTrack = jest.fn();
const mockStop = jest.fn();
class FakeRecorder {
  static isTypeSupported = () => true;
  state = 'inactive';
  ondataavailable?: (event: { data: Blob }) => void;
  onstop?: () => void;
  start() {
    this.state = 'recording';
  }
  stop() {
    mockStop();
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob([new Uint8Array(256)], { type: 'audio/webm' }) });
    this.onstop?.();
  }
}
function Harness() {
  const [isOpen, setOpen] = useState(true);
  return (
    <>
      <button onClick={() => setOpen(true)}>Reopen recording</button>
      <SessionVoiceModeModal
        isOpen={isOpen}
        mode="recordGroup"
        sessionSlug="recording-fixture"
        onClose={() => setOpen(false)}
        onSelectMode={() => {}}
        questionPool={[]}
        onApplyAnswer={() => {}}
        onApplyAdditional={() => {}}
        onApplyImportance={() => {}}
        onApplyConviction={() => {}}
      />
    </>
  );
}
function dismiss(method: string) {
  const dialog = screen.getByRole('dialog');
  if (method === 'Close') fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  else if (method === 'Escape')
    fireEvent.keyUp(document.activeElement || document.body, { key: 'Escape', keyCode: 27 });
  else {
    fireEvent.mouseDown(dialog);
    fireEvent.click(dialog);
  }
}
const originalRecorder = globalThis.MediaRecorder;
const originalDevices = navigator.mediaDevices;
beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  mockRecords.clear();
  jest.mocked(transcribeAudio).mockResolvedValue(transcript);
  Object.defineProperty(globalThis, 'MediaRecorder', { configurable: true, value: FakeRecorder });
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: jest.fn(async () => ({ getTracks: () => [{ stop: mockStopTrack }] })),
    },
  });
});
afterEach(() => {
  Object.defineProperty(globalThis, 'MediaRecorder', { configurable: true, value: originalRecorder });
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: originalDevices });
});

it.each(['Close', 'Escape', 'outside click'])(
  'closing with %s saves the final speech and restores it on reopen',
  async (method) => {
    render(<Harness />);
    await waitFor(() => expect(screen.getByTestId('ce-session-listening-start')).toBeEnabled());
    fireEvent.click(screen.getByTestId('ce-session-listening-start'));
    await screen.findByRole('button', { name: 'Stop recording' });
    dismiss(method);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(transcribeAudio).toHaveBeenCalledTimes(1);
    expect(savedTranscript()).toBe(transcript);
    fireEvent.click(screen.getByText('Reopen recording'));
    fireEvent.click(await screen.findByTestId('ce-session-listening-transcript-details'));
    expect(screen.getByTestId('ce-session-listening-transcript')).toHaveValue(transcript);
  },
);

it('waits for delayed transcription and ignores repeated dismissals', async () => {
  let finish = (_text: string) => {};
  jest.mocked(transcribeAudio).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(<Harness />);
  await waitFor(() => expect(screen.getByTestId('ce-session-listening-start')).toBeEnabled());
  fireEvent.click(screen.getByTestId('ce-session-listening-start'));
  await screen.findByRole('button', { name: 'Stop recording' });
  dismiss('Close');
  expect(await screen.findByText('Finalizing recording…')).toBeInTheDocument();
  dismiss('Escape');
  dismiss('outside click');
  expect(mockStop).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  await act(async () => finish(transcript));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(savedTranscript()).toBe(transcript);
});

it('stopping before closing preserves the completed transcript without transcribing it twice', async () => {
  render(<Harness />);
  await waitFor(() => expect(screen.getByTestId('ce-session-listening-start')).toBeEnabled());
  fireEvent.click(screen.getByTestId('ce-session-listening-start'));
  fireEvent.click(await screen.findByRole('button', { name: 'Stop recording' }));
  await waitFor(() => expect(savedTranscript()).toBe(transcript));
  dismiss('Close');
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(transcribeAudio).toHaveBeenCalledTimes(1);
});

it('keeps failed audio in storage and automatically retries it before closing', async () => {
  jest
    .mocked(transcribeAudio)
    .mockRejectedValueOnce(new Error('Transcription unavailable'))
    .mockResolvedValue(transcript);
  render(<Harness />);
  await waitFor(() => expect(screen.getByTestId('ce-session-listening-start')).toBeEnabled());
  fireEvent.click(screen.getByTestId('ce-session-listening-start'));
  await screen.findByRole('button', { name: 'Stop recording' });
  dismiss('Close');
  expect(await screen.findByText('Retrying')).toBeInTheDocument();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect([...mockRecords.values()][0]?.audio?.size).toBe(256);
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), { timeout: 3000 });
  expect(transcribeAudio).toHaveBeenCalledTimes(2);
  expect(jest.mocked(transcribeAudio).mock.calls[1][0]).toBe(jest.mocked(transcribeAudio).mock.calls[0][0]);
  expect(mockStop).toHaveBeenCalledTimes(1);
  expect(savedTranscript()).toBe(transcript);
});
