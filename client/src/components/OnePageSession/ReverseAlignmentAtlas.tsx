import { useEffect, useRef, useState } from 'react';
import { REVERSE_ALIGNMENT_SOURCE, reverseAlignmentBranches, reverseAlignmentTopics } from './reverseAlignmentTopics';
import styles from './ReverseAlignmentAtlas.module.scss';

type ReadingTab = 'Overview' | 'Tensions' | 'Sources';
type Context = { paragraphs: string[]; links: { label: string; url: string }[] };

export default function ReverseAlignmentAtlas({ context }: { context?: Context | null }) {
  const [branchIndex, setBranchIndex] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({});
  const restoreFocus = useRef<string | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [tab, setTab] = useState<ReadingTab>('Overview');
  const selected = reverseAlignmentTopics.find((topic) => topic.id === selectedId);
  const branch = branchIndex === null ? null : reverseAlignmentBranches[branchIndex];
  const introduction = context?.paragraphs.length
    ? context.paragraphs[0]
    : 'How should society adapt to AI? Explore twelve topics across three areas.';
  const links = context?.links.length ? context.links : [{ label: 'Reverse Alignment', url: REVERSE_ALIGNMENT_SOURCE }];

  useEffect(() => {
    const target = restoreFocus.current;
    restoreFocus.current = null;
    if (target) {
      buttons.current[target]?.focus();
    } else if (branchIndex !== null) {
      titleRef.current?.focus({ preventScroll: true });
      panelRef.current?.scrollIntoView?.({ block: 'start' });
    }
  }, [branchIndex, selectedId]);

  const select = (topicId: string) => {
    const topic = reverseAlignmentTopics.find((item) => item.id === topicId);
    if (!topic) return;
    setBranchIndex(topic.branch);
    setSelectedId(topicId);
    setTab('Overview');
  };
  const move = (offset: number) => {
    if (!selected) return;
    const index = reverseAlignmentTopics.indexOf(selected);
    select(reverseAlignmentTopics[(index + offset + reverseAlignmentTopics.length) % reverseAlignmentTopics.length].id);
  };
  const moveBranch = (offset: number) => {
    if (branchIndex === null) return;
    setBranchIndex((branchIndex + offset + reverseAlignmentBranches.length) % reverseAlignmentBranches.length);
  };
  const backToTopics = () => {
    restoreFocus.current = selectedId;
    setSelectedId(null);
  };
  const backToAreas = () => {
    restoreFocus.current = `branch-${branchIndex}`;
    setBranchIndex(null);
  };

  return (
    <section className={styles.atlas} aria-label="Reverse Alignment context" data-testid="ce-rxc-context-atlas">
      {branchIndex === null ? (
        <>
          <header className={styles.introduction} data-testid="ce-session-context">
            <p>{introduction}</p>
            <div className={styles.contextLinks}>
              {links.map((link) => (
                <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer">
                  {link.label} ↗
                </a>
              ))}
            </div>
          </header>
          <div className={styles.areas} role="group" aria-label="Explore topic groups">
            {reverseAlignmentBranches.map((area, index) => (
              <button
                key={area.tone}
                type="button"
                className={`${styles.area} ${styles[area.tone]}`}
                aria-label={area.label}
                ref={(button) => {
                  buttons.current[`branch-${index}`] = button;
                }}
                onClick={() => setBranchIndex(index)}
              >
                <strong>{area.label}</strong>
                <span className={styles.topicCount}>4 topics</span>
                <span className={styles.areaArrow} aria-hidden="true">
                  ↗
                </span>
              </button>
            ))}
          </div>
        </>
      ) : selected ? (
        <article ref={panelRef} className={styles.reading} aria-label="Selected focus area">
          <div className={styles.readingNavigation}>
            <button
              type="button"
              className={styles.back}
              data-ce-control-appearance="frameless"
              onClick={backToTopics}
              aria-label="Back to focus areas"
            >
              <span aria-hidden="true">←</span> {reverseAlignmentBranches[selected.branch].label}
            </button>
            <div className={styles.tour}>
              <button
                type="button"
                data-ce-control-appearance="frameless"
                onClick={() => move(-1)}
                aria-label="Previous focus area"
              >
                <span aria-hidden="true">←</span>
              </button>
              <span>{reverseAlignmentTopics.indexOf(selected) + 1} / 12</span>
              <button
                type="button"
                data-ce-control-appearance="frameless"
                onClick={() => move(1)}
                aria-label="Next focus area"
              >
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
          <h4 ref={titleRef} tabIndex={-1}>
            {selected.label}
          </h4>
          <div className={styles.readingTabs} role="group" aria-label="Reading view">
            {(['Overview', 'Tensions', 'Sources'] as const).map((view) => (
              <button
                type="button"
                key={view}
                data-ce-control-appearance="frameless"
                aria-pressed={tab === view}
                onClick={() => setTab(view)}
              >
                {view}
              </button>
            ))}
          </div>
          {tab === 'Overview' && (
            <>
              <p className={styles.brief}>{selected.brief}</p>
              <div className={styles.prompt}>
                <h5>A question to carry with you</h5>
                <p>{selected.tension}</p>
              </div>
            </>
          )}
          {tab === 'Tensions' && (
            <div className={styles.prompt}>
              <h5>An invitation to discuss</h5>
              <p>{selected.tension}</p>
              <p className={styles.note}>
                Consider who benefits, who decides, and how someone could contest the outcome.
              </p>
            </div>
          )}
          {tab === 'Sources' && (
            <>
              <p>The focus areas and short summaries draw on the Reverse Alignment website.</p>
              <p className={styles.note}>
                The three regions, discussion prompts, and connections are an editorial guide for this session.
              </p>
              <a href={REVERSE_ALIGNMENT_SOURCE} target="_blank" rel="noreferrer">
                Read Reverse Alignment ↗
              </a>
            </>
          )}
          <div className={styles.related}>
            {selected.related.map((topicId) => (
              <button
                type="button"
                key={topicId}
                data-ce-control-appearance="frameless"
                onClick={() => select(topicId)}
              >
                {reverseAlignmentTopics.find((topic) => topic.id === topicId)?.label}
                <span aria-hidden="true"> ↗</span>
              </button>
            ))}
          </div>
        </article>
      ) : (
        branch && (
          <section ref={panelRef} className={`${styles.groupView} ${styles[branch.tone]}`} aria-label={branch.label}>
            <div className={styles.readingNavigation}>
              <button
                type="button"
                className={styles.back}
                data-ce-control-appearance="frameless"
                onClick={backToAreas}
                aria-label="Back to all areas"
              >
                <span aria-hidden="true">←</span> All areas
              </button>
              <div className={styles.tour}>
                <button
                  type="button"
                  data-ce-control-appearance="frameless"
                  onClick={() => moveBranch(-1)}
                  aria-label="Previous topic group"
                >
                  <span aria-hidden="true">←</span>
                </button>
                <span>{branchIndex + 1} / 3</span>
                <button
                  type="button"
                  data-ce-control-appearance="frameless"
                  onClick={() => moveBranch(1)}
                  aria-label="Next topic group"
                >
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>
            <h4 ref={titleRef} tabIndex={-1}>
              <span className={styles.dot} aria-hidden="true" />
              {branch.label}
            </h4>
            <div className={styles.topics} role="group" aria-label={`${branch.label} topics`}>
              {reverseAlignmentTopics
                .filter((topic) => topic.branch === branchIndex)
                .map((topic) => (
                  <button
                    type="button"
                    key={topic.id}
                    ref={(button) => {
                      buttons.current[topic.id] = button;
                    }}
                    onClick={() => select(topic.id)}
                  >
                    <span className={styles.dot} aria-hidden="true" />
                    <span>{topic.label}</span>
                    <span className={styles.topicArrow} aria-hidden="true">
                      ›
                    </span>
                  </button>
                ))}
            </div>
          </section>
        )
      )}
    </section>
  );
}
