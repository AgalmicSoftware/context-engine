import { lazy, Suspense, useCallback, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFilter } from '@fortawesome/free-solid-svg-icons';
import {
  buildSurveyResultsQuestionFilterQuestions,
  type SurveyResultsFilterQuestionRecord,
} from '../SurveyTool/surveyResultsHelpers';
import reportStyles from './PolisReport.module.scss';
import styles from './PolisReportFilters.module.scss';

// Raw Results' own filter panel, loaded when someone first opens it from the Report.
const QuestionFilter = lazy(() => import('../SurveyTool/QuestionFilter'));

type Row = { responder?: unknown; response?: unknown };

// The panel reads who answered each question as Raw Results keeps it: by question, then by person.
const answersByPerson = (rows: unknown): Record<string, Record<string, unknown>> =>
  Object.fromEntries(
    Object.entries(rows && typeof rows === 'object' ? (rows as Record<string, unknown>) : {}).map(
      ([questionId, list]) => [
        questionId,
        Object.fromEntries(
          (Array.isArray(list) ? (list as Row[]) : [])
            .filter((row) => row?.responder)
            .map((row) => [String(row.responder).toLowerCase(), row.response]),
        ),
      ],
    ),
  );

// The Report applies neither the AI ranking nor "answered / not answered by me". Its panel hides both, and a
// change made there keeps them as Raw Results set them, so opening the panel never starts a ranking either.
const LEFT_TO_RAW_RESULTS = ['aiFilter', 'aiTopN', 'aiCombine', 'responseStatus'];
const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

type FilterButtonProps = { open: boolean; panelId: string; onToggle: () => void };

/** Opens and closes the panel. Like the Report's other controls, it stays out of the PDF. */
export function PolisReportFilterButton({ open, panelId, onToggle }: FilterButtonProps) {
  return (
    // The display is set here, as for the Report's other controls, since .pdfIgnore sets one of its own.
    <span className={reportStyles.pdfIgnore} style={{ display: 'inline-flex' }}>
      <button
        type="button"
        className={styles.button}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={onToggle}
      >
        Filter
        <FontAwesomeIcon icon={faFilter} className={styles.icon} aria-hidden="true" />
      </button>
    </span>
  );
}

export type PolisReportFilterPanelProps = {
  id: string;
  // The Report's answer rows by question, before its filters, and the cached question details by ID.
  rows: unknown;
  questions: Record<string, SurveyResultsFilterQuestionRecord>;
  filterState: unknown;
  onFilterChange: (next: unknown) => void;
  // Passed on to the panel as Raw Results passes them.
  provider?: unknown;
  network?: unknown;
  defaultTags?: unknown;
  isQuestionCacheReady?: boolean;
  isSBTCacheReady?: unknown;
  sbtCacheRevision?: unknown;
  questionResponsesNonce?: unknown;
  sessionSlug?: string;
  sessionConfig?: unknown;
  ensureLightSbtUniverse?: unknown;
};

/**
 * Raw Results' filter panel, inline in the Report. It changes the one filter the
 * Report and Raw Results share, so each shows the change at once.
 */
export function PolisReportFilterPanel({
  id,
  rows,
  questions,
  filterState,
  onFilterChange,
  ...passedOn
}: PolisReportFilterPanelProps) {
  const questionList = useMemo(
    () => buildSurveyResultsQuestionFilterQuestions({ networkQuestionsById: questions, questionResponses: rows }),
    [questions, rows],
  );
  const responses = useMemo(() => answersByPerson(rows), [rows]);
  const shownFilterState = useMemo(
    () =>
      Object.fromEntries(Object.entries(asRecord(filterState)).filter(([key]) => !LEFT_TO_RAW_RESULTS.includes(key))),
    [filterState],
  );
  const handleChange = useCallback(
    (next: unknown) => {
      const shared = asRecord(filterState);
      onFilterChange({
        ...asRecord(next),
        ...Object.fromEntries(LEFT_TO_RAW_RESULTS.map((key) => [key, shared[key] ?? null])),
      });
    },
    [filterState, onFilterChange],
  );
  return (
    <div id={id} className={`${reportStyles.pdfIgnore} ${styles.panel}`}>
      <Suspense fallback={<p role="status">Loading filters…</p>}>
        <QuestionFilter
          {...passedOn}
          resultsMode
          filterModalOpen
          creatorAndResponderMode
          hideAiFilter
          hideResponseStatusFilter
          currentViewModeForUrl="questions"
          questions={questionList}
          questionResponses={responses}
          filterState={shownFilterState}
          onFilterStateChange={handleChange}
        />
      </Suspense>
    </div>
  );
}
