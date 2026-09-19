import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Input } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faRobot, faTimes } from '@fortawesome/free-solid-svg-icons';
import BinaryChoiceInput from './BinaryChoiceInput';
import FullQuestionFooterIcons from './FullQuestionFooterIcons';
import AdditionalCommentsInlineRow from './AdditionalCommentsInlineRow';
import SurveyQuestionsFullQuestionSliderSection from './SurveyQuestionsFullQuestionSliderSection';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import type { InterviewDraftResponse, InterviewQuestion } from './sessionInterview';
import styles from './SessionInterviewDraftCard.module.scss';

export type InterviewQuestionControls = {
  renderAnswerInput?: (questionId: string, value: unknown, onChange: (value: unknown) => void) => React.ReactNode;
  renderAdditionalInput?: (questionId: string, value: string, onChange: (value: string) => void) => React.ReactNode;
  renderFieldLock?: (questionId: string, field: 'answer' | 'additional') => React.ReactNode;
};

type EditableField = 'answer' | 'additionalComments' | 'importance' | 'conviction';

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

const valuesEqual = (left: unknown, right: unknown): boolean => {
  try {
    return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
  } catch (_) {
    return left === right;
  }
};

const addEditedField = (edited: InterviewDraftResponse, field: EditableField): EditableField[] => {
  const fields = new Set<EditableField>((edited.userEditedFields || []) as EditableField[]);
  fields.add(field);
  return [...fields];
};

type DraftEditableTextProps = {
  label: string;
  value: string;
  displayValue?: string;
  placeholder: string;
  disabled: boolean;
  onChange: (value: string) => void;
  renderEditor?: (value: string, onChange: (value: string) => void) => React.ReactNode;
};

const DraftEditableText = ({
  label,
  value,
  displayValue: displayValueOverride,
  placeholder,
  disabled,
  onChange,
  renderEditor,
}: DraftEditableTextProps) => {
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const injectedEditorRef = useRef<HTMLDivElement | null>(null);
  const injectedResizeFrameRef = useRef<number | null>(null);
  const displayValue = (displayValueOverride ?? value).trim();
  const resizeTextAreaToContent = useCallback((node: HTMLTextAreaElement) => {
    const computed = window.getComputedStyle(node);
    const borderBoxAdjustment =
      computed.boxSizing === 'border-box'
        ? (Number.parseFloat(computed.borderTopWidth) || 0) + (Number.parseFloat(computed.borderBottomWidth) || 0)
        : 0;
    node.style.height = 'auto';
    node.style.overflow = 'hidden';
    node.style.overflowY = 'hidden';
    node.style.height = `${Math.ceil(node.scrollHeight + borderBoxAdjustment)}px`;
  }, []);
  const resizeInjectedTextareas = useCallback(() => {
    const wrapper = injectedEditorRef.current;
    if (!wrapper) return;
    wrapper.querySelectorAll('textarea').forEach((node) => resizeTextAreaToContent(node));
  }, [resizeTextAreaToContent]);
  const scheduleInjectedResize = useCallback(() => {
    resizeInjectedTextareas();
    if (typeof window.requestAnimationFrame !== 'function') return;
    if (injectedResizeFrameRef.current !== null) window.cancelAnimationFrame(injectedResizeFrameRef.current);
    injectedResizeFrameRef.current = window.requestAnimationFrame(() => {
      injectedResizeFrameRef.current = null;
      resizeInjectedTextareas();
    });
  }, [resizeInjectedTextareas]);
  useEffect(() => {
    if (!editing || !textareaRef.current) return;
    resizeTextAreaToContent(textareaRef.current);
  }, [editing, resizeTextAreaToContent, value]);
  useEffect(() => {
    if (!editing) return;
    textareaRef.current?.focus();
    const wrapper = injectedEditorRef.current;
    if (!wrapper) return;
    const firstTextarea = wrapper.querySelector<HTMLTextAreaElement>('textarea');
    firstTextarea?.focus();
    scheduleInjectedResize();
  }, [editing, scheduleInjectedResize]);
  useEffect(() => {
    if (!editing || !renderEditor) return;
    scheduleInjectedResize();
  }, [editing, renderEditor, scheduleInjectedResize, value]);
  useEffect(() => {
    if (!editing || !renderEditor) return undefined;
    const onResize = () => scheduleInjectedResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [editing, renderEditor, scheduleInjectedResize]);
  useEffect(
    () => () => {
      if (injectedResizeFrameRef.current !== null && typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(injectedResizeFrameRef.current);
      }
    },
    [],
  );

  if (editing && !disabled && renderEditor) {
    return (
      <div
        ref={injectedEditorRef}
        className={styles.injectedEditorShell}
        onInputCapture={scheduleInjectedResize}
        onBlur={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
          setEditing(false);
        }}
      >
        {renderEditor(value, onChange)}
        <button type="button" className={styles.doneEditingButton} onClick={() => setEditing(false)}>
          Done editing
        </button>
      </div>
    );
  }

  if (editing && !disabled) {
    return (
      <Input
        innerRef={textareaRef}
        type="textarea"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onInput={() => {
          const node = textareaRef.current;
          if (!node) return;
          resizeTextAreaToContent(node);
        }}
        onBlur={() => setEditing(false)}
        aria-label={label}
        className={styles.autosizeTextArea}
        rows={1}
      />
    );
  }

  return (
    <div className={styles.readableTextShell}>
      <button
        type="button"
        className={styles.readableTextButton}
        onClick={() => !disabled && setEditing(true)}
        onKeyDown={(event) => {
          if (disabled || (event.key !== 'Enter' && event.key !== ' ')) return;
          event.preventDefault();
          setEditing(true);
        }}
        disabled={disabled}
        aria-label={`${label}. Activate to edit.`}
      >
        {displayValue ? displayValue : <span className={styles.emptyReadableText}>{placeholder}</span>}
      </button>
      {!disabled ? <span className={styles.editHint}>Tap or press Enter to edit.</span> : null}
    </div>
  );
};

const isNativeAnswerType = (question?: InterviewQuestion): boolean => {
  const type = String(question?.type || '').toLowerCase();
  return type === 'binary' || type === 'rating' || type === 'multichoice' || type === 'multiple-choice';
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
  const editedFields = edited.userEditedFields || [];
  const hasHumanEditedDraft = editedFields.some((field) =>
    ['answer', 'additionalComments', 'importance', 'conviction'].includes(String(field)),
  );
  const rawComments = String(edited.additionalComments || '');
  const answerValue = edited.answer;
  const useNativeAnswer = isNativeAnswerType(question);
  const markEdit = (field: EditableField, value: unknown) => {
    if (valuesEqual(value, edited[field])) return { [field]: value } as Partial<InterviewDraftResponse>;
    return { [field]: value, userEditedFields: addEditedField(edited, field) } as Partial<InterviewDraftResponse>;
  };
  const onAnswerChange = (answer: unknown) => onEdit(markEdit('answer', answer));
  const onCommentsChange = (additionalComments: string) => {
    onEdit(markEdit('additionalComments', additionalComments));
  };
  return (
    <article
      className={`${styles.draftCard} ${selected ? '' : styles.draftCardRemoved}`}
      data-testid={E2E_TESTIDS.SESSION_INTERVIEW_DRAFT}
      data-ce-question-id={draft.questionId}
    >
      <button
        type="button"
        className={styles.removeButton}
        onClick={() => onSelect(false)}
        aria-label={`Remove draft for ${prompt}`}
        title="Remove draft"
        disabled={disabled || !selected}
        data-testid={E2E_TESTIDS.SESSION_INTERVIEW_DRAFT_REMOVE}
        data-ce-question-id={draft.questionId}
      >
        <FontAwesomeIcon icon={faTimes} />
      </button>
      <div className={styles.questionText}>{prompt}</div>
      <div className={styles.editorStack}>
        {useNativeAnswer && renderAnswerInput ? (
          renderAnswerInput(draft.questionId, answerValue, onAnswerChange)
        ) : question?.type === 'binary' ? (
          <BinaryChoiceInput
            questionId={draft.questionId}
            value={String(answerValue ?? '')}
            inputNamePrefix="interview-draft"
            onChange={onAnswerChange}
            disabled={disabled}
          />
        ) : (
          <DraftEditableText
            label={`Draft answer for ${prompt}`}
            value={typeof answerValue === 'string' ? answerValue : JSON.stringify(answerValue ?? '')}
            placeholder="No draft answer yet."
            disabled={disabled}
            onChange={onAnswerChange}
            renderEditor={
              renderAnswerInput
                ? (value, onChange) =>
                    renderAnswerInput(draft.questionId, value, (nextValue) => onChange(String(nextValue ?? '')))
                : undefined
            }
          />
        )}
        <div className={styles.footerShell}>
          <div className={styles.controlsRow}>
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
              onChange={(value) => onEdit(markEdit(sliderMode, value * 10))}
            />
            <div className={styles.footerIconCluster}>
              {!hasHumanEditedDraft ? (
                <span className={styles.agentCommentMarker} aria-label="AI-proposed response">
                  <FontAwesomeIcon icon={faRobot} />
                </span>
              ) : null}
              <FullQuestionFooterIcons
                questionId={draft.questionId}
                hasAdditionalContent={Boolean(rawComments.trim())}
                commentsOpen={showComments}
                onToggleComments={() => setShowComments((value) => !value)}
              >
                {renderFieldLock?.(draft.questionId, 'answer')}
              </FullQuestionFooterIcons>
            </div>
          </div>
          {showComments ? (
            <div className={styles.commentsRow}>
              <div className={styles.additionalEditor}>
                <AdditionalCommentsInlineRow
                  lockControl={renderFieldLock?.(draft.questionId, 'additional')}
                  input={
                    <DraftEditableText
                      label={`Additional comments for ${prompt}`}
                      value={rawComments}
                      placeholder="No additional comment."
                      disabled={disabled}
                      onChange={onCommentsChange}
                      renderEditor={
                        renderAdditionalInput
                          ? (value, onChange) => renderAdditionalInput(draft.questionId, value, onChange)
                          : undefined
                      }
                    />
                  }
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {draft.confidence !== undefined ? (
        <div
          className={styles.confidence}
          title="The AI’s estimate of how well this draft is supported by the available evidence."
          aria-label={`AI-estimated confidence: ${percent}%`}
          data-testid={E2E_TESTIDS.SESSION_INTERVIEW_DRAFT_CONFIDENCE}
          data-ce-question-id={draft.questionId}
        >
          <div className={styles.confidenceMeta}>
            <strong>{percent}% AI-estimated confidence</strong>
          </div>
          <div
            className={styles.confidenceTrack}
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
        <div className={styles.evidenceDisclosure}>
          <button
            type="button"
            className={styles.evidenceToggle}
            onClick={() => setShowEvidence((value) => !value)}
            aria-expanded={showEvidence}
            aria-controls={evidenceId}
            data-testid={E2E_TESTIDS.SESSION_INTERVIEW_DRAFT_BASIS_TOGGLE}
            data-ce-question-id={draft.questionId}
          >
            <FontAwesomeIcon
              icon={faCaretDown}
              className={`${styles.evidenceCaret} ${showEvidence ? styles.evidenceCaretExpanded : ''}`}
            />{' '}
            Basis
          </button>
          {showEvidence ? (
            <div id={evidenceId} className={styles.evidenceText}>
              {draft.confidence !== undefined ? <div>AI-estimated support: {confidenceLabel}</div> : null}
              {draft.evidence}
            </div>
          ) : null}
        </div>
      ) : null}
      {!selected ? (
        <div className={styles.draftActions}>
          <button type="button" className={styles.restoreButton} onClick={() => onSelect(true)} disabled={disabled}>
            {existing ? 'Replace with draft' : 'Restore draft'}
          </button>
        </div>
      ) : null}
    </article>
  );
}
