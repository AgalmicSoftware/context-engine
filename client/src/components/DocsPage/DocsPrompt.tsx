import { findPromptPlaceholders } from '../Shared/aiPromptPieces';
import { PromptStandInList, PromptText } from '../Shared/AiPromptStandIns';
import styles from './DocsPage.module.scss';

/** A published prompt template: its placeholders listed, and marked where the template uses them. */
export default function DocsPrompt({ id, text }: { id: string; text: string }) {
  return (
    <>
      {findPromptPlaceholders(text).length ? (
        <div className={styles.promptMeta}>
          Variables: <PromptStandInList prompt={text} className={styles.promptVar} />
        </div>
      ) : null}
      {/* The template alone, so selecting it to copy by hand takes nothing else. */}
      <pre id={id} className={styles.promptBlock}>
        <PromptText prompt={text} className={styles.promptVar} />
      </pre>
    </>
  );
}
