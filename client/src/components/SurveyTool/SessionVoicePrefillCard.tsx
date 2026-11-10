import { useEffect, useRef, useState } from 'react';
import { UncontrolledTooltip } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { getCorsProxyUrlOrThrow } from '../../utilities/worker/corsProxy.js';
import { sortInterviewQuestionPoolNewestFirst, buildInterviewQuestionPriority } from './sessionInterviewQuestionOrder';
import { buildExternalInterviewKickoff, normalizeInterviewQuestions } from './sessionInterview';
import { verifyInterviewKickoffCatalog } from './sessionInterviewCatalogValidation';
import { buildInterviewReturnSessionUrl } from './sessionInterviewReturnUrl';
import SessionInterviewMemoryKickoffCard from './SessionInterviewMemoryKickoffCard';
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
  const [resolvedWorkerUrl, setResolvedWorkerUrl] = useState('');
  const [promptCopied, setPromptCopied] = useState(false);
  const [showAgentPrompt, setShowAgentPrompt] = useState(false);
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeWorkerUrl = workerUrl || resolvedWorkerUrl;
  // The pile rebuilds `context` on every render, so the lookup keys on its values
  // and reads the latest objects, rather than restarting each render.
  const lookupInputs = useRef({ sessionConfig, context });
  lookupInputs.current = { sessionConfig, context };
  const { account, providerLike, chainId } = (context || {}) as Record<string, unknown>;
  const hasSessionConfig = Boolean(sessionConfig);

  useEffect(() => {
    if (activeWorkerUrl) return;
    let active = true;
    void getCorsProxyUrlOrThrow({ sessionSlug, ...lookupInputs.current, allowDemoFallback: false })
      .then((value: string) => {
        if (active) setResolvedWorkerUrl(value);
      })
      // Without a session Worker there is no prompt to offer.
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [activeWorkerUrl, sessionSlug, hasSessionConfig, account, providerLike, chainId]);
  useEffect(
    () => () => {
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
    },
    [],
  );

  if (!activeWorkerUrl) return null;
  const sessionUrl = buildInterviewReturnSessionUrl();
  const questionPriority = questionPool
    ? buildInterviewQuestionPriority(
        normalizeInterviewQuestions(sortInterviewQuestionPoolNewestFirst(questionPool)),
        existingResponseSlice,
      )
    : undefined;
  const kickoff = buildExternalInterviewKickoff({
    workerUrl: activeWorkerUrl,
    sessionSlug,
    sessionUrl,
    questionPriority,
  });
  const copyPrompt = async () => {
    setPromptCopied(false);
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(kickoff);
    setPromptCopied(true);
    if (copyResetRef.current) clearTimeout(copyResetRef.current);
    copyResetRef.current = setTimeout(() => setPromptCopied(false), 1800);
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
        kickoff={kickoff}
        validateKickoff={() => verifyInterviewKickoffCatalog({ workerUrl: activeWorkerUrl, sessionSlug, sessionUrl })}
        promptCopied={promptCopied}
        showAgentPrompt={showAgentPrompt}
        onCopyPrompt={copyPrompt}
        onTogglePrompt={() => setShowAgentPrompt((current) => !current)}
      />
    </section>
  );
}
