import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SessionRecordingInput from './SessionRecordingInput';

it('adds MP3 files with a usable MIME type and permits choosing the same file again', async () => {
  const onAudio = jest.fn(async (_audio: Blob) => {});
  render(<SessionRecordingInput disabled={false} onAudio={onAudio} onTranscript={jest.fn()} />);
  expect(screen.getByRole('button', { name: /Add input/ })).toHaveTextContent(/^\+$/);
  fireEvent.click(screen.getByRole('button', { name: /Add input/ }));
  expect(screen.getByRole('button', { name: /Upload audio/ })).toBeVisible();
  const input = screen.getByLabelText('Upload audio file');
  const file = new File(['audio'], 'conversation.MP3');
  fireEvent.change(input, { target: { files: [file] } });
  await screen.findByText('Audio added. Transcription will appear below.');
  expect(onAudio.mock.calls[0][0]).toMatchObject({ type: 'audio/mpeg', size: 5 });
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(onAudio).toHaveBeenCalledTimes(2));
});

it('can put its + elsewhere, as in a dialog’s header, keeping its choices and Escape where they were', () => {
  const header = document.createElement('div');
  document.body.append(header);
  try {
    const { container } = render(
      <SessionRecordingInput disabled={false} onAudio={jest.fn()} onTranscript={jest.fn()} triggerSlot={header} />,
    );
    const add = screen.getByRole('button', { name: 'Add input' });
    expect(header).toContainElement(add);
    expect(container).not.toContainElement(add);
    fireEvent.click(add);
    expect(container).toContainElement(screen.getByRole('button', { name: /Upload audio/ }));
    fireEvent.keyDown(add, { key: 'Escape' });
    expect(screen.queryByRole('button', { name: /Upload audio/ })).toBeNull();
    expect(add).toHaveAttribute('aria-expanded', 'false');
  } finally {
    header.remove();
  }
});

it('rejects unsupported, empty and oversized audio before enqueueing', async () => {
  const onAudio = jest.fn();
  render(<SessionRecordingInput disabled={false} onAudio={onAudio} onTranscript={jest.fn()} />);
  const input = screen.getByLabelText('Upload audio file');
  for (const [file, message] of [
    [new File(['bad'], 'document.pdf'), /Choose an MP3/],
    [new File([], 'empty.mp3'), /empty/],
    [Object.assign(new File(['audio'], 'large.mp3'), {}), /up to 20 MB/],
  ] as Array<[File, RegExp]>) {
    if (file.name === 'large.mp3') Object.defineProperty(file, 'size', { value: 21 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(message));
  }
  expect(onAudio).not.toHaveBeenCalled();
});

it('supports pasted and uploaded transcripts, retaining the paste if saving fails', async () => {
  const onTranscript = jest.fn(async (_text: string) => {}).mockRejectedValueOnce(new Error('Try again.'));
  render(<SessionRecordingInput disabled={false} onAudio={jest.fn()} onTranscript={onTranscript} />);
  fireEvent.click(screen.getByRole('button', { name: /Add input/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Paste transcript' }));
  fireEvent.change(screen.getByLabelText('Written transcript'), { target: { value: 'A written discussion.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add transcript' }));
  await screen.findByText('Try again.');
  expect(screen.getByLabelText('Written transcript')).toHaveValue('A written discussion.');
  fireEvent.click(screen.getByRole('button', { name: 'Add transcript' }));
  await screen.findByText('Transcript added.');
  const file = new File(['Uploaded discussion.'], 'conversation.txt');
  Object.defineProperty(file, 'text', { value: async () => 'Uploaded discussion.' });
  fireEvent.change(screen.getByLabelText('Upload transcript file'), { target: { files: [file] } });
  await waitFor(() => expect(onTranscript).toHaveBeenLastCalledWith('Uploaded discussion.'));
});

it('closes its choices with Escape and blocks changes when disabled', () => {
  const { rerender } = render(<SessionRecordingInput disabled={false} onAudio={jest.fn()} onTranscript={jest.fn()} />);
  const toggle = screen.getByRole('button', { name: /Add input/ });
  fireEvent.click(toggle);
  fireEvent.keyDown(screen.getByRole('button', { name: 'Paste transcript' }), { key: 'Escape' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(toggle).toHaveFocus();
  rerender(<SessionRecordingInput disabled onAudio={jest.fn()} onTranscript={jest.fn()} />);
  expect(toggle).toBeDisabled();
  expect(screen.getByLabelText('Upload audio file')).toBeDisabled();
});
