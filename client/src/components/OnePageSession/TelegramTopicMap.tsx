/**
 * @file TelegramTopicMap.tsx — local-only opinion/topic map for telegram
 * sessions, rendered as a circle-pack (debate-atlas style). The data file is
 * produced OUT-OF-BAND by Codex from a prompt the session page generates
 * (copy → run in the worktree → Codex writes
 * client/public/telegram-topic-map/<slug>.json → Vite serves it at
 * /telegram-topic-map/<slug>.json). No worker/deploy involvement.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faSyncAlt } from '@fortawesome/free-solid-svg-icons';
import styles from './TelegramTopicMap.module.scss';

type TopicMapTopic = {
  id: string;
  label: string;
  summary: string;
  size: number;
  agreement: number | null;
  items: string[];
};

type TopicMapFile = {
  sessionSlug: string;
  generatedAt: string;
  topics: TopicMapTopic[];
};

const toStr = (value: unknown): string => String(value ?? '').trim();
const toNum = (value: unknown, fallback = 0): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const normalizeTopicMapFile = (raw: unknown): TopicMapFile | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const topics = (Array.isArray(record.topics) ? record.topics : [])
    .map((topic, index) => {
      const entry = (topic && typeof topic === 'object' && !Array.isArray(topic))
        ? topic as Record<string, unknown>
        : {};
      const label = toStr(entry.label);
      if (!label) return null;
      const agreement = Number(entry.agreement);
      return {
        id: toStr(entry.id) || `topic-${index + 1}`,
        label,
        summary: toStr(entry.summary),
        size: Math.max(1, toNum(entry.size, 1)),
        agreement: Number.isFinite(agreement) ? Math.max(0, Math.min(1, agreement)) : null,
        items: (Array.isArray(entry.items) ? entry.items : []).map(toStr).filter(Boolean).slice(0, 12),
      };
    })
    .filter(Boolean) as TopicMapTopic[];
  if (topics.length === 0) return null;
  return {
    sessionSlug: toStr(record.sessionSlug),
    generatedAt: toStr(record.generatedAt),
    topics,
  };
};

const PACK_WIDTH = 640;
const PACK_HEIGHT = 420;

const TelegramTopicMap = ({ sessionSlug = '' }: { sessionSlug?: string }) => {
  const slug = toStr(sessionSlug);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'missing' | 'error'>('idle');
  const [data, setData] = useState<TopicMapFile | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');

  const loadTopicMap = useCallback(async () => {
    if (!slug) return;
    setStatus('loading');
    try {
      const response = await fetch(`/telegram-topic-map/${encodeURIComponent(slug)}.json`, { cache: 'no-store' });
      if (!response.ok) {
        setData(null);
        setStatus('missing');
        return;
      }
      const normalized = normalizeTopicMapFile(await response.json().catch(() => null));
      if (!normalized) {
        setData(null);
        setStatus('error');
        return;
      }
      setData(normalized);
      setSelectedTopicId(normalized.topics[0]?.id || '');
      setStatus('ready');
    } catch (_) {
      setData(null);
      setStatus('missing');
    }
  }, [slug]);

  useEffect(() => {
    void loadTopicMap();
  }, [loadTopicMap]);

  const packedTopics = useMemo(() => {
    if (!data) return [];
    // Explicit children accessor + descendants-based leaf filter keep this
    // compatible with both real d3 and the repo's jest d3 mock.
    const root: any = d3.hierarchy(
      { children: data.topics } as never,
      (node: any) => node?.children || null
    ).sum((node: any) => Math.max(1, toNum(node?.size, 1)));
    const packed: any = d3.pack().size([PACK_WIDTH, PACK_HEIGHT]).padding(10)(root);
    const color = d3.scaleOrdinal(d3.schemeTableau10);
    return (packed.descendants() as any[])
      .filter((node: any) => !node.children || node.children.length === 0)
      .map((leaf: any, index: number) => {
        const topic = leaf.data as unknown as TopicMapTopic;
        return {
          topic,
          x: leaf.x,
          y: leaf.y,
          r: leaf.r,
          fill: String(color(String(index))),
        };
      });
  }, [data]);

  const selectedTopic = useMemo(
    () => data?.topics.find((topic) => topic.id === selectedTopicId) || null,
    [data, selectedTopicId]
  );

  return (
    <div className={styles.topicMap} data-testid="ce-session-telegram-topicmap">
      <div className={styles.topicMapToolbar}>
        <span className={styles.topicMapStatus}>
          {status === 'ready' && data
            ? `${data.topics.length} topics${data.generatedAt ? ` · generated ${data.generatedAt}` : ''}`
            : status === 'loading'
              ? 'Checking for a local topic map...'
              : status === 'error'
                ? 'Topic map file exists but could not be parsed.'
                : 'No local topic map yet — copy the Codex prompt, run it in the worktree, then reload.'}
        </span>
        <button
          type="button"
          className={styles.topicMapReload}
          onClick={() => { void loadTopicMap(); }}
          disabled={status === 'loading'}
          data-testid="ce-session-telegram-topicmap-reload"
          aria-label="Reload topic map"
        >
          {status === 'loading'
            ? <FontAwesomeIcon icon={faSpinner} spin />
            : <FontAwesomeIcon icon={faSyncAlt} />}
          <span>Reload</span>
        </button>
      </div>
      {status === 'ready' && packedTopics.length > 0 ? (
        <>
          <svg
            className={styles.topicMapCanvas}
            viewBox={`0 0 ${PACK_WIDTH} ${PACK_HEIGHT}`}
            role="img"
            aria-label="Session topic map"
          >
            {packedTopics.map(({ topic, x, y, r, fill }) => (
              <g
                key={topic.id}
                transform={`translate(${x}, ${y})`}
                className={`${styles.topicMapNode} ${topic.id === selectedTopicId ? styles.topicMapNodeSelected : ''}`.trim()}
                onClick={() => setSelectedTopicId(topic.id)}
                data-testid="ce-session-telegram-topicmap-topic"
              >
                <circle r={r} fill={fill} fillOpacity={0.28} stroke={fill} strokeWidth={topic.id === selectedTopicId ? 3 : 1.5} />
                <text className={styles.topicMapLabel} textAnchor="middle" dy="-0.2em">
                  {topic.label.length > 22 ? `${topic.label.slice(0, 21)}…` : topic.label}
                </text>
                <text className={styles.topicMapSubLabel} textAnchor="middle" dy="1.1em">
                  {topic.size}{topic.agreement !== null ? ` · ${Math.round(topic.agreement * 100)}%` : ''}
                </text>
              </g>
            ))}
          </svg>
          {selectedTopic ? (
            <div className={styles.topicMapDetail} data-testid="ce-session-telegram-topicmap-detail">
              <div className={styles.topicMapDetailTitle}>{selectedTopic.label}</div>
              {selectedTopic.summary ? (
                <div className={styles.topicMapDetailSummary}>{selectedTopic.summary}</div>
              ) : null}
              {selectedTopic.items.length > 0 ? (
                <ul className={styles.topicMapDetailItems}>
                  {selectedTopic.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
};

export default TelegramTopicMap;
