import QuadraticAllocationInput from '../../SurveyTool/QuadraticAllocationInput';
import React, { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight, faPaperPlane } from '@fortawesome/free-solid-svg-icons';

import BinaryChoiceInput from '../../SurveyTool/BinaryChoiceInput';
import MultichoiceQuestionInput from '../../SurveyTool/MultichoiceQuestionInput';
import SurveyAudioFieldInput from '../../SurveyTool/SurveyAudioFieldInput';
import CESlider from '../../Shared/CESlider';
import { renderPileActiveQuestionCard } from '../../SurveyTool/surveyPileActiveQuestionCard';
import surveyStyles from '../../SurveyTool/SurveyTool.module.scss';
import styles from '../OnePageSession.module.scss';
import { normalizeRatingAnswer } from '../../../../../shared/questions/ratingScale.mjs';
import { normalizeRatingScale } from '../../../utilities/survey/ratingValue';
import type { AgentQuestion } from '../../../utilities/session/agentSessionData';
import type { AgentAnswerInput } from '../../../utilities/session/agentSessionBackend';

type AgentQuestionPileProps = {
  activeIndex: number;
  canSubmit: boolean;
  disabledReason?: string;
  questions: AgentQuestion[];
  status: string;
  submittedQuestionIds?: string[];
  submittingQuestionIds?: ReadonlySet<string>;
  submitError?: string;
  onActiveIndexChange: (nextIndex: number) => void;
  onSubmitAnswer: (question: AgentQuestion, answer: AgentAnswerInput) => void;
};

const normalizeQuestionType = (question: AgentQuestion): string =>
  String(question.questionType || question.type || 'freeform')
    .trim()
    .toLowerCase();

const questionContainerClassName = (question: AgentQuestion): string => {
  const type = normalizeQuestionType(question);
  if (type === 'binary') return surveyStyles.binaryQuestionContainer;
  if (type === 'multichoice') return surveyStyles.multichoiceQuestionContainer;
  if (type === 'rating') return surveyStyles.ratingQuestionContainer;
  if (type === 'quadratic') return surveyStyles.quadraticQuestionContainer;
  return surveyStyles.freeformQuestionContainer;
};

// The middle of the question's own scale, on its grid, so an untouched slider still sends an accepted answer.
const middleRating = (question: AgentQuestion): number => {
  const { min, max, step = 1 } = normalizeRatingScale(question);
  return normalizeRatingAnswer(min + Math.round((max - min) / 2 / step) * step, question) ?? min;
};

const buildInitialAnswer = (question: AgentQuestion): AgentAnswerInput => {
  const type = normalizeQuestionType(question);
  if (type === 'quadratic') return { value: question.options.map(() => 0) };
  if (type === 'rating') return { value: middleRating(question) };
  if (type === 'multichoice') return { values: [] };
  return { value: '' };
};

const selectedMultichoiceValues = (answer: AgentAnswerInput): unknown[] =>
  Array.isArray(answer.values) ? answer.values : [];

const AgentQuestionPile = ({
  activeIndex,
  canSubmit,
  disabledReason = '',
  questions,
  status,
  submittedQuestionIds = [],
  submittingQuestionIds = new Set<string>(),
  submitError = '',
  onActiveIndexChange,
  onSubmitAnswer,
}: AgentQuestionPileProps): React.ReactElement => {
  const activeQuestion = questions[activeIndex] || null;
  const [answers, setAnswers] = useState<Record<string, AgentAnswerInput>>({});
  const submitted = useMemo(() => new Set(submittedQuestionIds), [submittedQuestionIds]);

  const updateAnswer = (questionId: string, patch: AgentAnswerInput) => {
    setAnswers((prev) => ({ ...prev, [questionId]: { ...(prev[questionId] || {}), ...patch } }));
  };

  if (status === 'loading') {
    return (
      <div className={styles.agentListPanel} data-testid="ce-agent-http-questions">
        Loading questions...
      </div>
    );
  }

  if (!activeQuestion) {
    return (
      <div className={styles.agentListPanel} data-testid="ce-agent-http-questions">
        <div className={styles.agentListEmpty}>No answerable questions are available for this session.</div>
      </div>
    );
  }

  const questionId = activeQuestion.questionId;
  const answer = answers[questionId] || buildInitialAnswer(activeQuestion);
  const type = normalizeQuestionType(activeQuestion);
  const isSubmitting = submittingQuestionIds.has(questionId);
  const alreadySubmitted = submitted.has(questionId) || activeQuestion.answeredByUser;
  const submitDisabled = !canSubmit || isSubmitting || alreadySubmitted || activeQuestion.answerable === false;
  const submitDisabledReason = alreadySubmitted
    ? 'Already submitted'
    : activeQuestion.answerable === false
      ? 'Not answerable from this session'
      : disabledReason;

  let questionComponent: React.ReactNode;
  if (type === 'binary') {
    questionComponent = (
      <BinaryChoiceInput
        questionId={questionId}
        value={String(answer.value || '')}
        inputNamePrefix="agent-question"
        onChange={(value) => updateAnswer(questionId, { value })}
        disabled={isSubmitting}
      />
    );
  } else if (type === 'quadratic') {
    questionComponent = (
      <QuadraticAllocationInput
        questionId={questionId}
        options={activeQuestion.options}
        voiceCredits={activeQuestion.voiceCredits}
        value={answer.value}
        disabled={isSubmitting}
        onChange={(value) => updateAnswer(questionId, { value })}
      />
    );
  } else if (type === 'multichoice') {
    questionComponent = (
      <MultichoiceQuestionInput
        questionId={questionId}
        options={activeQuestion.options}
        selectedValues={selectedMultichoiceValues(answer)}
        isSingleSelect={activeQuestion.singleSelect === true}
        disabled={isSubmitting}
        onChange={(values) => updateAnswer(questionId, { values })}
      />
    );
  } else if (type === 'rating') {
    const scale = normalizeRatingScale(activeQuestion);
    const ratingValue = Number(answer.value);
    const shownValue = Number.isFinite(ratingValue) ? ratingValue : middleRating(activeQuestion);
    questionComponent = (
      <>
        <div className={surveyStyles.ratingContainer}>
          <CESlider
            min={scale.min}
            max={scale.max}
            step={scale.step}
            value={shownValue}
            onChange={(value) => updateAnswer(questionId, { value })}
            disabled={isSubmitting}
            className={surveyStyles.ratingSlider}
          />
          <span className={surveyStyles.ratingValueDisplay}>{shownValue}</span>
        </div>
        <div className={styles.agentRatingEnds}>
          <span>{scale.minLabel}</span>
          <span>{scale.maxLabel}</span>
        </div>
      </>
    );
  } else {
    questionComponent = (
      <SurveyAudioFieldInput
        placeholder="Your response..."
        value={String(answer.text || answer.value || '')}
        updateFunction={(value: string) => updateAnswer(questionId, { text: value, value })}
        toggleEncryption={() => undefined}
        disabled={isSubmitting}
        forceGlow={false}
        disableEncryption={true}
        enableDownloads={false}
        dataTestId="ce-agent-http-question-freeform-textarea"
      />
    );
  }

  return (
    <section className={styles.agentListPanel} data-testid="ce-agent-http-questions">
      <div className={styles.agentListHeader}>
        <span>
          Question {activeIndex + 1} of {questions.length}
        </span>
        <div className={styles.agentPileNav}>
          <button
            type="button"
            className={styles.agentIconButton}
            data-testid="ce-agent-http-question-prev"
            onClick={() => onActiveIndexChange(Math.max(0, activeIndex - 1))}
            disabled={activeIndex <= 0}
            aria-label="Previous agent question"
          >
            <FontAwesomeIcon icon={faChevronLeft} />
          </button>
          <button
            type="button"
            className={styles.agentIconButton}
            data-testid="ce-agent-http-question-next"
            onClick={() => onActiveIndexChange(Math.min(questions.length - 1, activeIndex + 1))}
            disabled={activeIndex >= questions.length - 1}
            aria-label="Next agent question"
          >
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
        </div>
      </div>

      <div className={styles.agentPileFrame}>
        {renderPileActiveQuestionCard({
          question: activeQuestion,
          promptMasked: false,
          renderQuestionMaskedPromptCard: () => null,
          promptHeader: (
            <div>
              <h3>{activeQuestion.prompt}</h3>
              {activeQuestion.tags.length ? (
                <div className={styles.agentChipRow}>
                  {activeQuestion.tags.map((tag) => (
                    <span key={tag} className={styles.agentChipDark}>
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ),
          questionComponent,
          questionContainerClass: questionContainerClassName(activeQuestion),
          footerSection: (
            <div className={styles.agentPileFooter}>
              <button
                type="button"
                className={styles.agentPrimaryButton}
                data-testid="ce-agent-http-question-submit"
                disabled={submitDisabled}
                onClick={() => onSubmitAnswer(activeQuestion, answer)}
              >
                <FontAwesomeIcon icon={faPaperPlane} />
                <span>{isSubmitting ? 'Submitting' : 'Submit'}</span>
              </button>
              {submitDisabled && submitDisabledReason ? (
                <span className={styles.agentSubmitDisabledReason}>{submitDisabledReason}</span>
              ) : null}
            </div>
          ),
        })}
      </div>

      {submitError ? <div className={styles.agentListError}>{submitError}</div> : null}
    </section>
  );
};

export default AgentQuestionPile;
