import React, { Suspense, useState } from 'react';
import LazyFallback from '../Shared/LazyFallback';
import type { AtlasViewProps, DebateNode } from '../DebateMap/debateMapTypes';
import styles from './ReverseAlignmentTopicMap.module.scss';
import { hasReverseAlignmentContext, reverseAlignmentBranches, reverseAlignmentTopics } from './reverseAlignmentTopics';

// Regression guard: session pages import this preview statically, so DebateMap's
// large stylesheet must arrive with the lazy circles, not with this module.
const Circles = React.lazy(async () => {
  const [{ AtlasView }, { default: debateStyles }] = await Promise.all([
    import('../DebateMap/DebateMap'),
    import('../DebateMap/DebateMap.module.scss'),
  ]);
  const DebateMapCircles = ({ className, ...atlasProps }: AtlasViewProps & { className: string }) => (
    <div className={`${debateStyles.debateMap} ${className}`}>
      <AtlasView {...atlasProps} />
    </div>
  );
  return { default: DebateMapCircles };
});

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

// Keep the RxC research session on Report and Raw Results until its map is ready.
export const hasReverseAlignmentTopicPreview = (slug: string) =>
  hasReverseAlignmentContext(slug) && slug !== 'rxc-ra-test';

export default function ReverseAlignmentTopicMap() {
  const [selected, setSelected] = useState<DebateNode | null>(null);
  return (
    <section className={styles.map} aria-label="Reverse Alignment topic map" data-testid="ce-rxc-topic-map">
      <header>
        <h3>Debate map</h3>
        <span className={styles.preview}>Circles · Preview</span>
      </header>
      <p className={styles.waiting}>Waiting for more data</p>
      <Suspense
        fallback={
          <div className={styles.canvas}>
            <LazyFallback label="Loading topic circles…" minHeight="30vh" />
          </div>
        }
      >
        <Circles
          className={styles.canvas}
          data={topicTree}
          rootLabel="Reverse Alignment"
          atlasLayoutMode="packed"
          readOnly
          onNodeClick={setSelected}
        />
      </Suspense>
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
