import React, { useId, useState } from 'react';
import artwork from '../../assets/img/reverse-alignment-atlas-v1.jpg';
import { REVERSE_ALIGNMENT_SOURCE, reverseAlignmentBranches, reverseAlignmentTopics } from './reverseAlignmentTopics';
import styles from './ReverseAlignmentAtlas.module.scss';

type ReadingTab = 'Overview' | 'Tensions' | 'Sources';

export default function ReverseAlignmentAtlas() {
  const id = useId();
  const [selectedId, setSelectedId] = useState('communal-sensemaking');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<ReadingTab>('Overview');
  const selected = reverseAlignmentTopics.find((topic) => topic.id === selectedId) ?? reverseAlignmentTopics[5];
  const matches = reverseAlignmentTopics.filter((topic) =>
    `${topic.label} ${topic.brief}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const select = (topicId: string) => {
    setSelectedId(topicId);
    setTab('Overview');
  };
  const move = (offset: number) => {
    const index = reverseAlignmentTopics.findIndex((topic) => topic.id === selectedId);
    select(reverseAlignmentTopics[(index + offset + reverseAlignmentTopics.length) % reverseAlignmentTopics.length].id);
  };

  return (
    <section className={styles.atlas} aria-labelledby={`${id}-title`} data-testid="ce-rxc-context-atlas">
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>RxC · A field guide</span>
          <h3 id={`${id}-title`}>Reverse Alignment Atlas</h3>
          <p>Explore the institutions, choices, and capabilities that shape life with AI.</p>
        </div>
        <label className={styles.search}>
          Find a focus area
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try privacy or learning"
          />
        </label>
      </header>
      <div className={styles.explorer}>
        <div className={styles.map} aria-label="Explore twelve focus areas">
          <img className={styles.artwork} src={artwork} alt="" width="1448" height="1086" loading="lazy" />
          {reverseAlignmentBranches.map((branch, branchIndex) => (
            <section key={branch.tone} className={`${styles.branch} ${styles[branch.tone]}`} aria-label={branch.label}>
              <h4>{branch.label}</h4>
              {reverseAlignmentTopics
                .filter((topic) => topic.branch === branchIndex)
                .map((topic) => (
                  <button
                    type="button"
                    key={topic.id}
                    aria-pressed={selected.id === topic.id}
                    hidden={!matches.includes(topic)}
                    onClick={() => select(topic.id)}
                  >
                    <span className={styles.dot} aria-hidden="true" />
                    {topic.label}
                  </button>
                ))}
            </section>
          ))}
          {matches.length === 0 && (
            <p className={styles.noMatches} role="status">
              No matching focus areas. Try another search.
            </p>
          )}
        </div>
        <article className={styles.reading} aria-label="Selected focus area" aria-live="polite">
          <span className={styles.eyebrow}>{reverseAlignmentBranches[selected.branch].label}</span>
          <h4>{selected.label}</h4>
          <div className={styles.readingTabs} role="group" aria-label="Reading view">
            {(['Overview', 'Tensions', 'Sources'] as const).map((view) => (
              <button type="button" key={view} aria-pressed={tab === view} onClick={() => setTab(view)}>
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
            <h5>Connected focus areas</h5>
            {selected.related.map((topicId) => (
              <button type="button" key={topicId} onClick={() => select(topicId)}>
                {reverseAlignmentTopics.find((topic) => topic.id === topicId)?.label}
                <span aria-hidden="true"> ↗</span>
              </button>
            ))}
          </div>
          <div className={styles.tour}>
            <button type="button" onClick={() => move(-1)} aria-label="Previous focus area">
              ← Previous
            </button>
            <span>{reverseAlignmentTopics.indexOf(selected) + 1} / 12</span>
            <button type="button" onClick={() => move(1)} aria-label="Next focus area">
              Next →
            </button>
          </div>
        </article>
      </div>
      <footer className={styles.footer}>
        <strong>12 focus areas. Many possible futures.</strong>
        <span>
          Explore this guide, then visit the topic map in Results to see session perspectives as they become available.
        </span>
      </footer>
    </section>
  );
}
