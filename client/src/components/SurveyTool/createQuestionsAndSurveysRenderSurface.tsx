import React from 'react';
import { Button, Label, Input } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSpinner,
  faClipboard,
  faPlus,
  faTimes,
  faBookmark,
  faCheck,
  faPenNib,
  faExternalLinkAlt,
  faMagic,
  faExclamationCircle,
  faCaretDown,
  faCaretUp,
  faEraser,
  faQuestionCircle,
} from '@fortawesome/free-solid-svg-icons';

import styles from './CreateQuestionsAndSurveys.module.scss';
import CETooltip from '../Shared/CETooltip';
import CEConfirmDialog from '../Shared/CEConfirmDialog';
import { normalizeArweaveUrl } from '../../utilities/arweave/arweaveUrls.js';
import { litStorage } from '../../utilities/crypto/litProtocol.js';
import AudioSurveyGenerator from './SurveyGenerator/SurveyGenerator';
import { JsonButtonRow, JsonPanel, JsonToggleButton } from '../Shared/Json/JsonControls';
import GateMultiSelectLock from '../Gates/GateMultiSelectLock';
import { buildQuestionRoutePath } from '../../utilities/survey/questionRouting.js';
import { getLegacyArweaveTxId } from '../../utilities/storage/storageRefs.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { mergeSessionContractMaps } from '../../utilities/session/sessionNaming.js';
import { t } from '../../utilities/ui/terminology.js';
import {
  buildCreateSurveyOpenLockKeyPatch,
  buildCreateSurveySurveyLockGateIdsPatch,
  normalizeGateIds,
  normalizePayloadQuestionOptions,
  normalizeTagList,
  resolvePayloadSingleSelect,
} from './createQuestionsAndSurveysHelpers.js';
import { sanitizeDocumentUrls } from './createQuestionsAndSurveysDocumentUrlHelpers';
import {
  CREATE_SURVEY_ACTION_ICON_STYLE,
  CREATE_SURVEY_AUTO_TOOL_PANEL_STYLE,
  CREATE_SURVEY_CLEAR_FORM_BUTTON_STYLE,
  CREATE_SURVEY_HEADER_ICON_STYLE,
  CREATE_SURVEY_SMALL_ICON_BUTTON_STYLE,
  CREATE_SURVEY_SUBMIT_ICON_STYLE,
  CREATE_SURVEY_TRAILING_TOGGLE_LABEL_STYLE,
  CREATE_SURVEY_UPLOADED_QUESTION_LINK_STYLE,
  buildCreateSurveyActionLinkClassName,
  buildCreateSurveyAiPromptCopyClassName,
  buildCreateSurveyContainerClassName,
  buildCreateSurveyProgressStepClassName,
  buildCreateSurveySubmitButtonClassName,
  buildCreateSurveyTypePillClassName,
  resolveCreateSurveyBookmarkSurveyStyle,
  resolveCreateSurveyProgressFillStyle,
  resolveCreateSurveyQuestionBookmarkStyle,
  resolveCreateSurveyToggleKnobStyle,
} from './createQuestionsAndSurveysDisplayHelpers';

type UnknownRecord = Record<string, unknown>;
type FocusablePromptElement = HTMLInputElement | HTMLTextAreaElement;

type CreateSurveyRenderQuestion = UnknownRecord & {
  id?: string;
  uiKey?: string;
  type?: string;
  prompt?: string;
  options?: string[];
  singleSelect?: boolean;
  oneSelectionOnly?: boolean;
  associatedSurveyId?: string;
  tags?: string[];
  aiGeneratedTagsFromSource?: string[];
  currentTagInputValue?: string;
  isGeneratingTags?: boolean;
  lockGateIds?: string[] | null;
  lockGateIdsTouched?: boolean;
};

type CreateSurveyUploadedQuestionEntry = UnknownRecord & {
  questionId?: string;
  arweaveTxId?: string;
  storageRef?: unknown;
};

type CreateSurveyRenderedQuestion = CreateSurveyRenderQuestion & {
  prompt: string;
  type: string;
  uiKey: string;
};

type CreateSurveyUploadedQuestionRenderEntry = CreateSurveyUploadedQuestionEntry & {
  questionId: string;
};

type CreateSurveyGateOption = UnknownRecord & {
  id: string;
  label: string;
  displayLabel: string;
  badgeLabel: string;
  color: string;
  mode: string;
  requireAll: boolean;
  sbtAddresses: string[];
  sbtAddress: string;
  resourceKey: string;
};

type CreateSurveyGateOptionsResult = {
  gateMap: Record<string, unknown>;
  gateOptions: CreateSurveyGateOption[];
  defaultGateId: string;
};

type CreateSurveyRenderProps = UnknownRecord & {
  account?: string;
  provider?: unknown;
  network?: UnknownRecord | null;
  loginComplete?: boolean;
  toggleLoginModal?: (open?: boolean) => void;
  activeSessionSlug?: string;
  sessionSlug?: string;
  sessionConfig?: UnknownRecord | null;
  contracts?: UnknownRecord;
  defaultTags?: string[] | string;
  documentURLs?: string[];
  networkChainId?: number | null;
  litHooks?: unknown;
  preformedQuestions?: UnknownRecord[];
  miniaturized?: boolean;
  hideSurveyQuestionToggleUntilAuthoring?: boolean;
};

type CreateSurveyRenderState = UnknownRecord & {
  title: string;
  questions: CreateSurveyRenderQuestion[];
  isSubmitting: boolean;
  progress: number;
  showJson: boolean;
  isStandaloneQuestion: boolean;
  surveyAddedSuccessfully: boolean;
  questionsAddedSuccessfully: boolean;
  uploadedQuestions: CreateSurveyUploadedQuestionEntry[];
  submissionError: string;
  showAutoTool: boolean;
  documentURLs: string[];
  lastSubmittedSurveyId: string;
  autoPopulateAiTags: boolean;
  lastSubmittedSurveyArweaveTxId: string;
  submitStep: number;
  surveyLockGateIds: string[];
  openLockKey: string;
  formValidationError: string;
  surveyHash: string;
  docURLInput: string;
  docURLError: string;
  showSubmitSteps: boolean;
  needsNetworkSwitch: boolean;
  bookmarkedQuestionsSet: Set<string>;
  bookmarkedSurveysSet: Set<string>;
  copySurveyIdSuccess: boolean;
  copySurveyLinkSuccess: boolean;
  copyJsonSuccess: boolean;
  showAIPrompt: boolean;
  aiPromptCopySuccess: boolean;
  aiPromptModelLabel: string;
  aiPromptText: string;
  showClearFormConfirm: boolean;
};

type CreateSurveySetState = (
  state:
    | Partial<CreateSurveyRenderState>
    | null
    | ((prevState: CreateSurveyRenderState, props: CreateSurveyRenderProps) => Partial<CreateSurveyRenderState> | null),
  callback?: () => void,
) => void;

type CreateSurveyTagInputKeyEvent = {
  key: string;
  preventDefault: () => void;
};

type CreateSurveyInputValueEvent = {
  target: {
    value: string;
  };
};

type CreateSurveyCheckboxChangeEvent = {
  target: {
    checked: boolean;
    name: string;
  };
};

export type RenderCreateQuestionsAndSurveysSurfaceController = {
  addDocumentURL: () => void;
  addOption: (questionIndex: number) => void;
  bookmarkQuestion: (questionId: unknown) => void;
  bookmarkSurvey: (surveyId: unknown) => void;
  cancelClearForm: () => void;
  confirmClearForm: () => void;
  copyAIPromptToClipboard: () => void;
  copyJsonPreview: (jsonData: unknown) => void;
  copyQuestionIdToClipboard: (qid: unknown) => void;
  copySurveyIdToClipboard: (surveyId: unknown) => void;
  copySurveyLinkToClipboard: (surveyId?: unknown) => void;
  getActiveSessionSlug: () => string;
  getResolvedSessionConfig: () => UnknownRecord;
  getSessionConfig: () => UnknownRecord;
  handleAutoQuestionsGenerated: (questionsArray: UnknownRecord[], docURLs?: unknown[], aiTitle?: unknown) => void;
  handleClearForm: () => void;
  handleCurrentTagInputChange: (questionIndex: number, value: unknown) => void;
  handleDocURLInputChange: (event: CreateSurveyInputValueEvent) => void;
  handleDocUrlKeyDown: (event: CreateSurveyTagInputKeyEvent) => void;
  handleOptionChange: (questionIndex: number, optionIndex: number, value: unknown) => void;
  handleQuestionChange: (index: number, key: string, value: unknown) => void;
  handleSubmitButtonClick: () => void;
  handleTagInputKeyDown: (questionIndex: number, event: CreateSurveyTagInputKeyEvent) => void;
  handleTitleChange: (event: CreateSurveyInputValueEvent) => void;
  processTagInput: (questionIndex: number) => void;
  promptRefs: Record<string, FocusablePromptElement | null>;
  props: CreateSurveyRenderProps;
  quickAdd: (type: string) => void;
  removeDocumentURL: (index: number) => void;
  removeOption: (questionIndex: number, optionIndex: number) => void;
  removeQuestion: (index: number) => void;
  removeTagFromQuestion: (questionIndex: number, tagIndexToRemove: number) => void;
  resolveGateOptions: (cfgIn?: unknown, args?: { isStandaloneQuestion?: unknown }) => CreateSurveyGateOptionsResult;
  saveToLocalStorage: () => void;
  setState: CreateSurveySetState;
  state: CreateSurveyRenderState;
  suggestTagsForQuestion: (questionIndex: number) => Promise<void>;
  switchToCorrectNetwork: () => Promise<void>;
  toggleAIPrompt: () => void;
  toggleAutoTool: () => void;
  toggleShowJson: () => void;
  toggleStandaloneQuestion: () => void;
};

const highlightPromptVariables = (str: unknown): React.ReactNode[] | null => {
  if (!str) return null;
  const text = String(str);
  const re = /<([A-Za-z][A-Za-z0-9_]*)>/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(
      <span key={match.index} className={styles.aiVar}>
        {'<'}
        {match[1]}
        {'>'}
      </span>,
    );
    lastIndex = re.lastIndex;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
};

const renderCreateSurveyTypeSelector = (quickAdd: (type: string) => void): React.ReactNode => (
  <div className={styles.typeSelectorBlock}>
    <div className={styles.typeSelectorLabel}>Choose Question Type</div>
    <div className={styles.typeSelectorGrid} role="group" aria-label="Question types">
      <button
        type="button"
        className={styles.typeButton}
        onClick={() => quickAdd('binary')}
        aria-label="Add Binary question"
      >
        <div className={styles.typeTitle}>Binary</div>
        <div className={styles.typePreviewRow}>
          <span className={buildCreateSurveyTypePillClassName(styles, 'agree')}>Agree</span>
          <span className={buildCreateSurveyTypePillClassName(styles, 'unsure')}>Unsure</span>
          <span className={buildCreateSurveyTypePillClassName(styles, 'disagree')}>Disagree</span>
        </div>
      </button>

      <button
        type="button"
        className={styles.typeButton}
        onClick={() => quickAdd('rating')}
        aria-label="Add Rating question"
      >
        <div className={styles.typeTitle}>Rating</div>
        <div className={styles.ratingPreviewWrap} aria-hidden="true">
          <div className={styles.ratingPreviewFill} />
          <div className={styles.ratingPreviewHandle} />
        </div>
      </button>

      <button
        type="button"
        className={styles.typeButton}
        onClick={() => quickAdd('multichoice')}
        aria-label="Add Multichoice question"
      >
        <div className={styles.typeTitle}>Multichoice</div>
        <div className={styles.typePreviewRow}>
          <span className={styles.pill}>Option 1</span>
          <span className={styles.pill}>Option 2</span>
          <span className={styles.pill}>Option 3</span>
        </div>
      </button>

      <button
        type="button"
        className={styles.typeButton}
        onClick={() => quickAdd('freeform')}
        aria-label="Add Freeform question"
      >
        <div className={styles.typeTitle}>Freeform</div>
        <div className={styles.freeformPreview} aria-hidden="true">
          ...
        </div>
      </button>
    </div>
  </div>
);

export const renderCreateQuestionsAndSurveysSurface = (
  controller: RenderCreateQuestionsAndSurveysSurfaceController,
): React.ReactNode => {
  const { props, state } = controller;
  const {
    title,
    questions,
    isSubmitting,
    progress,
    showJson,
    isStandaloneQuestion,
    surveyAddedSuccessfully,
    questionsAddedSuccessfully,
    uploadedQuestions,
    submissionError,
    showAutoTool,
    documentURLs,
    lastSubmittedSurveyId,
    autoPopulateAiTags,
    lastSubmittedSurveyArweaveTxId,
    submitStep,
    surveyLockGateIds,
    openLockKey,
    formValidationError,
  } = state;
  const docUrlErrorId = 'ce-create-doc-url-error';
  const safeDocumentUrls = sanitizeDocumentUrls(documentURLs);
  const renderedQuestions = questions as CreateSurveyRenderedQuestion[];
  const uploadedQuestionEntries = uploadedQuestions as CreateSurveyUploadedQuestionRenderEntry[];
  const hasAuthoredDraftContent =
    questions.length > 0 ||
    title.trim() !== '' ||
    safeDocumentUrls.length > 0 ||
    surveyAddedSuccessfully ||
    questionsAddedSuccessfully;
  // Pile entry starts in AI mode, so hide the survey/questions switch until
  // the user either starts manual authoring or generation produces content.
  const showModeToggle = !props.hideSurveyQuestionToggleUntilAuthoring || !showAutoTool || hasAuthoredDraftContent;

  const surveyIDForDisplay = lastSubmittedSurveyId || state.surveyHash;
  const sessionConfig = controller.getSessionConfig();
  const resolvedSessionConfig = controller.getResolvedSessionConfig();
  const { gateOptions, defaultGateId } = controller.resolveGateOptions(resolvedSessionConfig, { isStandaloneQuestion });
  const gateOptionsList = (Array.isArray(gateOptions) ? gateOptions : []) as CreateSurveyGateOption[];
  const hasSelectableGateOptions = gateOptionsList.length > 0;
  const gateIdSet: Set<string> = new Set(gateOptionsList.map((opt) => opt.id));
  const resolvedContracts = mergeSessionContractMaps(
    resolvedSessionConfig?.contracts,
    props.contracts,
    sessionConfig?.contracts,
  );

  const normalizeSelectedGateIds = (value: unknown) =>
    normalizeGateIds(value).filter((gateId: string) => gateIdSet.has(gateId));
  const applyDefaultSelectedGateIds = (value: unknown) => {
    const normalized = normalizeSelectedGateIds(value);
    if (normalized.length) return normalized;
    return defaultGateId ? [defaultGateId] : [];
  };
  const applyStandaloneSelectedGateIds = (value: unknown, touched: unknown) => {
    const normalized = normalizeSelectedGateIds(value);
    if (normalized.length) return normalized;
    if (touched && Array.isArray(value) && normalizeGateIds(value).length === 0) return [];
    return defaultGateId ? [defaultGateId] : [];
  };
  const surveySelectedGateIds = !isStandaloneQuestion ? applyDefaultSelectedGateIds(surveyLockGateIds) : [];

  // JSON preview (only questions; no questionIDs)
  let jsonData: Record<string, unknown> = {};
  if (isStandaloneQuestion) {
    jsonData = {
      questions: renderedQuestions.map((q) => ({
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        options: normalizePayloadQuestionOptions(q.type, q.options),
        singleSelect: resolvePayloadSingleSelect(q.type, q.singleSelect),
        tags: normalizeTagList(q.tags),
        associatedSurveyId: q.associatedSurveyId || '',
      })),
    };
  } else {
    jsonData = {
      surveyID: state.surveyHash,
      title: title,
      documentURLs: safeDocumentUrls,
      questions: renderedQuestions.map((q) => ({
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        options: normalizePayloadQuestionOptions(q.type, q.options),
        singleSelect: resolvePayloadSingleSelect(q.type, q.singleSelect),
        tags: normalizeTagList(q.tags),
      })),
    };
  }
  // Note: lock-driven encryption is applied at submit-time per survey/question.

  const manualCreationUI = (
    <>
      {!isStandaloneQuestion && (
        <div className={styles.surveyTitleRow}>
          <Input
            className={styles.surveyTitleInput}
            placeholder="Title"
            data-testid={E2E_TESTIDS.CREATE_TITLE}
            value={title}
            onChange={controller.handleTitleChange}
            required={!isStandaloneQuestion}
          />
          {hasSelectableGateOptions ? (
            <div className={styles.surveyTitleLock}>
              <GateMultiSelectLock
                gateOptions={gateOptions}
                selectedGateIds={surveySelectedGateIds}
                onChangeSelectedGateIds={(nextIds: unknown) => {
                  const normalized = normalizeSelectedGateIds(nextIds);
                  controller.setState(
                    buildCreateSurveySurveyLockGateIdsPatch(normalized),
                    controller.saveToLocalStorage,
                  );
                  if (!normalized.length) {
                    controller.setState(buildCreateSurveyOpenLockKeyPatch());
                  }
                }}
                open={openLockKey === 'survey'}
                onToggleOpen={(nextOpen: unknown) => {
                  if (nextOpen && surveySelectedGateIds.length === 0 && defaultGateId) {
                    controller.setState(
                      buildCreateSurveySurveyLockGateIdsPatch([defaultGateId]),
                      controller.saveToLocalStorage,
                    );
                  }
                  controller.setState(buildCreateSurveyOpenLockKeyPatch(nextOpen ? 'survey' : ''));
                }}
                disabled={!hasSelectableGateOptions}
                showDots={false}
              />
              <FontAwesomeIcon icon={faQuestionCircle} className={styles.tooltip} id="cs-survey-gate-tip" />
              <CETooltip
                placement="right"
                trigger="hover focus click"
                target="cs-survey-gate-tip"
                className={styles.tooltipBubble}
              >
                {`Only holders of selected ${t('sbtsLower')} can access locked content.`}
              </CETooltip>
            </div>
          ) : null}
        </div>
      )}

      {/* Multi Document URL Input Group */}
      {!isStandaloneQuestion && (
        <div className={styles.docUrlSection}>
          <div className={styles.docUrlInputGroup}>
            <Input
              className={styles.docUrlInput}
              placeholder="Source document URL (optional)"
              value={state.docURLInput || ''}
              onChange={controller.handleDocURLInputChange}
              onKeyDown={controller.handleDocUrlKeyDown}
              aria-invalid={state.docURLError ? 'true' : undefined}
              aria-describedby={state.docURLError ? docUrlErrorId : undefined}
            />
            <button
              type="button"
              className={styles.addDocUrlButton}
              onClick={controller.addDocumentURL}
              disabled={!state.docURLInput.trim()}
            >
              <FontAwesomeIcon icon={faPlus} />
            </button>
          </div>
          {state.docURLError && (
            <div id={docUrlErrorId} className={styles.inlineValidationError} data-testid="ce-create-doc-url-error">
              {state.docURLError}
            </div>
          )}

          {safeDocumentUrls.length > 0 && (
            <div className={styles.documentUrlDisplay}>
              <strong>Attached Document URL(s):</strong>
              <ul>
                {safeDocumentUrls.map((url: string, idx: number) => (
                  <li key={idx} className={styles.documentUrlItem}>
                    {litStorage.isLitArweaveUrl(url) ? (
                      <span className={styles.documentUrlEncrypted}>Encrypted doc ({url})</span>
                    ) : (
                      <a
                        href={normalizeArweaveUrl(url, { contextLabel: 'create_survey_document_url' })}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {url}
                      </a>
                    )}
                    <span
                      className={styles.removeDocumentUrlButton}
                      onClick={() => controller.removeDocumentURL(idx)}
                      title="Remove URL"
                    >
                      <FontAwesomeIcon icon={faTimes} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {formValidationError && (
        <div className={styles.inlineValidationError} data-testid="ce-create-validation-error" role="alert">
          {formValidationError}
        </div>
      )}

      {renderedQuestions.map((question, qIndex: number) => {
        const questionTags = normalizeTagList(question.tags);
        const aiSourceTags = normalizeTagList(question.aiGeneratedTagsFromSource);
        // Logic to determine if the "Magic Wand" (Generate Tags) button should be visible
        // It hides if tags are already fully populated from AI source
        const hasAiSourceTags = aiSourceTags.length > 0;
        const aiSourceTagsFullyInQuestionTags =
          hasAiSourceTags &&
          aiSourceTags.every((aiTag: string) => questionTags.includes(aiTag)) &&
          questionTags.length === aiSourceTags.length;

        let showGenerateTagsButton = false;
        if (!hasAiSourceTags) {
          showGenerateTagsButton = true;
        } else {
          if (!autoPopulateAiTags && !aiSourceTagsFullyInQuestionTags) {
            showGenerateTagsButton = true;
          }
        }
        if (question.isGeneratingTags) showGenerateTagsButton = true;

        return (
          <div
            key={question.uiKey || `question-${qIndex}`}
            className={styles.questionContainer}
            data-testid={E2E_TESTIDS.CREATE_QUESTION}
            data-ce-question-index={qIndex}
          >
            <div className={styles.questionHeader}>
              <strong className={styles.questionTypeText}>
                #{qIndex + 1}:{' '}
                {question.type ? question.type.charAt(0).toUpperCase() + question.type.slice(1) : 'Unknown Type'}{' '}
                Question
              </strong>
              <div className={styles.questionHeaderActions}>
                {(() => {
                  const lockKey = `q-lock:${question.uiKey || qIndex}`;
                  const inheritsSurvey =
                    !isStandaloneQuestion &&
                    (!Object.prototype.hasOwnProperty.call(question || {}, 'lockGateIds') ||
                      question.lockGateIds === null);
                  const selectedGateIds = isStandaloneQuestion
                    ? applyStandaloneSelectedGateIds(question.lockGateIds, question.lockGateIdsTouched)
                    : inheritsSurvey
                      ? surveySelectedGateIds
                      : applyDefaultSelectedGateIds(question.lockGateIds);

                  return hasSelectableGateOptions ? (
                    <>
                      {!isStandaloneQuestion && (
                        <label className={styles.inheritToggle}>
                          <input
                            type="checkbox"
                            checked={inheritsSurvey}
                            onChange={(e: CreateSurveyCheckboxChangeEvent) => {
                              const checked = !!e.target.checked;
                              controller.setState((prev: CreateSurveyRenderState) => {
                                const updated = Array.isArray(prev.questions) ? [...prev.questions] : [];
                                const nextQ = { ...(updated[qIndex] || {}) };
                                if (checked) {
                                  nextQ.lockGateIds = null;
                                } else {
                                  const base = normalizeSelectedGateIds(prev.surveyLockGateIds);
                                  nextQ.lockGateIds = base.length ? base : defaultGateId ? [defaultGateId] : [];
                                }
                                updated[qIndex] = nextQ;
                                return { questions: updated, openLockKey: '' };
                              }, controller.saveToLocalStorage);
                            }}
                          />
                          inherit
                        </label>
                      )}

                      <GateMultiSelectLock
                        gateOptions={gateOptions}
                        selectedGateIds={selectedGateIds}
                        onChangeSelectedGateIds={(nextIds: unknown) => {
                          const normalized = normalizeSelectedGateIds(nextIds);
                          controller.setState((prev: CreateSurveyRenderState) => {
                            const updated = Array.isArray(prev.questions) ? [...prev.questions] : [];
                            const nextQ = { ...(updated[qIndex] || {}) };
                            nextQ.lockGateIds = normalized;
                            nextQ.lockGateIdsTouched = true;
                            updated[qIndex] = nextQ;
                            return {
                              questions: updated,
                              openLockKey: normalized.length ? prev.openLockKey : '',
                            };
                          }, controller.saveToLocalStorage);
                        }}
                        open={openLockKey === lockKey}
                        onToggleOpen={(nextOpen: unknown) => {
                          if (nextOpen && selectedGateIds.length === 0 && defaultGateId) {
                            if (!isStandaloneQuestion && inheritsSurvey) {
                              controller.setState(
                                buildCreateSurveySurveyLockGateIdsPatch([defaultGateId]),
                                controller.saveToLocalStorage,
                              );
                            } else {
                              controller.setState((prev: CreateSurveyRenderState) => {
                                const updated = Array.isArray(prev.questions) ? [...prev.questions] : [];
                                const nextQ = { ...(updated[qIndex] || {}) };
                                nextQ.lockGateIds = [defaultGateId];
                                nextQ.lockGateIdsTouched = true;
                                updated[qIndex] = nextQ;
                                return { questions: updated };
                              }, controller.saveToLocalStorage);
                            }
                          }
                          controller.setState(buildCreateSurveyOpenLockKeyPatch(nextOpen ? lockKey : ''));
                        }}
                        disabled={!hasSelectableGateOptions}
                        showDots={false}
                      />
                    </>
                  ) : null;
                })()}

                <Button className={styles.removeQuestionButton} onClick={() => controller.removeQuestion(qIndex)}>
                  <FontAwesomeIcon icon={faTimes} />
                </Button>
              </div>
            </div>

            {/* Ref attached to the prompt textarea for auto-focus */}
            <Input
              innerRef={(el: FocusablePromptElement | null) => {
                controller.promptRefs[question.uiKey] = el;
              }}
              type="textarea"
              rows="2"
              className={styles.questionPromptInput}
              placeholder="Question prompt"
              data-testid={E2E_TESTIDS.CREATE_QUESTION_PROMPT}
              value={question.prompt || ''}
              onChange={(e: CreateSurveyInputValueEvent) =>
                controller.handleQuestionChange(qIndex, 'prompt', e.target.value)
              }
            />

            {question.type === 'multichoice' && (
              <div className={styles.optionsContainer}>
                {(question.options || []).map((option: string, oIndex: number) => (
                  <div key={`option-${question.uiKey || qIndex}-${oIndex}`} className={styles.optionItem}>
                    <Input
                      placeholder={`Option ${oIndex + 1}`}
                      value={option}
                      onChange={(e: CreateSurveyInputValueEvent) =>
                        controller.handleOptionChange(qIndex, oIndex, e.target.value)
                      }
                      className={styles.optionInput}
                    />
                    <Button
                      className={styles.removeOptionButton}
                      onClick={() => controller.removeOption(qIndex, oIndex)}
                    >
                      <FontAwesomeIcon icon={faTimes} />
                    </Button>
                  </div>
                ))}
                {(question.options || []).length < 10 && (
                  <Button
                    className={styles.addOptionButton}
                    data-testid={E2E_TESTIDS.CREATE_QUESTION_ADD_OPTION}
                    onClick={() => controller.addOption(qIndex)}
                  >
                    <FontAwesomeIcon icon={faPlus} /> Add Option
                  </Button>
                )}
                {/* Single-select limits multichoice answers to one option. */}
                <div className={styles.singleSelectToggle}>
                  <label className={styles.singleSelectLabel}>
                    <input
                      type="checkbox"
                      data-testid={E2E_TESTIDS.CREATE_QUESTION_SINGLE_SELECT}
                      checked={!!question.singleSelect}
                      onChange={(e: CreateSurveyCheckboxChangeEvent) =>
                        controller.handleQuestionChange(qIndex, 'singleSelect', e.target.checked)
                      }
                    />
                    <span>One Selection Only</span>
                    <FontAwesomeIcon
                      icon={faQuestionCircle}
                      className={styles.tooltip}
                      id={`singleSelectTooltip-${question.uiKey || qIndex}`}
                    />
                    <CETooltip
                      placement="right"
                      trigger="hover focus click"
                      target={`singleSelectTooltip-${question.uiKey || qIndex}`}
                      className={styles.tooltipBubble}
                    >
                      Single-select limits respondents to one option. Multi-select allows multiple choices.
                    </CETooltip>
                  </label>
                </div>
              </div>
            )}
            <div className={styles.questionMetadata}>
              <div className={styles.tagsManagerContainer}>
                <div className={styles.tagsContainer}>
                  {questionTags.map((tag: string, tagIndex: number) => (
                    <span key={`${qIndex}-${tagIndex}-${tag}`} className={styles.filterBubble}>
                      {tag}
                      <FontAwesomeIcon
                        icon={faTimes}
                        className={styles.removeIcon}
                        onClick={() => controller.removeTagFromQuestion(qIndex, tagIndex)}
                      />
                    </span>
                  ))}

                  {/* Updated Tag Input UX */}
                  <div className={styles.tagInputGroup}>
                    <Input
                      type="text"
                      placeholder="Add tag"
                      data-testid={E2E_TESTIDS.CREATE_QUESTION_TAG_INPUT}
                      value={question.currentTagInputValue || ''}
                      onChange={(e: CreateSurveyInputValueEvent) =>
                        controller.handleCurrentTagInputChange(qIndex, e.target.value)
                      }
                      onKeyDown={(e: CreateSurveyTagInputKeyEvent) => controller.handleTagInputKeyDown(qIndex, e)}
                      className={styles.tagInputField}
                    />

                    {/* Checkmark: Only visible when user is typing */}
                    {(question.currentTagInputValue || '').trim() !== '' && (
                      <button
                        type="button"
                        className={styles.addTagButton}
                        data-testid={E2E_TESTIDS.CREATE_QUESTION_ADD_TAG}
                        onClick={() => controller.processTagInput(qIndex)}
                        title="Add Tag"
                      >
                        <FontAwesomeIcon icon={faCheck} />
                      </button>
                    )}

                    {/* Magic Wand: Replaces old generate button, hidden if tags populated */}
                    {showGenerateTagsButton && (
                      <button
                        type="button"
                        className={styles.magicTagButton}
                        onClick={() => controller.suggestTagsForQuestion(qIndex)}
                        disabled={question.isGeneratingTags || !question.prompt.trim()}
                        title={
                          !question.prompt.trim()
                            ? 'Enter a question prompt to generate tags'
                            : 'Generate tags using AI'
                        }
                      >
                        {question.isGeneratingTags ? (
                          <FontAwesomeIcon icon={faSpinner} spin />
                        ) : (
                          <FontAwesomeIcon icon={faMagic} />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Visual type selector */}
      {renderCreateSurveyTypeSelector(controller.quickAdd)}

      {/* Submit Button: only render if at least one question exists */}
      {questions.length > 0 && (
        <>
          <Button
            className={buildCreateSurveySubmitButtonClassName(styles, isSubmitting, submissionError)}
            data-testid={E2E_TESTIDS.CREATE_SUBMIT}
            onClick={
              state.needsNetworkSwitch && props.provider === 'wagmi' && props.loginComplete
                ? controller.switchToCorrectNetwork
                : controller.handleSubmitButtonClick
            }
            disabled={
              isSubmitting ||
              (state.needsNetworkSwitch && props.provider === 'wagmi' && props.loginComplete
                ? false
                : submissionError
                  ? false
                  : (!isStandaloneQuestion && !title.trim()) || renderedQuestions.some((q) => q.isGeneratingTags))
            }
            aria-busy={isSubmitting ? 'true' : 'false'}
            title={submissionError ? 'Click to copy error' : undefined}
          >
            {isSubmitting && (
              <span
                className={styles.buttonProgressFill}
                style={resolveCreateSurveyProgressFillStyle(progress)}
                aria-hidden="true"
              />
            )}
            <span className={styles.buttonContent}>
              {isSubmitting ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin style={CREATE_SURVEY_SUBMIT_ICON_STYLE} />
                  Submitting...
                </>
              ) : submissionError ? (
                <>
                  <FontAwesomeIcon icon={faExclamationCircle} style={CREATE_SURVEY_SUBMIT_ICON_STYLE} />
                  {submissionError}
                  <span className={styles.copyHint}>&nbsp;— click to copy</span>
                </>
              ) : state.needsNetworkSwitch && props.provider === 'wagmi' && props.loginComplete ? (
                'Switch to correct network → Submit'
              ) : isStandaloneQuestion ? (
                'Create Questions'
              ) : (
                'Create Survey'
              )}
            </span>
          </Button>

          {/* Progress Indicator: Only visible during/after submission steps */}
          {(isSubmitting || state.showSubmitSteps) && (
            <div className={styles.progressIndicator}>
              <div className={buildCreateSurveyProgressStepClassName(styles, submitStep, 1)}>
                <FontAwesomeIcon
                  icon={submitStep === 1 ? faSpinner : submitStep > 1 ? faCheck : faExclamationCircle}
                  spin={submitStep === 1}
                />
                <span>Upload Arweave</span>
              </div>
              <div className={buildCreateSurveyProgressStepClassName(styles, submitStep, 2)}>
                <FontAwesomeIcon
                  icon={submitStep === 2 ? faSpinner : submitStep > 2 ? faCheck : faExclamationCircle}
                  spin={submitStep === 2}
                />
                <span>Submit Contract</span>
              </div>
              <div className={buildCreateSurveyProgressStepClassName(styles, submitStep, 3)}>
                <FontAwesomeIcon icon={submitStep === 3 ? faCheck : faExclamationCircle} />
                <span>Done</span>
              </div>
            </div>
          )}
        </>
      )}

      {submissionError && !isSubmitting && <div className={styles.errorMessage}>Error: {submissionError}</div>}

      {questionsAddedSuccessfully && (
        <div className={styles.surveySubmissionConfirmation} data-testid={E2E_TESTIDS.CREATE_SUCCESS}>
          <h3>Questions Added Successfully!</h3>
          {uploadedQuestions && uploadedQuestions.length > 0 && (
            <div className={styles.uploadedQuestionsList} data-testid={E2E_TESTIDS.CREATE_UPLOADED_QUESTIONS}>
              <h4>Uploaded Questions:</h4>
              <ul>
                {uploadedQuestionEntries.map((entry, index: number) => {
                  const { questionId } = entry;
                  const arweaveTxId = getLegacyArweaveTxId(entry);
                  const idL = String(questionId).toLowerCase();
                  const bookmarked = state.bookmarkedQuestionsSet.has(idL);
                  const sessionSlug = controller.getActiveSessionSlug();
                  return (
                    <li
                      key={`uploaded-${questionId}-${index}`}
                      className={styles.uploadedQuestionItem}
                      data-testid={E2E_TESTIDS.CREATE_UPLOADED_QUESTION}
                      data-ce-question-id={String(questionId || '')
                        .trim()
                        .toLowerCase()}
                    >
                      <a href={`${window.location.origin}${buildQuestionRoutePath(questionId, { sessionSlug })}`}>
                        {questionId.substring(0, 10)}...{questionId.substring(questionId.length - 8)}
                      </a>
                      {arweaveTxId && (
                        <a
                          href={normalizeArweaveUrl(arweaveTxId, { contextLabel: 'create_survey_question_link' })}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="View on Arweave"
                          style={CREATE_SURVEY_UPLOADED_QUESTION_LINK_STYLE}
                        >
                          <FontAwesomeIcon icon={faExternalLinkAlt} size="sm" />
                        </a>
                      )}
                      <Button
                        className={styles.copyQuestionIdButton}
                        onClick={() => controller.copyQuestionIdToClipboard(questionId)}
                        title="Copy Question ID"
                        size="sm"
                        color="link"
                        style={CREATE_SURVEY_SMALL_ICON_BUTTON_STYLE}
                      >
                        <FontAwesomeIcon icon={faClipboard} />
                      </Button>
                      <Button
                        className={styles.bookmarkQuestionButton}
                        onClick={() => controller.bookmarkQuestion(questionId)}
                        title="Bookmark Question ID"
                        size="sm"
                        color="link"
                        style={CREATE_SURVEY_SMALL_ICON_BUTTON_STYLE}
                      >
                        <FontAwesomeIcon
                          icon={faBookmark}
                          style={resolveCreateSurveyQuestionBookmarkStyle(bookmarked)}
                        />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {surveyAddedSuccessfully && surveyIDForDisplay && (
        <div className={styles.surveySubmissionConfirmation} data-testid={E2E_TESTIDS.CREATE_SUCCESS}>
          <h3>Survey Created</h3>

          <div className={styles.successActionsRow}>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => controller.copySurveyLinkToClipboard(surveyIDForDisplay)}
              title="Copy Link to Survey Page"
            >
              <FontAwesomeIcon
                icon={state.copySurveyLinkSuccess ? faCheck : faClipboard}
                style={CREATE_SURVEY_ACTION_ICON_STYLE}
              />
              Copy Link
            </button>

            <a
              href={`/survey/${surveyIDForDisplay}${controller.getActiveSessionSlug() ? `?session=${encodeURIComponent(controller.getActiveSessionSlug())}` : ''}`}
              target="_blank"
              rel="noopener noreferrer"
              className={buildCreateSurveyActionLinkClassName(styles)}
              title="Open Survey Page in New Tab"
            >
              <FontAwesomeIcon icon={faExternalLinkAlt} />
              View Survey
            </a>

            {lastSubmittedSurveyArweaveTxId && (
              <a
                href={normalizeArweaveUrl(lastSubmittedSurveyArweaveTxId, { contextLabel: 'create_survey_link' })}
                target="_blank"
                rel="noopener noreferrer"
                className={buildCreateSurveyActionLinkClassName(styles)}
                title="View on Arweave"
              >
                <FontAwesomeIcon icon={faExternalLinkAlt} />
                Arweave
              </a>
            )}

            <button
              type="button"
              onClick={() => controller.bookmarkSurvey(surveyIDForDisplay)}
              className={styles.actionBtn}
              title="Bookmark Survey"
            >
              <FontAwesomeIcon
                icon={faBookmark}
                style={resolveCreateSurveyBookmarkSurveyStyle(
                  state.bookmarkedSurveysSet.has(String(surveyIDForDisplay).toLowerCase()),
                )}
              />
              Bookmark
            </button>

            <button
              type="button"
              onClick={() => controller.copySurveyIdToClipboard(surveyIDForDisplay)}
              className={styles.actionBtn}
              title="Copy Survey ID"
            >
              <FontAwesomeIcon icon={state.copySurveyIdSuccess ? faCheck : faClipboard} />
              {state.copySurveyIdSuccess ? 'Copied!' : 'Copy ID'}
            </button>
          </div>
        </div>
      )}

      {/* JSON preview area */}
      {showJson && (
        <JsonPanel
          as="pre"
          onCopy={() => controller.copyJsonPreview(jsonData)}
          copied={state.copyJsonSuccess}
          copyTitle="Copy JSON"
        >
          {JSON.stringify(jsonData, null, 2)}
        </JsonPanel>
      )}

      {/* Shared toolbar */}
      <JsonButtonRow align="end" className={styles.jsonPromptBar}>
        <JsonToggleButton
          label={showJson ? 'Hide JSON' : 'Show JSON'}
          active={showJson}
          onClick={controller.toggleShowJson}
        />
        <JsonToggleButton
          label={state.showAIPrompt ? 'Hide AI Prompt' : 'Show AI Prompt'}
          active={state.showAIPrompt}
          onClick={controller.toggleAIPrompt}
          icon={state.showAIPrompt ? faCaretUp : faCaretDown}
        />
      </JsonButtonRow>

      {/* AI Prompt panel */}
      {state.showAIPrompt && (
        <div className={styles.aiPromptWrapper}>
          <button
            type="button"
            className={buildCreateSurveyAiPromptCopyClassName(styles, state.aiPromptCopySuccess)}
            onClick={controller.copyAIPromptToClipboard}
            title="Copy prompt"
          >
            <FontAwesomeIcon icon={state.aiPromptCopySuccess ? faCheck : faClipboard} />
          </button>

          <div className={styles.aiPromptHeader}>
            <strong>{`AI Prompt — ${state.aiPromptModelLabel}`}</strong>
          </div>

          <div className={styles.aiPromptMeta}>
            Variables:&nbsp;
            <span className={styles.aiVar}>&lt;SourceDocContent&gt;</span>,{' '}
            <span className={styles.aiVar}>&lt;NumSeedStatements&gt;</span>,{' '}
            <span className={styles.aiVar}>&lt;Types&gt;</span>,{' '}
            <span className={styles.aiVar}>&lt;DefaultTags&gt;</span>
          </div>

          <div className={styles.jsonDisplayWrapper}>
            <pre className={styles.jsonDisplay}>
              {highlightPromptVariables(state.aiPromptText || '(Prompt not available)')}
            </pre>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div
      className={buildCreateSurveyContainerClassName(styles, props.miniaturized)}
      data-testid={E2E_TESTIDS.CREATE_PANEL}
    >
      {/* Header: Survey/Questions toggle + single context-aware mode switch */}
      <div className={styles.modeHeader}>
        {showModeToggle && (
          <div className={styles.modeToggle}>
            <Label className={styles.toggleLabel}> Survey</Label>
            <div className={styles.toggleSwitch} onClick={controller.toggleStandaloneQuestion}>
              <div className={styles.toggleKnob} style={resolveCreateSurveyToggleKnobStyle(isStandaloneQuestion)} />
            </div>
            <Label className={styles.toggleLabel} style={CREATE_SURVEY_TRAILING_TOGGLE_LABEL_STYLE}>
              Questions
            </Label>
          </div>
        )}

        {!props.miniaturized && !props.preformedQuestions && (
          <Button
            className={styles.modeSwitchButton}
            data-testid={E2E_TESTIDS.CREATE_MODE_SWITCH}
            onClick={controller.toggleAutoTool}
            color="secondary"
            outline
          >
            <FontAwesomeIcon icon={showAutoTool ? faPenNib : faMagic} style={CREATE_SURVEY_HEADER_ICON_STYLE} />
            {showAutoTool ? 'Manual' : 'from URL / Content'}
          </Button>
        )}

        {/* Clear Form Button */}
        {!props.preformedQuestions &&
          !state.showAutoTool &&
          (state.questions.length > 0 || state.title.trim() !== '') && (
            <button
              type="button"
              className={styles.clearFormButton}
              data-testid={E2E_TESTIDS.CREATE_CLEAR}
              onClick={controller.handleClearForm}
              title="Clear entire form"
              style={CREATE_SURVEY_CLEAR_FORM_BUTTON_STYLE}
            >
              <FontAwesomeIcon icon={faEraser} style={CREATE_SURVEY_HEADER_ICON_STYLE} />
              Clear
            </button>
          )}
      </div>

      {state.showAutoTool && !props.miniaturized && !props.preformedQuestions ? (
        <div style={CREATE_SURVEY_AUTO_TOOL_PANEL_STYLE}>
          <AudioSurveyGenerator
            minified={true}
            hideEncryption={true}
            provider={props.provider}
            network={props.network}
            account={props.account}
            loginComplete={props.loginComplete}
            toggleLoginModal={props.toggleLoginModal}
            defaultTags={props.defaultTags || []}
            onQuestionsGenerated={controller.handleAutoQuestionsGenerated}
            sessionConfig={resolvedSessionConfig}
            contracts={resolvedContracts}
            activeSessionSlug={controller.getActiveSessionSlug()}
            litHooks={props.litHooks}
          />
        </div>
      ) : (
        manualCreationUI
      )}
      <CEConfirmDialog
        isOpen={!!state.showClearFormConfirm}
        title="Clear form?"
        body="This removes the unsaved survey or question draft from this browser."
        confirmLabel="Clear"
        cancelLabel="Keep editing"
        danger
        onCancel={controller.cancelClearForm}
        onConfirm={controller.confirmClearForm}
        testId="ce-survey-clear-confirm"
      />
    </div>
  );
};
