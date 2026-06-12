import React from 'react';

import { SbtListStandardCard } from '../../SBTs/SbtListDisplayCards';
import sbtListStyles from '../../SBTs/SBTsList.module.scss';
import styles from '../OnePageSession.module.scss';
import type { TelegramBucketCard } from '../../../utilities/session/telegramAgentData';

type TelegramBucketCardsProps = {
  cards: TelegramBucketCard[];
  localSelections?: Record<string, string>;
  onLocalSelectionChange?: (categoryId: string, optionId: string) => void;
  sessionSlug?: string;
};

const toStr = (value: unknown): string => String(value ?? '').trim();

export default function TelegramBucketCards({
  cards,
  localSelections = {},
  onLocalSelectionChange,
  sessionSlug = '',
}: TelegramBucketCardsProps): React.ReactElement {
  return (
    <div className={styles.telegramListPanel} data-testid="ce-session-telegram-buckets">
      {cards.length === 0 ? (
        <div className={styles.telegramListEmpty}>No research buckets linked yet.</div>
      ) : (
        <div className={sbtListStyles.standardBase}>
          {cards.map((card) => {
            const selectedOptions = card.options.filter((option) => option.selected);
            const selectValue = localSelections[card.categoryId] ?? (selectedOptions[0]?.optionId || '');
            const selectedLabel = selectedOptions.map((option) => option.label).filter(Boolean).join(', ');
            const bucketAddress = `telegram-bucket-${card.categoryId}`;
            const bucketModel = {
              description: selectedLabel || 'Optional research bucket for aggregate filtering.',
              imageSrc: null,
              key: bucketAddress,
              locked: false,
              name: card.categoryLabel,
              sbtAddress: bucketAddress,
              sbtAddressLower: bucketAddress.toLowerCase(),
              sessionSlug,
            };
            const bucketDetails = (
              <div data-testid={`ce-session-telegram-bucket-${card.categoryId}`}>
                <select
                  className={styles.telegramBucketSelect}
                  value={selectValue}
                  onChange={(event) => {
                    onLocalSelectionChange?.(card.categoryId, toStr(event.target.value));
                  }}
                  aria-label={`${card.categoryLabel} bucket option`}
                  data-testid="ce-session-telegram-bucket-select"
                >
                  <option value="">Select an option</option>
                  {card.options.map((option) => (
                    <option key={option.optionId} value={option.optionId}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {selectedOptions.length > 0 ? (
                  <div className={styles.telegramChipRow}>
                    {selectedOptions.map((option) => (
                      <span
                        key={option.optionId}
                        className={`${styles.telegramChipDark} ${styles.telegramChipDarkSelected}`.trim()}
                      >
                        {option.label}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            );
            return (
              <SbtListStandardCard
                key={bucketModel.key}
                detailsPanel={bucketDetails}
                href="#"
                isExpanded={true}
                model={bucketModel}
                onClick={(event) => event.preventDefault()}
                sbtLabel="research bucket"
                shellClassName={`${sbtListStyles.standardCardShell} ${sbtListStyles.standardCardShellExpanded || ''}`.trim()}
                styles={sbtListStyles}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
