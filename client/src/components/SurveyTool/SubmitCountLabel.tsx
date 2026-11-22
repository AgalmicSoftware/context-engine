import React from 'react';

import styles from './SurveyTool.module.scss';

// "Submit (2)" splits into its word and count, so the count can be set apart from the word.
export const splitPileSubmitLabel = (text: string): { word: string; count: string } => {
  const match = /^(.*?) (\(\d+\))$/.exec(text);
  return match ? { word: match[1], count: match[2] } : { word: text, count: '' };
};

/**
 * Submit's words, as in "Submit (2)", on every Submit that sends answers: the word, with the number of answers small
 * in the button's top corner, without its brackets. Each button takes its name from the full text, which keeps them.
 */
export function SubmitCountLabel({ text }: { text: string }): React.ReactElement {
  const { word, count } = splitPileSubmitLabel(text);
  return (
    <span className={`${styles.pileSubmitButtonLabel}${count ? ` ${styles.pileSubmitButtonLabelCounted}` : ''}`}>
      {word}
      {count && <span className={styles.pileSubmitButtonCount}>{count.replace(/\D/g, '')}</span>}
    </span>
  );
}
