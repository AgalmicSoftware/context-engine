/** @file RiskMatrix.tsx */

import React, { Component } from 'react';
import { Modal } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp, faExternalLinkAlt, faNetworkWired } from '@fortawesome/free-solid-svg-icons';

import styles from './RiskMatrix.module.scss';
import {
  getRiskMatrixAtlasScenarioCountForCell,
  getRiskMatrixAtlasScenariosForCell,
} from '../../variables/demo/riskMatrixAtlasScenarioData.js';
import seedComments from '../../variables/demo/riskMatrixSeedComments.json';
import {
  enrichRiskMatrixCommentRecord,
  getRiskMatrixCorpusSourceCitationItems,
  type RiskMatrixCorpusRef,
  type RiskMatrixHistoricalFigure,
} from '../../variables/demo/riskMatrixCommentContext';
import { buildAtlasNodeRoute, buildPublicUrlPath, readWindowLocationPath } from '../../utilities/ui/publicUrl.js';
import { getHistoricalFigureAvatarByName } from '../../utilities/ui/historicalFigureAvatars.js';

export type RiskValence = 'opportunity' | 'risk';

export type RiskCommentRecord = {
  cell: string;
  comment: string;
  valence: RiskValence;
  intensity: number;
  historicalFigure?: RiskMatrixHistoricalFigure | null;
  corpusRefs?: RiskMatrixCorpusRef[];
};

export type RiskMatrixRestoreState = {
  comments?: RiskCommentRecord[];
  modal?: boolean;
  selectedCellId?: string;
  comment?: string;
  valence?: RiskValence;
  intensity?: number;
  activeCategoryX?: string | null;
  activeCategoryY?: string | null;
  activeSubcategoryX?: string | null;
  activeSubcategoryY?: string | null;
};

type RiskCategory = {
  name: string;
  subcategories: string[];
};

type RiskMatrixProps = {
  embedded?: boolean;
  onOpenAtlasNode?: ((nodeId: string, restoreState?: RiskMatrixRestoreState) => void) | null;
  restoreState?: RiskMatrixRestoreState | null;
  onRestoreApplied?: (() => void) | null;
};

type RiskMatrixState = {
  comments: RiskCommentRecord[];
  modal: boolean;
  selectedCellId: string;
  existingComments: RiskCommentRecord[];
  valence: RiskValence;
  comment: string;
  intensity: number;
  heatmap: Record<string, number>;
  activeCategoryX: string | null;
  activeCategoryY: string | null;
  activeSubcategoryX: string | null;
  activeSubcategoryY: string | null;
  hoveredRowIndex: number | null;
  hoveredColIndex: number | null;
  hoveredSubRowIndex: number | null;
  hoveredSubColIndex: number | null;
  openCommentGroups: Record<RiskValence, boolean>;
};

type RiskMatrixAtlasScenario = {
  id: string;
  riskMatrixCell: string;
  atlasNodeId: string;
  atlasNodeLabel: string;
  title: string;
  shortTitle?: string;
  summary: string;
  valence: 'risk' | 'opportunity' | 'mixed';
  intensity: number;
  confidence: string;
  timeHorizon: string;
  primaryMechanism: string;
  riskClaim?: string;
  opportunityClaim?: string;
  counterpoint?: string;
  image?: string | null;
  imageAlt?: string;
  historicalAnchors?: Array<{
    name: string;
    avatar: string;
    role?: string;
  }>;
};

export const RISK_MATRIX_CATEGORIES: RiskCategory[] = [
  { name: 'Safety', subcategories: ['Alignment', 'Evaluations', 'Red Teaming', 'Containment'] },
  { name: 'Capabilities', subcategories: ['Scaling', 'Agents', 'Reasoning', 'Multimodal'] },
  { name: 'Governance', subcategories: ['Regulation', 'Licensing', 'International', 'Liability'] },
  { name: 'Open Source', subcategories: ['Weight Release', 'Democratization', 'Safety Tradeoffs'] },
  { name: 'Labor', subcategories: ['Automation', 'Productivity', 'Inequality', 'Retraining'] },
  { name: 'Security', subcategories: ['Cyber Offense', 'Biosecurity', 'Surveillance', 'Deepfakes'] },
  { name: 'Military', subcategories: ['Autonomous Weapons', 'Escalation', 'Arms Control'] },
  { name: 'Infra', subcategories: ['Compute', 'Energy', 'Data Centers', 'Supply Chain'] },
  { name: 'Discourse', subcategories: ['Media', 'Narratives', 'Trust', 'Misinformation'] },
  { name: 'Crypto', subcategories: ['ZK Proofs', 'Trustless Agreements', 'Post-Quantum', 'Key Management'] },
];

const DEFAULT_VALENCE: RiskValence = 'opportunity';
const DEFAULT_INTENSITY = 5;
const VALID_VALENCES = new Set(['opportunity', 'risk']);

const clsx = (...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(' ');

const toTestIdFragment = (value = '') =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const isAggregateCellId = (cellId = '') => cellId.includes('_vs_');

const isCanonicalCellId = (cell = '') => {
  const parts = String(cell).split('.');
  return parts.length === 4 && parts.every(Boolean);
};

const normalizeCommentRecord = (entry: RiskCommentRecord): RiskCommentRecord => ({
  cell: entry.cell.trim(),
  comment: entry.comment.trim(),
  valence: entry.valence,
  intensity: Number(entry.intensity),
  historicalFigure: entry.historicalFigure || null,
  corpusRefs: Array.isArray(entry.corpusRefs) ? entry.corpusRefs : [],
});

const isValidCommentRecord = (entry: unknown): entry is RiskCommentRecord => {
  if (!entry || typeof entry !== 'object') return false;
  const candidate = entry as Partial<RiskCommentRecord>;
  if (!isCanonicalCellId(candidate.cell)) return false;
  if (typeof candidate.comment !== 'string' || !candidate.comment.trim()) return false;
  if (!VALID_VALENCES.has(String(candidate.valence))) return false;

  const intensity = Number(candidate.intensity);
  return Number.isFinite(intensity) && intensity > 0;
};

const INITIAL_COMMENTS: RiskCommentRecord[] = Array.isArray(seedComments)
  ? seedComments.filter(isValidCommentRecord).map(normalizeCommentRecord).map(enrichRiskMatrixCommentRecord)
  : [];

export const buildHeatmapFromComments = (comments: RiskCommentRecord[] = []) => {
  const heatmap: Record<string, number> = {};

  comments.forEach((commentData) => {
    if (!isValidCommentRecord(commentData)) return;

    const [catX, , catY] = commentData.cell.split('.');
    const key = `${catY}_${catX}`;
    const signedValue = (commentData.valence === 'risk' ? -1 : 1) * Number(commentData.intensity);

    heatmap[key] = (heatmap[key] || 0) + signedValue;
  });

  return heatmap;
};

export const formatRiskMatrixValue = (value: number) => (value > 0 ? `+${value}` : `${value}`);

const formatCellPath = (cellId = '') => {
  const parts = cellId.split('.');
  if (parts.length !== 4) return cellId;
  return `${parts[0]} / ${parts[1]} -> ${parts[2]} / ${parts[3]}`;
};

const formatSelectionTitle = (cellId = '') => {
  if (!cellId) return 'Interaction detail';

  if (isAggregateCellId(cellId)) {
    const [catX, catY] = cellId.split('_vs_');
    return `Interaction: ${catX} vs ${catY}`;
  }

  const [catX, subX, catY, subY] = cellId.split('.');
  return `${catX} / ${subX} vs ${catY} / ${subY}`;
};

const parseSelectionStateFromCell = (cellId = '') => {
  if (isAggregateCellId(cellId)) {
    const [activeCategoryX, activeCategoryY] = cellId.split('_vs_');
    if (!activeCategoryX || !activeCategoryY) return null;

    return {
      activeCategoryX,
      activeCategoryY,
      activeSubcategoryX: null,
      activeSubcategoryY: null,
    };
  }

  if (!isCanonicalCellId(cellId)) return null;

  const [activeCategoryX, activeSubcategoryX, activeCategoryY, activeSubcategoryY] = cellId.split('.');
  return {
    activeCategoryX,
    activeCategoryY,
    activeSubcategoryX,
    activeSubcategoryY,
  };
};

const getCommentsForCellRecords = (cellId: string, comments: RiskCommentRecord[] = []): RiskCommentRecord[] => {
  if (typeof cellId !== 'string' || !cellId) return [];

  if (isAggregateCellId(cellId)) {
    const [catX, catY] = cellId.split('_vs_');
    if (!catX || !catY) return [];

    return comments.filter(
      (entry) => isCanonicalCellId(entry.cell) && entry.cell.startsWith(`${catX}.`) && entry.cell.includes(`.${catY}.`),
    );
  }

  return comments.filter((entry) => entry.cell === cellId);
};

const hasRestoreState = (restoreState: RiskMatrixRestoreState | null | undefined) =>
  Boolean(restoreState && typeof restoreState === 'object' && Object.keys(restoreState).length > 0);

const buildInitialRiskMatrixState = (restoreState: RiskMatrixRestoreState | null | undefined): RiskMatrixState => {
  const nextComments = Array.isArray(restoreState?.comments)
    ? restoreState.comments.filter(isValidCommentRecord).map(normalizeCommentRecord).map(enrichRiskMatrixCommentRecord)
    : INITIAL_COMMENTS;
  const rawSelectedCellId = String(restoreState?.selectedCellId || '').trim();
  const selectedCellId =
    isAggregateCellId(rawSelectedCellId) || isCanonicalCellId(rawSelectedCellId) ? rawSelectedCellId : '';
  const derivedSelectionState = parseSelectionStateFromCell(selectedCellId);
  const nextValence = VALID_VALENCES.has(String(restoreState?.valence || ''))
    ? (restoreState?.valence as RiskValence)
    : DEFAULT_VALENCE;
  const parsedIntensity = Number(restoreState?.intensity);
  const nextIntensity = Number.isFinite(parsedIntensity) && parsedIntensity > 0 ? parsedIntensity : DEFAULT_INTENSITY;
  const modal = Boolean(restoreState?.modal && selectedCellId);

  return {
    comments: nextComments,
    modal,
    selectedCellId: modal ? selectedCellId : '',
    existingComments: modal ? getCommentsForCellRecords(selectedCellId, nextComments) : [],
    comment: typeof restoreState?.comment === 'string' ? restoreState.comment : '',
    valence: nextValence,
    intensity: nextIntensity,
    heatmap: buildHeatmapFromComments(nextComments),
    activeCategoryX: restoreState?.activeCategoryX ?? derivedSelectionState?.activeCategoryX ?? null,
    activeCategoryY: restoreState?.activeCategoryY ?? derivedSelectionState?.activeCategoryY ?? null,
    activeSubcategoryX: restoreState?.activeSubcategoryX ?? derivedSelectionState?.activeSubcategoryX ?? null,
    activeSubcategoryY: restoreState?.activeSubcategoryY ?? derivedSelectionState?.activeSubcategoryY ?? null,
    hoveredRowIndex: null,
    hoveredColIndex: null,
    hoveredSubRowIndex: null,
    hoveredSubColIndex: null,
    openCommentGroups: {
      opportunity: true,
      risk: true,
    },
  };
};

const resolveAtlasAssetPath = (value = '') => {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) return '';
  return normalizedValue.startsWith('/') ? buildPublicUrlPath(normalizedValue) : normalizedValue;
};

class RiskMatrix extends Component<RiskMatrixProps, RiskMatrixState> {
  constructor(props: RiskMatrixProps) {
    super(props);

    this.state = buildInitialRiskMatrixState(props.restoreState);
  }

  componentDidMount() {
    const { onRestoreApplied = null, restoreState = null } = this.props;
    if (typeof onRestoreApplied === 'function' && hasRestoreState(restoreState)) {
      onRestoreApplied();
    }
  }

  closeModal = () => {
    this.setState({
      modal: false,
      selectedCellId: '',
      existingComments: [],
      comment: '',
      valence: DEFAULT_VALENCE,
      intensity: DEFAULT_INTENSITY,
    });
  };

  toggleCommentGroup = (valence: RiskValence) => {
    this.setState((previous) => ({
      openCommentGroups: {
        ...previous.openCommentGroups,
        [valence]: !previous.openCommentGroups[valence],
      },
    }));
  };

  getCellValue = (catY: string, catX: string) => this.state.heatmap[`${catY}_${catX}`] || 0;

  getCommentsForCell = (cellId: string, comments: RiskCommentRecord[] = this.state.comments): RiskCommentRecord[] =>
    getCommentsForCellRecords(cellId, comments);

  getRestoreState = (): RiskMatrixRestoreState => ({
    comments: this.state.comments,
    modal: this.state.modal,
    selectedCellId: this.state.selectedCellId,
    comment: this.state.comment,
    valence: this.state.valence,
    intensity: this.state.intensity,
    activeCategoryX: this.state.activeCategoryX,
    activeCategoryY: this.state.activeCategoryY,
    activeSubcategoryX: this.state.activeSubcategoryX,
    activeSubcategoryY: this.state.activeSubcategoryY,
  });

  getHeatmapMaxMagnitude = () => Math.max(6, ...Object.values(this.state.heatmap).map((value) => Math.abs(value)));

  getCellAriaLabel = (catX: string, catY: string, value: number) => {
    if (value === 0) {
      return `${catX} versus ${catY}, no seeded signal yet. Open aggregated notes.`;
    }

    const leaning = value > 0 ? 'opportunity' : 'risk';
    return `${catX} versus ${catY}, ${leaning} balance ${formatRiskMatrixValue(value)}. Open aggregated notes.`;
  };

  getSubCellAriaLabel = (catX: string, subX: string, catY: string, subY: string, value: number) => {
    if (value === 0) {
      return `${catX} ${subX} versus ${catY} ${subY}, no seeded signal yet. Open detailed notes.`;
    }

    const leaning = value > 0 ? 'opportunity' : 'risk';
    return `${catX} ${subX} versus ${catY} ${subY}, ${leaning} balance ${formatRiskMatrixValue(value)}. Open detailed notes.`;
  };

  openModalForCell = (selectedCellId: string, statePatch: Partial<RiskMatrixState> = {}) => {
    const existingComments = this.getCommentsForCell(selectedCellId);

    this.setState({
      ...statePatch,
      modal: true,
      selectedCellId,
      existingComments,
      comment: '',
      valence: DEFAULT_VALENCE,
      intensity: DEFAULT_INTENSITY,
    } as Pick<RiskMatrixState, keyof RiskMatrixState>);
  };

  handleKeyActivate = (event: React.KeyboardEvent<HTMLElement>, callback: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      callback();
    }
  };

  handleCategoryXClick = (categoryXName: string) => {
    this.setState((prevState) => ({
      activeCategoryX: prevState.activeCategoryX === categoryXName ? null : categoryXName,
      activeSubcategoryX: null,
    }));
  };

  handleCategoryYClick = (categoryYName: string) => {
    this.setState((prevState) => ({
      activeCategoryY: prevState.activeCategoryY === categoryYName ? null : categoryYName,
      activeSubcategoryY: null,
    }));
  };

  handleSubcategoryXClick = (subcategoryXName: string | null) => {
    this.setState((prevState) => ({
      activeSubcategoryX: prevState.activeSubcategoryX === subcategoryXName ? null : subcategoryXName,
    }));
  };

  handleSubcategoryYClick = (subcategoryYName: string | null) => {
    this.setState((prevState) => ({
      activeSubcategoryY: prevState.activeSubcategoryY === subcategoryYName ? null : subcategoryYName,
    }));
  };

  handleCellClick = (catY: string, catX: string) => {
    const selectedCellId = `${catX}_vs_${catY}`;

    this.openModalForCell(selectedCellId, {
      activeCategoryX: catX,
      activeCategoryY: catY,
      activeSubcategoryX: null,
      activeSubcategoryY: null,
    });
  };

  handleSubCellClick = (subY: string, subX: string) => {
    const { activeCategoryX, activeCategoryY } = this.state;
    if (!activeCategoryX || !activeCategoryY) return;

    const selectedCellId = `${activeCategoryX}.${subX}.${activeCategoryY}.${subY}`;

    this.openModalForCell(selectedCellId, {
      activeSubcategoryX: subX,
      activeSubcategoryY: subY,
    });
  };

  handleSaveComment = () => {
    const { comment, intensity, selectedCellId, valence } = this.state;

    if (isAggregateCellId(selectedCellId)) return;

    const trimmedComment = comment.trim();
    if (!selectedCellId || !trimmedComment) return;

    const newComment = enrichRiskMatrixCommentRecord({
      cell: selectedCellId,
      comment: trimmedComment,
      valence,
      intensity: Number(intensity),
    });

    this.setState((prevState) => {
      const comments = [...prevState.comments, newComment];

      return {
        comments,
        heatmap: buildHeatmapFromComments(comments),
        existingComments: this.getCommentsForCell(selectedCellId, comments),
        comment: '',
        valence: DEFAULT_VALENCE,
        intensity: DEFAULT_INTENSITY,
      };
    });
  };

  handleValenceChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValence = event.target.value === 'risk' ? 'risk' : 'opportunity';
    this.setState({ valence: nextValence });
  };
  handleCommentChange = (event: React.ChangeEvent<HTMLTextAreaElement>) =>
    this.setState({ comment: event.target.value });
  handleIntensityChange = (event: React.ChangeEvent<HTMLInputElement>) =>
    this.setState({ intensity: Number(event.target.value) });

  handleCellMouseEnter = (rowIndex: number, colIndex: number) =>
    this.setState({
      hoveredRowIndex: rowIndex,
      hoveredColIndex: colIndex,
    });

  handleCellMouseLeave = () =>
    this.setState({
      hoveredRowIndex: null,
      hoveredColIndex: null,
    });

  handleSubCellMouseEnter = (rowIndex: number, colIndex: number) =>
    this.setState({
      hoveredSubRowIndex: rowIndex,
      hoveredSubColIndex: colIndex,
    });

  handleSubCellMouseLeave = () =>
    this.setState({
      hoveredSubRowIndex: null,
      hoveredSubColIndex: null,
    });

  getColorByValue = (value: number) => {
    if (value === 0) return undefined;

    const maxMagnitude = this.getHeatmapMaxMagnitude();
    const ratio = Math.min(Math.abs(value) / maxMagnitude, 1);
    const opacity = 0.35 + ratio * 0.55;

    if (value > 0) {
      return `rgba(50, 255, 140, ${opacity})`;
    }

    return `rgba(255, 80, 90, ${opacity})`;
  };

  renderMainGrid = () => {
    const { activeCategoryX, activeCategoryY, hoveredColIndex, hoveredRowIndex } = this.state;
    const numCategories = RISK_MATRIX_CATEGORIES.length;

    return (
      <section className={styles.sectionCard}>
        <div className={styles.gridScroll}>
          <div
            className={styles.gridContainer}
            style={{
              gridTemplateColumns: `122px repeat(${numCategories}, minmax(104px, 1fr))`,
              gridTemplateRows: `auto repeat(${numCategories}, minmax(78px, auto))`,
            }}
          >
            <div className={clsx(styles.cell, styles.cornerCell)} style={{ gridColumn: 1, gridRow: 1 }}>
              <span>Y / X</span>
            </div>

            {RISK_MATRIX_CATEGORIES.map((catX, index) => (
              <button
                key={`header-x-${catX.name}`}
                type="button"
                className={clsx(
                  styles.cell,
                  styles.headerCell,
                  activeCategoryX === catX.name && styles.activeHeaderCell,
                )}
                style={{ gridColumn: index + 2, gridRow: 1 }}
                data-testid={`ce-risk-matrix-header-x-${toTestIdFragment(catX.name)}`}
                aria-pressed={activeCategoryX === catX.name}
                onClick={() => this.handleCategoryXClick(catX.name)}
                onKeyDown={(event) => this.handleKeyActivate(event, () => this.handleCategoryXClick(catX.name))}
              >
                {catX.name}
              </button>
            ))}

            {RISK_MATRIX_CATEGORIES.map((catY, rowIndex) => (
              <React.Fragment key={`row-${catY.name}`}>
                <button
                  type="button"
                  className={clsx(
                    styles.cell,
                    styles.headerCell,
                    activeCategoryY === catY.name && styles.activeHeaderCell,
                  )}
                  style={{ gridColumn: 1, gridRow: rowIndex + 2 }}
                  data-testid={`ce-risk-matrix-header-y-${toTestIdFragment(catY.name)}`}
                  aria-pressed={activeCategoryY === catY.name}
                  onClick={() => this.handleCategoryYClick(catY.name)}
                  onKeyDown={(event) => this.handleKeyActivate(event, () => this.handleCategoryYClick(catY.name))}
                >
                  {catY.name}
                </button>

                {RISK_MATRIX_CATEGORIES.map((catX, colIndex) => {
                  const isDiagonal = rowIndex === colIndex;
                  const cellValue = isDiagonal ? 0 : this.getCellValue(catY.name, catX.name);
                  const selectedCellId = `${catX.name}_vs_${catY.name}`;
                  const hasValue = cellValue !== 0;
                  const atlasScenarioCount = isDiagonal ? 0 : getRiskMatrixAtlasScenarioCountForCell(selectedCellId);
                  const isHovered = rowIndex === hoveredRowIndex && colIndex === hoveredColIndex;
                  const isHighlighted = !isDiagonal && (catY.name === activeCategoryY || catX.name === activeCategoryX);

                  if (isDiagonal) {
                    return (
                      <div
                        key={`cell-${rowIndex}-${colIndex}`}
                        className={clsx(styles.cell, styles.diagonalCell)}
                        style={{ gridColumn: colIndex + 2, gridRow: rowIndex + 2 }}
                      >
                        &bull;
                      </div>
                    );
                  }

                  return (
                    <button
                      key={`cell-${rowIndex}-${colIndex}`}
                      type="button"
                      className={clsx(
                        styles.cell,
                        styles.gridCell,
                        !hasValue && styles.emptyCell,
                        atlasScenarioCount > 0 && styles.gridCellLinked,
                        isHighlighted && styles.highlighted,
                        isHovered && hasValue && styles.popOutEffect,
                      )}
                      style={{
                        gridColumn: colIndex + 2,
                        gridRow: rowIndex + 2,
                        backgroundColor: this.getColorByValue(cellValue),
                      }}
                      data-testid={`ce-risk-matrix-cell-${toTestIdFragment(catX.name)}-vs-${toTestIdFragment(catY.name)}`}
                      aria-label={this.getCellAriaLabel(catX.name, catY.name, cellValue)}
                      onMouseEnter={() => this.handleCellMouseEnter(rowIndex, colIndex)}
                      onMouseLeave={this.handleCellMouseLeave}
                      onFocus={() => this.handleCellMouseEnter(rowIndex, colIndex)}
                      onBlur={this.handleCellMouseLeave}
                      onClick={() => this.handleCellClick(catY.name, catX.name)}
                    >
                      {hasValue && <span className={styles.cellValue}>{formatRiskMatrixValue(cellValue)}</span>}
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>
    );
  };

  renderSubcategorySelectors = () => {
    const { activeCategoryX, activeCategoryY, activeSubcategoryX, activeSubcategoryY } = this.state;

    const categoryX = RISK_MATRIX_CATEGORIES.find((cat) => cat.name === activeCategoryX);
    const categoryY = RISK_MATRIX_CATEGORIES.find((cat) => cat.name === activeCategoryY);

    if (!categoryX || !categoryY) return null;

    return (
      <div className={styles.selectorGrid}>
        <div className={styles.selectorPanel}>
          <h4 className={styles.selectorTitle}>{activeCategoryX}</h4>

          <div className={styles.selectorButtonRow}>
            {categoryX.subcategories.map((sub) => (
              <button
                key={`selector-x-${sub}`}
                type="button"
                className={clsx(styles.selectorButton, activeSubcategoryX === sub && styles.selectorButtonActive)}
                data-testid={`ce-risk-matrix-selector-x-${toTestIdFragment(sub)}`}
                aria-pressed={activeSubcategoryX === sub}
                onClick={() => this.handleSubcategoryXClick(sub)}
              >
                {sub}
              </button>
            ))}

            <button
              type="button"
              className={clsx(styles.selectorButton, styles.selectorButtonClear)}
              data-testid="ce-risk-matrix-selector-x-clear"
              onClick={() => this.handleSubcategoryXClick(null)}
              disabled={!activeSubcategoryX}
            >
              Clear X
            </button>
          </div>
        </div>

        <div className={styles.selectorPanel}>
          <h4 className={styles.selectorTitle}>{activeCategoryY}</h4>

          <div className={styles.selectorButtonRow}>
            {categoryY.subcategories.map((sub) => (
              <button
                key={`selector-y-${sub}`}
                type="button"
                className={clsx(styles.selectorButton, activeSubcategoryY === sub && styles.selectorButtonActive)}
                data-testid={`ce-risk-matrix-selector-y-${toTestIdFragment(sub)}`}
                aria-pressed={activeSubcategoryY === sub}
                onClick={() => this.handleSubcategoryYClick(sub)}
              >
                {sub}
              </button>
            ))}

            <button
              type="button"
              className={clsx(styles.selectorButton, styles.selectorButtonClear)}
              data-testid="ce-risk-matrix-selector-y-clear"
              onClick={() => this.handleSubcategoryYClick(null)}
              disabled={!activeSubcategoryY}
            >
              Clear Y
            </button>
          </div>
        </div>
      </div>
    );
  };

  renderSubGrid = () => {
    const {
      activeCategoryX,
      activeCategoryY,
      activeSubcategoryX,
      activeSubcategoryY,
      hoveredSubColIndex,
      hoveredSubRowIndex,
    } = this.state;

    const categoryX = RISK_MATRIX_CATEGORIES.find((cat) => cat.name === activeCategoryX);
    const categoryY = RISK_MATRIX_CATEGORIES.find((cat) => cat.name === activeCategoryY);

    if (!categoryX || !categoryY) return null;
    const activeCategoryXKey = activeCategoryX || '';
    const activeCategoryYKey = activeCategoryY || '';

    const subcategoriesX = categoryX.subcategories;
    const subcategoriesY = categoryY.subcategories;
    const numSubX = subcategoriesX.length;
    const numSubY = subcategoriesY.length;

    return (
      <section className={styles.sectionCard} data-testid="ce-risk-matrix-subgrid">
        <div className={styles.subgridHeader}>
          <h3 className={styles.sectionTitle}>
            {activeCategoryY} x {activeCategoryX}
          </h3>
          <p className={styles.subgridSummary}>
            Refine to sub-overlaps, compare seeded notes, and open the atlas-linked scenarios attached to each detail
            cell.
          </p>
        </div>

        {this.renderSubcategorySelectors()}

        <div className={styles.gridScroll}>
          <div
            className={styles.subgridContainer}
            style={{
              gridTemplateColumns: `minmax(140px, 0.85fr) repeat(${numSubX}, minmax(0, 1fr))`,
              gridTemplateRows: `auto repeat(${numSubY}, minmax(72px, auto))`,
            }}
          >
            <div className={clsx(styles.cell, styles.cornerCell)} style={{ gridColumn: 1, gridRow: 1 }}>
              Detail
            </div>

            {subcategoriesX.map((subX, index) => (
              <button
                key={`subhead-x-${subX}`}
                type="button"
                className={clsx(styles.cell, styles.headerCell, activeSubcategoryX === subX && styles.activeHeaderCell)}
                style={{ gridColumn: index + 2, gridRow: 1 }}
                data-testid={`ce-risk-matrix-subheader-x-${toTestIdFragment(subX)}`}
                aria-pressed={activeSubcategoryX === subX}
                onClick={() => this.handleSubcategoryXClick(subX)}
              >
                {subX}
              </button>
            ))}

            {subcategoriesY.map((subY, rowIndex) => (
              <React.Fragment key={`subrow-${subY}`}>
                <button
                  type="button"
                  className={clsx(
                    styles.cell,
                    styles.headerCell,
                    activeSubcategoryY === subY && styles.activeHeaderCell,
                  )}
                  style={{ gridColumn: 1, gridRow: rowIndex + 2 }}
                  data-testid={`ce-risk-matrix-subheader-y-${toTestIdFragment(subY)}`}
                  aria-pressed={activeSubcategoryY === subY}
                  onClick={() => this.handleSubcategoryYClick(subY)}
                >
                  {subY}
                </button>

                {subcategoriesX.map((subX, colIndex) => {
                  const selectedCellId = `${activeCategoryX}.${subX}.${activeCategoryY}.${subY}`;
                  const cellComments = this.getCommentsForCell(selectedCellId);
                  const cellValue = cellComments.reduce((total, entry) => {
                    const signedValue = (entry.valence === 'risk' ? -1 : 1) * Number(entry.intensity);
                    return total + signedValue;
                  }, 0);
                  const hasValue = cellValue !== 0;
                  const atlasScenarioCount = getRiskMatrixAtlasScenarioCountForCell(selectedCellId);
                  const isHovered = rowIndex === hoveredSubRowIndex && colIndex === hoveredSubColIndex;
                  const isHighlighted = subY === activeSubcategoryY || subX === activeSubcategoryX;

                  return (
                    <button
                      key={`subcell-${rowIndex}-${colIndex}`}
                      type="button"
                      className={clsx(
                        styles.cell,
                        styles.gridCell,
                        !hasValue && styles.emptyCell,
                        atlasScenarioCount > 0 && styles.gridCellLinked,
                        isHighlighted && styles.highlighted,
                        isHovered && hasValue && styles.popOutEffect,
                      )}
                      style={{
                        gridColumn: colIndex + 2,
                        gridRow: rowIndex + 2,
                        backgroundColor: this.getColorByValue(cellValue),
                      }}
                      data-testid={`ce-risk-matrix-subcell-${toTestIdFragment(activeCategoryXKey)}-${toTestIdFragment(subX)}-vs-${toTestIdFragment(activeCategoryYKey)}-${toTestIdFragment(subY)}`}
                      aria-label={this.getSubCellAriaLabel(
                        activeCategoryXKey,
                        subX,
                        activeCategoryYKey,
                        subY,
                        cellValue,
                      )}
                      onMouseEnter={() => this.handleSubCellMouseEnter(rowIndex, colIndex)}
                      onMouseLeave={this.handleSubCellMouseLeave}
                      onFocus={() => this.handleSubCellMouseEnter(rowIndex, colIndex)}
                      onBlur={this.handleSubCellMouseLeave}
                      onClick={() => this.handleSubCellClick(subY, subX)}
                    >
                      {hasValue && <span className={styles.cellValue}>{formatRiskMatrixValue(cellValue)}</span>}
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>
    );
  };

  renderCommentComposer = () => {
    const { comment, intensity, selectedCellId, valence } = this.state;

    if (isAggregateCellId(selectedCellId)) return null;

    return (
      <div className={styles.modalComposer}>
        <div className={styles.modalInputGroup}>
          <label className={styles.modalLabel} htmlFor="risk-matrix-comment-input">
            Comment
          </label>
          <textarea
            id="risk-matrix-comment-input"
            className={styles.commentInput}
            data-testid="ce-risk-matrix-comment-input"
            placeholder="Add a concrete note."
            value={comment}
            onChange={this.handleCommentChange}
            rows={4}
          />
        </div>

        <fieldset className={styles.modalFieldset}>
          <legend className={styles.modalLegend}>Signal type</legend>
          <label className={styles.radioOption} htmlFor="risk-matrix-opportunity">
            <input
              id="risk-matrix-opportunity"
              checked={valence === 'opportunity'}
              name="risk-matrix-valence"
              type="radio"
              value="opportunity"
              onChange={this.handleValenceChange}
            />
            Opportunity
          </label>
          <label className={styles.radioOption} htmlFor="risk-matrix-risk">
            <input
              id="risk-matrix-risk"
              checked={valence === 'risk'}
              name="risk-matrix-valence"
              type="radio"
              value="risk"
              onChange={this.handleValenceChange}
            />
            Risk
          </label>
        </fieldset>

        <div className={styles.modalInputGroup}>
          <label className={styles.modalLabel} htmlFor="risk-matrix-intensity">
            Intensity
            <span className={styles.intensityValue}>{intensity}</span>
          </label>
          <input
            id="risk-matrix-intensity"
            className={styles.intensityInput}
            data-testid="ce-risk-matrix-intensity-input"
            max="10"
            min="1"
            name="intensity"
            step="1"
            type="range"
            value={intensity}
            onChange={this.handleIntensityChange}
          />
        </div>
      </div>
    );
  };

  renderAtlasScenarioCards = (scenarios: RiskMatrixAtlasScenario[]) => {
    if (!Array.isArray(scenarios) || scenarios.length === 0) return null;
    const { onOpenAtlasNode = null } = this.props;

    return (
      <section className={styles.atlasScenarioRail} aria-label="Related atlas scenario visualizations">
        <div className={styles.atlasScenarioGrid}>
          {scenarios.map((scenario) => {
            const atlasHref = buildAtlasNodeRoute(scenario.atlasNodeId, {
              demo: true,
              returnTo: readWindowLocationPath(),
            });
            const atlasLinkLabel = scenario.atlasNodeLabel;
            const atlasLinkAriaLabel = `Open atlas node ${scenario.atlasNodeLabel}`;
            const atlasLinkTestId = `ce-risk-matrix-atlas-link-${toTestIdFragment(scenario.id)}`;

            return (
              <article
                key={scenario.id}
                className={styles.atlasScenarioCard}
                data-testid="ce-risk-matrix-atlas-scenario-card"
              >
                <div className={styles.atlasScenarioContent}>
                  <div className={styles.atlasScenarioHeader}>
                    <div className={styles.atlasScenarioHeaderMain}>
                      {scenario.image ? (
                        <img
                          className={styles.atlasScenarioImage}
                          src={resolveAtlasAssetPath(scenario.image)}
                          alt={scenario.imageAlt || `${scenario.title} visualization`}
                        />
                      ) : (
                        <div className={styles.atlasScenarioImageFallback} aria-hidden="true">
                          <span>{scenario.atlasNodeLabel}</span>
                        </div>
                      )}
                      <div className={styles.atlasScenarioTitleBlock}>
                        <span className={styles.atlasScenarioNodeLabel}>{scenario.atlasNodeLabel}</span>
                        <h4 className={styles.atlasScenarioTitle}>{scenario.title}</h4>
                        <p className={styles.atlasScenarioSummary}>{scenario.summary}</p>
                        <div
                          className={styles.atlasScenarioMetaLine}
                          aria-label={`${scenario.confidence} confidence, ${scenario.timeHorizon}`}
                        >
                          <span className={styles.atlasScenarioMetaPill}>{scenario.confidence} confidence</span>
                          <span className={styles.atlasScenarioMetaPill}>{scenario.timeHorizon}</span>
                        </div>
                      </div>
                    </div>
                    <span
                      className={clsx(
                        styles.atlasScenarioValence,
                        scenario.valence === 'risk' && styles.atlasScenarioValenceRisk,
                        scenario.valence === 'opportunity' && styles.atlasScenarioValenceOpportunity,
                        scenario.valence === 'mixed' && styles.atlasScenarioValenceMixed,
                      )}
                    >
                      {scenario.valence}
                    </span>
                  </div>
                  <div className={styles.atlasScenarioMechanism}>
                    <span>Why it matters</span>
                    <p>{scenario.primaryMechanism}</p>
                  </div>
                  {Array.isArray(scenario.historicalAnchors) && scenario.historicalAnchors.length > 0 && (
                    <div className={styles.atlasScenarioAnchors} aria-label="Historical anchors">
                      {scenario.historicalAnchors.map((anchor) => (
                        <div key={`${scenario.id}-${anchor.name}`} className={styles.atlasScenarioAnchorChip}>
                          <img
                            className={styles.atlasScenarioAnchorAvatar}
                            src={resolveAtlasAssetPath(anchor.avatar)}
                            alt={anchor.name}
                          />
                          <div className={styles.atlasScenarioAnchorCopy}>
                            <span className={styles.atlasScenarioAnchorName}>{anchor.name}</span>
                            {anchor.role && <span className={styles.atlasScenarioAnchorRole}>{anchor.role}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {typeof onOpenAtlasNode === 'function' ? (
                    <button
                      type="button"
                      className={styles.atlasScenarioLink}
                      aria-label={atlasLinkAriaLabel}
                      data-testid={atlasLinkTestId}
                      onClick={() => onOpenAtlasNode(scenario.atlasNodeId, this.getRestoreState())}
                    >
                      <FontAwesomeIcon icon={faNetworkWired} className={styles.atlasScenarioLinkIcon} />
                      <span className={styles.atlasScenarioLinkLabel}>{atlasLinkLabel}</span>
                      <FontAwesomeIcon icon={faExternalLinkAlt} className={styles.atlasScenarioLinkIconTrailing} />
                    </button>
                  ) : (
                    <a
                      className={styles.atlasScenarioLink}
                      aria-label={atlasLinkAriaLabel}
                      data-testid={atlasLinkTestId}
                      href={atlasHref}
                    >
                      <FontAwesomeIcon icon={faNetworkWired} className={styles.atlasScenarioLinkIcon} />
                      <span className={styles.atlasScenarioLinkLabel}>{atlasLinkLabel}</span>
                      <FontAwesomeIcon icon={faExternalLinkAlt} className={styles.atlasScenarioLinkIconTrailing} />
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    );
  };

  renderCommentGroup = (
    title: string,
    entries: RiskCommentRecord[],
    isAggregateSelection: boolean,
    valence: RiskValence,
  ) => {
    if (!Array.isArray(entries) || entries.length === 0) return null;

    const isOpen = this.state.openCommentGroups[valence] !== false;
    const listId = `ce-risk-matrix-comment-list-${valence}`;

    return (
      <section
        className={clsx(
          styles.commentSection,
          valence === 'opportunity' && styles.commentSectionOpportunity,
          valence === 'risk' && styles.commentSectionRisk,
        )}
      >
        <button
          type="button"
          className={styles.commentSectionHeader}
          aria-expanded={isOpen}
          aria-controls={listId}
          onClick={() => this.toggleCommentGroup(valence)}
        >
          <span className={styles.commentSectionHeaderText}>
            <FontAwesomeIcon icon={isOpen ? faCaretUp : faCaretDown} className={styles.commentSectionChevron} />
            <span className={styles.commentSectionTitle}>{title}</span>
          </span>
          <span className={styles.commentSectionCount}>
            {entries.length} note{entries.length === 1 ? '' : 's'}
          </span>
        </button>
        {isOpen && (
          <ul id={listId} className={styles.commentList} data-testid={listId}>
            {entries.map((entry, index) =>
              (() => {
                const figureName = String(entry.historicalFigure?.name || '').trim();
                const figureAvatar = figureName ? getHistoricalFigureAvatarByName(figureName) : '';
                const corpusRefs = Array.isArray(entry.corpusRefs) ? entry.corpusRefs.filter(Boolean) : [];
                const sourceCitations = getRiskMatrixCorpusSourceCitationItems(corpusRefs).slice(0, 2);

                return (
                  <li
                    key={`${title}-${entry.cell}-${index}`}
                    className={clsx(
                      styles.commentItem,
                      entry.valence === 'opportunity' && styles.commentItemOpportunity,
                      entry.valence === 'risk' && styles.commentItemRisk,
                    )}
                  >
                    <div className={styles.commentHeader}>
                      <div className={styles.commentHeaderMain}>
                        <span className={styles.commentEyebrow}>
                          {isAggregateSelection ? 'Sub-overlap' : 'Seeded note'}
                        </span>
                        <h5 className={styles.commentCardTitle}>
                          {isAggregateSelection
                            ? formatCellPath(entry.cell)
                            : entry.valence === 'opportunity'
                              ? 'Opportunity signal'
                              : 'Risk signal'}
                        </h5>
                      </div>
                      <div className={styles.commentHeaderMeta}>
                        <span className={styles.commentIntensity}>Intensity {entry.intensity}</span>
                        <span className={styles.commentBadge}>
                          {entry.valence === 'opportunity' ? 'Opportunity' : 'Risk'}
                        </span>
                      </div>
                    </div>
                    <p className={styles.commentText}>{entry.comment}</p>

                    {figureName && (
                      <div className={styles.commentFigureRow}>
                        {figureAvatar ? (
                          <img className={styles.commentFigureAvatar} src={figureAvatar} alt={figureName} />
                        ) : (
                          <div className={styles.commentFigureAvatarFallback} aria-hidden="true">
                            {figureName.charAt(0)}
                          </div>
                        )}
                        <div className={styles.commentFigureCopy}>
                          <span className={styles.commentFigureName}>{figureName}</span>
                          {entry.historicalFigure?.role && (
                            <span className={styles.commentFigureRole}>{entry.historicalFigure.role}</span>
                          )}
                        </div>
                      </div>
                    )}

                    {sourceCitations.length > 0 && (
                      <div className={styles.commentReferenceLine}>
                        {sourceCitations.length > 1 ? 'Sources: ' : 'Source: '}
                        {sourceCitations.map((citation, citationIndex) => (
                          <React.Fragment key={`${citation.label}-${citation.url || citationIndex}`}>
                            {citationIndex > 0 && <span aria-hidden="true"> • </span>}
                            {citation.url ? (
                              <a
                                className={styles.commentReferenceLink}
                                href={citation.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {citation.label}
                              </a>
                            ) : (
                              <span>{citation.label}</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })(),
            )}
          </ul>
        )}
      </section>
    );
  };

  renderModal = () => {
    const { comment, existingComments, modal, selectedCellId } = this.state;

    const isAggregateSelection = isAggregateCellId(selectedCellId);
    const canSaveComment = !isAggregateSelection && comment.trim().length > 0;
    const modalTitle = formatSelectionTitle(selectedCellId);
    const atlasScenarios = getRiskMatrixAtlasScenariosForCell(selectedCellId) as RiskMatrixAtlasScenario[];
    const commentsLabel = existingComments.length === 1 ? '1 note' : `${existingComments.length} notes`;
    const modalMeta =
      atlasScenarios.length > 0
        ? `${commentsLabel} • ${atlasScenarios.length} linked atlas overlap${atlasScenarios.length === 1 ? '' : 's'}`
        : commentsLabel;
    const opportunityComments = existingComments.filter((entry) => entry.valence === 'opportunity');
    const riskComments = existingComments.filter((entry) => entry.valence === 'risk');

    return (
      <Modal
        isOpen={modal}
        toggle={this.closeModal}
        fade={false}
        size="lg"
        centered
        modalClassName={styles.riskMatrixCommentModal}
        backdropClassName={styles.riskMatrixBackdrop}
        contentClassName={styles.riskMatrixModalContent}
      >
        <div className={styles.riskMatrixModalBody} data-testid="ce-risk-matrix-modal">
          <div className={styles.riskMatrixModalHeader}>
            <div className={styles.modalTitleBlock}>
              <h3 className={styles.modalTitle}>{modalTitle}</h3>
              <span className={styles.modalMeta}>{modalMeta}</span>
            </div>
            <button type="button" className={styles.modalCloseButton} aria-label="Close" onClick={this.closeModal}>
              ×
            </button>
          </div>

          {this.renderAtlasScenarioCards(atlasScenarios)}

          {existingComments.length > 0 ? (
            <div className={styles.commentSections} data-testid="ce-risk-matrix-comment-list">
              {this.renderCommentGroup('Opportunities', opportunityComments, isAggregateSelection, 'opportunity')}
              {this.renderCommentGroup('Risks', riskComments, isAggregateSelection, 'risk')}
            </div>
          ) : (
            <p className={styles.emptyState}>No notes yet.</p>
          )}

          {this.renderCommentComposer()}

          <div className={styles.riskMatrixModalFooter}>
            <button
              type="button"
              className={clsx(styles.modalButton, styles.modalButtonSecondary)}
              onClick={this.closeModal}
            >
              Close
            </button>
            {!isAggregateSelection && (
              <button
                type="button"
                className={clsx(styles.modalButton, styles.modalButtonPrimary)}
                data-testid="ce-risk-matrix-save-comment"
                disabled={!canSaveComment}
                onClick={this.handleSaveComment}
              >
                Save
              </button>
            )}
          </div>
        </div>
      </Modal>
    );
  };

  render() {
    const { activeCategoryX, activeCategoryY } = this.state;
    const { embedded = false } = this.props;

    return (
      <div className={clsx(styles.container, embedded && styles.embedded)} data-testid="ce-risk-matrix">
        <div className={styles.shell}>
          {this.renderMainGrid()}
          {activeCategoryX && activeCategoryY && this.renderSubGrid()}
        </div>

        {this.renderModal()}
      </div>
    );
  }
}

export default RiskMatrix;
