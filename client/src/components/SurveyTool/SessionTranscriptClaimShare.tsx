import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button, Modal, ModalBody, ModalHeader, UncontrolledTooltip } from 'reactstrap';
import { QRCodeSVG } from 'qrcode.react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle, faTimes } from '@fortawesome/free-solid-svg-icons';
import { readLinkedWorkerGroupId } from '../../domains/worker/workerGroupAutoJoin';
import {
  mergedSpeakerLabel,
  mergeSpeakers,
  speakersShownAs,
  splitSpeakers,
  type SpeakerMerges,
} from '../../utilities/audio/speakerMerges';
import { useRecordingWakeLock } from '../../utilities/audio/useRecordingWakeLock';
import { claimsWorkerCanonicalAuthority } from '../../utilities/session/sessionCapabilityProjection';
import { getDemoSessionConfigByKey } from '../../utilities/session/sessionDemoCompat';
import { getUsableSessionWorkerUrl } from '../../utilities/session/sessionWorkerAvailability';
import { normalizeShareableWorkerOrigin } from '../Sessions/sessionWizardUrlSupport';
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
  'Each person scans their own code with their phone. It opens this session with their answers drafted from what they said, for them to check. Their part goes straight from this screen to their phone, where the session’s AI drafts their answers from it. Nothing is saved until they submit. On a video call, share your screen. If one person has two labels, drag one onto the other (on a touch screen, hold it still first), or choose Same person as in their code; × splits them again.';
const ABOUT_CODE =
  'The code changes as it goes. Keep the camera on it until the phone has every piece; any it misses come round again.';
// A press that moves further than this is a drag, not a tap.
const DRAG_START_PX = 8;
// On a touch screen a drag starts once a finger has held a button still this long, so a swipe still scrolls.
const HOLD_MS = 400;
const NO_MERGES: SpeakerMerges = {};

// The address a code opens: this session, pinned to its Worker as its own links are, so a fresh phone can find it.
// Sessions the site ships with open from a clean link and need no pin, which leaves more room in each code.
const claimBaseUrl = (sessionSlug: string, sessionConfig: unknown) => {
  const shipped = getDemoSessionConfigByKey(sessionSlug) as { workerCanonicalCleanRoute?: unknown } | null | undefined;
  const pinned = claimsWorkerCanonicalAuthority(sessionConfig) && shipped?.workerCanonicalCleanRoute !== true;
  const worker =
    new URLSearchParams(window.location.search).get('worker') ||
    (pinned ? normalizeShareableWorkerOrigin(getUsableSessionWorkerUrl({ slug: sessionSlug, sessionConfig })) : '');
  return `${window.location.origin}${window.location.pathname}${worker ? `?worker=${encodeURIComponent(worker)}` : ''}`;
};

// The person button under a point, other than the one being dragged, which follows the pointer above it.
const personAt = (x: number, y: number, dragged: string): string =>
  (document.elementsFromPoint?.(x, y) || [])
    .map((element) => element.closest<HTMLElement>('[data-claim-person]')?.dataset.claimPerson || '')
    .find((name) => name && name !== dragged) || '';

function ClaimCodeDialog({
  transcript,
  person,
  label,
  others,
  onSamePerson,
  sessionSlug,
  sessionConfig,
  onClose,
}: {
  transcript: string;
  person: string;
  // The person as their button shows them, with anyone merged into them.
  label: string;
  // Everyone else with a button, for saying this is one of them.
  others: Array<{ person: string; label: string }>;
  onSamePerson?: (other: string) => void;
  sessionSlug: string;
  sessionConfig: unknown;
  onClose: () => void;
}) {
  const helpId = `ce-claim-code-help-${useId().replace(/:/g, '')}`;
  const [share, setShare] = useState<{ codes: string[]; link: string } | null>(null);
  const [error, setError] = useState('');
  const [shown, setShown] = useState(0);
  const [copied, setCopied] = useState(false);
  // Choosing whom this person is the same as: a second step, so a stray tap can't merge anyone.
  const [choosing, setChoosing] = useState(false);
  const firstChoiceRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (choosing) firstChoiceRef.current?.focus();
  }, [choosing]);
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
      const base = claimBaseUrl(sessionSlug, sessionConfig);
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
    <Modal
      isOpen
      toggle={onClose}
      size="lg"
      centered
      contentClassName={styles.sessionVoiceModeModal}
      // The row puts focus back itself: the button that opened this code may have been merged away.
      returnFocusAfterClose={false}
    >
      <ModalHeader toggle={onClose}>
        <span className={styles.sessionClaimHeading}>
          <span className={styles.sessionClaimPerson} style={{ color: speakerColor(number) }}>
            {label}
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
                title={`${label}'s code, ${shown + 1} of ${count}`}
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
              {onSamePerson && others.length ? (
                <Button
                  type="button"
                  className={styles.sessionRecordingButton}
                  aria-expanded={choosing}
                  onClick={() => setChoosing((open) => !open)}
                >
                  Same person as…
                </Button>
              ) : null}
              <Button type="button" className={styles.sessionRecordingButton} onClick={onClose}>
                Done
              </Button>
            </div>
            {choosing && onSamePerson ? (
              <div role="group" aria-label="Same person as" className={styles.sessionClaimPeople}>
                {others.map((other, index) => (
                  <button
                    key={other.person}
                    ref={index === 0 ? firstChoiceRef : undefined}
                    type="button"
                    className={styles.sessionClaimPersonButton}
                    style={{ color: speakerColor(Number(other.person.replace(/\D/g, ''))) }}
                    onClick={() => onSamePerson(other.person)}
                  >
                    {other.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </ModalBody>
    </Modal>
  );
}

type Props = {
  transcript: string;
  sessionSlug: string;
  sessionConfig?: unknown;
  // Whose code is showing, '' for none. The transcript's labels choose it too.
  person: string;
  onPersonChange: (person: string) => void;
  // Speakers the host merged, already applied to `transcript`, and where a change to them is kept. Without a
  // place to keep them, people can't be merged.
  speakerMerges?: SpeakerMerges;
  onSpeakerMergesChange?: (merges: SpeakerMerges) => void;
};

/**
 * Under a labelled transcript: one button per speaker, each showing the code that hands them their part. Dropping
 * one person's button on another's makes them one person, with one code; the × on a merged button splits it.
 */
export default function SessionTranscriptClaimShare({
  transcript,
  sessionSlug,
  sessionConfig = null,
  person,
  onPersonChange,
  speakerMerges = NO_MERGES,
  onSpeakerMergesChange,
}: Props) {
  const helpId = `ce-claim-help-${useId().replace(/:/g, '')}`;
  const people = useMemo(() => claimablePeople(transcript), [transcript]);
  const [row, setRow] = useState<HTMLSpanElement | null>(null);
  const [drag, setDrag] = useState<{ person: string; over: string; x: number; y: number } | null>(null);
  // `held`: the press may drag. A mouse or pen can at once; a finger only after holding still (see HOLD_MS).
  const pressRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    moved: boolean;
    held: boolean;
    timer?: ReturnType<typeof setTimeout>;
  } | null>(null);
  // A drag can end with a click on the button it started from, which mustn't open that person's code.
  const draggedRef = useRef('');
  const [announcement, setAnnouncement] = useState('');
  // After a split, a merge or a closed code, focus goes to that person's button: the control it was on may be gone.
  const focusRef = useRef('');
  useLayoutEffect(() => {
    const name = focusRef.current;
    focusRef.current = '';
    if (name) row?.querySelector<HTMLElement>(`[data-claim-person="${name}"]`)?.focus();
  });
  // Once a finger has held a button, its moves drag the button rather than scroll the page.
  useEffect(() => {
    if (!row) return undefined;
    const hold = (event: TouchEvent) => {
      if (pressRef.current?.held) event.preventDefault();
    };
    row.addEventListener('touchmove', hold, { passive: false });
    return () => row.removeEventListener('touchmove', hold);
  }, [row]);
  useEffect(() => () => clearTimeout(pressRef.current?.timer), []);
  if (!people.length) return null;
  const labelFor = (name: string) => mergedSpeakerLabel(speakerMerges, name);
  const merge = onSpeakerMergesChange
    ? (from: string, into: string) => {
        const next = mergeSpeakers(speakerMerges, from, into);
        if (next === speakerMerges) return;
        onSpeakerMergesChange(next);
        setAnnouncement(`${labelFor(from)} joined ${labelFor(into)}.`);
      }
    : undefined;
  const split = (name: string) => {
    onSpeakerMergesChange?.(splitSpeakers(speakerMerges, name));
    setAnnouncement(`${speakersShownAs(speakerMerges, name).join(', ')} are separate again.`);
    focusRef.current = name;
  };
  // Only the pointer that pressed ends its drag: another finger lifting or cancelling leaves it.
  const endDrag = (event: { pointerId: number }) => {
    const press = pressRef.current;
    if (press?.pointerId !== event.pointerId) return false;
    clearTimeout(press.timer);
    pressRef.current = null;
    setDrag(null);
    return true;
  };
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
      <span ref={setRow} className={styles.sessionClaimPeople}>
        {people.map((name) => {
          const label = labelFor(name);
          const color = speakerColor(Number(name.replace(/\D/g, '')));
          const dragged = drag?.person === name ? drag : null;
          const grouped = label !== name && Boolean(onSpeakerMergesChange);
          return (
            <span key={name} className={styles.sessionClaimPersonGroup}>
              <button
                type="button"
                data-claim-person={name}
                className={[
                  styles.sessionClaimPersonButton,
                  merge ? styles.sessionClaimPersonDraggable : '',
                  grouped ? styles.sessionClaimPersonGrouped : '',
                  dragged ? styles.sessionClaimPersonDragging : '',
                  drag?.over === name ? styles.sessionClaimPersonTarget : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{ color, ...(dragged && { transform: `translate(${dragged.x}px, ${dragged.y}px)` }) }}
                onPointerDown={(event) => {
                  if (!merge || event.isPrimary === false || event.button !== 0) return;
                  const touch = event.pointerType === 'touch';
                  const press = {
                    pointerId: event.pointerId,
                    x: event.clientX,
                    y: event.clientY,
                    moved: false,
                    held: !touch,
                  };
                  if (touch)
                    pressRef.current = {
                      ...press,
                      timer: setTimeout(() => {
                        if (pressRef.current?.pointerId !== press.pointerId) return;
                        pressRef.current.held = true;
                        // Lifted: from here the button follows the finger.
                        setDrag({ person: name, over: '', x: 0, y: 0 });
                      }, HOLD_MS),
                    };
                  else pressRef.current = press;
                  // Moves keep coming here once the pointer leaves the button.
                  event.currentTarget.setPointerCapture?.(event.pointerId);
                }}
                onPointerMove={(event) => {
                  const press = pressRef.current;
                  if (!press || press.pointerId !== event.pointerId) return;
                  const x = event.clientX - press.x;
                  const y = event.clientY - press.y;
                  const far = Math.hypot(x, y) >= DRAG_START_PX;
                  // A finger that moves before it has held still is swiping: the page scrolls and nothing drags.
                  if (!press.held) {
                    if (far) endDrag(event);
                    return;
                  }
                  if (!press.moved && !far) return;
                  press.moved = true;
                  setDrag({ person: name, over: personAt(event.clientX, event.clientY, name), x, y });
                }}
                onPointerUp={(event) => {
                  const press = pressRef.current;
                  // A finger that held still has lifted the button, even if it put it back where it was.
                  const dragged = Boolean(press && (press.moved || (press.held && press.timer)));
                  if (!endDrag(event) || !dragged) return;
                  // That click comes straight after, if at all: a touch, or a button merged away, has none.
                  draggedRef.current = name;
                  setTimeout(() => {
                    if (draggedRef.current === name) draggedRef.current = '';
                  });
                  const over = personAt(event.clientX, event.clientY, name);
                  if (!over) return;
                  // The dragged button goes; a keyboard's place moves to the button it joined.
                  if (document.activeElement === event.currentTarget) focusRef.current = over;
                  merge?.(name, over);
                }}
                onPointerCancel={endDrag}
                onLostPointerCapture={endDrag}
                onContextMenu={(event) => {
                  // A long press would otherwise open the phone's menu over the button being dragged.
                  if (pressRef.current?.held) event.preventDefault();
                }}
                onClick={() => {
                  if (draggedRef.current === name) {
                    draggedRef.current = '';
                    return;
                  }
                  onPersonChange(name);
                }}
              >
                {label}
              </button>
              {grouped ? (
                <button
                  type="button"
                  className={styles.sessionClaimSplit}
                  style={{ color }}
                  aria-label={`Split ${label}`}
                  title="Split into separate people"
                  onClick={() => split(name)}
                >
                  <FontAwesomeIcon icon={faTimes} aria-hidden="true" />
                </button>
              ) : null}
            </span>
          );
        })}
      </span>
      <span className={styles.sessionListeningSrOnly} role="status">
        {announcement}
      </span>
      {/* Only a speaker with a button: a blank label has no part. A new person gets codes of their own. */}
      {people.includes(person) ? (
        <ClaimCodeDialog
          key={person}
          transcript={transcript}
          person={person}
          label={labelFor(person)}
          others={people
            .filter((other) => other !== person)
            .map((other) => ({ person: other, label: labelFor(other) }))}
          onSamePerson={
            merge
              ? (other) => {
                  merge(person, other);
                  onPersonChange(other);
                }
              : undefined
          }
          sessionSlug={sessionSlug}
          sessionConfig={sessionConfig}
          onClose={() => {
            focusRef.current = person;
            onPersonChange('');
          }}
        />
      ) : null}
    </div>
  );
}
