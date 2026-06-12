import React, { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCaretDown,
  faChevronLeft,
  faChevronRight,
  faCheck,
  faExpand,
  faFilter,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons';
import { Button, Card, CardBody } from 'reactstrap';

import BinaryChoiceInput from '../../SurveyTool/BinaryChoiceInput';
import MultichoiceQuestionInput from '../../SurveyTool/MultichoiceQuestionInput';
import SurveyAudioFieldInput from '../../SurveyTool/SurveyAudioFieldInput';
import CESlider from '../../Shared/CESlider';
import type { TelegramAgentQuestion } from '../../../utilities/session/telegramAgentData';
import type { TelegramAnswerInput } from '../../../utilities/session/telegramSessionBackend';
import {
  RATING_MAX,
  RATING_MIN,
} from '../../../utilities/survey/ratingValue';
import { E2E_TESTIDS } from '../../../utilities/e2eTestIds.js';
import styles from '../OnePageSession.module.scss';
import surveyToolStyles from '../../SurveyTool/SurveyTool.module.scss';
import {
  getNormalizedUiRatingValue,
  isSingleSelectMultichoice,
  normalizeMultichoiceValue,
} from '../../SurveyTool/surveyToolResponseState';

type TelegramQuestionPileProps = {
  compact?: boolean;
  questions: TelegramAgentQuestion[];
  activeIndex: number;
  status: string;
  submittedQuestionIds?: Set<string>;
  submittingQuestionId?: string;
  submitError?: string;
  onActiveIndexChange: (index: number) => void;
  onSubmitAnswer: (question: TelegramAgentQuestion, answer: TelegramAnswerInput | string | number | string[]) => Promise<unknown> | unknown;
  onViewAll?: () => void;
};

type DraftState = Record<string, unknown>;
type QuestionFilterMode = 'all' | 'open' | 'answered';

const clampIndex = (index: number, count: number): number => (
  Math.min(Math.max(0, index), Math.max(0, count - 1))
);

const questionType = (question: TelegramAgentQuestion): string => (
  String(question.questionType || 'freeform').trim().toLowerCase()
);

const draftFor = (drafts: DraftState, questionId: string): any => (
  drafts[questionId] || {}
);

const answerReady = (question: TelegramAgentQuestion, draft: any): boolean => {
  const type = questionType(question);
  if (type === 'binary') return Boolean(draft.value);
  if (type === 'rating') return Number.isFinite(Number(draft.value));
  if (type === 'multichoice') return Array.isArray(draft.values) && draft.values.length > 0;
  return String(draft.text || '').trim().length > 0;
};

const answerPayload = (question: TelegramAgentQuestion, draft: any): TelegramAnswerInput | string | number | string[] => {
  const type = questionType(question);
  if (type === 'binary') return { value: String(draft.value || '').toLowerCase() };
  if (type === 'rating') return { value: Number(draft.value) };
  if (type === 'multichoice') return { values: Array.isArray(draft.values) ? draft.values : [] };
  return { text: String(draft.text || '').trim() };
};

const asPileQuestion = (question: TelegramAgentQuestion) => ({
  id: question.questionId,
  type: questionType(question),
  prompt: question.prompt || 'Question',
  options: Array.isArray(question.options) ? question.options : [],
  singleSelect: (question as any).singleSelect,
  singleChoice: (question as any).singleChoice,
  oneSelectionOnly: (question as any).oneSelectionOnly,
});

export default function TelegramQuestionPile({
  compact = false,
  questions,
  activeIndex,
  status,
  submittedQuestionIds = new Set(),
  submittingQuestionId = '',
  submitError = '',
  onActiveIndexChange,
  onSubmitAnswer,
  onViewAll,
}: TelegramQuestionPileProps): React.ReactElement {
  const [drafts, setDrafts] = useState<DraftState>({});
  const [filterMode, setFilterMode] = useState<QuestionFilterMode>('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const isQuestionAnswered = (question: TelegramAgentQuestion): boolean => (
    Boolean(question?.answeredByUser || (question?.questionId && submittedQuestionIds.has(question.questionId)))
  );
  const displayedQuestions = questions.filter((question) => {
    if (filterMode === 'open' && isQuestionAnswered(question)) return false;
    if (filterMode === 'answered' && !isQuestionAnswered(question)) return false;
    if (typeFilter !== 'all' && questionType(question) !== typeFilter) return false;
    return true;
  });
  const activeQuestion = displayedQuestions[clampIndex(activeIndex, displayedQuestions.length)] || null;
  const draft = activeQuestion ? draftFor(drafts, activeQuestion.questionId) : {};
  const hasQuestions = questions.length > 0;
  const isSubmitting = Boolean(activeQuestion?.questionId && submittingQuestionId === activeQuestion.questionId);
  const isAnswered = Boolean(activeQuestion && isQuestionAnswered(activeQuestion));
  const canSubmit = Boolean(activeQuestion && answerReady(activeQuestion, draft) && !isSubmitting);
  const showSubmit = Boolean(activeQuestion && (answerReady(activeQuestion, draft) || isSubmitting));
  const filterIsActive = filterMode !== 'all' || typeFilter !== 'all';
  const availableTypes = Array.from(new Set(questions.map(questionType).filter(Boolean))).sort();

  const setDraft = (questionId: string, patch: Record<string, unknown>) => {
    setDrafts((previous) => ({
      ...previous,
      [questionId]: {
        ...draftFor(previous, questionId),
        ...patch,
      },
    }));
  };

  const submit = async () => {
    if (!activeQuestion || !canSubmit) return;
    await onSubmitAnswer(activeQuestion, answerPayload(activeQuestion, draft));
  };

  const setQuestionFilterMode = (mode: QuestionFilterMode) => {
    setFilterMode(mode);
    onActiveIndexChange(0);
  };

  const setQuestionTypeFilter = (type: string) => {
    setTypeFilter(type);
    onActiveIndexChange(0);
  };

  const controls = useMemo(() => {
    if (!activeQuestion) return null;
    const type = questionType(activeQuestion);
    const qid = activeQuestion.questionId;
    const pileQuestion = asPileQuestion(activeQuestion);
    const options = Array.isArray(activeQuestion.options)
      ? activeQuestion.options.map((option) => String(option || '').trim()).filter(Boolean)
      : [];
    if (type === 'binary') {
      return (
        <div data-testid="ce-session-telegram-question-binary-controls">
          <BinaryChoiceInput
            questionId={qid}
            value={String(draft.value || '')}
            inputNamePrefix="telegram-q"
            disabled={isSubmitting}
            onChange={(value) => setDraft(qid, { value })}
          />
        </div>
      );
    }
    if (type === 'rating') {
      const ratingValue = Number.isFinite(Number(draft.value))
        ? getNormalizedUiRatingValue(draft.value)
        : RATING_MIN;
      return (
        <div
          className={surveyToolStyles.ratingContainer}
          data-testid="ce-session-telegram-question-rating-controls"
        >
          <CESlider
            min={RATING_MIN}
            max={RATING_MAX}
            step={1}
            value={ratingValue}
            onChange={(value) => setDraft(qid, { value })}
            disabled={isSubmitting}
            className={surveyToolStyles.ratingSlider}
          />
          <span className={surveyToolStyles.ratingValueDisplay}>
            {ratingValue}
          </span>
        </div>
      );
    }
    if (type === 'multichoice' || options.length > 0) {
      return (
        <div
          data-testid="ce-session-telegram-question-multichoice-controls"
        >
          <MultichoiceQuestionInput
            questionId={qid}
            options={options.length > 0 ? options : ['Other']}
            selectedValues={normalizeMultichoiceValue(draft.values)}
            isSingleSelect={isSingleSelectMultichoice(pileQuestion)}
            disabled={isSubmitting}
            onChange={(values) => setDraft(qid, { values })}
          />
        </div>
      );
    }
    return (
      <div data-testid="ce-session-telegram-question-freeform-controls">
        <SurveyAudioFieldInput
          placeholder="Your response..."
          value={String(draft.text || '')}
          updateFunction={(value) => setDraft(qid, { text: value })}
          toggleEncryption={() => {}}
          disabled={isSubmitting}
          disableEncryption
          enableDownloads={false}
        />
      </div>
    );
  }, [activeQuestion, draft, isSubmitting]);

  const questionContainerClass = activeQuestion
    ? surveyToolStyles[`${questionType(activeQuestion)}QuestionContainer`] || ''
    : '';

  return (
    <div className={styles.telegramListPanel} data-testid="ce-session-telegram-questions">
      {compact && onViewAll ? (
        <div className={styles.telegramListHeader}>
          <span>Session questions</span>
          <span className={styles.telegramListHeaderActions}>
            <button
              type="button"
              className={styles.sectionHeaderActionButton}
              onClick={onViewAll}
              data-testid="ce-session-telegram-questions-view-all"
            >
              <FontAwesomeIcon icon={faExpand} />
              View All
            </button>
          </span>
        </div>
      ) : null}

      {status === 'error' ? (
        <div className={styles.telegramListError} role="alert">
          Could not load questions from the session worker.
        </div>
      ) : null}
      {submitError ? (
        <div className={styles.telegramListError} role="alert">
          {submitError}
        </div>
      ) : null}
      {status === 'loading' && !hasQuestions ? (
        <div className={styles.telegramListEmpty}>
          <FontAwesomeIcon icon={faSpinner} spin /> Loading questions...
        </div>
      ) : null}
      {status === 'ready' && !hasQuestions ? (
        <div className={styles.telegramListEmpty}>No questions available yet.</div>
      ) : null}

      {showFilterPanel ? (
        <div
          className={styles.telegramPileAuxPanel}
          data-testid="ce-session-telegram-question-filter-panel"
        >
          <div className={styles.telegramPileAuxTitle}>Filter questions</div>
          <div className={styles.telegramPileFilterOptions}>
            {(['all', 'open', 'answered'] as QuestionFilterMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`${styles.telegramPileAuxChoice} ${filterMode === mode ? styles.telegramPileAuxChoiceActive : ''}`.trim()}
                onClick={() => setQuestionFilterMode(mode)}
                aria-pressed={filterMode === mode}
              >
                {mode === 'all' ? 'All' : mode === 'open' ? 'Open' : 'Answered'}
              </button>
            ))}
            <select
              className={styles.telegramPileAuxSelect}
              value={typeFilter}
              onChange={(event) => setQuestionTypeFilter(event.target.value)}
              aria-label="Question type filter"
            >
              <option value="all">All types</option>
              {availableTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      {status === 'ready' && hasQuestions && !displayedQuestions.length ? (
        <div className={styles.telegramListEmpty}>No questions match this filter.</div>
      ) : null}

      {activeQuestion ? (
        <div
          className={`${surveyToolStyles.pileInteractionUnit} ${styles.telegramPileFrame}`.trim()}
          data-testid="ce-session-telegram-question-pile"
        >
          <div className={`${surveyToolStyles.pileCardContainer} ${styles.telegramPileDeck}`.trim()}>
            <Card
              className={`${surveyToolStyles.pileCardInner} ${styles.telegramPileCard}`.trim()}
              data-testid="ce-session-telegram-question-item"
            >
              <CardBody className={surveyToolStyles.pileCardBody}>
                <div className={surveyToolStyles.pileCardHeader}>
                  <div className={surveyToolStyles.promptTitleBlock}>
                    <h4 id={surveyToolStyles.questionTitle}>{activeQuestion.prompt}</h4>
                  </div>
                  {isAnswered ? (
                    <span className={styles.telegramAnsweredBadge}>
                      <FontAwesomeIcon icon={faCheck} /> Answered
                    </span>
                  ) : null}
                </div>
                <div className={surveyToolStyles.pileCardMainContent}>
                  <div className={questionContainerClass}>
                    {controls}
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
          <div className={`${surveyToolStyles.pileControls} ${styles.telegramPileControls}`.trim()}>
            <div
              className={`${surveyToolStyles.pileActions} ${styles.telegramPileActions}`.trim()}
              data-testid="ce-session-telegram-question-actions"
            >
              <button
                type="button"
                className={`${surveyToolStyles.actionButton} ${(showFilterPanel || filterIsActive) ? surveyToolStyles.actionButtonActive : ''}`.trim()}
                onClick={() => setShowFilterPanel((value) => !value)}
                title="Filter Questions"
                aria-label="Filter Questions"
                aria-pressed={showFilterPanel || filterIsActive}
                data-testid={E2E_TESTIDS.SURVEY_FILTER_TOGGLE}
              >
                <FontAwesomeIcon icon={faFilter} />
              </button>
              {onViewAll ? (
                <button
                  type="button"
                  className={surveyToolStyles.actionButton}
                  onClick={onViewAll}
                  title="View All Questions"
                  aria-label="View All Questions"
                  data-testid={E2E_TESTIDS.SURVEY_VIEW_ALL}
                >
                  <FontAwesomeIcon icon={faCaretDown} />
                </button>
              ) : null}
            </div>
            <div
              className={[
                surveyToolStyles.pileFooter,
                styles.telegramPileFooter,
                showSubmit ? '' : surveyToolStyles.pileFooterHidden,
              ].filter(Boolean).join(' ')}
            >
              <Button
                type="button"
                className={`${surveyToolStyles.pileSubmitButton} ${styles.telegramPileSubmitButton} ${canSubmit ? surveyToolStyles.submitGlow : ''}`.trim()}
                disabled={!canSubmit}
                onClick={submit}
                data-testid="ce-session-telegram-question-submit"
              >
                {isSubmitting ? (
                  <FontAwesomeIcon icon={faSpinner} spin />
                ) : (
                  <span className={surveyToolStyles.pileSubmitButtonContent}>
                    <span className={surveyToolStyles.pileSubmitButtonLabel}>
                      {isAnswered ? 'Update answer' : 'Submit answer'}
                    </span>
                    <span className={surveyToolStyles.pileSubmitButtonTrail} aria-hidden="true">
                      <FontAwesomeIcon icon={faChevronRight} className={surveyToolStyles.pileSubmitButtonTrailIcon} />
                      <FontAwesomeIcon icon={faChevronRight} className={surveyToolStyles.pileSubmitButtonTrailIcon} />
                      <FontAwesomeIcon icon={faChevronRight} className={surveyToolStyles.pileSubmitButtonTrailIcon} />
                    </span>
                  </span>
                )}
              </Button>
            </div>
            {displayedQuestions.length > 1 ? (
              <div
                className={`${surveyToolStyles.pileNav} ${styles.telegramPileNav}`.trim()}
                data-testid="ce-session-telegram-question-nav"
              >
                <button
                  type="button"
                  className={surveyToolStyles.pileNavArrow}
                  onClick={() => onActiveIndexChange(clampIndex(activeIndex - 1, displayedQuestions.length))}
                  disabled={activeIndex <= 0}
                  data-testid="ce-session-telegram-question-prev"
                  aria-label="Previous Question"
                >
                  <FontAwesomeIcon icon={faChevronLeft} />
                </button>
                <span className={surveyToolStyles.pileNavCounterText}>
                  {clampIndex(activeIndex, displayedQuestions.length) + 1} / {displayedQuestions.length}
                </span>
                <button
                  type="button"
                  className={surveyToolStyles.pileNavArrow}
                  onClick={() => onActiveIndexChange(clampIndex(activeIndex + 1, displayedQuestions.length))}
                  disabled={activeIndex >= displayedQuestions.length - 1}
                  data-testid="ce-session-telegram-question-next"
                  aria-label="Next Question"
                >
                  <FontAwesomeIcon icon={faChevronRight} />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
