/** @file SetupWithAi.tsx: "Set up with your AI" on /new. */
import { useContext, useState } from 'react';
import { ReactReduxContext } from 'react-redux';

import SessionWizardInfoTooltip from '../SessionWizardInfoTooltip';
import useSessionWizardTooltipPreference from '../hooks/useSessionWizardTooltipPreference';
import { E2E_TESTIDS } from '../../../utilities/e2eTestIds.js';
import { SESSION_SETUP_AI_APPS, buildSessionSetupKickoff } from './sessionSetupKickoff';
import styles from './SessionSetup.module.scss';

const ABOUT =
  'Your AI asks about your session, then gives you a link that fills in this page, or JSON to paste under Import. Nothing is created until you review the page and press Create. Add keys here, never in the chat.';

type Props = {
  /** Where the AI's link opens: /new on this site. */
  setupUrl: string;
};

// Copies the setup prompt, or opens ChatGPT or Claude with it. The prompt holds
// no keys or tokens; the AI's answer comes back through a link or a paste.
export const SetupWithAi = ({ setupUrl }: Props) => {
  const tooltipsEnabled = useSessionWizardTooltipPreference(useContext(ReactReduxContext)?.store ?? null);
  const [status, setStatus] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const prompt = buildSessionSetupKickoff({ setupUrl });
  // Safari needs the clipboard write to start in the tap itself, so it isn't awaited first.
  const copy = (copied: string) => {
    void (async () => {
      try {
        await navigator.clipboard.writeText(prompt);
        setStatus(copied);
      } catch {
        setShowPrompt(true);
        setStatus('Copy failed. Copy the prompt below.');
      }
    })();
  };
  return (
    <section className={styles.banner} aria-labelledby="ce-setup-ai-title" data-testid={E2E_TESTIDS.SETUP_WITH_AI}>
      <div className={styles.fieldLabelRow}>
        <h2 id="ce-setup-ai-title" className={styles.bannerTitle}>
          Set up with your AI
        </h2>
        <SessionWizardInfoTooltip
          enabled={tooltipsEnabled}
          id="ce-setup-ai-tip"
          content={ABOUT}
          placement="top"
          ariaLabel="About setting up with your AI"
        />
      </div>
      <span id="ce-setup-ai-about" className={styles.srOnly}>
        {ABOUT}
      </span>
      <div className={styles.buttonRow}>
        <button
          type="button"
          className={styles.button}
          aria-describedby="ce-setup-ai-about"
          data-testid={E2E_TESTIDS.SETUP_WITH_AI_COPY}
          onClick={() => copy('Prompt copied. Paste it into ChatGPT, Claude or another AI.')}
        >
          Copy prompt
        </button>
        {SESSION_SETUP_AI_APPS.map((app) => (
          <a
            key={app.name}
            className={styles.button}
            data-ce-control-appearance="raised"
            href={app.url(prompt)}
            target="_blank"
            rel="noopener noreferrer"
            aria-describedby="ce-setup-ai-about"
            onClick={() => copy(`Prompt copied too. If ${app.name} opens without it, paste it into the chat.`)}
          >
            Open in {app.name}
          </a>
        ))}
        <button
          type="button"
          className={styles.button}
          aria-expanded={showPrompt}
          aria-controls="ce-setup-ai-prompt"
          onClick={() => setShowPrompt((open) => !open)}
        >
          {showPrompt ? 'Hide prompt' : 'Show prompt'}
        </button>
      </div>
      {status ? (
        <p className={styles.statusText} role="status">
          {status}
        </p>
      ) : null}
      {showPrompt ? (
        <textarea
          id="ce-setup-ai-prompt"
          className={styles.textarea}
          aria-label="Setup prompt"
          readOnly
          rows={8}
          value={prompt}
        />
      ) : null}
    </section>
  );
};
