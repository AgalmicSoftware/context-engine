/** @file ParticipantsGraphControls.tsx: the Participants Graph's title-line controls: Clusters, and a gear for the rest. */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog } from '@fortawesome/free-solid-svg-icons';
import styles from './PolisReport.module.scss';

export type GraphToggle = { label: string; checked: boolean; onChange: () => void };

type ParticipantsGraphControlsProps = {
  /** The number in the box: the person's own count, or the automatic one. */
  clusterCount: string;
  /** True while the count is the automatic one, which is how every report opens. */
  clustersAutomatic: boolean;
  onClusterStep: (delta: number) => void;
  onClusterChange: (value: string) => void;
  onClusterBlur: () => void;
  projection: string;
  projections: Array<{ value: string; label: string }>;
  onProjectionChange: (value: string) => void;
  /** The "?" beside Projection. */
  projectionHelp?: ReactNode;
  toggles: GraphToggle[];
  /** Back to how the graph opens: automatic clusters, the first projection, the usual layers. */
  onReset: () => void;
};

const ParticipantsGraphControls = ({
  clusterCount,
  clustersAutomatic,
  onClusterStep,
  onClusterChange,
  onClusterBlur,
  projection,
  projections,
  onProjectionChange,
  projectionHelp = null,
  toggles,
  onReset,
}: ParticipantsGraphControlsProps) => {
  const [open, setOpen] = useState(false);
  const controlsRef = useRef<HTMLDivElement | null>(null);
  const panelId = `graph-settings-${useId().replace(/:/g, '')}`;

  // The settings close on Escape or a press anywhere else, as a menu does.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onPress = (event: MouseEvent) => {
      if (!controlsRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPress);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPress);
    };
  }, [open]);

  return (
    // The title line itself shows and hides the section; presses on these controls must not.
    <div
      className={`${styles.graphTitleControls} ${styles.pdfIgnore}`}
      ref={controlsRef}
      onClick={(event) => event.stopPropagation()}
    >
      <label htmlFor="cluster-count-input" className={styles.graphClustersLabel}>
        Clusters
      </label>
      <div className={styles.numberInputWrapper}>
        <button
          type="button"
          className={styles.stepperButton}
          onClick={() => onClusterStep(-1)}
          aria-label="Decrease cluster count"
        >
          -
        </button>
        <input
          id="cluster-count-input"
          type="number"
          value={clusterCount}
          onChange={(event) => onClusterChange(event.target.value)}
          onBlur={onClusterBlur}
          className={styles.clusterNumberInput}
          title={clustersAutomatic ? 'Chosen automatically' : 'Set by you; Reset in the settings returns to automatic'}
          min="2"
        />
        <button
          type="button"
          className={styles.stepperButton}
          onClick={() => onClusterStep(1)}
          aria-label="Increase cluster count"
        >
          +
        </button>
      </div>
      <button
        type="button"
        className={styles.graphSettingsButton}
        aria-label="Graph settings"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        <FontAwesomeIcon icon={faCog} />
      </button>
      {/* Kept in the page while closed, so the gear's aria-controls always has its target. */}
      <div id={panelId} role="group" aria-label="Graph settings" className={styles.graphSettingsPanel} hidden={!open}>
        <p className={styles.graphSettingsTitle}>Graph settings</p>
        <div className={styles.graphSettingsRow}>
          <label htmlFor="embedding-choice-select">
            Projection
            {projectionHelp}
          </label>
          <select
            id="embedding-choice-select"
            value={projection}
            onChange={(event) => onProjectionChange(event.target.value)}
          >
            {projections.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <fieldset className={styles.graphSettingsShow}>
          <legend>Show</legend>
          {toggles.map(({ label, checked, onChange }) => (
            <label key={label}>
              <input type="checkbox" checked={checked} onChange={onChange} />
              {label}
            </label>
          ))}
        </fieldset>
        <p className={styles.graphSettingsNote} role="status">
          {clustersAutomatic
            ? 'The number of clusters is chosen automatically.'
            : `You set ${clusterCount} clusters. Reset returns to the automatic number.`}
        </p>
        <button type="button" className={styles.graphSettingsReset} onClick={onReset}>
          Reset
        </button>
      </div>
    </div>
  );
};

export default ParticipantsGraphControls;
