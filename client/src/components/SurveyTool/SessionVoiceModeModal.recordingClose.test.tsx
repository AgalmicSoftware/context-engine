import React, { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SessionVoiceModeModal from './SessionVoiceModeModal';
import { transcribeAudio } from '../../utilities/ai/aiClient.js';
import { putRecordingChunk, type RecordingChunk } from '../../utilities/audio/recordingChunkStore';
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
  deleteRecordingChunk: jest.fn(async (_scope: string, id: string) => mockRecords.delete(id)),
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
      <button onClick={() => setOpen(true)}>Open the dialog again</button>
      <SessionVoiceModeModal
        isOpen={isOpen}
        mode="recordGroup"
        sessionSlug="recording-fixture"
        onClose={() => setOpen(false)}
        onSelectMode={() => setOpen(true)}
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
// While capturing, the header close asks first; Stop goes ahead.
const confirmStop = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Stop' }));
  await waitFor(() => expect(screen.queryByText('Stop recording?')).not.toBeInTheDocument());
};
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

it('opens the recorder without the microphone, and records only after Record once the microphone is granted', async () => {
  const getUserMedia = jest.mocked(navigator.mediaDevices.getUserMedia);
  getUserMedia.mockRejectedValueOnce(new DOMException('Permission denied', 'NotAllowedError'));
  render(<Harness />);
  await waitFor(() => expect(screen.getByTestId('ce-session-listening-start')).toBeEnabled());
  expect(getUserMedia).not.toHaveBeenCalled();
  // A refused microphone records nothing.
  fireEvent.click(screen.getByTestId('ce-session-listening-start'));
  await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.getByTestId('ce-session-listening-start')).toBeEnabled());
  expect(screen.queryByRole('button', { name: 'Stop recording' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByTestId('ce-session-listening-start'));
  expect(await screen.findByRole('button', { name: 'Stop recording' })).toBeInTheDocument();
  expect(getUserMedia).toHaveBeenCalledTimes(2);
});

it('closing with Close saves the final speech and restores it on reopen', async () => {
  render(<Harness />);
  await waitFor(() => expect(screen.getByTestId('ce-session-listening-start')).toBeEnabled());
  fireEvent.click(screen.getByTestId('ce-session-listening-start'));
  await screen.findByRole('button', { name: 'Stop recording' });
  dismiss('Close');
  await confirmStop();
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(transcribeAudio).toHaveBeenCalledTimes(1);
  expect(savedTranscript()).toBe(transcript);
  fireEvent.click(screen.getByText('Open the dialog again'));
  // A group recording shows its restored transcript open.
  expect(await screen.findByTestId('ce-session-listening-transcript')).toHaveTextContent(transcript);
});

it.each(['Escape', 'outside click'])(
  '%s keeps capturing, then closes and saves once the recording is stopped',
  async (method) => {
    render(<Harness />);
    await waitFor(() => expect(screen.getByTestId('ce-session-listening-start')).toBeEnabled());
    fireEvent.click(screen.getByTestId('ce-session-listening-start'));
    await screen.findByRole('button', { name: 'Stop recording' });
    dismiss(method);
    await act(async () => {});
    expect(mockStop).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }));
    await waitFor(() => expect(screen.getByTestId('ce-session-listening-transcript')).toHaveTextContent(transcript));
    dismiss(method);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(savedTranscript()).toBe(transcript);
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
  await confirmStop();
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
  await confirmStop();
  expect(await screen.findByRole('button', { name: 'Retry transcription' })).toBeInTheDocument();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect([...mockRecords.values()][0]?.audio?.size).toBe(256);
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), { timeout: 3000 });
  expect(transcribeAudio).toHaveBeenCalledTimes(2);
  expect(jest.mocked(transcribeAudio).mock.calls[1][0]).toBe(jest.mocked(transcribeAudio).mock.calls[0][0]);
  expect(mockStop).toHaveBeenCalledTimes(1);
  expect(savedTranscript()).toBe(transcript);
});

it('closes with pending audio and resumes it when the recording reopens', async () => {
  jest.mocked(transcribeAudio).mockImplementation(() => new Promise(() => {}));
  render(<Harness />);
  await waitFor(() => expect(screen.getByTestId('ce-session-listening-start')).toBeEnabled());
  fireEvent.click(screen.getByTestId('ce-session-listening-start'));
  await screen.findByRole('button', { name: 'Stop recording' });
  dismiss('Close');
  await confirmStop();
  fireEvent.click(await screen.findByRole('button', { name: 'Close and keep the audio' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect([...mockRecords.values()][0]?.audio?.size).toBe(256);
  jest.mocked(transcribeAudio).mockResolvedValue(transcript);
  fireEvent.click(screen.getByText('Open the dialog again'));
  await waitFor(() => expect(screen.getByTestId('ce-session-listening-transcript')).toHaveTextContent(transcript));
  expect(savedTranscript()).toBe(transcript);
  // The saved transcript replaced the audio on the device.
  expect([...mockRecords.values()][0]?.audio).toBeUndefined();
  expect(transcribeAudio).toHaveBeenCalledTimes(2);
});

it('asks before the header close stops a recording, and Keep recording goes on capturing', async () => {
  render(<Harness />);
  await waitFor(() => expect(screen.getByTestId('ce-session-listening-start')).toBeEnabled());
  fireEvent.click(screen.getByTestId('ce-session-listening-start'));
  await screen.findByRole('button', { name: 'Stop recording' });
  dismiss('Close');
  expect(await screen.findByText('Stop recording?')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Keep recording' }));
  await waitFor(() => expect(screen.queryByText('Stop recording?')).not.toBeInTheDocument());
  expect(mockStop).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Stop recording' })).toBeInTheDocument();
  dismiss('Close');
  await confirmStop();
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(mockStop).toHaveBeenCalledTimes(1);
  expect(savedTranscript()).toBe(transcript);
});

it('reminds the session page to reopen while kept audio waits to upload', async () => {
  jest.mocked(transcribeAudio).mockImplementation(() => new Promise(() => {}));
  render(<Harness />);
  await waitFor(() => expect(screen.getByTestId('ce-session-listening-start')).toBeEnabled());
  fireEvent.click(screen.getByTestId('ce-session-listening-start'));
  fireEvent.click(await screen.findByRole('button', { name: 'Stop recording' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Close and keep the audio' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  const notice = await screen.findByText('Saved audio is waiting to upload.');
  expect(notice).toHaveAttribute('role', 'status');
  expect(screen.getByRole('button', { name: 'About kept recording audio' })).toHaveAccessibleDescription(
    /stays on this device/,
  );
  // Dismiss hides it until the dialog next closes; it never covers the page for good.
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
  expect(screen.queryByText(/waiting to upload/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Open the dialog again'));
  fireEvent.click(await screen.findByRole('button', { name: 'Close and keep the audio' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(await screen.findByText('Saved audio is waiting to upload.')).toBeInTheDocument();
  jest.mocked(transcribeAudio).mockResolvedValue(transcript);
  fireEvent.click(screen.getByRole('button', { name: 'Reopen recording' }));
  await waitFor(() => expect(screen.getByTestId('ce-session-listening-transcript')).toHaveTextContent(transcript));
  expect(screen.queryByText(/waiting to upload/)).not.toBeInTheDocument();
  dismiss('Close');
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await act(async () => {});
  expect(screen.queryByText(/waiting to upload/)).not.toBeInTheDocument();
});

it.each(['a transcribed recording', 'a pasted transcript'])(
  'warns on the session page and before leaving while only this page holds %s',
  async (kind) => {
    const put = jest.mocked(putRecordingChunk).getMockImplementation()!;
    jest.mocked(putRecordingChunk).mockRejectedValue(new DOMException('Full', 'QuotaExceededError'));
    const leaving = () => !window.dispatchEvent(new Event('beforeunload', { cancelable: true }));
    try {
      render(<Harness />);
      await waitFor(() => expect(screen.getByTestId('ce-session-listening-start')).toBeEnabled());
      if (kind === 'a transcribed recording') {
        fireEvent.click(screen.getByTestId('ce-session-listening-start'));
        fireEvent.click(await screen.findByRole('button', { name: 'Stop recording' }));
      } else {
        fireEvent.click(screen.getByRole('button', { name: 'Add input' }));
        fireEvent.click(screen.getByRole('button', { name: 'Paste transcript' }));
        fireEvent.change(screen.getByLabelText('Written transcript'), { target: { value: transcript } });
        fireEvent.click(screen.getByRole('button', { name: 'Add transcript' }));
      }
      await waitFor(() => expect(screen.getByTestId('ce-session-listening-transcript')).toHaveTextContent(transcript));
      dismiss('Close');
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      // Transcribed or pasted, nothing waits to upload, yet a reload would lose it.
      expect(await screen.findByText("This recording can't be recovered after a reload.")).toHaveAttribute(
        'role',
        'status',
      );
      expect(screen.getByRole('button', { name: 'About kept recording audio' })).toHaveAccessibleDescription(
        /only this page holds it/,
      );
      expect(leaving()).toBe(true);
      // Cleared, nothing is left to lose.
      fireEvent.click(screen.getByRole('button', { name: 'Reopen recording' }));
      // Transcribed, so no audio is left, but Clear still asks before deleting the transcript.
      fireEvent.click(await screen.findByRole('button', { name: 'Clear transcript' }));
      expect(await screen.findByText('This deletes the transcript from this device.')).toBeInTheDocument();
      expect(screen.getByTestId('ce-session-listening-transcript')).toHaveTextContent(transcript);
      fireEvent.click(screen.getByTestId('ce-recording-clear-confirm'));
      await waitFor(() => expect(screen.queryByText('Clear this recording?')).not.toBeInTheDocument());
      await waitFor(() => expect(screen.queryByTestId('ce-session-listening-transcript')).not.toBeInTheDocument());
      dismiss('Close');
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      await act(async () => {});
      expect(screen.queryByText(/can't be recovered/)).not.toBeInTheDocument();
      expect(leaving()).toBe(false);
    } finally {
      jest.mocked(putRecordingChunk).mockImplementation(put);
    }
  },
);
