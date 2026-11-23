import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faClipboard } from '@fortawesome/free-solid-svg-icons';
import { findPromptVariables, splitPromptByVariables } from './aiPromptVariables';
import styles from './SurveyTool.module.scss';

type Props = {
  prompt: string;
  id?: string;
  testId?: string;
  /** Copies the whole prompt, values included. */
  onCopy: () => void;
  copied: boolean;
};

/**
 * An AI prompt, to read: the look of the question generator's "AI Prompt" box. Each value the prompt carries
 * for this person and session shows as a named stand-in, so a key or a private link is never on screen.
 */
export default function AiPromptBox({ prompt, id, testId, onCopy, copied }: Props) {
  const pieces = splitPromptByVariables(prompt, findPromptVariables(prompt));
  // Named in the order the prompt uses them.
  const names = [...new Set(pieces.flatMap(({ variable }) => (variable ? [variable] : [])))];
  return (
    <div id={id} className={styles.aiPromptBox} data-testid={testId}>
      <button
        type="button"
        className={`${styles.aiPromptBoxCopy} ${copied ? styles.aiPromptBoxCopied : ''}`}
        onClick={onCopy}
        aria-label={copied ? 'AI prompt copied' : 'Copy AI prompt'}
      >
        <FontAwesomeIcon icon={copied ? faCheck : faClipboard} />
      </button>
      <strong className={styles.aiPromptBoxHeader}>AI Prompt</strong>
      {names.length ? (
        <div className={styles.aiPromptBoxMeta}>
          Variables:{' '}
          {names.map((name, index) => (
            <span key={name}>
              {index ? ', ' : ''}
              <span className={styles.aiPromptVar}>{`<${name}>`}</span>
            </span>
          ))}
        </div>
      ) : null}
      <div className={styles.aiPromptBoxText}>
        {pieces.map((piece, index) =>
          piece.variable ? (
            <span key={index} className={styles.aiPromptVar}>
              {piece.text}
            </span>
          ) : (
            piece.text
          ),
        )}
      </div>
    </div>
  );
}
