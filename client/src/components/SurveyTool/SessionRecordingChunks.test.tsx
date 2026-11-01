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
