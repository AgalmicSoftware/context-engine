import React, { useState } from 'react';
import styles from './ReverseAlignmentTopicMap.module.scss';
import { hasReverseAlignmentContext, reverseAlignmentBranches, reverseAlignmentTopics } from './reverseAlignmentTopics';

const branches = reverseAlignmentBranches.map((branch, index) => ({
  label: branch.label,
  topics: reverseAlignmentTopics.filter((topic) => topic.branch === index).map((topic) => topic.label),
}));

// This is a session-specific preview, not a classification of its EDDY questions.
export const hasReverseAlignmentTopicPreview = hasReverseAlignmentContext;

export default function ReverseAlignmentTopicMap() {
  const [selected, setSelected] = useState('Identity');
  return (
    <section className={styles.map} aria-label="Reverse Alignment topic map" data-testid="ce-rxc-topic-map">
      <header>
        <h3>Topic map</h3>
        <span className={styles.preview}>Preview</span>
      </header>
      <p className={styles.waiting}>Waiting for more data</p>
      <p>Explore the topics below. No questions or responses have been assigned yet.</p>
      <a href="https://reversealignment.ai/" target="_blank" rel="noreferrer">
        Based on Reverse Alignment
      </a>
      <div className={styles.root}>Reverse Alignment</div>
      <div className={styles.branches}>
        {branches.map((branch) => (
          <section className={styles.branch} key={branch.label} aria-label={branch.label}>
            <h4>{branch.label}</h4>
            <div className={styles.topics}>
              {branch.topics.map((topic) => (
                <button type="button" key={topic} aria-pressed={selected === topic} onClick={() => setSelected(topic)}>
                  <span>{topic}</span>
                  <span className={styles.count}>0 assigned</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className={styles.empty} role="status" aria-live="polite">
        <h4>{selected}</h4>
        <p>No questions or responses assigned yet.</p>
      </div>
    </section>
  );
}
