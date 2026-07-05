import React from 'react';

import { SbtListStandardCard } from '../../SBTs/SbtListDisplayCards';
import sbtStyles from '../../SBTs/SBTsList.module.scss';
import styles from '../OnePageSession.module.scss';
import type { TelegramBucketCard } from '../../../utilities/session/telegramAgentData';

type TelegramBucketCardsProps = {
  cards: TelegramBucketCard[] | null;
  onReconnect?: () => void;
};

const noopClick: React.MouseEventHandler<HTMLAnchorElement> = (event) => {
  event.preventDefault();
};

const TelegramBucketCards = ({
  cards,
  onReconnect,
}: TelegramBucketCardsProps): React.ReactElement => {
  if (cards === null) {
    return (
      <section className={styles.telegramListPanel} data-testid="ce-session-telegram-buckets">
        <div className={styles.telegramListEmpty}>Reconnect to refresh groups.</div>
        <button
          type="button"
          className={styles.telegramSecondaryButton}
          data-testid="ce-session-telegram-buckets-reconnect"
          onClick={onReconnect}
        >
          Reconnect
        </button>
      </section>
    );
  }

  if (!cards.length) {
    return (
      <section className={styles.telegramListPanel} data-testid="ce-session-telegram-buckets">
        <div className={styles.telegramListEmpty}>No group buckets are available for this participant.</div>
      </section>
    );
  }

  return (
    <section className={styles.telegramListPanel} data-testid="ce-session-telegram-buckets">
      <div className={styles.telegramBucketGrid}>
        {cards.map((card) => {
          const selected = card.options.filter((option) => option.selected);
          const model = {
            key: card.categoryId,
            sbtAddress: card.categoryId,
            sbtAddressLower: card.categoryId.toLowerCase(),
            sessionSlug: 'telegram',
            name: card.categoryLabel,
            description: selected.length
              ? selected.map((option) => option.label).join(', ')
              : 'No bucket selected.',
            imageSrc: '',
            locked: false,
          };
          return (
            <SbtListStandardCard
              key={card.categoryId}
              href="#telegram-bucket"
              model={model}
              onClick={noopClick}
              sbtLabel="Group"
              shellClassName={sbtStyles.standardCardShell}
              styles={sbtStyles}
              detailsPanel={(
                <label className={styles.telegramBucketSelect}>
                  <span>{card.categoryLabel}</span>
                  <select
                    data-testid="ce-session-telegram-bucket-select"
                    value={selected[0]?.optionId || ''}
                    onChange={() => undefined}
                  >
                    <option value="">No selection</option>
                    {card.options.map((option) => (
                      <option key={option.optionId} value={option.optionId}>{option.label}</option>
                    ))}
                  </select>
                </label>
              )}
              isExpanded={true}
            />
          );
        })}
      </div>
    </section>
  );
};

export default TelegramBucketCards;
