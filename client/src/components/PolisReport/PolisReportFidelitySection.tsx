import React, { useId, useMemo, useState } from 'react';
import { UncontrolledTooltip } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp, faQuestionCircle } from '@fortawesome/free-solid-svg-icons';

import {
  collectSessionFidelityData,
  resultsResponseRows,
  scoreFidelityOverview,
  type FidelityCalibration,
  type FidelityCalibrationBin,
  type FidelityEstimate,
} from '../../../../shared/agentFidelity.mjs';
import { normalizeInterviewSettings } from '../../../../shared/interviewSettings.mjs';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import PolisReportSectionToggleLabel from './PolisReportSectionToggleLabel';
import styles from './PolisReportFidelitySection.module.scss';
import reportStyles from './PolisReport.module.scss';

// The page reruns this whenever its data changes, so it draws fewer bootstrap
// samples than the command-line report's 1000; the intervals are a little rougher.
const BOOTSTRAP_SAMPLES = 200;
const PLATFORM_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  other: 'Other',
  unknown: 'Not stated',
};
const SERIES = [
  { condition: 'shown', label: 'Drafts shown' },
  { condition: 'blind', label: 'Drafts hidden' },
] as const;

const whole = (value: number): number => Math.round(value * 100);
const percent = (value: number | null | undefined): string =>
  typeof value === 'number' && Number.isFinite(value) ? `${whole(value)}%` : '–';
const percentRange = (interval: [number, number] | null | undefined, unit = '%'): string =>
  interval ? `${whole(interval[0])}–${whole(interval[1])}${unit}` : '–';

type HelpProps = { id: string; label: string; children: string };

// A "?" with the explanation in a tooltip; screen readers get it from the hidden copy.
function Help({ id, label, children }: HelpProps) {
  return (
    <>
      <button
        type="button"
        id={`${id}-help`}
        className={styles.help}
        data-ce-control-appearance="frameless"
        aria-label={label}
        aria-describedby={`${id}-about`}
      >
        <FontAwesomeIcon icon={faQuestionCircle} />
      </button>
      <span id={`${id}-about`} hidden>
        {children}
      </span>
      <UncontrolledTooltip target={`${id}-help`} placement="top" trigger="hover focus" autohide={false}>
        {children}
      </UncontrolledTooltip>
    </>
  );
}

type TileProps = {
  id: string;
  label: string;
  help: string;
  estimate: FidelityEstimate;
  detail: string;
  minimum: number;
};

function Tile({ id, label, help, estimate, detail, minimum }: TileProps) {
  return (
    <div className={styles.tile} role="group" aria-labelledby={`${id}-label`}>
      <div className={styles.tileLabel}>
        <span id={`${id}-label`}>{label}</span>
        <Help id={id} label={`About ${label}`}>
          {help}
        </Help>
      </div>
      {estimate.suppressed ? (
        <p className={styles.withheld}>Fewer than {minimum} people</p>
      ) : (
        <>
          <p className={styles.value}>{percent(estimate.value)}</p>
          <p className={styles.detail}>95% interval {percentRange(estimate.interval)}</p>
        </>
      )}
      <p className={styles.detail}>{detail}</p>
    </div>
  );
}

type ChartSeries = { condition: string; label: string; bins: FidelityCalibrationBin[] };

// Plot area inside a 260 by 240 view box, with room for the axis labels.
const LEFT = 48;
const TOP = 12;
const SIDE = 196;
const x = (value: number) => LEFT + value * SIDE;
const y = (value: number) => TOP + (1 - value) * SIDE;

function CalibrationChart({ series }: { series: ChartSeries[] }) {
  const most = Math.max(...series.flatMap(({ bins }) => bins.map((bin) => bin.predictions)));
  return (
    <svg className={styles.chart} viewBox="0 0 260 240" role="img" aria-labelledby="ce-results-fidelity-chart-title">
      <title id="ce-results-fidelity-chart-title">
        Stated confidence against the share of answers people kept; the dashed line is where they are equal.
      </title>
      <rect className={styles.chartFrame} x={LEFT} y={TOP} width={SIDE} height={SIDE} />
      <line className={styles.chartDiagonal} x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} />
      {[0, 0.5, 1].map((tick) => (
        <React.Fragment key={tick}>
          <text className={styles.chartTick} x={x(tick)} y={TOP + SIDE + 14} textAnchor="middle">
            {percent(tick)}
          </text>
          <text className={styles.chartTick} x={LEFT - 6} y={y(tick) + 4} textAnchor="end">
            {percent(tick)}
          </text>
        </React.Fragment>
      ))}
      <text className={styles.chartAxis} x={LEFT + SIDE / 2} y={238} textAnchor="middle">
        Stated confidence
      </text>
      <text className={styles.chartAxis} x={-(TOP + SIDE / 2)} y={12} transform="rotate(-90)" textAnchor="middle">
        Kept unchanged
      </text>
      {series.map(({ condition, bins }) => (
        <g key={condition} className={styles[`series-${condition}`]}>
          <polyline
            className={styles.chartLine}
            points={bins.map((bin) => `${x(bin.meanConfidence)},${y(bin.keepRate)}`).join(' ')}
          />
          {bins.map((bin) => (
            <circle
              key={bin.from}
              className={styles.chartPoint}
              cx={x(bin.meanConfidence)}
              cy={y(bin.keepRate)}
              r={3 + 4 * Math.sqrt(bin.predictions / most)}
            />
          ))}
        </g>
      ))}
    </svg>
  );
}

type CalibrationProps = { calibration: Partial<Record<string, FidelityCalibration>>; minimum: number };

function Calibration({ calibration, minimum }: CalibrationProps) {
  const present = SERIES.flatMap(({ condition, label }) => {
    const result = calibration[condition];
    return result ? [{ condition, label, result }] : [];
  });
  if (!present.length) return <p className={styles.detail}>No draft stated a confidence to check yet.</p>;
  const charted = present.flatMap(({ condition, label, result }) =>
    result.suppressed ? [] : [{ condition, label, bins: result.bins }],
  );
  return (
    <>
      {charted.length ? <CalibrationChart series={charted} /> : null}
      <ul className={styles.calibrationList}>
        {present.map(({ condition, label, result }) => (
          <li key={condition}>
            {charted.length > 1 ? (
              <span className={`${styles.legendMark} ${styles[`series-${condition}`]}`} aria-hidden="true" />
            ) : null}
            <strong>{label}:</strong>{' '}
            {result.suppressed
              ? `withheld, fewer than ${minimum} people`
              : `off by ${whole(result.expectedCalibrationError)} points on average (95% interval ${percentRange(result.errorInterval, '')}), ${result.predictions} answers from ${result.participants} people`}
          </li>
        ))}
      </ul>
      {charted.length ? (
        <details className={styles.numbers}>
          <summary>Numbers</summary>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Drafts</th>
                <th scope="col">Stated confidence</th>
                <th scope="col">Kept unchanged</th>
                <th scope="col">Answers</th>
              </tr>
            </thead>
            <tbody>
              {charted.flatMap(({ condition, label, bins }) =>
                bins.map((bin) => (
                  <tr key={`${condition}-${bin.from}`}>
                    <td>{label}</td>
                    <td>{percent(bin.meanConfidence)}</td>
                    <td>{percent(bin.keepRate)}</td>
                    <td>{bin.predictions}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </details>
      ) : null}
    </>
  );
}

export type PolisReportFidelitySectionProps = {
  sessionConfig?: unknown;
  questions?: Record<string, unknown>;
  // Rows by question, as the report holds them after its filters.
  questionResponses?: unknown;
  pdfMode?: boolean;
};

const TITLE = 'How well AIs predicted people';

/**
 * How well people's AI-prefill drafts predicted their answers, for sessions
 * that show participants their score. It scores the responses the report
 * shows, after its filters, and stays empty until enough people take part.
 */
export default function PolisReportFidelitySection({
  sessionConfig,
  questions,
  questionResponses,
  pdfMode = false,
}: PolisReportFidelitySectionProps) {
  const [open, setOpen] = useState(true);
  const bodyId = useId();
  const config = sessionConfig && typeof sessionConfig === 'object' ? (sessionConfig as Record<string, unknown>) : {};
  const enabled = normalizeInterviewSettings(config.interviewMode).showFidelityScore;
  const overview = useMemo(() => {
    if (!enabled || !questionResponses) return null;
    // Cached questions are keyed by ID and may not repeat it inside.
    const questionList = Object.entries(questions || {}).map(([id, question]) => ({
      id,
      ...(question && typeof question === 'object' ? question : {}),
    }));
    const { pairs } = collectSessionFidelityData({
      questions: questionList,
      payloads: resultsResponseRows({ filteredQuestionResponses: questionResponses }),
    });
    // Like each person's own score: voice and typed-context drafts restate
    // what the person said, so only their AI's prefill counts.
    const prefill = pairs.filter((pair) => pair.origin === 'external_prefill');
    return prefill.length
      ? scoreFidelityOverview({
          questions: questionList,
          pairs: prefill,
          options: { bootstrapSamples: BOOTSTRAP_SAMPLES },
        })
      : null;
  }, [enabled, questions, questionResponses]);
  if (!overview) return null;

  const minimum = overview.options.minParticipants;
  if (overview.coverage.participants < minimum) {
    return (
      <p className={styles.pending} data-testid={E2E_TESTIDS.SESSION_RESULTS_FIDELITY}>
        {TITLE} shows here once {minimum} people have shared their AI draft changes.
      </p>
    );
  }
  const { coverage, mirrorScore, correctionRate, calibration } = overview;
  const hidden = mirrorScore.byCondition.blind;
  const expanded = open || pdfMode;
  return (
    <section
      className={reportStyles.sectionCollapse}
      aria-label={TITLE}
      data-testid={E2E_TESTIDS.SESSION_RESULTS_FIDELITY}
    >
      <h2 className={`${reportStyles.sectionHeader} ${reportStyles.sectionTitle}`}>
        <button
          type="button"
          className={reportStyles.allQuestionsToggle}
          aria-label={TITLE}
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={() => setOpen(!open)}
        >
          <FontAwesomeIcon icon={expanded ? faCaretUp : faCaretDown} />
          {TITLE}
          <span className={`${reportStyles.pdfIgnore} ${reportStyles.allQuestionsToggleLabel}`}>
            <PolisReportSectionToggleLabel open={open} />
          </span>
        </button>
      </h2>
      <div id={bodyId} className={`${reportStyles.statsSection} ${styles.body}`} hidden={!expanded}>
        <p className={styles.detail}>
          {coverage.predictions} AI-drafted answers from {coverage.participants} people, compared with what they
          submitted.
        </p>
        <div className={styles.tiles}>
          <Tile
            id="ce-results-fidelity-mirror"
            label="Mirror Score"
            help="How closely the AI's drafts matched people's answers, from 0 to 100%. Near misses get partial credit, and each person counts once."
            estimate={mirrorScore.overall}
            detail="All drafts"
            minimum={minimum}
          />
          {hidden ? (
            <Tile
              id="ce-results-fidelity-hidden"
              label="Hidden drafts"
              help="The Mirror Score for drafts kept hidden until the person answered, so seeing the draft couldn't sway them."
              estimate={hidden}
              detail={`${coverage.byCondition.blind} drafts`}
              minimum={minimum}
            />
          ) : null}
          <Tile
            id="ce-results-fidelity-changed"
            label="Changed"
            help="The share of the choice drafts people saw that they changed before submitting."
            estimate={correctionRate}
            detail="Choice drafts shown"
            minimum={minimum}
          />
        </div>
        <section className={styles.section} aria-labelledby="ce-results-fidelity-confidence">
          <div className={styles.sectionHeading}>
            <h3 id="ce-results-fidelity-confidence">Confidence</h3>
            <Help id="ce-results-fidelity-calibration" label="About confidence">
              When the AI says it is 80% sure, people should keep about 80% of those answers. Points below the dashed
              line mean it was overconfident; above it, underconfident.
            </Help>
          </div>
          <Calibration calibration={calibration} minimum={minimum} />
        </section>
        <section className={styles.section} aria-labelledby="ce-results-fidelity-platforms">
          <div className={styles.sectionHeading}>
            <h3 id="ce-results-fidelity-platforms">By platform</h3>
            <Help id="ce-results-fidelity-platform" label="About platforms">
              Which AI drafted the answers, as each prefill reported it.
            </Help>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Platform</th>
                <th scope="col">Mirror Score</th>
                <th scope="col">95% interval</th>
                <th scope="col">People</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(mirrorScore.byPlatform).map(([platform, estimate]) => (
                <tr key={platform}>
                  <th scope="row">{PLATFORM_LABELS[platform] || platform}</th>
                  {estimate.suppressed ? (
                    <td colSpan={2}>Fewer than {minimum} people</td>
                  ) : (
                    <>
                      <td>{percent(estimate.value)}</td>
                      <td>{percentRange(estimate.interval)}</td>
                    </>
                  )}
                  <td>{estimate.participants}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </section>
  );
}
