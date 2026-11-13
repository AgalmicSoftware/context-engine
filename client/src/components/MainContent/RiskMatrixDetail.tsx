import { useId, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle, faTimes } from '@fortawesome/free-solid-svg-icons';

import CETooltip from '../Shared/CETooltip';
import styles from './RiskMatrix.module.scss';

type Note = { valence: 'opportunity' | 'risk'; intensity: number };
type Area = { name: string; subcategories: string[] };

type Props = {
  /** The area across the top: each column is one of its sub-sections. */
  columns: Area;
  /** The area down the side: each row is one of its sub-sections. */
  rows: Area;
  highlightedColumn: string | null;
  highlightedRow: string | null;
  demo: boolean;
  notesFor: (cellId: string) => Note[];
  atlasCountFor: (cellId: string) => number;
  cellLabel: (subX: string, subY: string, value: number, notes: number) => string;
  onHighlightColumn: (sub: string | null) => void;
  onHighlightRow: (sub: string | null) => void;
  onOpenCell: (subY: string, subX: string) => void;
};

const clsx = (...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(' ');
const testIdFragment = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
const balanceOf = (notes: Note[]) =>
  notes.reduce((total, note) => total + (note.valence === 'risk' ? -1 : 1) * Number(note.intensity), 0);

// The number carries its own direction (an arrow and a sign), so colour is never the only cue.
export const formatRiskBalance = (value: number) =>
  value > 0 ? `▲ +${value}` : value < 0 ? `▼ -${Math.abs(value)}` : '±0';

const fillFor = (value: number, max: number) => {
  if (value === 0) return undefined;
  const share = 35 + Math.min(Math.abs(value) / max, 1) * 55;
  const color =
    value > 0
      ? 'var(--ce-risk-opportunity-color, var(--ce-status-success))'
      : 'var(--ce-risk-danger-color, var(--ce-status-danger))';
  return `color-mix(in srgb, ${color} ${share}%, transparent)`;
};

/** Where one area's sub-sections meet another's, for the cell picked in the main matrix. */
export default function RiskMatrixDetail(props: Props) {
  const { columns, rows, highlightedColumn, highlightedRow, demo } = props;
  const helpId = `risk-matrix-detail-help-${useId().replace(/:/g, '')}`;
  const gridRef = useRef<HTMLDivElement>(null);
  const cells = rows.subcategories.map((subY) =>
    columns.subcategories.map((subX) => {
      const cellId = `${columns.name}.${subX}.${rows.name}.${subY}`;
      const notes = props.notesFor(cellId);
      return { subX, subY, cellId, notes, value: balanceOf(notes) };
    }),
  );
  const max = Math.max(6, ...cells.flat().map(({ value }) => Math.abs(value)));
  const highlighted = [highlightedColumn, highlightedRow].filter(Boolean).join(', ');
  const heading = (sub: string, axis: 'column' | 'row') => {
    const on = (axis === 'column' ? highlightedColumn : highlightedRow) === sub;
    const toggle = axis === 'column' ? props.onHighlightColumn : props.onHighlightRow;
    return (
      <button
        key={`${axis}-${sub}`}
        type="button"
        className={clsx(styles.cell, styles.headerCell, styles.detailHeading, on && styles.activeHeaderCell)}
        data-testid={`ce-risk-matrix-subheader-${axis === 'column' ? 'x' : 'y'}-${testIdFragment(sub)}`}
        data-ce-control-appearance="frameless"
        aria-pressed={on}
        title={on ? `Stop highlighting this ${axis}` : `Highlight this ${axis}`}
        onClick={() => toggle(sub)}
      >
        {on ? (
          <span className={styles.detailTick} aria-hidden="true">
            ✓
          </span>
        ) : null}
        {sub}
      </button>
    );
  };

  return (
    <section className={styles.sectionCard} data-testid="ce-risk-matrix-subgrid">
      <div className={styles.subgridHeader}>
        <h3 className={styles.sectionTitle}>
          {rows.name} x {columns.name}
        </h3>
        <p className={styles.subgridSummary}>
          {demo ? 'Open a square for its notes and linked atlas scenarios.' : 'Open a square to read its notes.'}{' '}
          <button
            type="button"
            id={helpId}
            className={styles.detailHelp}
            aria-label="How to read this grid"
            onClick={(event) => event.currentTarget.focus()}
          >
            <FontAwesomeIcon icon={faQuestionCircle} />
          </button>
        </p>
        <CETooltip target={helpId} placement="bottom" trigger="hover focus" autohide={false}>
          Each column is a sub-section of {columns.name}; each row, a sub-section of {rows.name}. A square holds the
          notes on where the two meet. Each note is an opportunity or a risk at an intensity from 1 to 10; the number
          adds the opportunities and subtracts the risks. Pick a heading to highlight its column or row.
        </CETooltip>
      </div>

      <ul className={styles.detailLegend} aria-label="Key">
        <li>
          <span className={clsx(styles.detailSwatch, styles.detailSwatchOpportunity)} aria-hidden="true" />
          <strong>▲ +</strong> More opportunity
        </li>
        <li>
          <span className={clsx(styles.detailSwatch, styles.detailSwatchRisk)} aria-hidden="true" />
          <strong>▼ -</strong> More risk
        </li>
        <li>
          <span className={clsx(styles.detailSwatch, styles.detailSwatchEmpty)} aria-hidden="true" />
          No notes
        </li>
      </ul>

      {/* The live region stays mounted so a screen reader announces each change. */}
      <div className={highlighted ? styles.detailHighlight : undefined}>
        <span role="status">{highlighted ? `Highlighted: ${highlighted}` : ''}</span>
        {highlighted ? (
          <button
            type="button"
            className={styles.detailClear}
            data-ce-control-appearance="frameless"
            data-testid="ce-risk-matrix-clear-highlight"
            onClick={() => {
              props.onHighlightColumn(null);
              props.onHighlightRow(null);
              // The button goes with the highlight, so keep the keyboard in the grid.
              gridRef.current?.querySelector<HTMLButtonElement>('button[aria-pressed]')?.focus();
            }}
          >
            <FontAwesomeIcon icon={faTimes} aria-hidden="true" /> Clear highlight
          </button>
        ) : null}
      </div>

      <div className={styles.gridScroll}>
        <div
          ref={gridRef}
          className={clsx(styles.subgridContainer, styles.detailGrid)}
          style={{
            gridTemplateColumns: `minmax(112px, 0.9fr) repeat(${columns.subcategories.length}, minmax(96px, 1fr))`,
          }}
        >
          <div aria-hidden="true" style={{ gridColumn: 1, gridRow: 1 }} />
          <div
            className={styles.detailAxis}
            style={{ gridColumn: `2 / span ${columns.subcategories.length}`, gridRow: 1 }}
          >
            Columns: {columns.name}
          </div>
          <div className={clsx(styles.detailAxis, styles.detailAxisRows)} style={{ gridColumn: 1, gridRow: 2 }}>
            Rows: {rows.name}
          </div>
          {columns.subcategories.map((subX) => heading(subX, 'column'))}
          {cells.map((row, rowIndex) => [
            heading(rows.subcategories[rowIndex], 'row'),
            ...row.map(({ subX, subY, cellId, notes, value }) => {
              const linked = demo && props.atlasCountFor(cellId) > 0;
              return (
                <button
                  key={cellId}
                  type="button"
                  className={clsx(
                    styles.cell,
                    styles.gridCell,
                    styles.detailCell,
                    notes.length === 0 && styles.detailCellEmpty,
                    linked && styles.gridCellLinked,
                    (subX === highlightedColumn || subY === highlightedRow) && styles.detailCellHighlighted,
                  )}
                  data-ce-control-appearance="frameless"
                  style={{ backgroundColor: fillFor(value, max) }}
                  data-testid={`ce-risk-matrix-subcell-${testIdFragment(columns.name)}-${testIdFragment(subX)}-vs-${testIdFragment(rows.name)}-${testIdFragment(subY)}`}
                  aria-label={props.cellLabel(subX, subY, value, notes.length)}
                  onClick={() => props.onOpenCell(subY, subX)}
                >
                  {notes.length ? (
                    <>
                      <span className={styles.cellValue}>{formatRiskBalance(value)}</span>
                      <span className={styles.detailNoteCount}>
                        {notes.length === 1 ? '1 note' : `${notes.length} notes`}
                      </span>
                    </>
                  ) : (
                    <span className={styles.detailEmptyLabel}>No notes</span>
                  )}
                </button>
              );
            }),
          ])}
        </div>
      </div>
    </section>
  );
}
