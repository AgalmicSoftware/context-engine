import React from 'react';

import styles from './RiskMatrix.module.scss';
import type { RiskValence } from './RiskMatrix';

export type RiskSeverityLevel = 'low' | 'medium' | 'high';

export type RiskMatrixSeverityAxisLevel = {
  description?: string;
  id: string;
  label: string;
};

export type RiskMatrixSeverityAxis = {
  id: string;
  label: string;
  levels: RiskMatrixSeverityAxisLevel[];
};

export type RiskMatrixSeverityAxes = {
  x: RiskMatrixSeverityAxis;
  y: RiskMatrixSeverityAxis;
};

export type RiskMatrixSeverityAssessment = {
  category: string;
  id: string;
  impact?: RiskSeverityLevel;
  likelihood?: RiskSeverityLevel;
  sourceRefs?: string[];
  summary: string;
  valence?: RiskValence;
  xLevelId?: string;
  yLevelId?: string;
};

const SEVERITY_LEVELS: RiskSeverityLevel[] = ['low', 'medium', 'high'];
const GENERATED_AXIS_HEADER_WIDTH = 104;
const GENERATED_AXIS_COLUMN_WIDTH = 160;
const DEFAULT_AXES: RiskMatrixSeverityAxes = {
  x: {
    id: 'likelihood',
    label: 'Likelihood',
    levels: SEVERITY_LEVELS.map((level) => ({
      id: level,
      label: `${level.charAt(0).toUpperCase()}${level.slice(1)}`,
    })),
  },
  y: {
    id: 'impact',
    label: 'Impact',
    levels: SEVERITY_LEVELS.map((level) => ({
      id: level,
      label: `${level.charAt(0).toUpperCase()}${level.slice(1)}`,
    })),
  },
};

const clsx = (...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(' ');

const toTestIdFragment = (value = '') =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const getCellLabel = (axes: RiskMatrixSeverityAxes, xLevelId: string, yLevelId: string) => {
  const xLevel = axes.x.levels.find((level) => level.id === xLevelId);
  const yLevel = axes.y.levels.find((level) => level.id === yLevelId);
  return `${axes.x.label}: ${xLevel?.label || xLevelId}, ${axes.y.label}: ${yLevel?.label || yLevelId}`;
};

const getCellTestId = (axes: RiskMatrixSeverityAxes, xLevelId: string, yLevelId: string) => {
  if (axes.x.id === 'likelihood' && axes.y.id === 'impact') {
    return `ce-risk-matrix-severity-cell-likelihood-${toTestIdFragment(xLevelId)}-impact-${toTestIdFragment(yLevelId)}`;
  }
  return `ce-risk-matrix-axis-cell-x-${toTestIdFragment(xLevelId)}-y-${toTestIdFragment(yLevelId)}`;
};

const getAssessmentPanelId = (assessmentId: string) => `ce-risk-matrix-generated-assessment-${toTestIdFragment(assessmentId)}`;

const normalizeSourceRefs = (sourceRefs: string[] | undefined): string[] =>
  Array.from(new Set((Array.isArray(sourceRefs) ? sourceRefs : []).map((sourceRef) => sourceRef.trim()).filter(Boolean)));

const normalizeAxes = (axes: RiskMatrixSeverityAxes | null | undefined): RiskMatrixSeverityAxes => {
  const xLevels = Array.isArray(axes?.x?.levels) ? axes.x.levels.filter((level) => level?.id && level?.label) : [];
  const yLevels = Array.isArray(axes?.y?.levels) ? axes.y.levels.filter((level) => level?.id && level?.label) : [];
  if (!axes?.x?.id || !axes?.x?.label || !axes?.y?.id || !axes?.y?.label || xLevels.length === 0 || yLevels.length === 0) {
    return DEFAULT_AXES;
  }
  return {
    x: { ...axes.x, levels: xLevels },
    y: { ...axes.y, levels: yLevels },
  };
};

const getAssessmentXLevelId = (assessment: RiskMatrixSeverityAssessment) =>
  assessment.xLevelId || assessment.likelihood || '';

const getAssessmentYLevelId = (assessment: RiskMatrixSeverityAssessment) =>
  assessment.yLevelId || assessment.impact || '';

type RiskMatrixGeneratedSeverityProps = {
  assessments: RiskMatrixSeverityAssessment[];
  axes?: RiskMatrixSeverityAxes | null;
};

const RiskMatrixGeneratedSeverity = ({ assessments, axes: inputAxes = null }: RiskMatrixGeneratedSeverityProps) => {
  const axes = normalizeAxes(inputAxes);
  const [expandedAssessmentIds, setExpandedAssessmentIds] = React.useState<Record<string, boolean>>({});
  const generatedGridMinWidth = GENERATED_AXIS_HEADER_WIDTH + axes.x.levels.length * GENERATED_AXIS_COLUMN_WIDTH;
  const assessmentsByCell = new Map<string, RiskMatrixSeverityAssessment[]>();

  assessments.forEach((assessment) => {
    const xLevelId = getAssessmentXLevelId(assessment);
    const yLevelId = getAssessmentYLevelId(assessment);
    const key = `${xLevelId}:${yLevelId}`;
    assessmentsByCell.set(key, [...(assessmentsByCell.get(key) || []), assessment]);
  });

  const toggleAssessment = (assessmentId: string) => {
    setExpandedAssessmentIds((previous) => ({
      ...previous,
      [assessmentId]: !previous[assessmentId],
    }));
  };

  return (
    <section className={styles.sectionCard} data-testid="ce-risk-matrix-generated-severity">
      <div className={styles.subgridHeader}>
        <h3 className={styles.sectionTitle}>Generated risk matrix</h3>
        <p className={styles.subgridSummary}>
          AI-generated qualitative assessments from the session snapshot, organized by generated axes. These are not measured response counts.
        </p>
      </div>
      <div className={styles.gridScroll}>
        <div
          className={styles.generatedSeverityGridContainer}
          data-testid="ce-risk-matrix-generated-severity-grid"
          style={{
            gridTemplateColumns: `${GENERATED_AXIS_HEADER_WIDTH}px repeat(${axes.x.levels.length}, minmax(144px, 1fr))`,
            gridTemplateRows: `auto repeat(${axes.y.levels.length}, minmax(104px, auto))`,
            minWidth: `${generatedGridMinWidth}px`,
          }}
        >
          <div className={clsx(styles.cell, styles.cornerCell)} style={{ gridColumn: 1, gridRow: 1 }}>
            <span>{axes.y.label} / {axes.x.label}</span>
          </div>
          {axes.x.levels.map((xLevel, index) => (
            <div
              key={`severity-x-${xLevel.id}`}
              className={clsx(styles.cell, styles.headerCell)}
              style={{ gridColumn: index + 2, gridRow: 1 }}
            >
              {xLevel.label}
            </div>
          ))}
          {axes.y.levels.map((yLevel, rowIndex) => (
            <React.Fragment key={`severity-y-${yLevel.id}`}>
              <div className={clsx(styles.cell, styles.headerCell)} style={{ gridColumn: 1, gridRow: rowIndex + 2 }}>
                {yLevel.label}
              </div>
              {axes.x.levels.map((xLevel, colIndex) => {
                const cellAssessments = assessmentsByCell.get(`${xLevel.id}:${yLevel.id}`) || [];
                return (
                  <div
                    key={`severity-cell-${xLevel.id}-${yLevel.id}`}
                    className={clsx(styles.cell, styles.gridCell, cellAssessments.length === 0 && styles.emptyCell)}
                    style={{ gridColumn: colIndex + 2, gridRow: rowIndex + 2 }}
                    data-testid={getCellTestId(axes, xLevel.id, yLevel.id)}
                    aria-label={`${getCellLabel(axes, xLevel.id, yLevel.id)}, ${cellAssessments.length} generated assessment${cellAssessments.length === 1 ? '' : 's'}.`}
                  >
                    <div className={styles.generatedSeverityList}>
                      {cellAssessments.map((assessment) => {
                        const expanded = expandedAssessmentIds[assessment.id] === true;
                        const panelId = getAssessmentPanelId(assessment.id);
                        const sourceRefs = normalizeSourceRefs(assessment.sourceRefs);
                        return (
                          <article key={assessment.id} className={styles.generatedSeverityAssessment}>
                            <button
                              type="button"
                              className={styles.generatedSeverityToggle}
                              aria-expanded={expanded}
                              aria-controls={panelId}
                              onClick={() => toggleAssessment(assessment.id)}
                            >
                              <span className={styles.generatedSeverityCategory}>{assessment.category}</span>
                              <span className={styles.generatedSeverityCue}>{expanded ? 'Hide details' : 'Show details'}</span>
                            </button>
                            {expanded ? (
                              <div id={panelId} className={styles.generatedSeverityDetails}>
                                <p>{assessment.summary}</p>
                                {sourceRefs.length > 0 ? (
                                  <div className={styles.generatedSeveritySourceBlock}>
                                    <span className={styles.generatedSeveritySourceLabel}>Source refs</span>
                                    <ul className={styles.generatedSeveritySourceList}>
                                      {sourceRefs.map((sourceRef) => (
                                        <li key={sourceRef}>{sourceRef}</li>
                                      ))}
                                    </ul>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  );
};

export default RiskMatrixGeneratedSeverity;
