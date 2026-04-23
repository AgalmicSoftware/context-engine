/** @file RiskMatrix.tsx */

import React, { Component } from 'react';
import { Modal } from 'reactstrap';

import seedComments from './riskMatrixTestData.json';
import styles from './RiskMatrix.module.scss';

type RiskValence = 'opportunity' | 'risk';

type RiskCommentRecord = {
  cell: string;
  comment: string;
  valence: RiskValence;
  intensity: number;
};

type RiskCategory = {
  name: string;
  subcategories: string[];
};

type RiskMatrixProps = {
  embedded?: boolean;
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

const toTestIdFragment = (value = '') => String(value)
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
  ? seedComments.filter(isValidCommentRecord).map(normalizeCommentRecord)
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

class RiskMatrix extends Component<RiskMatrixProps, RiskMatrixState> {
  constructor(props: RiskMatrixProps) {
    super(props);

    this.state = {
      comments: INITIAL_COMMENTS,
      modal: false,
      selectedCellId: '',
      existingComments: [],
      valence: DEFAULT_VALENCE,
      comment: '',
      intensity: DEFAULT_INTENSITY,
      heatmap: buildHeatmapFromComments(INITIAL_COMMENTS),
      activeCategoryX: null,
      activeCategoryY: null,
      activeSubcategoryX: null,
      activeSubcategoryY: null,
      hoveredRowIndex: null,
      hoveredColIndex: null,
      hoveredSubRowIndex: null,
      hoveredSubColIndex: null,
    };
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

  getCellValue = (catY: string, catX: string) => this.state.heatmap[`${catY}_${catX}`] || 0;

  getCommentsForCell = (
    cellId: string,
    comments: RiskCommentRecord[] = this.state.comments
  ): RiskCommentRecord[] => {
    if (typeof cellId !== 'string' || !cellId) return [];

    if (isAggregateCellId(cellId)) {
      const [catX, catY] = cellId.split('_vs_');
      if (!catX || !catY) return [];

      return comments.filter(
        (entry) => isCanonicalCellId(entry.cell)
          && entry.cell.startsWith(`${catX}.`)
          && entry.cell.includes(`.${catY}.`)
      );
    }

    return comments.filter((entry) => entry.cell === cellId);
  };

  getHeatmapMaxMagnitude = () => Math.max(
    6,
    ...Object.values(this.state.heatmap).map((value) => Math.abs(value))
  );

  getCurrentViewLabel = () => {
    const { activeCategoryX, activeCategoryY } = this.state;

    if (activeCategoryX && activeCategoryY) {
      return `${activeCategoryY} x ${activeCategoryX}`;
    }

    if (activeCategoryX) return `Column focus: ${activeCategoryX}`;
    if (activeCategoryY) return `Row focus: ${activeCategoryY}`;
    return 'Matrix overview';
  };

  getCellAriaLabel = (catX: string, catY: string, value: number) => {
    if (value === 0) {
      return `${catX} versus ${catY}, no seeded signal yet. Open aggregated notes.`;
    }

    const leaning = value > 0 ? 'opportunity' : 'risk';
    return `${catX} versus ${catY}, ${leaning} balance ${formatRiskMatrixValue(value)}. Open aggregated notes.`;
  };

  getSubCellAriaLabel = (
    catX: string,
    subX: string,
    catY: string,
    subY: string,
    value: number
  ) => {
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
    const {
      comment,
      intensity,
      selectedCellId,
      valence,
    } = this.state;

    if (isAggregateCellId(selectedCellId)) return;

    const trimmedComment = comment.trim();
    if (!selectedCellId || !trimmedComment) return;

    const newComment = {
      cell: selectedCellId,
      comment: trimmedComment,
      valence,
      intensity: Number(intensity),
    };

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
  handleCommentChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => this.setState({ comment: event.target.value });
  handleIntensityChange = (event: React.ChangeEvent<HTMLInputElement>) => this.setState({ intensity: Number(event.target.value) });

  handleCellMouseEnter = (rowIndex: number, colIndex: number) => this.setState({
    hoveredRowIndex: rowIndex,
    hoveredColIndex: colIndex,
  });

  handleCellMouseLeave = () => this.setState({
    hoveredRowIndex: null,
    hoveredColIndex: null,
  });

  handleSubCellMouseEnter = (rowIndex: number, colIndex: number) => this.setState({
    hoveredSubRowIndex: rowIndex,
    hoveredSubColIndex: colIndex,
  });

  handleSubCellMouseLeave = () => this.setState({
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

  renderTopBar = () => {
    const { activeCategoryX, activeCategoryY } = this.state;
    const showViewChip = activeCategoryX || activeCategoryY;

    return (
      <div className={styles.topBar}>
        <h2 className={styles.title}>Risk Matrix</h2>
        <div className={styles.topBarMeta}>
          <span
            className={clsx(styles.legendPill, styles.legendPillOpportunity)}
            data-testid="ce-risk-matrix-legend-opportunity"
          >
            Opportunity signal
          </span>
          <span
            className={clsx(styles.legendPill, styles.legendPillRisk)}
            data-testid="ce-risk-matrix-legend-risk"
          >
            Risk signal
          </span>
          {showViewChip && (
            <span className={styles.viewChip}>{this.getCurrentViewLabel()}</span>
          )}
        </div>
      </div>
    );
  };

  renderMainGrid = () => {
    const {
      activeCategoryX,
      activeCategoryY,
      hoveredColIndex,
      hoveredRowIndex,
    } = this.state;
    const numCategories = RISK_MATRIX_CATEGORIES.length;

    return (
      <section className={styles.sectionCard}>
        <div className={styles.gridScroll}>
          <div
            className={styles.gridContainer}
            style={{
              gridTemplateColumns: `110px repeat(${numCategories}, minmax(88px, 1fr))`,
              gridTemplateRows: `auto repeat(${numCategories}, minmax(72px, auto))`,
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
                  activeCategoryX === catX.name && styles.activeHeaderCell
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
                    activeCategoryY === catY.name && styles.activeHeaderCell
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
                  const hasValue = cellValue !== 0;
                  const isHovered = rowIndex === hoveredRowIndex && colIndex === hoveredColIndex;
                  const isHighlighted = !isDiagonal && (
                    catY.name === activeCategoryY || catX.name === activeCategoryX
                  );

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
                        isHighlighted && styles.highlighted,
                        isHovered && hasValue && styles.popOutEffect
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
                      {hasValue && (
                        <span className={styles.cellValue}>{formatRiskMatrixValue(cellValue)}</span>
                      )}
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
    const {
      activeCategoryX,
      activeCategoryY,
      activeSubcategoryX,
      activeSubcategoryY,
    } = this.state;

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
                className={clsx(
                  styles.selectorButton,
                  activeSubcategoryX === sub && styles.selectorButtonActive
                )}
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
                className={clsx(
                  styles.selectorButton,
                  activeSubcategoryY === sub && styles.selectorButtonActive
                )}
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

    const getSubCellValue = (subY: string, subX: string) => {
      const cellId = `${activeCategoryX}.${subX}.${activeCategoryY}.${subY}`;
      const comments = this.getCommentsForCell(cellId);

      return comments.reduce((total, entry) => {
        const signedValue = (entry.valence === 'risk' ? -1 : 1) * Number(entry.intensity);
        return total + signedValue;
      }, 0);
    };

    return (
      <section className={styles.sectionCard} data-testid="ce-risk-matrix-subgrid">
        <div className={styles.subgridHeader}>
          <h3 className={styles.sectionTitle}>{activeCategoryY} x {activeCategoryX}</h3>
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
                className={clsx(
                  styles.cell,
                  styles.headerCell,
                  activeSubcategoryX === subX && styles.activeHeaderCell
                )}
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
                    activeSubcategoryY === subY && styles.activeHeaderCell
                  )}
                  style={{ gridColumn: 1, gridRow: rowIndex + 2 }}
                  data-testid={`ce-risk-matrix-subheader-y-${toTestIdFragment(subY)}`}
                  aria-pressed={activeSubcategoryY === subY}
                  onClick={() => this.handleSubcategoryYClick(subY)}
                >
                  {subY}
                </button>

                {subcategoriesX.map((subX, colIndex) => {
                  const cellValue = getSubCellValue(subY, subX);
                  const hasValue = cellValue !== 0;
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
                        isHighlighted && styles.highlighted,
                        isHovered && hasValue && styles.popOutEffect
                      )}
                      style={{
                        gridColumn: colIndex + 2,
                        gridRow: rowIndex + 2,
                        backgroundColor: this.getColorByValue(cellValue),
                      }}
                      data-testid={`ce-risk-matrix-subcell-${toTestIdFragment(activeCategoryXKey)}-${toTestIdFragment(subX)}-vs-${toTestIdFragment(activeCategoryYKey)}-${toTestIdFragment(subY)}`}
                      aria-label={this.getSubCellAriaLabel(activeCategoryXKey, subX, activeCategoryYKey, subY, cellValue)}
                      onMouseEnter={() => this.handleSubCellMouseEnter(rowIndex, colIndex)}
                      onMouseLeave={this.handleSubCellMouseLeave}
                      onFocus={() => this.handleSubCellMouseEnter(rowIndex, colIndex)}
                      onBlur={this.handleSubCellMouseLeave}
                      onClick={() => this.handleSubCellClick(subY, subX)}
                    >
                      {hasValue && (
                        <span className={styles.cellValue}>{formatRiskMatrixValue(cellValue)}</span>
                      )}
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
    const {
      comment,
      intensity,
      selectedCellId,
      valence,
    } = this.state;

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

  renderModal = () => {
    const {
      comment,
      existingComments,
      modal,
      selectedCellId,
    } = this.state;

    const isAggregateSelection = isAggregateCellId(selectedCellId);
    const canSaveComment = !isAggregateSelection && comment.trim().length > 0;
    const modalTitle = formatSelectionTitle(selectedCellId);
    const commentsLabel = existingComments.length === 1 ? '1 note' : `${existingComments.length} notes`;

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
              <span className={styles.modalMeta}>{commentsLabel}</span>
            </div>
            <button
              type="button"
              className={styles.modalCloseButton}
              aria-label="Close"
              onClick={this.closeModal}
            >
              ×
            </button>
          </div>

          {existingComments.length > 0 ? (
            <ul className={styles.commentList} data-testid="ce-risk-matrix-comment-list">
              {existingComments.map((entry, index) => (
                <li
                  key={`${entry.cell}-${index}`}
                  className={clsx(
                    styles.commentItem,
                    entry.valence === 'opportunity' && styles.commentItemOpportunity,
                    entry.valence === 'risk' && styles.commentItemRisk
                  )}
                >
                  <div className={styles.commentHeader}>
                    <span className={styles.commentBadge}>
                      {entry.valence === 'opportunity' ? 'Opportunity' : 'Risk'}
                    </span>
                    <span className={styles.commentIntensity}>Intensity {entry.intensity}</span>
                  </div>
                  <p className={styles.commentText}>{entry.comment}</p>
                  {isAggregateSelection && (
                    <p className={styles.commentPath}>{formatCellPath(entry.cell)}</p>
                  )}
                </li>
              ))}
            </ul>
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
      <div
        className={clsx(styles.container, embedded && styles.embedded)}
        data-testid="ce-risk-matrix"
      >
        <div className={styles.shell}>
          {this.renderTopBar()}
          {this.renderMainGrid()}
          {activeCategoryX && activeCategoryY && this.renderSubGrid()}
        </div>

        {this.renderModal()}
      </div>
    );
  }
}

export default RiskMatrix;
