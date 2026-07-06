import React, { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy } from '@fortawesome/free-solid-svg-icons';

import styles from '../OnePageSession.module.scss';
import type { TelegramAgentQuestion, TelegramAgentResultsResult } from '../../../utilities/session/telegramAgentData';

type TelegramDebateMapPanelProps = {
  questions: TelegramAgentQuestion[];
  results: TelegramAgentResultsResult | null;
};

const buildPrompt = (questions: TelegramAgentQuestion[], results: TelegramAgentResultsResult | null): string => {
  const topicCounts = results?.views?.topicMap?.data?.counts || {};
  const lines = [
    'Create a Context Engine debate map from this Telegram-first session.',
    '',
    'Questions:',
    ...questions.slice(0, 20).map((question, index) => `${index + 1}. ${question.prompt}`),
    '',
    `Topic-map counts: ${JSON.stringify(topicCounts)}`,
  ];
  return lines.join('\n');
};

const TelegramDebateMapPanel = ({
  questions,
  results,
}: TelegramDebateMapPanelProps): React.ReactElement => {
  const [copied, setCopied] = useState(false);
  const prompt = useMemo(() => buildPrompt(questions, results), [questions, results]);
  const topicCounts = results?.views?.topicMap?.data?.counts || {};

  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(prompt);
      setCopied(true);
    } catch (_) {
      setCopied(false);
    }
  };

  return (
    <section className={styles.telegramListPanel} data-testid="ce-session-telegram-debate-map">
      <div className={styles.telegramListHeader}>
        <span>Debate Map Prompt</span>
        <button
          type="button"
          className={styles.telegramSecondaryButton}
          data-testid="ce-session-telegram-debate-map-copy"
          onClick={handleCopy}
        >
          <FontAwesomeIcon icon={faCopy} />
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <div className={styles.telegramTopicCounts}>
        {Object.keys(topicCounts).length
          ? Object.entries(topicCounts).map(([key, value]) => (
            <span key={key} className={styles.telegramChipDark}>{key}: {String(value)}</span>
          ))
          : <span className={styles.telegramListEmpty}>Topic-map counts are not available yet.</span>}
      </div>
      <pre className={styles.telegramTopicPrompt}>{prompt}</pre>
    </section>
  );
};

export default TelegramDebateMapPanel;
