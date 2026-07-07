import React from 'react';
import CheckboxMultiSelect from '../../Shared/CheckboxMultiSelect';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagic, faTimes } from '@fortawesome/free-solid-svg-icons';
import { getSegmentDisplayName } from '../../../utilities/demo/demoAnalysisMath.js';
import styles from './DemoAnalysisWorkspace.module.scss';

const slugify = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const formatPersonaCount = (count = 0) => {
  const normalizedCount = Number(count || 0);
  return `${normalizedCount} persona${normalizedCount === 1 ? '' : 's'}`;
};

type DemographicOption = {
  value: string;
  count?: number;
};

type DemographicsByCategory = Record<string, DemographicOption[]>;

type DemographicSelectorProps = {
  demographics?: DemographicsByCategory;
  selectedSegmentKeys?: string[];
  onToggleSegment: (segmentKey: string) => void;
  onCategoryChange: (category: string, segmentKeys: string[]) => void;
  onClearAll: () => void;
  onAutoSelectCorrelation: () => void;
  onSuggestFromSegment: (segmentKey: string) => void;
};

const DemographicSelector = ({
  demographics = {},
  selectedSegmentKeys = [],
  onToggleSegment,
  onCategoryChange,
  onClearAll,
  onAutoSelectCorrelation,
  onSuggestFromSegment,
}: DemographicSelectorProps) => {
  const selectedSet = new Set(selectedSegmentKeys);

  return (
    <section className={`${styles.panel} ${styles.filterPanel}`} data-testid="demo-analysis-demographic-selector">
      <div className={styles.panelHeader}>
        <div>
          <h3 className={styles.panelTitle}>Compare Demographics</h3>
          <p className={styles.panelMeta}>
            Select any two or more demographic segments to power the comparison report.
          </p>
        </div>
        <div className={styles.selectorActions}>
          <button
            type="button"
            className={styles.clearButton}
            onClick={onAutoSelectCorrelation}
            title="Auto-select the strongest correlation"
            aria-label="Auto-select strongest correlation"
          >
            <FontAwesomeIcon icon={faMagic} />
          </button>
          {selectedSegmentKeys.length > 0 && (
            <button type="button" className={styles.clearButton} onClick={onClearAll}>
              Clear all
            </button>
          )}
        </div>
      </div>

      {selectedSegmentKeys.length === 0 ? (
        <div className={styles.workspaceEmpty}>
          <span>Add filters from the dropdowns below to begin.</span>
        </div>
      ) : (
        <div className={styles.workspaceContainer}>
          <div className={styles.pillsLayout}>
            {selectedSegmentKeys.map((segmentKey) => (
              <div key={segmentKey} className={styles.filterPill}>
                <span className={styles.pillName}>{getSegmentDisplayName(segmentKey)}</span>
                <div className={styles.pillControls}>
                  <button
                    type="button"
                    className={styles.pillIconButton}
                    onClick={() => onSuggestFromSegment(segmentKey)}
                    title="Suggest related comparisons"
                    aria-label={`Suggest related comparisons for ${getSegmentDisplayName(segmentKey)}`}
                  >
                    <FontAwesomeIcon icon={faMagic} />
                  </button>
                  <button
                    type="button"
                    className={styles.pillIconButton}
                    onClick={() => onToggleSegment(segmentKey)}
                    title="Remove group"
                    aria-label={`Remove ${getSegmentDisplayName(segmentKey)}`}
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.selectorLayout}>
        {Object.entries(demographics).map(([category, options]) => (
          <div key={category} className={styles.selectorField}>
            <CheckboxMultiSelect
              inputId={`demo-analysis-select-${slugify(category)}`}
              className={styles.demographicSelect}
              isClearable
              onChange={(nextOptions) => {
                const nextSegmentKeys = (Array.isArray(nextOptions) ? nextOptions : []).map(
                  (option) => `${category}:${String(option.value || '')}`,
                );
                onCategoryChange(category, nextSegmentKeys);
              }}
              options={(Array.isArray(options) ? options : []).map((option) => ({
                value: option.value,
                label: `${option.value} (${formatPersonaCount(option.count)})`,
              }))}
              placeholder={category}
              value={(Array.isArray(options) ? options : [])
                .filter((option) => selectedSet.has(`${category}:${option.value}`))
                .map((option) => ({
                  value: option.value,
                  label: `${option.value} (${formatPersonaCount(option.count)})`,
                }))}
            />
          </div>
        ))}
      </div>
    </section>
  );
};

export default DemographicSelector;
