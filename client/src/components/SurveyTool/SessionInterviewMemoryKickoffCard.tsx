import React from 'react';
import { UncontrolledTooltip } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCheck, faCopy, faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import styles from './SurveyTool.module.scss';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import SessionInterviewPrompt from './SessionInterviewPrompt';
import { shouldIgnorePromptCopyEvent } from './sessionInterviewModalState';

type SessionInterviewMemoryKickoffCardProps = {
  kickoff: string;
  promptCopied: boolean;
  showAgentPrompt: boolean;
  onCopyPrompt: () => void;
  onTogglePrompt: () => void;
};

export default function SessionInterviewMemoryKickoffCard({
  kickoff,
  promptCopied,
  showAgentPrompt,
  onCopyPrompt,
  onTogglePrompt,
}: SessionInterviewMemoryKickoffCardProps) {
  return (
    <div
      className={styles.sessionAgentKickoff}
      onClick={(event) => {
        if (!shouldIgnorePromptCopyEvent(event.target)) onCopyPrompt();
      }}
    >
      <div className={styles.sessionAgentKickoffRow}>
        <div
          role="button"
          tabIndex={0}
          className={`${styles.sessionAgentKickoffCopyTarget} ${promptCopied ? styles.sessionAgentKickoffCopied : ''}`}
          onClick={(event) => {
            event.stopPropagation();
            onCopyPrompt();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onCopyPrompt();
            }
          }}
          aria-label={promptCopied ? 'Memory augmentation prompt copied' : 'Copy memory augmentation prompt'}
          title={promptCopied ? 'Copied' : 'Copy memory augmentation prompt'}
          data-ce-control-appearance="frameless"
          data-testid={E2E_TESTIDS.SESSION_INTERVIEW_COPY_AGENT_PROMPT}
        >
          <span className={styles.sessionAgentKickoffTitle}>
            <span className={styles.sessionAgentKickoffCopyBadge} aria-hidden="true">
              <FontAwesomeIcon icon={promptCopied ? faCheck : faCopy} />
              <span>{promptCopied ? 'Copied' : 'Copy'}</span>
            </span>
            <span>
              {promptCopied
                ? ' prompt to clipboard'
                : ' and paste this prompt into ChatGPT or Claude to augment your interview and draft responses.'}
            </span>
          </span>
        </div>
        <div className={styles.sessionAgentKickoffActions}>
          <button
            type="button"
            className={styles.sessionAgentKickoffToggle}
            onClick={onTogglePrompt}
            aria-expanded={showAgentPrompt}
            aria-controls="ce-session-interview-agent-prompt"
            data-testid={E2E_TESTIDS.SESSION_INTERVIEW_AGENT_PROMPT_TOGGLE}
          >
            <span>Prompt</span>
            <FontAwesomeIcon
              icon={faCaretDown}
              className={`${styles.sessionAgentKickoffCaret} ${
                showAgentPrompt ? styles.sessionAgentKickoffCaretExpanded : ''
              }`}
            />
          </button>
        </div>
      </div>
      {showAgentPrompt ? (
        <div
          id="ce-session-interview-agent-prompt"
          className={styles.sessionAgentKickoffPrompt}
          data-testid={E2E_TESTIDS.SESSION_INTERVIEW_AGENT_PROMPT}
          data-ce-no-background-copy="true"
        >
          <div className={styles.sessionAgentKickoffPromptHelpRow}>
            <button
              type="button"
              id="ce-interview-agent-prompt-help"
              className={styles.sessionInterviewHeaderButton}
              aria-label="About the interview prompt"
            >
              <FontAwesomeIcon icon={faQuestionCircle} />
            </button>
            <UncontrolledTooltip
              target="ce-interview-agent-prompt-help"
              placement="top-end"
              fade={false}
              trigger="hover focus"
              autohide={false}
            >
              Allows your agent to predict your responses and raise better interview questions.
            </UncontrolledTooltip>
          </div>
          <SessionInterviewPrompt prompt={kickoff} />
        </div>
      ) : null}
    </div>
  );
}
