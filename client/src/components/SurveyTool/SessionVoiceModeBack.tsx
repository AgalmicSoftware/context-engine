/** @file SessionVoiceModeBack.tsx: Back from Interview or Group Conversation to the Voice mode choices. */
import { createContext } from 'react';
import { UncontrolledTooltip } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import styles from './SurveyTool.module.scss';

/** The dialog's Back, for the Interview header the interview panel renders; none leaves Back out. */
export const VoiceModeBackContext = createContext<(() => void) | null>(null);

type Props = { id: string; onBack: () => void; disabled?: boolean };

// Left of the title. It's off while a recording or an interview is under way, which going back would cut short.
export default function SessionVoiceModeBackButton({ id, onBack, disabled = false }: Props) {
  return (
    <>
      <button
        type="button"
        id={id}
        className={styles.sessionInterviewHeaderButton}
        data-ce-control-appearance="frameless"
        aria-label="Back to Voice mode"
        disabled={disabled}
        data-testid="ce-voice-mode-back"
        onClick={onBack}
      >
        <FontAwesomeIcon icon={faArrowLeft} />
      </button>
      <UncontrolledTooltip target={id} placement="bottom" trigger="hover focus">
        Back to Voice mode
      </UncontrolledTooltip>
    </>
  );
}
