import React from 'react';
import { getSegmentDisplayName } from '../../../utilities/demo/demoAnalysisMath.js';
import styles from './DemoAnalysisWorkspace.module.scss';

const QuestionDrilldownModal = ({
  isOpen,
  question,
  comparisonGroups = [],
  flatResponses = [],
  questionTags = [],
  onClose,
}) => {
  if (!isOpen || !question) return null;

  const segmentKeys = ['All', ...(comparisonGroups || []).map((group) => group.segmentKey)];

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modalCard} role="dialog" aria-modal="true" data-testid="demo-analysis-drilldown-modal">
        <div className={styles.modalHeader}>
          <div>
            <h3 className={styles.panelTitle}>Question Drilldown</h3>
            <p className={styles.panelMeta}>{question.text}</p>
          </div>
          <button type="button" className={styles.clearButton} onClick={onClose}>
            Close
          </button>
        </div>

        {questionTags.length > 0 && (
          <div className={styles.tagFilterRow}>
            {questionTags.map((tag) => (
              <span key={tag.tagID} className={styles.ratePill}>
                {tag.tagName}
              </span>
            ))}
          </div>
        )}

        <div className={styles.tableWrap}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Group</th>
                {question.options.map((option) => (
                  <th key={option}>{option}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {segmentKeys.map((segmentKey) => (
                <tr key={segmentKey}>
                  <td className={styles.tableRowLabel}>{getSegmentDisplayName(segmentKey)}</td>
                  {question.options.map((option) => {
                    const row = flatResponses.find((item) => (
                      item.questionId === question.id &&
                      item.segmentKey === segmentKey &&
                      item.responseText === option
                    ));
                    return (
                      <td key={`${segmentKey}-${option}`}>
                        {row ? `${(Number(row.rate || 0) * 100).toFixed(0)}%` : '-'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default QuestionDrilldownModal;
