import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faClipboard } from '@fortawesome/free-solid-svg-icons';
import { splitPromptByVariables, type PromptVariable } from './aiPromptPieces';
import { PromptStandInList, PromptText } from './AiPromptStandIns';
import styles from './AiPromptBox.module.scss';

type Props = {
  prompt: string;
  /** The values or placeholders to draw as stand-ins. */
  variables: PromptVariable[];
  /** The header; pass null where the box sits under a title of its own. */
  title?: string | null;
  id?: string;
  testId?: string;
  /** Copies the whole prompt, values included. Left out, the box has no copy button. */
  onCopy?: () => void;
  copied?: boolean;
};

/**
 * An AI prompt, to read: the look of the question generator's "AI Prompt" box. Each value the prompt carries
 * shows as a named stand-in, so a key or a private link is never on screen.
 */
export default function AiPromptBox({ prompt, variables, title = 'AI Prompt', id, testId, onCopy, copied }: Props) {
  const hasStandIns = splitPromptByVariables(prompt, variables).some(({ variable }) => variable);
  return (
    <div id={id} className={styles.box} data-testid={testId}>
      {onCopy ? (
        <button
          type="button"
          className={`${styles.copy} ${copied ? styles.copied : ''}`}
          onClick={onCopy}
          aria-label={copied ? 'AI prompt copied' : 'Copy AI prompt'}
        >
          <FontAwesomeIcon icon={copied ? faCheck : faClipboard} />
        </button>
      ) : null}
      {title ? <strong className={styles.header}>{title}</strong> : null}
      {hasStandIns ? (
        <div className={styles.meta}>
          Variables: <PromptStandInList prompt={prompt} variables={variables} className={styles.variable} />
        </div>
      ) : null}
      <div className={styles.text}>
        <PromptText prompt={prompt} variables={variables} className={styles.variable} />
      </div>
    </div>
  );
}
