import React, { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy } from '@fortawesome/free-solid-svg-icons';

import styles from '../OnePageSession.module.scss';
import type { AgentQuestion, AgentResultsResult } from '../../../utilities/session/agentSessionData';

type AgentDebateMapPanelProps = {
  questions: AgentQuestion[];
  results: AgentResultsResult | null;
};

const buildPrompt = (questions: AgentQuestion[], results: AgentResultsResult | null): string => {
  const topicCounts = results?.views?.topicMap?.data?.counts || {};
  const lines = [
    'Create a Context Engine debate map from this hosted agent session.',
    '',
    'Questions:',
    ...questions.slice(0, 20).map((question, index) => `${index + 1}. ${question.prompt}`),
    '',
    `Topic-map counts: ${JSON.stringify(topicCounts)}`,
  ];
  return lines.join('\n');
};

const AgentDebateMapPanel = ({ questions, results }: AgentDebateMapPanelProps): React.ReactElement => {
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
    <section className={styles.agentListPanel} data-testid="ce-session-agent-debate-map">
      <div className={styles.agentListHeader}>
        <span>Debate Map Prompt</span>
        <button
          type="button"
          className={styles.agentSecondaryButton}
          data-testid="ce-session-agent-debate-map-copy"
          onClick={handleCopy}
        >
          <FontAwesomeIcon icon={faCopy} />
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <div className={styles.agentTopicCounts}>
        {Object.keys(topicCounts).length ? (
          Object.entries(topicCounts).map(([key, value]) => (
            <span key={key} className={styles.agentChipDark}>
              {key}: {String(value)}
            </span>
          ))
        ) : (
          <span className={styles.agentListEmpty}>Topic-map counts are not available yet.</span>
        )}
      </div>
      <pre className={styles.agentTopicPrompt}>{prompt}</pre>
    </section>
  );
};

export default AgentDebateMapPanel;
