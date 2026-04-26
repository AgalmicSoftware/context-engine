import React from 'react';
import { getSegmentDisplayName } from '../../../utilities/demo/demoAnalysisMath.js';
import styles from './DemoAnalysisWorkspace.module.scss';

type DrilldownQuestion = {
  id: string;
  text: string;
  options: string[];
};

type ComparisonGroup = {
  segmentKey: string;
};

type FlatResponse = {
  questionId: string;
  segmentKey: string;
  responseText: string;
  rate?: number | string | null;
};

type QuestionTag = {
  tagID: string | number;
  tagName: string;
};

export type QuestionDrilldownModalProps = {
  isOpen: boolean;
  question?: DrilldownQuestion | null;
  comparisonGroups?: ComparisonGroup[] | null;
  flatResponses?: FlatResponse[] | null;
  questionTags?: QuestionTag[] | null;
  onClose: () => void;
};

const QuestionDrilldownModal = ({
  isOpen,
  question,
  comparisonGroups = [],
  flatResponses = [],
  questionTags = [],
  onClose,
}: QuestionDrilldownModalProps) => {
  if (!isOpen || !question) return null;

  const segmentKeys = ['All', ...(comparisonGroups || []).map((group) => group.segmentKey)];
  const responses = Array.isArray(flatResponses) ? flatResponses : [];
  const tags = Array.isArray(questionTags) ? questionTags : [];

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

        {tags.length > 0 && (
          <div className={styles.tagFilterRow}>
            {tags.map((tag) => (
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
                    const row = responses.find((item) => (
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
