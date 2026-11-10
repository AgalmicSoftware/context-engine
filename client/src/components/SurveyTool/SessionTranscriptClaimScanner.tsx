import { useEffect, useRef, useState } from 'react';
import { Button } from 'reactstrap';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import {
  claimCodeDestination,
  createClaimCollector,
  readClaimFrame,
  unpackClaim,
  type ClaimFrame,
  type TranscriptClaim,
} from './sessionTranscriptClaim';
import styles from './SurveyTool.module.scss';

// Fast enough to catch every code as it passes, without keeping a phone's only thread busy.
const SCAN_GAP_MS = 90;
// A code reads best at the camera's own detail, so the view's middle goes to the decoder as it is. A code held
// close can overflow that, so every other try reads the whole view, scaled down.
const MIDDLE_PIXELS = 900;
const WHOLE_VIEW_PIXELS = 640;

type Props = {
  sessionSlug: string;
  /** The code that opened this page, already read. */
  firstFrame?: ClaimFrame | null;
  onClaim: (claim: TranscriptClaim) => void;
  onCancel: () => void;
};

/** Reads someone's looping code through the camera, then hands over their part of the conversation. */
export default function SessionTranscriptClaimScanner({ sessionSlug, firstFrame = null, onClaim, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [progress, setProgress] = useState(() => ({ collected: firstFrame ? 1 : 0, total: firstFrame?.total || 0 }));
  const [problem, setProblem] = useState('');
  const [otherSession, setOtherSession] = useState('');
  const latest = useRef({ onClaim, sessionSlug });
  latest.current = { onClaim, sessionSlug };

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const collector = createClaimCollector();
    const stop = () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
    // True once the part is whole, whether or not it could be used.
    const receive = async (frame: ClaimFrame): Promise<boolean> => {
      const { collected, total, packed } = collector.add(frame);
      setProgress({ collected, total });
      if (!packed) return false;
      const result = await unpackClaim(packed);
      if (stopped) return true;
      if (!result.ok) setProblem(result.error);
      else if (result.claim.sessionSlug !== latest.current.sessionSlug) setProblem('This code is for another session.');
      else {
        stop();
        latest.current.onClaim(result.claim);
      }
      return true;
    };
    const scan = async () => {
      const video = videoRef.current;
      if (!video) return;
      const [{ default: readQrCode }] = await Promise.all([import('jsqr')]);
      if (stopped) return;
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      if (stopped) {
        stop();
        return;
      }
      video.srcObject = stream;
      await video.play();
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { willReadFrequently: true });
      let wholeView = false;
      const tick = async () => {
        if (stopped) return;
        const { videoWidth: width, videoHeight: height } = video;
        const side = Math.min(width, height);
        if (side && context) {
          const crop = wholeView ? side : Math.min(side, MIDDLE_PIXELS);
          const output = wholeView ? Math.min(side, WHOLE_VIEW_PIXELS) : crop;
          wholeView = !wholeView;
          canvas.width = output;
          canvas.height = output;
          context.drawImage(video, (width - crop) / 2, (height - crop) / 2, crop, crop, 0, 0, output, output);
          const { data } = context.getImageData(0, 0, output, output);
          const code = readQrCode(data, output, output, { inversionAttempts: 'dontInvert' });
          if (code?.data) {
            const frame = readClaimFrame(code.data);
            const destination = frame ? claimCodeDestination(code.data, window.location) : '';
            if (frame && destination === 'here') {
              setProblem('');
              setOtherSession('');
              await receive(frame);
            } else if (destination === 'other') setOtherSession(code.data);
            else setProblem('That code isn’t someone’s part of a conversation.');
          }
        }
        if (!stopped) timer = setTimeout(() => void tick(), SCAN_GAP_MS);
      };
      await tick();
    };
    void (async () => {
      // A link with the whole part needs no camera.
      if (firstFrame && (await receive(firstFrame))) return;
      await scan();
    })().catch((failure: unknown) => {
      if (stopped) return;
      // A camera that opened but wouldn't play isn't left on behind the message.
      stop();
      const name = failure instanceof Error ? failure.name : '';
      setProblem(
        name === 'NotAllowedError'
          ? 'Allow the camera to scan the code, or ask for the link instead.'
          : 'The camera could not start. Ask for the link instead.',
      );
    });
    return stop;
    // Reading starts once and runs until this closes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { collected, total } = progress;
  return (
    <div className={styles.sessionClaimScanner} data-testid={E2E_TESTIDS.SESSION_CLAIM_SCANNER}>
      {/* Only the code is shown: nothing the camera sees is stored or sent. */}
      <video ref={videoRef} className={styles.sessionClaimVideo} muted playsInline aria-label="Camera view" />
      <p role="status" aria-live="polite">
        {total ? `Got ${collected} of ${total} pieces. Keep the camera on the code.` : 'Point the camera at the code.'}
      </p>
      {total ? <progress className={styles.sessionClaimMeter} value={collected} max={total} /> : null}
      {problem ? (
        <div className={styles.sessionListeningError} role="alert">
          {problem}
        </div>
      ) : null}
      {otherSession ? (
        <p role="alert">
          This code is for another session. <a href={otherSession}>Open that session</a>
        </p>
      ) : null}
      <Button type="button" className={styles.sessionRecordingButton} onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}
