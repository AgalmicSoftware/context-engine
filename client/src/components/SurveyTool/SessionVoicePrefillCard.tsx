import { useEffect, useRef, useState } from 'react';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { getCorsProxyUrlOrThrow } from '../../utilities/worker/corsProxy.js';
import { buildExternalInterviewKickoff } from './sessionInterview';
import { verifyInterviewKickoffCatalog } from './sessionInterviewCatalogValidation';
import { buildInterviewReturnSessionUrl } from './sessionInterviewReturnUrl';
import SessionInterviewMemoryKickoffCard from './SessionInterviewMemoryKickoffCard';
import styles from './SurveyTool.module.scss';

type Props = {
  sessionSlug?: string;
  sessionConfig?: Record<string, unknown> | null;
  context?: unknown;
  workerUrl?: string;
};

/** The voice chooser's AI-prefill option: a prompt to paste into ChatGPT or Claude, which drafts answers. */
export default function SessionVoicePrefillCard({ sessionSlug = '', sessionConfig, context, workerUrl }: Props) {
  const [resolvedWorkerUrl, setResolvedWorkerUrl] = useState('');
  const [promptCopied, setPromptCopied] = useState(false);
  const [showAgentPrompt, setShowAgentPrompt] = useState(false);
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeWorkerUrl = workerUrl || resolvedWorkerUrl;

  useEffect(() => {
    if (activeWorkerUrl) return;
    let active = true;
    void getCorsProxyUrlOrThrow({ sessionSlug, sessionConfig, context, allowDemoFallback: false })
      .then((value: string) => {
        if (active) setResolvedWorkerUrl(value);
      })
      // Without a session Worker there is no prompt to offer.
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [activeWorkerUrl, context, sessionConfig, sessionSlug]);
  useEffect(
    () => () => {
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
    },
    [],
  );

  if (!activeWorkerUrl) return null;
  const sessionUrl = buildInterviewReturnSessionUrl();
  const kickoff = buildExternalInterviewKickoff({ workerUrl: activeWorkerUrl, sessionSlug, sessionUrl });
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
      <h3 id="ce-session-voice-prefill-title">Let your AI draft your answers</h3>
      <p>It drafts them from what it knows about you, and you review them here before anything is submitted.</p>
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
