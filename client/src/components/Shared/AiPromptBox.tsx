import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faClipboard } from '@fortawesome/free-solid-svg-icons';
import { splitPromptByVariables, type PromptVariable } from './aiPromptPieces';
import { PromptStandInList, PromptText, STAND_IN_ATTRIBUTE } from './AiPromptStandIns';
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
  /**
   * What goes on the clipboard when a selection that holds a stand-in is copied by hand: the prompt itself
   * by default. Return null to copy nothing, as while the prompt is about to change.
   */
  handCopy?: () => string | null;
};

/**
 * An AI prompt, to read: the look of the question generator's "AI Prompt" box. Each value the prompt carries
 * shows as a named stand-in, so a key or a private link is never on screen.
 */
export default function AiPromptBox({
  prompt,
  variables,
  title = 'AI Prompt',
  id,
  testId,
  onCopy,
  copied,
  handCopy,
}: Props) {
  const hasStandIns = splitPromptByVariables(prompt, variables).some(({ variable }) => variable);
  // A stand-in that hides a value (not a template's own placeholder, which is what it shows) is text no AI
  // can use. A selection that holds one is copied as the whole prompt, as the copy button gives it; any
  // other selection is the browser's to copy.
  const hidesValues = variables.some(({ name, value, shown = `<${name}>` }) => shown !== value);
  const copySelection = (event: React.ClipboardEvent<HTMLDivElement>) => {
    if (!hidesValues) return;
    const selection = window.getSelection();
    const ranges = Array.from({ length: selection?.rangeCount || 0 }, (_, index) => selection!.getRangeAt(index));
    const standIns = Array.from(event.currentTarget.querySelectorAll(`[${STAND_IN_ATTRIBUTE}]`));
    if (!standIns.some((standIn) => ranges.some((range) => !range.collapsed && range.intersectsNode(standIn)))) return;
    event.preventDefault();
    // Refused, the clipboard is emptied: what it held before is not what the person meant to paste.
    event.clipboardData.setData('text/plain', (handCopy ? handCopy() : prompt) ?? '');
  };
  return (
    <div
      id={id}
      className={onCopy ? `${styles.box} ${styles.withCopy}` : styles.box}
      data-testid={testId}
      onCopy={copySelection}
    >
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
