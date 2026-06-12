import React, { useEffect, useRef, useState } from 'react';

import TelegramTopicMap from '../TelegramTopicMap';
import styles from '../OnePageSession.module.scss';
import { buildTelegramPolisDataset } from '../../../utilities/session/telegramAgentData';

type UnknownRecord = Record<string, unknown>;

type TelegramDebateMapPanelProps = {
  questions?: UnknownRecord[];
  sessionSlug?: string;
  views?: UnknownRecord | null;
};

const WORKTREE_PATH = '/Users/charlie/Desktop/xoCortex/projects/context-engine/.codex/scratch/edge-2026';

export const buildTelegramTopicMapCodexPrompt = ({
  questions = [],
  sessionSlug = '',
  views = null,
}: TelegramDebateMapPanelProps): string => {
  const sanitizedQuestions = questions.map((question) => ({
    questionId: question.questionId,
    prompt: question.prompt,
    questionType: question.questionType,
    tags: question.tags || [],
  }));
  const safeViews: UnknownRecord = views && typeof views === 'object' && !Array.isArray(views)
    ? views
    : {};
  const pickReady = (key: string) => {
    const view = safeViews[key] as UnknownRecord | undefined;
    return view?.status === 'ready' ? view.data : null;
  };
  const consensus = pickReady('consensus') as UnknownRecord | null;
  const difference = pickReady('difference') as UnknownRecord | null;
  const groups = pickReady('groups') as UnknownRecord | null;
  const polis = buildTelegramPolisDataset(safeViews);
  const vectors: UnknownRecord = {};
  if (polis?.hasData && polis?.aggregator) {
    Object.entries(polis.aggregator).forEach(([questionIdValue, rows]) => {
      vectors[questionIdValue] = (Array.isArray(rows) ? rows : [])
        .map((row: any) => {
          try {
            return { p: row.responder, v: JSON.parse(row.response)?.answer?.value || '' };
          } catch (_) {
            return null;
          }
        })
        .filter(Boolean);
    });
  }
  const dataset = {
    sessionSlug,
    questions: sanitizedQuestions,
    consensus: Array.isArray(consensus?.questions) ? consensus.questions : [],
    difference: Array.isArray(difference?.questions) ? difference.questions : [],
    groups: Array.isArray(groups?.groups) ? groups.groups : [],
    vectors,
  };
  return [
    'You are Codex running inside the Context Engine worktree at',
    WORKTREE_PATH,
    '',
    'Task: turn the telegram session dataset below into an opinion/topic map for the web client.',
    '',
    '1. Use ONLY the JSON dataset at the end of this prompt. Do not fetch anything, run no network calls, and never print tokens or secrets.',
    '2. Cluster the questions/opinions into 3-8 coherent topics. Use tags, consensus/difference scores, group themes, and the per-participant vectors (vectors[questionId] = [{p: participantAlias, v: Agree|Disagree|Unsure}]) to judge which opinions belong together and how contested each topic is.',
    `3. Write EXACTLY one file (create the directory if needed): client/public/telegram-topic-map/${sessionSlug}.json`,
    '   Schema (valid JSON, no comments, nothing else in the file):',
    '   {',
    `     "sessionSlug": "${sessionSlug}",`,
    '     "generatedAt": "<ISO 8601 timestamp>",',
    '     "topics": [',
    '       {',
    '         "id": "kebab-case-id",',
    '         "label": "Short topic name (max 4 words)",',
    '         "summary": "1-2 sentence neutral summary of the opinion landscape for this topic",',
    '         "size": <number of related questions/responses; drives bubble size>,',
    '         "agreement": <0 to 1 rough agreement level across participants>,',
    '         "items": ["related question or opinion statement", "..."]',
    '       }',
    '     ]',
    '   }',
    '4. Do not modify any other files.',
    '5. Reply with the file path and the topic count when done.',
    '',
    'DATASET:',
    JSON.stringify(dataset, null, 2),
  ].join('\n');
};

export default function TelegramDebateMapPanel({
  questions = [],
  sessionSlug = '',
  views = null,
}: TelegramDebateMapPanelProps): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
  }, []);

  const handleCopyTopicMapPrompt = async () => {
    const prompt = buildTelegramTopicMapCodexPrompt({ questions, sessionSlug, views });
    let didCopy = false;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(prompt);
        didCopy = true;
      }
    } catch (_) {
      didCopy = false;
    }
    if (!didCopy && typeof document !== 'undefined') {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = prompt;
        document.body.appendChild(textarea);
        textarea.select();
        didCopy = document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch (_) {
        didCopy = false;
      }
    }
    if (didCopy) {
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className={styles.telegramTopicMapSection} data-testid="ce-session-telegram-topicmap-section">
      <div className={styles.telegramListHeader}>
        <span>Topic map (local) - generate with Codex in this worktree, then reload.</span>
        <span className={styles.telegramListHeaderActions}>
          <button
            type="button"
            className={styles.sectionHeaderActionButton}
            onClick={handleCopyTopicMapPrompt}
            data-testid="ce-session-telegram-topicmap-copy"
          >
            {copied ? 'Copied!' : 'Copy Codex prompt'}
          </button>
        </span>
      </div>
      <TelegramTopicMap sessionSlug={sessionSlug} />
    </div>
  );
}
