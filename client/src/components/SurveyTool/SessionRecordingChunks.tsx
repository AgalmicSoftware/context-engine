import React from 'react';
import type { RollingTranscriptSegment } from '../../utilities/audio/rollingTranscription';
import styles from './SessionRecordingChunks.module.scss';

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
};

export function SessionRecordingChunks({ segments, downloadableChunkIds = [], onRetry, onDownload }: Props) {
  if (!segments.length) return null;
  return (
    <ol className={styles.chunks} aria-label="Recording chunks" data-testid="ce-recording-chunks">
      {segments.map((segment) => (
        <li key={segment.id}>
          <div className={styles.row}>
            <strong>Chunk {segment.index + 1}</strong>
            <span role="status">{STATUS_LABELS[segment.status]}</span>
            <div className={styles.actions}>
              {/* An upload can hang without failing; Retry sends it again. */}
              {segment.status === 'failed' || segment.status === 'retrying' || segment.status === 'transcribing' ? (
                <button
                  type="button"
                  onClick={() => onRetry(segment.id)}
                  aria-label={`Retry chunk ${segment.index + 1}`}
                >
                  Retry
                </button>
              ) : null}
              {downloadableChunkIds.includes(segment.id) ? (
                <button
                  type="button"
                  onClick={() => onDownload(segment.id)}
                  aria-label={`Download chunk ${segment.index + 1}`}
                >
                  Download audio
                </button>
              ) : null}
            </div>
          </div>
          {segment.error ? <p>{segment.error}</p> : null}
        </li>
      ))}
    </ol>
  );
}
