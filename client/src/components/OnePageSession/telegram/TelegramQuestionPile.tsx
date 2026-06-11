import React, { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faArrowRight,
  faCheck,
  faExpand,
  faSpinner,
  faSyncAlt,
} from '@fortawesome/free-solid-svg-icons';
import { Card, CardBody } from 'reactstrap';

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
import styles from '../OnePageSession.module.scss';
import surveyToolStyles from '../../SurveyTool/SurveyTool.module.scss';
import {
  getNormalizedUiRatingValue,
  isSingleSelectMultichoice,
  normalizeMultichoiceValue,
} from '../../SurveyTool/surveyToolResponseState';

type TelegramQuestionPileProps = {
  answerState?: { answeredCount?: number; unansweredCount?: number } | null;
  compact?: boolean;
  questions: TelegramAgentQuestion[];
  activeIndex: number;
  status: string;
  submittedQuestionIds?: Set<string>;
  submittingQuestionId?: string;
  submitError?: string;
  onActiveIndexChange: (index: number) => void;
  onRefresh: () => void;
  onSubmitAnswer: (question: TelegramAgentQuestion, answer: TelegramAnswerInput | string | number | string[]) => Promise<unknown> | unknown;
  onViewAll?: () => void;
};

type DraftState = Record<string, unknown>;

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
  answerState = null,
  compact = false,
  questions,
  activeIndex,
  status,
  submittedQuestionIds = new Set(),
  submittingQuestionId = '',
  submitError = '',
  onActiveIndexChange,
  onRefresh,
  onSubmitAnswer,
  onViewAll,
}: TelegramQuestionPileProps): React.ReactElement {
  const [drafts, setDrafts] = useState<DraftState>({});
  const activeQuestion = questions[clampIndex(activeIndex, questions.length)] || null;
  const draft = activeQuestion ? draftFor(drafts, activeQuestion.questionId) : {};
  const hasQuestions = questions.length > 0;
  const isSubmitting = Boolean(activeQuestion?.questionId && submittingQuestionId === activeQuestion.questionId);
  const isAnswered = Boolean(activeQuestion?.answeredByUser || (activeQuestion?.questionId && submittedQuestionIds.has(activeQuestion.questionId)));
  const canSubmit = Boolean(activeQuestion && answerReady(activeQuestion, draft) && !isSubmitting);

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
      <div className={styles.telegramListHeader}>
        {answerState ? (
          <span>
            {answerState.unansweredCount || 0} open · {answerState.answeredCount || 0} answered
          </span>
        ) : <span>Session questions</span>}
        <span className={styles.telegramListHeaderActions}>
          {questions.length > 1 ? (
            <>
              <button
                type="button"
                className={styles.sectionHeaderActionButton}
                onClick={() => onActiveIndexChange(clampIndex(activeIndex - 1, questions.length))}
                disabled={activeIndex <= 0}
                data-testid="ce-session-telegram-question-prev"
                aria-label="Previous question"
              >
                <FontAwesomeIcon icon={faArrowLeft} />
              </button>
              <span className={styles.telegramPanelMeta}>
                {clampIndex(activeIndex, questions.length) + 1} / {questions.length}
              </span>
              <button
                type="button"
                className={styles.sectionHeaderActionButton}
                onClick={() => onActiveIndexChange(clampIndex(activeIndex + 1, questions.length))}
                disabled={activeIndex >= questions.length - 1}
                data-testid="ce-session-telegram-question-next"
                aria-label="Next question"
              >
                <FontAwesomeIcon icon={faArrowRight} />
              </button>
            </>
          ) : null}
          {compact && onViewAll ? (
            <button
              type="button"
              className={styles.sectionHeaderActionButton}
              onClick={onViewAll}
              data-testid="ce-session-telegram-questions-view-all"
            >
              <FontAwesomeIcon icon={faExpand} />
              View All
            </button>
          ) : null}
          <button
            type="button"
            className={styles.sectionHeaderActionButton}
            onClick={onRefresh}
            disabled={status === 'loading'}
            data-testid="ce-session-telegram-questions-refresh"
            aria-label="Refresh questions"
          >
            <FontAwesomeIcon icon={faSyncAlt} spin={status === 'loading'} />
          </button>
        </span>
      </div>

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

      {activeQuestion ? (
        <div className={styles.telegramPileDeck} data-testid="ce-session-telegram-question-pile">
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
              <div className={surveyToolStyles.pileCardFooter}>
                <button
                  type="button"
                  className={styles.telegramSubmitAnswerButton}
                  disabled={!canSubmit}
                  onClick={submit}
                  data-testid="ce-session-telegram-question-submit"
                >
                  {isSubmitting ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner} spin /> Submitting
                    </>
                  ) : isAnswered ? 'Update answer' : 'Submit answer'}
                </button>
              </div>
            </CardBody>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
