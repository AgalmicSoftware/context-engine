import { useId } from 'react';
import { UncontrolledTooltip } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { describeInterviewPlatform } from './sessionInterviewModalState';
import SessionDataNote from './SessionDataNote';
import { RESEARCH_DOC_URL } from './SessionInterviewResearchConsent';
import type { InterviewPrefillPacket } from './sessionInterview';
import styles from './SurveyTool.module.scss';
import consentStyles from './SessionInterviewResearchConsent.module.scss';

export const HIDDEN_DRAFTS_ABOUT =
  'Some of your AI’s drafts start blank, so you answer before you see its guess. This measures how well your AI predicts you. Untick “Share for research” to see every draft and keep no research record.';

type Props = {
  draftCount: number;
  platform?: InterviewPrefillPacket['source']['platform'];
  // Drafts still hidden until the person answers; 0 once all are answered or research sharing is off.
  hiddenCount: number;
  // The session's note on where research data goes (interviewMode.dataNote); empty shows none.
  dataNote: string;
};

/** "Your AI drafted 38 answers", and when some are hidden, why, with the session's data note behind a "?". */
export default function SessionInterviewPrefillStatus({ draftCount, platform, hiddenCount, dataNote }: Props) {
  // Tooltip targets are CSS selectors, which can't contain React's colons.
  const helpId = `ce-hidden-drafts-help-${useId().replace(/:/g, '')}`;
  return (
    <div className={styles.sessionInterviewPrefillStatus} data-testid={E2E_TESTIDS.SESSION_INTERVIEW_PREFILL_STATUS}>
      <p className={styles.sessionInterviewPrefillStatusLine}>
        Your AI drafted {draftCount} {draftCount === 1 ? 'answer' : 'answers'}
        {platform && platform !== 'other' ? ` · ${describeInterviewPlatform(platform)}, self-reported` : ''}
      </p>
      {hiddenCount > 0 ? (
        <p className={styles.sessionInterviewPrefillStatusLine}>
          {hiddenCount} {hiddenCount === 1 ? 'is' : 'are'} hidden until you answer, to test how well your AI predicts
          you.{' '}
          <a className={consentStyles.researchLink} href={RESEARCH_DOC_URL} target="_blank" rel="noreferrer">
            How it works
          </a>
          <button
            type="button"
            id={helpId}
            className={consentStyles.researchHelp}
            data-ce-control-appearance="frameless"
            aria-label="About hidden drafts"
            aria-describedby={`${helpId}-description`}
          >
            <FontAwesomeIcon icon={faQuestionCircle} />
          </button>
          <span id={`${helpId}-description`} hidden>
            {HIDDEN_DRAFTS_ABOUT} {dataNote.trim()}
          </span>
          <UncontrolledTooltip target={helpId} placement="top" trigger="hover focus" autohide={false}>
            {HIDDEN_DRAFTS_ABOUT}
            {dataNote.trim() ? (
              <>
                {' '}
                <SessionDataNote note={dataNote} />
              </>
            ) : null}
          </UncontrolledTooltip>
        </p>
      ) : null}
    </div>
  );
}
