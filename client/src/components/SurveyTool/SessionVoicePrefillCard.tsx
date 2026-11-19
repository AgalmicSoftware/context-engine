import { useEffect, useRef, useState } from 'react';
import { UncontrolledTooltip } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { copyText } from '../../utilities/ui/copyText';
import SessionInterviewMemoryKickoffCard from './SessionInterviewMemoryKickoffCard';
import { useSessionPrefillKickoff } from './useSessionPrefillKickoff';
import styles from './SurveyTool.module.scss';

const PREFILL_ABOUT =
  'Your AI drafts answers from what it knows about you, and you review them here before anything is submitted.';

type Props = {
  sessionSlug?: string;
  sessionConfig?: Record<string, unknown> | null;
  context?: unknown;
  workerUrl?: string;
  questionPool?: unknown[];
  existingResponseSlice?: Record<string, unknown> | null;
};

/** The voice chooser's AI-prefill option: a prompt to paste into ChatGPT or Claude, which drafts answers. */
export default function SessionVoicePrefillCard({
  sessionSlug = '',
  sessionConfig,
  context,
  workerUrl,
  questionPool,
  existingResponseSlice,
}: Props) {
  const [promptCopied, setPromptCopied] = useState(false);
  const [showAgentPrompt, setShowAgentPrompt] = useState(false);
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { kickoff: prefill } = useSessionPrefillKickoff({
    sessionSlug,
    sessionConfig,
    context,
    workerUrl,
    questionPool,
    existingResponseSlice,
  });
  useEffect(
    () => () => {
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
    },
    [],
  );

  if (!prefill) return null;
  const copyPrompt = async (prompt: string) => {
    setPromptCopied(false);
    if (!(await copyText(prompt))) return false;
    setPromptCopied(true);
    if (copyResetRef.current) clearTimeout(copyResetRef.current);
    copyResetRef.current = setTimeout(() => setPromptCopied(false), 1800);
    return true;
  };
  return (
    <section
      className={styles.sessionVoicePrefill}
      aria-labelledby="ce-session-voice-prefill-title"
      data-testid={E2E_TESTIDS.SESSION_VOICE_PREFILL}
    >
      <div className={styles.sessionVoicePrefillHeading}>
        <h3 id="ce-session-voice-prefill-title">Let your AI draft your answers</h3>
        <button
          type="button"
          id="ce-session-voice-prefill-help"
          className={styles.sessionInterviewHeaderButton}
          data-ce-control-appearance="frameless"
          aria-label="About letting your AI draft your answers"
          aria-describedby="ce-session-voice-prefill-about"
        >
          <FontAwesomeIcon icon={faQuestionCircle} />
        </button>
      </div>
      {/* Tooltips aren't read out, so screen readers get the description from here,
          with its control only: `aria-describedby` still reads hidden text. */}
      <span id="ce-session-voice-prefill-about" hidden>
        {PREFILL_ABOUT}
      </span>
      <UncontrolledTooltip
        target="ce-session-voice-prefill-help"
        placement="top"
        trigger="hover focus"
        autohide={false}
      >
        {PREFILL_ABOUT}
      </UncontrolledTooltip>
      <SessionInterviewMemoryKickoffCard
        // Another account is checked afresh, for its own ticket.
        key={prefill.accountKey}
        kickoff={prefill.kickoff}
        validateKickoff={prefill.validateKickoff}
        promptCopied={promptCopied}
        showAgentPrompt={showAgentPrompt}
        onCopyPrompt={copyPrompt}
        onTogglePrompt={() => setShowAgentPrompt((current) => !current)}
      />
    </section>
  );
}
