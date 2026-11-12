/** @file SetupSuggestQuestions.tsx: "Suggest questions" on /new. */
import { useContext, useState } from 'react';
import { ReactReduxContext } from 'react-redux';

import SessionWizardInfoTooltip from '../SessionWizardInfoTooltip';
import useSessionWizardTooltipPreference from '../hooks/useSessionWizardTooltipPreference';
import type { PendingContextFiles } from './SetupContextSources';
import { SUGGESTED_QUESTION_COUNT, hasSuggestionContext, suggestSetupQuestions } from './setupQuestionSuggestions';
import type { SetupDraft, SetupQuestion } from './setupSectionTypes';
import styles from './SessionSetup.module.scss';

const ABOUT = `Drafts ${SUGGESTED_QUESTION_COUNT} questions from this page’s context with your OpenAI key, following the question prompt and tag suggestions under AI. It reads the name, description and context, link titles and addresses (not the linked pages), and the files you added, admins-only ones too, so check each draft. Drafts join the list above, where you can edit or remove them; none reach the session before Create.`;

type Props = {
  draft: SetupDraft;
  pending: PendingContextFiles;
  /** The OpenAI key typed under AI. */
  apiKey: string;
  /** Appends drafts to the draft's questions as they stand then. */
  onAdd: (questions: SetupQuestion[]) => void;
};

export const SetupSuggestQuestions = ({ draft, pending, apiKey, onAdd }: Props) => {
  const tooltipsEnabled = useSessionWizardTooltipPreference(useContext(ReactReduxContext)?.store ?? null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ alert: boolean; message: string }>({ alert: false, message: '' });
  const blocked = !apiKey.trim()
    ? 'Add an OpenAI key under AI to get suggestions.'
    : !hasSuggestionContext(draft, pending)
      ? 'Add some context first: text, links or a file.'
      : '';
  const suggest = async () => {
    setBusy(true);
    setStatus({ alert: false, message: 'Drafting questions…' });
    try {
      const { questions, skipped } = await suggestSetupQuestions({ draft, pending, apiKey });
      onAdd(questions);
      const added = `Added ${questions.length} ${questions.length === 1 ? 'draft' : 'drafts'}. Edit or remove them before Create.`;
      setStatus({
        alert: false,
        message: skipped.length
          ? `${added} Not sent to the AI: ${skipped.join(', ')}, too large to send together or unreadable.`
          : added,
      });
    } catch (error) {
      setStatus({ alert: true, message: error instanceof Error ? error.message : 'Couldn’t draft questions.' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className={styles.fieldLabelRow}>
        <button
          type="button"
          className={styles.button}
          disabled={busy || !!blocked}
          aria-describedby="ce-setup-suggest-about"
          data-testid="ce-setup-suggest-questions"
          onClick={() => void suggest()}
        >
          {busy ? 'Suggesting…' : 'Suggest questions'}
        </button>
        <SessionWizardInfoTooltip
          enabled={tooltipsEnabled}
          id="ce-setup-suggest-tip"
          content={ABOUT}
          placement="top"
          ariaLabel="About Suggest questions"
        />
      </div>
      <span id="ce-setup-suggest-about" className={styles.srOnly}>
        {ABOUT}
      </span>
      {blocked || status.message ? (
        <p
          className={status.alert && !blocked ? styles.errorText : styles.hint}
          role={status.alert && !blocked ? 'alert' : 'status'}
          data-testid="ce-setup-suggest-status"
        >
          {blocked || status.message}
        </p>
      ) : null}
    </>
  );
};
