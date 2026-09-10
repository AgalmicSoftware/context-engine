import React, { useState } from 'react';
import { Input } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCheck, faTimes } from '@fortawesome/free-solid-svg-icons';
import BinaryChoiceInput from './BinaryChoiceInput';
import FullQuestionFooterIcons from './FullQuestionFooterIcons';
import AdditionalCommentsInlineRow from './AdditionalCommentsInlineRow';
import SurveyQuestionsFullQuestionSliderSection from './SurveyQuestionsFullQuestionSliderSection';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import type { InterviewDraftResponse, InterviewQuestion } from './sessionInterview';
import styles from './SurveyTool.module.scss';

export type InterviewQuestionControls = {
  renderAnswerInput?: (questionId: string, value: unknown, onChange: (value: unknown) => void) => React.ReactNode;
  renderAdditionalInput?: (questionId: string, value: string, onChange: (value: string) => void) => React.ReactNode;
  renderFieldLock?: (questionId: string, field: 'answer' | 'additional') => React.ReactNode;
};

type Props = InterviewQuestionControls & {
  draft: InterviewDraftResponse;
  edited: InterviewDraftResponse;
  question?: InterviewQuestion;
  selected: boolean;
  existing: boolean;
  disabled: boolean;
  onSelect: (selected: boolean) => void;
  onEdit: (patch: Partial<InterviewDraftResponse>) => void;
};

export default function SessionInterviewDraftCard({
  draft,
  edited,
  question,
  selected,
  existing,
  disabled,
  onSelect,
  onEdit,
  renderAnswerInput,
  renderAdditionalInput,
  renderFieldLock,
}: Props) {
  const [showComments, setShowComments] = useState(Boolean(edited.additionalComments));
  const [showEvidence, setShowEvidence] = useState(false);
  const [sliderMode, setSliderMode] = useState<'conviction' | 'importance'>('conviction');
  const [sliderOpen, setSliderOpen] = useState(false);
  const prompt = question?.prompt || draft.questionId;
  const evidenceId = `ce-session-interview-basis-${draft.questionId}`;
  const percent = Math.round(Math.max(0, Math.min(1, draft.confidence || 0)) * 100);
  const confidenceLabel = percent < 40 ? 'Weak inference' : percent < 70 ? 'Moderate support' : 'Strong support';
  const comments = edited.additionalComments || '';
  const onAnswerChange = (answer: unknown) => onEdit({ answer });
  const onCommentsChange = (additionalComments: string) => onEdit({ additionalComments });
  return (
    <article
      className={`${styles.sessionInterviewDraft} ${selected ? '' : styles.sessionInterviewDraftRemoved}`}
      data-testid={E2E_TESTIDS.SESSION_INTERVIEW_DRAFT}
      data-ce-question-id={draft.questionId}
    >
      <button
        type="button"
        className={styles.sessionInterviewDraftRemove}
        onClick={() => onSelect(false)}
        aria-label={`Remove draft for ${prompt}`}
        title="Remove draft"
        disabled={disabled || !selected}
        data-testid={E2E_TESTIDS.SESSION_INTERVIEW_DRAFT_REMOVE}
        data-ce-question-id={draft.questionId}
      >
        <FontAwesomeIcon icon={faTimes} />
      </button>
      <div className={styles.sessionInterviewQuestion}>{prompt}</div>
      <div className={styles.sessionInterviewQuestionEditor}>
        {renderAnswerInput ? (
          renderAnswerInput(draft.questionId, edited.answer, onAnswerChange)
        ) : question?.type === 'binary' ? (
          <BinaryChoiceInput
            questionId={draft.questionId}
            value={String(edited.answer ?? '')}
            inputNamePrefix="interview-draft"
            onChange={onAnswerChange}
            disabled={disabled}
          />
        ) : (
          <Input
            type="textarea"
            value={typeof edited.answer === 'string' ? edited.answer : (JSON.stringify(edited.answer) ?? '')}
            onChange={(event) => onAnswerChange(event.target.value)}
            disabled={disabled}
            className={styles.sessionInterviewAnswerInput}
            aria-label={`Draft answer for ${prompt}`}
          />
        )}
        <div className={styles.pileCardFooter}>
          <div className={styles.pileControlsRow}>
            <SurveyQuestionsFullQuestionSliderSection
              questionId={`interview-${draft.questionId}`}
              importanceToggleEnabled
              isSubmitting={disabled}
              sliderOpen={sliderOpen}
              sliderMode={sliderMode}
              convictionValue={(edited.conviction ?? 0) / 10}
              importanceValue={(edited.importance ?? 0) / 10}
              activeSliderValue={(edited[sliderMode] ?? 0) / 10}
              hasConvictionImportanceValue={edited.conviction !== undefined || edited.importance !== undefined}
              onSelectMode={(mode) => {
                setSliderMode(mode);
                setSliderOpen(true);
              }}
              onChange={(value) => onEdit({ [sliderMode]: value * 10 })}
            />
            <FullQuestionFooterIcons
              questionId={draft.questionId}
              hasAdditionalContent={Boolean(comments.trim())}
              commentsOpen={showComments}
              onToggleComments={() => setShowComments((value) => !value)}
            >
              {renderFieldLock?.(draft.questionId, 'answer')}
            </FullQuestionFooterIcons>
          </div>
          {showComments ? (
            <AdditionalCommentsInlineRow
              lockControl={renderFieldLock?.(draft.questionId, 'additional')}
              input={
                renderAdditionalInput ? (
                  renderAdditionalInput(draft.questionId, comments, onCommentsChange)
                ) : (
                  <Input
                    type="textarea"
                    value={comments}
                    onChange={(event) => onCommentsChange(event.target.value)}
                    disabled={disabled}
                    aria-label={`Additional comments for ${prompt}`}
                  />
                )
              }
            />
          ) : null}
        </div>
      </div>
      {draft.confidence !== undefined ? (
        <div
          className={styles.sessionInterviewConfidence}
          aria-label={`Prediction confidence: ${percent}% (${confidenceLabel})`}
          data-testid={E2E_TESTIDS.SESSION_INTERVIEW_DRAFT_CONFIDENCE}
          data-ce-question-id={draft.questionId}
        >
          <div className={styles.sessionInterviewConfidenceMeta}>
            <strong>{percent}% confidence</strong>
            <span>{confidenceLabel}</span>
          </div>
          <div
            className={styles.sessionInterviewConfidenceTrack}
            role="progressbar"
            aria-label={`Confidence for ${prompt}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <span style={{ width: `${percent}%` }} />
          </div>
        </div>
      ) : null}
      {draft.evidence ? (
        <div className={styles.sessionInterviewEvidenceDisclosure}>
          <button
            type="button"
            className={styles.sessionInterviewEvidenceToggle}
            onClick={() => setShowEvidence((value) => !value)}
            aria-expanded={showEvidence}
            aria-controls={evidenceId}
            data-testid={E2E_TESTIDS.SESSION_INTERVIEW_DRAFT_BASIS_TOGGLE}
            data-ce-question-id={draft.questionId}
          >
            <FontAwesomeIcon
              icon={faCaretDown}
              className={`${styles.sessionInterviewEvidenceCaret} ${showEvidence ? styles.sessionInterviewEvidenceCaretExpanded : ''}`}
            />{' '}
            Basis
          </button>
          {showEvidence ? (
            <div id={evidenceId} className={styles.sessionInterviewEvidence}>
              {draft.evidence}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className={styles.sessionInterviewDraftActions}>
        <button
          type="button"
          className={`${styles.sessionInterviewDraftApply} ${selected ? styles.sessionInterviewDraftApplySelected : ''}`}
          onClick={() => onSelect(!selected)}
          aria-pressed={selected}
          disabled={disabled}
        >
          {selected ? <FontAwesomeIcon icon={faCheck} /> : null}
          {existing && !selected ? 'Replace with draft' : selected ? 'Draft selected' : 'Select draft'}
        </button>
      </div>
    </article>
  );
}
