import React, { Suspense, useState } from 'react';
import LazyFallback from '../Shared/LazyFallback';
import type { DebateNode } from '../DebateMap/debateMapTypes';
import debateStyles from '../DebateMap/DebateMap.module.scss';
import styles from './ReverseAlignmentTopicMap.module.scss';
import { hasReverseAlignmentContext, reverseAlignmentBranches, reverseAlignmentTopics } from './reverseAlignmentTopics';

const Circles = React.lazy(() => import('../DebateMap/DebateMap').then(({ AtlasView }) => ({ default: AtlasView })));

// Editorial scaffolding only: no submitted question/response IDs or sample votes.
const topicTree: DebateNode[] = reverseAlignmentBranches.map((branch, index) => ({
  id: `ra-branch-${branch.tone}`,
  name: branch.label,
  depth: 0,
  questions: [],
  comments: [],
  children: reverseAlignmentTopics
    .filter((topic) => topic.branch === index)
    .map((topic) => ({
      id: `ra-topic-${topic.id}`,
      name: topic.label,
      depth: 1,
      questions: [],
      comments: [],
      children: [],
    })),
}));

export const hasReverseAlignmentTopicPreview = hasReverseAlignmentContext;

export default function ReverseAlignmentTopicMap() {
  const [selected, setSelected] = useState<DebateNode | null>(null);
  return (
    <section className={styles.map} aria-label="Reverse Alignment topic map" data-testid="ce-rxc-topic-map">
      <header>
        <h3>Debate map</h3>
        <span className={styles.preview}>Circles · Preview</span>
      </header>
      <p className={styles.waiting}>Waiting for more data</p>
      <div className={`${debateStyles.debateMap} ${styles.canvas}`}>
        <Suspense fallback={<LazyFallback label="Loading topic circles…" minHeight="30vh" />}>
          <Circles
            data={topicTree}
            rootLabel="Reverse Alignment"
            atlasLayoutMode="packed"
            readOnly
            onNodeClick={setSelected}
          />
        </Suspense>
      </div>
      <div role="status" aria-live="polite">
        {selected && (
          <div className={styles.empty}>
            <h4>{selected.name}</h4>
            <p>No questions or responses assigned yet.</p>
          </div>
        )}
      </div>
    </section>
  );
}
