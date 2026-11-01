import React, { useState } from 'react';
import type { RollingTranscriptSegment } from '../../utilities/audio/rollingTranscription';
import { buildPublicUrlPath } from '../../utilities/ui/publicUrl';
import styles from './SessionRecordingChunks.module.scss';
import recorderStyles from './SurveyTool.module.scss';

const STATUS_LABELS = {
  recording: 'Recording',
  queued: 'Waiting to upload',
  transcribing: 'Uploading',
  complete: 'Transcribed',
  failed: 'Failed',
  retrying: 'Retrying',
};

type Props = {
  segments: RollingTranscriptSegment[];
  downloadableChunkIds?: string[];
  onRetry: (id: string) => void;
  onDownload: (id: string) => void;
  onDownloadRecording: (onProgress: (percent: number) => void) => Promise<void>;
  capturing?: boolean;
};

export function SessionRecordingChunks({
  segments,
  downloadableChunkIds = [],
  onRetry,
  onDownload,
  onDownloadRecording,
  capturing = false,
}: Props) {
  const [downloadError, setDownloadError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [percent, setPercent] = useState(0);
  if (!segments.length) return null;
  const retryable = segments.filter((segment) => ['failed', 'retrying', 'transcribing'].includes(segment.status));
  const errors = [...new Set(segments.map((segment) => segment.error).filter(Boolean))];
  return (
    <div className={styles.recovery}>
      <div className={styles.row}>
        {retryable.length > 0 && (
          <button
            type="button"
            className={recorderStyles.sessionRecordingButton}
            onClick={() => retryable.forEach((segment) => onRetry(segment.id))}
          >
            Retry transcription
          </button>
        )}
        {downloadableChunkIds.length > 0 && (
          <button
            type="button"
            className={recorderStyles.sessionRecordingButton}
            disabled={capturing || downloading}
            onClick={async () => {
              setDownloading(true);
              setDownloadError('');
              setPercent(0);
              try {
                await onDownloadRecording(setPercent);
                setDownloaded(true);
              } catch (error) {
                setDownloadError(error instanceof Error ? error.message : 'Could not export this recording.');
              } finally {
                setDownloading(false);
              }
            }}
          >
            {downloading ? `Preparing MP3… ${percent}%` : 'Download audio'}
          </button>
        )}
      </div>
      {errors.map((error) => (
        <p key={error}>
          {/anonymous access denied.*transcribe|workerAuthority\.anonymousScopes/i.test(error || '')
            ? 'This attempt was blocked by the session’s access settings. Retry if access has been enabled, or sign in.'
            : error}
        </p>
      ))}
      {(downloaded || downloading || downloadError) && (
        <small>
          MP3 encoder: LAME (Alex Zhukov and contributors).{' '}
          <a href={buildPublicUrlPath('/licenses/lamejs/README.txt')} target="_blank" rel="noreferrer">
            License &amp; source
          </a>
        </small>
      )}
      {downloadError && <p role="alert">{downloadError}</p>}
      {downloadError && (
        <ol className={styles.chunks} aria-label="Original audio downloads" data-testid="ce-recording-chunks">
          {segments
            .filter((segment) => downloadableChunkIds.includes(segment.id))
            .map((segment) => (
              <li key={segment.id}>
                <div className={styles.row}>
                  <strong>
                    {segment.source === 'text' ? 'Transcript' : 'Audio'} {segment.index + 1}
                  </strong>
                  <span role="status">{segment.source === 'text' ? 'Added' : STATUS_LABELS[segment.status]}</span>
                  <div className={styles.actions}>
                    {downloadableChunkIds.includes(segment.id) ? (
                      <button
                        type="button"
                        className={recorderStyles.sessionRecordingButton}
                        onClick={() => onDownload(segment.id)}
                        aria-label={`Download chunk ${segment.index + 1}`}
                      >
                        Download audio
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
        </ol>
      )}
    </div>
  );
}
