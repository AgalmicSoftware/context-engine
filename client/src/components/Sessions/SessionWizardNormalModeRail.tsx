import React from 'react';

import type { NormalModeCard } from './sessionWizardNormalModeCards';
import styles from './SessionWizard.module.scss';

type SessionWizardNormalModeRailProps = {
  activeNormalModeIndex: number;
  collapsedSections: Record<string, boolean>;
  normalModeCards: NormalModeCard[];
  onFocusSection: (key: string) => void;
};

const getNormalModeCardToneClassName = (tone: NormalModeCard['tone']): string => {
  if (tone === 'ready') return styles.normalModeCardReady;
  if (tone === 'pending') return styles.normalModeCardPending;
  return styles.normalModeCardNeutral;
};

const SessionWizardNormalModeRail = ({
  activeNormalModeIndex,
  collapsedSections,
  normalModeCards,
  onFocusSection,
}: SessionWizardNormalModeRailProps): React.ReactElement => (
  <section
    className={styles.normalModeRail}
    aria-label="Normal mode sections"
    style={{ '--session-wizard-card-count': String(normalModeCards.length) } as React.CSSProperties}
  >
    {normalModeCards.map((card, index) => {
      const isOpen = !collapsedSections[card.key];
      const showExpandedDetails = activeNormalModeIndex > index;
      const toneClass = getNormalModeCardToneClassName(card.tone);
      return (
        <button
          key={card.key}
          type="button"
          className={`${styles.normalModeCard} ${toneClass} ${isOpen ? styles.normalModeCardActive : ''}`}
          onClick={() => onFocusSection(card.key)}
          aria-label={`Step ${card.stepNumber}: ${card.title}`}
        >
          <span className={styles.normalModeCardNumber}>{card.stepNumber}</span>
          <span className={styles.normalModeCardContent}>
            <span className={styles.normalModeCardTitle}>{card.title}</span>
            {showExpandedDetails && <span className={styles.normalModeCardSummary}>{card.summary}</span>}
          </span>
        </button>
      );
    })}
  </section>
);

export { getNormalModeCardToneClassName };
export default SessionWizardNormalModeRail;
