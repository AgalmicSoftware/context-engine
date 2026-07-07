import React from 'react';
import { getSegmentDisplayName } from '../../../utilities/demo/demoAnalysisMath.js';
import styles from './DemoAnalysisWorkspace.module.scss';

export type ComparisonSuggestion = {
  questionId: string;
  questionText: string;
  pair: string[];
};

export type ComparisonSuggestionsProps = {
  suggestions?: ComparisonSuggestion[] | null;
  onSuggestionClick: (suggestion: ComparisonSuggestion) => void;
  activeSuggestionKey?: string;
};

const buildSuggestionSelectionKey = (questionId = '', pair: string[] = []) =>
  `${String(questionId || '').trim()}::${[...(Array.isArray(pair) ? pair : [])].sort().join('::')}`;

const ComparisonSuggestions = ({
  suggestions = [],
  onSuggestionClick,
  activeSuggestionKey = '',
}: ComparisonSuggestionsProps) => {
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
        {suggestions.map((suggestion, index) =>
          (() => {
            const selectionKey = buildSuggestionSelectionKey(suggestion.questionId, suggestion.pair);
            const isActive = selectionKey === activeSuggestionKey;

            return (
              <button
                key={`${suggestion.pair.join('::')}::${suggestion.questionId}`}
                type="button"
                data-testid={`demo-analysis-suggestion-${index}`}
                className={`${styles.suggestionButton} ${isActive ? styles.suggestionButtonActive : ''}`.trim()}
                aria-pressed={isActive}
                onClick={() => onSuggestionClick(suggestion)}
              >
                <span className={styles.suggestionPair}>
                  {getSegmentDisplayName(suggestion.pair[0])}
                  <span className={styles.suggestionVs}>vs</span>
                  {getSegmentDisplayName(suggestion.pair[1])}
                </span>
                <span className={styles.suggestionQuestion}>{suggestion.questionText}</span>
              </button>
            );
          })(),
        )}
      </div>
    </section>
  );
};

export default ComparisonSuggestions;
