/** @file QuadraticQuestionPreview.tsx: a quadratic question on its atlas card, drawn as the session's own answer rows. */
import React from 'react';

import styles from './QuadraticQuestionPreview.module.scss';

/**
 * The budget, then each option beside the − 0 + stepper it is answered with. Like the other types' previews it is
 * a picture of the control, kept from assistive technology: the card's link names the question and opens its own
 * page, where it is answered.
 */
export const QuadraticQuestionPreview = ({ credits, options }: { credits?: unknown; options: string[] }) => {
  // A question stored without a budget has the default one.
  const voiceCredits = Number(credits ?? 99);
  return (
    <div className={styles.quadratic} data-testid="ce-atlas-quadratic-preview" aria-hidden="true">
      <p className={styles.budget}>
        <strong>{voiceCredits}</strong> voice credit{voiceCredits === 1 ? '' : 's'}
        <span> · votes cost their square</span>
      </p>
      {options.length ? (
        <ul className={styles.options}>
          {options.map((option, index) => (
            <li key={`${index}-${option}`}>
              <span className={styles.label}>{option}</span>
              <span className={styles.stepper}>
                <span data-step="down">−</span>
                <span>0</span>
                <span data-step="up">+</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.unavailable}>Options unavailable</p>
      )}
    </div>
  );
};

export default QuadraticQuestionPreview;
