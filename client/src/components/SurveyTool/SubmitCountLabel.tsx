import React from 'react';

import styles from './SurveyTool.module.scss';

// "Submit (2)" splits into its word and count, so a narrow phone row can set the count apart.
export const splitPileSubmitLabel = (text: string): { word: string; count: string } => {
  const match = /^(.*?) (\(\d+\))$/.exec(text);
  return match ? { word: match[1], count: match[2] } : { word: text, count: '' };
};

/**
 * Submit's words, as in "Submit (2)", on the pile's Submit and the All questions bar's alike. On a phone the count
 * shows without its brackets in the button's top corner, so the button takes its name from the full text.
 */
export function SubmitCountLabel({ text }: { text: string }): React.ReactElement {
  const { word, count } = splitPileSubmitLabel(text);
  return (
    <span className={`${styles.pileSubmitButtonLabel}${count ? ` ${styles.pileSubmitButtonLabelCounted}` : ''}`}>
      {word}
      {/* The brackets are their own spans so a phone row can show the number alone. */}
      {count && (
        <span className={styles.pileSubmitButtonCount}>
          <span className={styles.pileSubmitButtonCountBracket}>(</span>
          {count.replace(/\D/g, '')}
          <span className={styles.pileSubmitButtonCountBracket}>)</span>
        </span>
      )}
    </span>
  );
}
