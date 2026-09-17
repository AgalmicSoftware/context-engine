import React, { useState } from 'react';
import { Input } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faTimes } from '@fortawesome/free-solid-svg-icons';
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
  const [commentsEdited, setCommentsEdited] = useState(false);
  const prompt = question?.prompt || draft.questionId;
  const evidenceId = `ce-session-interview-basis-${draft.questionId}`;
  const percent = Math.round(Math.max(0, Math.min(1, draft.confidence || 0)) * 100);
  const confidenceLabel = percent < 40 ? 'Weak inference' : percent < 70 ? 'Moderate support' : 'Strong support';
  const comments = edited.additionalComments || '';
  const answerIsAgentDraft =
    !edited.userEditedFields?.includes('answer') && JSON.stringify(edited.answer) === JSON.stringify(draft.answer);
  const commentsAreAgentDraft =
    !edited.userEditedFields?.includes('additionalComments') &&
    Boolean(draft.additionalComments) &&
    comments === draft.additionalComments;
  const onAnswerChange = (answer: unknown) => onEdit({ answer });
  const onCommentsChange = (additionalComments: string) => {
    setCommentsEdited(true);
    onEdit({ additionalComments });
  };
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
        <p className={styles.sessionInterviewFieldOrigin}>
          <strong>{answerIsAgentDraft ? 'Agent:' : 'User:'}</strong>{' '}
          {answerIsAgentDraft ? 'Auto-filled answer' : 'Edited answer'}
        </p>
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
              sliderToggleExpandedByQuestion={{ [`interview-${draft.questionId}`]: sliderOpen }}
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
            <div className={styles.pileCommentsRow}>
              <div className={styles.pileAdditionalEditor}>
                {comments &&
                (commentsAreAgentDraft || commentsEdited || edited.userEditedFields?.includes('additionalComments')) ? (
                  <p className={styles.sessionInterviewFieldOrigin}>
                    <strong>{commentsAreAgentDraft ? 'Agent:' : 'User:'}</strong>{' '}
                    {commentsAreAgentDraft ? 'Auto-filled comments' : 'Edited comments'}
                  </p>
                ) : null}
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
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {draft.confidence !== undefined ? (
        <div
          className={styles.sessionInterviewConfidence}
          title="The AI’s estimate of how well this draft is supported by the available evidence."
          aria-label={`AI-estimated confidence: ${percent}%`}
          data-testid={E2E_TESTIDS.SESSION_INTERVIEW_DRAFT_CONFIDENCE}
          data-ce-question-id={draft.questionId}
        >
          <div className={styles.sessionInterviewConfidenceMeta}>
            <strong>{percent}% AI-estimated confidence</strong>
          </div>
          <div
            className={styles.sessionInterviewConfidenceTrack}
            role="progressbar"
            aria-label={`AI-estimated confidence for ${prompt}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <span style={{ width: `${percent}%` }} />
          </div>
        </div>
      ) : null}
      {draft.evidence || draft.confidence !== undefined ? (
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
              {draft.confidence !== undefined ? <div>AI-estimated support: {confidenceLabel}</div> : null}
              {draft.evidence}
            </div>
          ) : null}
        </div>
      ) : null}
      {!selected ? (
        <div className={styles.sessionInterviewDraftActions}>
          <button
            type="button"
            className={styles.sessionInterviewDraftApply}
            onClick={() => onSelect(true)}
            disabled={disabled}
          >
            {existing ? 'Replace with draft' : 'Restore draft'}
          </button>
        </div>
      ) : null}
    </article>
  );
}
