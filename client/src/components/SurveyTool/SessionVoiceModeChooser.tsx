import { useEffect, useId, useRef, type ReactNode } from 'react';
import { UncontrolledTooltip } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faComments, faMicrophone, faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import styles from './SurveyTool.module.scss';
import type { SessionVoiceMode } from './sessionInterview';

const CHOICES = [
  {
    mode: 'interview' as const,
    icon: faMicrophone,
    title: 'Interview',
    about: 'Talk with an AI interviewer to answer the session’s questions, then review your responses.',
    testId: E2E_TESTIDS.SESSION_VOICE_MODE_INTERVIEW,
  },
  {
    mode: 'recordGroup' as const,
    icon: faComments,
    title: 'Group Conversation',
    about: 'Record a group discussion and generate questions and context from it.',
    testId: E2E_TESTIDS.SESSION_VOICE_MODE_GROUP,
  },
];

type SessionVoiceModeChooserProps = {
  onSelectMode: (mode: SessionVoiceMode) => void;
  // The choice to focus when the choices return from it, so focus doesn't drop to the page.
  focusMode?: SessionVoiceMode | null;
  // Shown below the two choices, such as the AI-prefill option.
  children?: ReactNode;
};

export default function SessionVoiceModeChooser({
  onSelectMode,
  focusMode = null,
  children,
}: SessionVoiceModeChooserProps) {
  const focusRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    focusRef.current?.focus();
  }, []);
  return (
    <div className={styles.sessionVoiceModeLauncher}>
      <div className={styles.sessionVoiceModeChooser} data-testid={E2E_TESTIDS.SESSION_VOICE_MODE_CHOOSER}>
        {CHOICES.map(({ mode, icon, title, about, testId }) => (
          <div key={mode} className={styles.sessionVoiceModeChoice}>
            <button
              ref={mode === focusMode ? focusRef : undefined}
              type="button"
              className={styles.sessionVoiceModeChoiceButton}
              onClick={() => onSelectMode(mode)}
              aria-describedby={`ce-voice-mode-${mode}-about`}
              data-testid={testId}
            >
              <FontAwesomeIcon icon={icon} fixedWidth />
              <strong>{title}</strong>
            </button>
            {/* Screen readers hear each choice's description with it: `aria-describedby` still reads hidden text. */}
            <span id={`ce-voice-mode-${mode}-about`} hidden>
              {about}
            </span>
          </div>
        ))}
      </div>
      {children}
    </div>
  );
}

/** One "?" beside the dialog's "Voice mode" title, explaining both choices, each under its name. */
export function SessionVoiceModeHelp() {
  const id = `ce-voice-mode-help-${useId().replace(/:/g, '')}`;
  const items = CHOICES.map(({ mode, title, about }) => (
    <span key={mode} className={styles.sessionVoiceModeHelpItem}>
      <strong>{title}</strong> {about}
    </span>
  ));
  return (
    <>
      <button
        type="button"
        id={id}
        className={styles.sessionInterviewHeaderButton}
        data-ce-control-appearance="frameless"
        aria-label="About voice mode"
        aria-describedby={`${id}-description`}
      >
        <FontAwesomeIcon icon={faQuestionCircle} />
      </button>
      <span id={`${id}-description`} hidden>
        {items}
      </span>
      <UncontrolledTooltip target={id} trigger="hover focus" autohide={false}>
        {items}
      </UncontrolledTooltip>
    </>
  );
}
