import { useEffect, useRef } from 'react';
import { hasKeptRecordingAudio } from '../../utilities/audio/recordingChunkStore';
import { recordingOwner, type RecordingOptions } from '../../utilities/audio/recordingOwner';

/**
 * Calls `onFound` when this device keeps unsent audio of the session's recording, as after Close and keep the
 * audio and a reload, so the page can mount the voice dialog, whose notice asks for the recording to be reopened.
 */
export default function KeptRecordingProbe({ onFound, ...options }: RecordingOptions & { onFound: () => void }) {
  const { identity } = recordingOwner(options);
  const found = useRef(onFound);
  found.current = onFound;
  useEffect(() => {
    let current = true;
    hasKeptRecordingAudio(identity).then(
      (kept) => {
        if (kept && current) found.current();
      },
      // Without device storage nothing was kept.
      () => {},
    );
    return () => {
      current = false;
    };
  }, [identity]);
  return null;
}
