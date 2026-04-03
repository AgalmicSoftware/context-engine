import React from 'react';
import { getSegmentDisplayName } from '../../../utilities/demo/demoAnalysisMath.js';
import styles from './DemoAnalysisWorkspace.module.scss';

const ComparisonSuggestions = ({ suggestions = [], onSuggestionClick }) => {
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    return (
      <section className={`${styles.panel} ${styles.suggestionPanel}`}>
        <h3 className={styles.panelTitle}>Comparison Suggestions</h3>
        <p className={styles.emptyHint}>No suggestion pairs are available for the current selection.</p>
      </section>
    );
  }

  return (
    <section className={`${styles.panel} ${styles.suggestionPanel}`}>
      <div className={styles.panelHeader}>
        <div>
          <h3 className={styles.panelTitle}>Comparison Suggestions</h3>
          <p className={styles.panelMeta}>
            Click a suggestion to load both groups and jump to the most revealing question behind the split.
          </p>
        </div>
      </div>
      <div className={styles.suggestionsList}>
        {suggestions.map((suggestion, index) => (
          <button
            key={`${suggestion.pair.join('::')}::${suggestion.questionId}`}
            type="button"
            data-testid={`demo-analysis-suggestion-${index}`}
            className={styles.suggestionButton}
            onClick={() => onSuggestionClick(suggestion)}
          >
            <span className={styles.suggestionPair}>
              {getSegmentDisplayName(suggestion.pair[0])}
              <span className={styles.suggestionVs}>vs</span>
              {getSegmentDisplayName(suggestion.pair[1])}
            </span>
            <span className={styles.suggestionQuestion}>{suggestion.questionText}</span>
          </button>
        ))}
      </div>
    </section>
  );
};

export default ComparisonSuggestions;
