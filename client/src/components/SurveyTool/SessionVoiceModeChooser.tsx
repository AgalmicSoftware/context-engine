import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faComments, faMicrophone } from '@fortawesome/free-solid-svg-icons';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import styles from './SurveyTool.module.scss';
import type { SessionVoiceMode } from './sessionInterview';

type SessionVoiceModeChooserProps = {
  onSelectMode: (mode: SessionVoiceMode) => void;
};

export default function SessionVoiceModeChooser({ onSelectMode }: SessionVoiceModeChooserProps) {
  return (
    <div className={styles.sessionVoiceModeChooser} data-testid={E2E_TESTIDS.SESSION_VOICE_MODE_CHOOSER}>
      <button type="button" onClick={() => onSelectMode('interview')} data-testid={E2E_TESTIDS.SESSION_VOICE_MODE_INTERVIEW}>
        <FontAwesomeIcon icon={faMicrophone} />
        <strong>Interview</strong>
        <span>One person. A voice interviewer drafts responses and may suggest new questions for review.</span>
      </button>
      <button type="button" onClick={() => onSelectMode('recordGroup')} data-testid={E2E_TESTIDS.SESSION_VOICE_MODE_GROUP}>
        <FontAwesomeIcon icon={faComments} />
        <strong>Group Conversation</strong>
        <span>Record a group discussion and generate new question drafts from it.</span>
      </button>
    </div>
  );
}
