import { fireEvent, render, screen } from '@testing-library/react';
import { SessionRecordingChunks } from './SessionRecordingChunks';

it('keeps the ordinary view free of audio parts and exposes originals only when export fails', async () => {
  const onDownload = jest.fn();
  render(
    <SessionRecordingChunks
      segments={[{ id: 'audio', index: 0, text: 'Saved.', status: 'complete', startedAt: 1 }]}
      downloadableChunkIds={['audio']}
      onRetry={jest.fn()}
      onDownload={onDownload}
      onDownloadRecording={async () => {
        throw new Error('Cannot decode this audio.');
      }}
    />,
  );
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Download audio' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Cannot decode this audio.');
  expect(screen.getByRole('list', { name: 'Original audio downloads' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Download chunk 1' }));
  expect(onDownload).toHaveBeenCalledWith('audio');
});

it('keeps every part downloadable while device storage fails, even during capture', () => {
  const onDownload = jest.fn();
  render(
    <SessionRecordingChunks
      segments={[
        { id: 'done', index: 0, text: 'Saved.', status: 'complete', startedAt: 1 },
        { id: 'live', index: 1, text: '', status: 'recording', startedAt: 2 },
      ]}
      downloadableChunkIds={['done', 'live']}
      onRetry={jest.fn()}
      onDownload={onDownload}
      onDownloadRecording={jest.fn()}
      capturing
      storageFailed
    />,
  );
  expect(screen.getByRole('button', { name: 'Download audio' })).toBeDisabled();
  expect(screen.getByRole('list', { name: 'Original audio downloads' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Download chunk 1' }));
  fireEvent.click(screen.getByRole('button', { name: 'Download chunk 2' }));
  expect(onDownload.mock.calls).toEqual([['done'], ['live']]);
});

it('offers Retry for an upload only once it has stalled', () => {
  const onRetry = jest.fn();
  const view = (error?: string) => (
    <SessionRecordingChunks
      segments={[{ id: 'upload', index: 0, text: '', status: 'transcribing', startedAt: 1, error }]}
      onRetry={onRetry}
      onDownload={jest.fn()}
      onDownloadRecording={jest.fn()}
    />
  );
  const { rerender } = render(view());
  // Retrying a healthy upload would abort it and might pay for it twice.
  expect(screen.queryByRole('button', { name: 'Retry transcription' })).not.toBeInTheDocument();
  rerender(view('The upload stopped responding. Retrying.'));
  fireEvent.click(screen.getByRole('button', { name: 'Retry transcription' }));
  expect(onRetry).toHaveBeenCalledWith('upload');
});
