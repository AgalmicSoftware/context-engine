import { useEffect, useId, useMemo, useState } from 'react';
import { Button, Modal, ModalBody, ModalHeader, UncontrolledTooltip } from 'reactstrap';
import { QRCodeSVG } from 'qrcode.react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import { readLinkedWorkerGroupId } from '../../domains/worker/workerGroupAutoJoin';
import { useRecordingWakeLock } from '../../utilities/audio/useRecordingWakeLock';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { speakerColor } from './SessionListeningTranscript';
import {
  CLAIM_CODE_MS,
  CLAIM_QR_VERSION,
  buildClaimCodes,
  buildClaimLink,
  claimablePeople,
  claimTranscriptFor,
  createClaimShareId,
  packClaim,
} from './sessionTranscriptClaim';
import styles from './SurveyTool.module.scss';

const ABOUT =
  'Each person scans their own code with their phone. It opens this session with their answers drafted from what they said, for them to check. Their part goes straight from this screen to their phone, without being uploaded. On a video call, share your screen.';
const ABOUT_CODE =
  'The code changes as it goes. Keep the camera on it until the phone has every piece; any it misses come round again.';

// The address a code opens: this session, on this Worker if the page was opened with one.
const claimBaseUrl = () => {
  const worker = new URLSearchParams(window.location.search).get('worker');
  return `${window.location.origin}${window.location.pathname}${worker ? `?worker=${encodeURIComponent(worker)}` : ''}`;
};

function ClaimCodeDialog({
  transcript,
  person,
  sessionSlug,
  onClose,
}: {
  transcript: string;
  person: string;
  sessionSlug: string;
  onClose: () => void;
}) {
  const helpId = `ce-claim-code-help-${useId().replace(/:/g, '')}`;
  const [share, setShare] = useState<{ codes: string[]; link: string } | null>(null);
  const [error, setError] = useState('');
  const [shown, setShown] = useState(0);
  const [copied, setCopied] = useState(false);
  // A dimming screen would stop the code being read.
  useRecordingWakeLock(true);
  // Built once: a person's code doesn't change under the camera as more of the conversation arrives.
  useEffect(() => {
    let current = true;
    void (async () => {
      const packed = await packClaim({
        sessionSlug,
        person,
        transcript: claimTranscriptFor(transcript, person),
        joinGroup: readLinkedWorkerGroupId(sessionSlug),
      });
      const id = createClaimShareId();
      const base = claimBaseUrl();
      if (current) setShare({ codes: buildClaimCodes(packed, base, id), link: buildClaimLink(packed, base, id) });
    })().catch((failure: unknown) => {
      if (current) setError(failure instanceof Error ? failure.message : 'This part could not be prepared.');
    });
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const count = share?.codes.length || 0;
  useEffect(() => {
    if (count < 2) return undefined;
    const timer = setInterval(() => setShown((index) => (index + 1) % count), CLAIM_CODE_MS);
    return () => clearInterval(timer);
  }, [count]);
  const number = Number(person.replace(/\D/g, '')) || 1;
  return (
    <Modal isOpen toggle={onClose} size="lg" centered contentClassName={styles.sessionVoiceModeModal}>
      <ModalHeader toggle={onClose}>
        <span className={styles.sessionClaimHeading}>
          <span className={styles.sessionClaimPerson} style={{ color: speakerColor(number) }}>
            {person}
          </span>
          <button
            type="button"
            id={helpId}
            className={styles.sessionInterviewHeaderButton}
            aria-label="About this code"
            aria-describedby={`${helpId}-about`}
          >
            <FontAwesomeIcon icon={faQuestionCircle} />
          </button>
          <span id={`${helpId}-about`} hidden>
            {ABOUT_CODE}
          </span>
          <UncontrolledTooltip target={helpId} trigger="hover focus" autohide={false}>
            {ABOUT_CODE}
          </UncontrolledTooltip>
        </span>
      </ModalHeader>
      <ModalBody>
        {error ? (
          <div className={styles.sessionListeningError} role="alert">
            {error}
          </div>
        ) : null}
        {share ? (
          <div className={styles.sessionClaimCode} data-testid={E2E_TESTIDS.SESSION_CLAIM_CODE}>
            <div className={styles.sessionClaimCodeBox}>
              <QRCodeSVG
                value={share.codes[shown]}
                level="M"
                minVersion={CLAIM_QR_VERSION}
                boostLevel={false}
                marginSize={4}
                size={640}
                title={`${person}'s code, ${shown + 1} of ${count}`}
              />
            </div>
            <p className={styles.sessionClaimProgress}>
              Code {shown + 1} of {count} · about {Math.ceil((count * CLAIM_CODE_MS) / 1000)} s a loop
            </p>
            <div className={styles.sessionClaimActions}>
              <Button
                type="button"
                className={styles.sessionRecordingButton}
                onClick={async () => {
                  await navigator.clipboard?.writeText(share.link);
                  setCopied(true);
                }}
              >
                {copied ? 'Link copied' : 'Copy link instead'}
              </Button>
              <Button type="button" className={styles.sessionRecordingButton} onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        ) : null}
      </ModalBody>
    </Modal>
  );
}

type Props = { transcript: string; sessionSlug: string };

/** Under a labelled transcript: one button per speaker, each showing the code that hands them their part. */
export default function SessionTranscriptClaimShare({ transcript, sessionSlug }: Props) {
  const helpId = `ce-claim-help-${useId().replace(/:/g, '')}`;
  const people = useMemo(() => claimablePeople(transcript), [transcript]);
  const [person, setPerson] = useState('');
  if (!people.length) return null;
  return (
    <div className={styles.sessionClaimShare} data-testid={E2E_TESTIDS.SESSION_CLAIM_SHARE}>
      <span className={styles.sessionRecordingOption}>
        <span>Give each person their part</span>
        <button
          type="button"
          id={helpId}
          className={styles.sessionInterviewHeaderButton}
          aria-label="About giving each person their part"
          aria-describedby={`${helpId}-about`}
        >
          <FontAwesomeIcon icon={faQuestionCircle} />
        </button>
        <span id={`${helpId}-about`} hidden>
          {ABOUT}
        </span>
        <UncontrolledTooltip target={helpId} trigger="hover focus" autohide={false}>
          {ABOUT}
        </UncontrolledTooltip>
      </span>
      <span className={styles.sessionClaimPeople}>
        {people.map((name) => (
          <button
            key={name}
            type="button"
            className={styles.sessionClaimPersonButton}
            style={{ color: speakerColor(Number(name.replace(/\D/g, ''))) }}
            onClick={() => setPerson(name)}
          >
            {name}
          </button>
        ))}
      </span>
      {person ? (
        <ClaimCodeDialog
          transcript={transcript}
          person={person}
          sessionSlug={sessionSlug}
          onClose={() => setPerson('')}
        />
      ) : null}
    </div>
  );
}
