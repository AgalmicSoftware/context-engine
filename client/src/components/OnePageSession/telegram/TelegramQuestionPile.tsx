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

import type { TelegramAgentQuestion } from '../../../utilities/session/telegramAgentData';
import type { TelegramAnswerInput } from '../../../utilities/session/telegramSessionBackend';
import styles from '../OnePageSession.module.scss';
import surveyToolStyles from '../../SurveyTool/SurveyTool.module.scss';

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
  if (type === 'binary') return { value: draft.value };
  if (type === 'rating') return { value: Number(draft.value) };
  if (type === 'multichoice') return { values: Array.isArray(draft.values) ? draft.values : [] };
  return { text: String(draft.text || '').trim() };
};

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
    const options = Array.isArray(activeQuestion.options)
      ? activeQuestion.options.map((option) => String(option || '').trim()).filter(Boolean)
      : [];
    if (type === 'binary') {
      return (
        <div
          className={`${styles.telegramReadonlyControls} ${surveyToolStyles.binaryChoice || ''}`.trim()}
          data-testid="ce-session-telegram-question-binary-controls"
          aria-label="Binary answer options"
        >
          {['Agree', 'Unsure', 'Disagree'].map((label) => {
            const value = label.toLowerCase();
            const selected = draft.value === value;
            return (
              <button
                key={label}
                type="button"
                className={`${styles.telegramReadonlyChoice} ${selected ? styles.telegramAnswerChoiceSelected : ''}`.trim()}
                onClick={() => setDraft(qid, { value })}
                aria-pressed={selected}
              >
                {label}
              </button>
            );
          })}
        </div>
      );
    }
    if (type === 'rating') {
      return (
        <div
          className={`${styles.telegramReadonlyControls} ${styles.telegramRatingControls}`.trim()}
          data-testid="ce-session-telegram-question-rating-controls"
          aria-label="Rating answer options"
        >
          {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => {
            const selected = Number(draft.value) === value;
            return (
              <button
                key={value}
                type="button"
                className={`${styles.telegramRatingButton} ${selected ? styles.telegramAnswerChoiceSelected : ''}`.trim()}
                onClick={() => setDraft(qid, { value })}
                aria-pressed={selected}
              >
                {value}
              </button>
            );
          })}
        </div>
      );
    }
    if (type === 'multichoice' || options.length > 0) {
      const selectedValues = new Set(Array.isArray(draft.values) ? draft.values : []);
      return (
        <div
          className={`${styles.telegramReadonlyControls} ${styles.telegramReadonlyOptionGrid}`.trim()}
          data-testid="ce-session-telegram-question-multichoice-controls"
          aria-label="Multiple choice answer options"
        >
          {(options.length > 0 ? options : ['Other']).map((option) => {
            const selected = selectedValues.has(option);
            return (
              <button
                key={option}
                type="button"
                className={`${styles.telegramReadonlyOption} ${selected ? styles.telegramAnswerChoiceSelected : ''}`.trim()}
                onClick={() => {
                  const next = new Set(selectedValues);
                  if (selected) next.delete(option);
                  else next.add(option);
                  setDraft(qid, { values: Array.from(next) });
                }}
                aria-pressed={selected}
              >
                {option}
              </button>
            );
          })}
        </div>
      );
    }
    return (
      <div className={styles.telegramReadonlyControls} data-testid="ce-session-telegram-question-freeform-controls">
        <textarea
          className={styles.telegramFreeformTextarea}
          value={String(draft.text || '')}
          placeholder="Type your response"
          aria-label="Freeform response"
          onChange={(event) => setDraft(qid, { text: event.target.value })}
        />
      </div>
    );
  }, [activeQuestion, draft]);

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
                <span>{activeQuestion.questionType || 'question'}</span>
                {isAnswered ? (
                  <span className={styles.telegramAnsweredBadge}>
                    <FontAwesomeIcon icon={faCheck} /> Answered
                  </span>
                ) : null}
              </div>
              <div className={surveyToolStyles.pileCardMainContent}>
                <div className={styles.telegramQuestionPromptDark}>{activeQuestion.prompt}</div>
                {activeQuestion.tags?.length ? (
                  <div className={styles.telegramChipRow}>
                    {activeQuestion.tags.map((tag) => (
                      <span key={tag} className={styles.telegramChipDark}>{tag}</span>
                    ))}
                  </div>
                ) : null}
                {controls}
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
