import React, { useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy } from '@fortawesome/free-solid-svg-icons';

import styles from '../OnePageSession.module.scss';
import type { AgentQuestion, AgentResultsResult } from '../../../utilities/session/agentSessionData';
import { copyText, selectText } from '../../../utilities/ui/copyText';

type AgentDebateMapPanelProps = {
  questions: AgentQuestion[];
  results: AgentResultsResult | null;
};

const buildPrompt = (questions: AgentQuestion[], results: AgentResultsResult | null): string => {
  const topicCounts = results?.views?.topicMap?.data?.counts || {};
  const lines = [
    'Create a Context Engine debate atlas from this hosted agent session.',
    '',
    'Questions:',
    ...questions.slice(0, 20).map((question, index) => `${index + 1}. ${question.prompt}`),
    '',
    `Topic-map counts: ${JSON.stringify(topicCounts)}`,
  ];
  return lines.join('\n');
};

const AgentDebateMapPanel = ({ questions, results }: AgentDebateMapPanelProps): React.ReactElement => {
  const [copied, setCopied] = useState<boolean | null>(null);
  const promptRef = useRef<HTMLPreElement>(null);
  const prompt = useMemo(() => buildPrompt(questions, results), [questions, results]);
  const topicCounts = results?.views?.topicMap?.data?.counts || {};

  const handleCopy = async () => {
    const done = await copyText(prompt);
    setCopied(done);
    if (!done) selectText(promptRef.current);
  };

  return (
    <section className={styles.agentListPanel} data-testid="ce-agent-http-debate-map">
      <div className={styles.agentListHeader}>
        <span>Debate Atlas prompt</span>
        <button
          type="button"
          className={styles.agentSecondaryButton}
          data-testid="ce-agent-http-debate-map-copy"
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
      {copied === false ? (
        <span role="status" className={styles.agentListError}>
          Copying isn&apos;t allowed here, so the prompt is selected. Copy it yourself.
        </span>
      ) : null}
      <pre ref={promptRef} className={styles.agentTopicPrompt}>
        {prompt}
      </pre>
    </section>
  );
};

export default AgentDebateMapPanel;
