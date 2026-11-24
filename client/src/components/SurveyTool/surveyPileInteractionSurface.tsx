import React from 'react';
import { Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTimes,
  faSpinner,
  faFilter,
  faChevronLeft,
  faChevronRight,
  faPlus,
  faMinus,
  faCaretDown,
  faBars,
  faMicrophone,
} from '@fortawesome/free-solid-svg-icons';

import {
  usesCloudflareSessionStorage,
  usesPublicReadCloudflareStorage,
} from '../../utilities/storage/sessionStorageConfig';

import ElapsedLoadingLabel from '../Shared/ElapsedLoadingLabel';
import PileQuestionActionMenu from './PileQuestionActionMenu';
import { SubmitCountLabel } from './SubmitCountLabel';
import { submittingLabel } from './surveyToolDraftState';
import styles from './SurveyTool.module.scss';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { readGroupReadHeader } from '../../utilities/worker/workerGroupReadProof';

// A private session's invite proof reads the questions signed out, as a QR guest does before signing in.
const holdsInviteProof = (config: unknown): boolean => {
  const { corsWorkerUrl, slug } = (config || {}) as { corsWorkerUrl?: unknown; slug?: unknown };
  return !!readGroupReadHeader(String(corsWorkerUrl || ''), String(slug || ''));
};

export const requiresQuestionStorageLogin = (config: unknown, signedIn: boolean): boolean =>
  !signedIn &&
  usesCloudflareSessionStorage(config, { resource: 'questions' }) &&
  !usesPublicReadCloudflareStorage(config, { resource: 'questions' }) &&
  !holdsInviteProof(config);

const ACTIVE_GREEN = 'var(--ce-status-success)';

type VoidHandler = () => void;

export type PileQuestionLike = {
  id: React.Key;
  prompt?: React.ReactNode;
  [key: string]: unknown;
};

export type PileScanDisplayLike = {
  metaLeftText: string;
  metaRightText: string;
};

type PileNavControlsProps = {
  pileQuestions: PileQuestionLike[];
  activePileIndex: number;
  navCounterVisible: boolean;
  /** The card has an answer, so Next is the step to take. */
  nextIsPrimary?: boolean;
  /** The person has just answered a card that stays put, so Next draws the eye. */
  nextNudge?: boolean;
  /** Next has opened the end of the set; on the last question it opens it. */
  endOfSetShown?: boolean;
  handlePrev: VoidHandler;
  handleNext: VoidHandler;
};

type PileActionControlsProps = {
  isFilterActive: boolean;
  toggleFilterModal: VoidHandler;
  showCreate: boolean;
  toggleCreate: VoidHandler;
  toggleListeningPanel?: VoidHandler;
  showVoiceModeControl?: boolean;
  voiceModeActive?: boolean;
  toggleVoiceModeModal?: VoidHandler;
  onViewAllClick?: VoidHandler | null;
  handleViewAllFromPile: VoidHandler;
};

type PileFooterControlsProps = {
  pileTopRailVisible: boolean;
  showSuccessBadge: boolean;
  showSubmitButton: boolean;
  handlePileSubmitClick: VoidHandler;
  hasPendingPileChanges: boolean;
  pendingAnswerCount?: number;
  shouldHidePileSubmitButton: boolean;
  isSubmitting: boolean;
  /** "12 of 40" while a Submit saves several answers. */
  submitCountText?: string;
  activePromptMasked: boolean;
  finalSubmitText: string;
  showClearPendingButton: boolean;
  handleRevertPendingChanges: VoidHandler;
  /** The end card has its own Submit, so Submit and Clear here step aside, keeping their place. */
  endOfSetShown?: boolean;
  /** Hears whether the green "Submitted" is showing (see PileSubmittedCheck). */
  onSubmittedCheckShown?: (shown: boolean) => void;
};

type PileDeckWindowProps = {
  pileQuestions: PileQuestionLike[];
  activePileIndex: number;
  renderActiveQuestion: (question: PileQuestionLike) => React.ReactNode;
};

type PileEmptyStateProps = {
  hasTerminalScanError: boolean;
  scanErrorMessage: string;
  hasError: boolean;
  requiresStorageLogin?: boolean;
  isStillLoading: boolean;
  loadingElapsedSec: number;
  hydrateDone: number;
  hydrateDiscovered: number;
  isHydrating: boolean;
  showLongLoading: boolean;
  scanTotalBlocks: number;
  pileScanDisplay: PileScanDisplayLike;
  scanPercent: number;
  showFilteredEmptyState: boolean;
  showGatedEmptyState: boolean;
  gatedEmptyPanel: React.ReactNode;
};

export type PileInteractionSurfaceProps = {
  submissionError?: string;
  draftPersistenceError?: string;
  // Shown when the session's saved answers failed to load, so earlier answers may be missing.
  savedAnswersNotice?: { retrying: boolean; onRetry: VoidHandler } | null;
  showMiniBackgroundSpinner: boolean;
  priorResponsesHydrating: boolean;
  showLongLoading: boolean;
  loadingElapsedSec: number;
  pileQuestions: PileQuestionLike[];
  activePileIndex: number;
  renderActiveQuestion: (question: PileQuestionLike) => React.ReactNode;
  hasTerminalScanError: boolean;
  scanErrorMessage: string;
  hasError: boolean;
  requiresStorageLogin?: boolean;
  isStillLoading: boolean;
  hydrateDone: number;
  hydrateDiscovered: number;
  isHydrating: boolean;
  scanTotalBlocks: number;
  pileScanDisplay: PileScanDisplayLike;
  scanPercent: number;
  showFilteredEmptyState: boolean;
  showGatedEmptyState: boolean;
  gatedEmptyPanel: React.ReactNode;
  isFilterActive: boolean;
  toggleFilterModal: VoidHandler;
  showCreate: boolean;
  toggleCreate: VoidHandler;
  toggleListeningPanel?: VoidHandler;
  showVoiceModeControl?: boolean;
  voiceModeActive?: boolean;
  toggleVoiceModeModal?: VoidHandler;
  onViewAllClick?: VoidHandler | null;
  handleViewAllFromPile: VoidHandler;
  pileTopRailVisible: boolean;
  showSuccessBadge: boolean;
  showSubmitButton: boolean;
  handlePileSubmitClick: VoidHandler;
  hasPendingPileChanges: boolean;
  pendingAnswerCount?: number;
  shouldHidePileSubmitButton: boolean;
  isSubmitting: boolean;
  submitCountText?: string;
  activePromptMasked: boolean;
  finalSubmitText: string;
  showClearPendingButton: boolean;
  handleRevertPendingChanges: VoidHandler;
  onSubmittedCheckShown?: (shown: boolean) => void;
  navCounterVisible: boolean;
  nextIsPrimary?: boolean;
  nextNudge?: boolean;
  /** Shown in place of the cards once Next passes the last question. */
  endOfSetCard?: React.ReactNode;
  handlePrev: VoidHandler;
  handleNext: VoidHandler;
};

export const PILE_SCAN_ERROR_DETAIL_STYLE: React.CSSProperties = {
  opacity: 0.8,
  marginTop: 8,
};

export const PILE_LOADING_ICON_WRAP_STYLE: React.CSSProperties = {
  fontSize: '2.5rem',
  display: 'flex',
  alignItems: 'center',
  gap: '15px',
};

export const resolvePileNavCounterStyle = (navCounterVisible: unknown): React.CSSProperties => ({
  opacity: navCounterVisible ? 0.8 : 0,
  transition: 'opacity 0.5s ease-in-out',
});

export const resolvePileFilterButtonStyle = (isFilterActive: unknown): React.CSSProperties =>
  isFilterActive ? { color: ACTIVE_GREEN, borderColor: ACTIVE_GREEN, opacity: 0.75 } : {};

export const resolvePileFilterIconStyle = (isFilterActive: unknown): React.CSSProperties =>
  isFilterActive ? { color: ACTIVE_GREEN } : {};

export const buildPileFilterButtonClassName = (styleMap: Record<string, string>, isFilterActive: unknown) =>
  [styleMap.actionButton, isFilterActive ? styleMap.actionButtonActive : ''].filter(Boolean).join(' ');

export const buildPileFooterClassName = (styleMap: Record<string, string>, pileTopRailVisible: unknown) =>
  `${styleMap.pileFooter}${pileTopRailVisible ? '' : ` ${styleMap.pileFooterHidden}`}`;

export const buildPileSubmitButtonClassName = (
  styleMap: Record<string, string>,
  hasPendingPileChanges: unknown,
  shouldHidePileSubmitButton: unknown,
) =>
  `${styleMap.pileSubmitButton}${hasPendingPileChanges ? ` ${styleMap.submitGlow}` : ''}${shouldHidePileSubmitButton ? ` ${styleMap.pileSubmitButtonInactive}` : ''}`;

export const resolvePileCardStatusClassName = (styleMap: Record<string, string>, offset: number) => {
  if (offset === 0) return styleMap.pileCardActive;
  if (offset === 1) return styleMap.pileCardNext;
  if (offset === -1) return styleMap.pileCardPrev;
  if (offset > 1) return styleMap.pileCardAfter;
  return styleMap.pileCardBefore;
};

export const buildPileCardClassName = (styleMap: Record<string, string>, statusClassName: string) =>
  `${styleMap.pileCard} ${statusClassName}`;

export const resolvePileLoadingProgressFillStyle = ({
  isHydrating,
  hydrateDone,
  hydrateDiscovered,
  scanPercent,
}: {
  isHydrating: boolean;
  hydrateDone: number;
  hydrateDiscovered: number;
  scanPercent: number;
}): React.CSSProperties => ({
  width: `${
    isHydrating
      ? hydrateDiscovered > 0
        ? Math.round((Math.min(hydrateDone, hydrateDiscovered) / hydrateDiscovered) * 100)
        : 0
      : scanPercent
  }%`,
});

export const resolvePileMiniLoaderStyle = (priorResponsesHydrating: unknown): React.CSSProperties => ({
  opacity: priorResponsesHydrating ? 0.5 : 1,
});

const renderPileNavControls = ({
  pileQuestions,
  activePileIndex,
  navCounterVisible,
  nextIsPrimary = false,
  nextNudge = false,
  endOfSetShown = false,
  handlePrev,
  handleNext,
}: PileNavControlsProps): React.ReactElement => {
  // Next on the last card opens the end of the set; there it has nowhere to go.
  const nextDisabled = pileQuestions.length === 0 || endOfSetShown;
  // A disabled Next is never the step to take, answered or not.
  const nextStands = nextIsPrimary && !nextDisabled;
  return (
    <div className={styles.pileNav}>
      <button
        onClick={handlePrev}
        // From the end of the set, Back returns to the last question, even when it is the first.
        disabled={pileQuestions.length === 0 || (activePileIndex === 0 && !endOfSetShown)}
        className={styles.pileNavArrow}
        aria-label="Previous Question"
        data-ce-control-appearance="frameless"
      >
        <FontAwesomeIcon icon={faChevronLeft} />
      </button>
      <span
        className={styles.pileNavCounterText}
        // A phone sizes the counter's slot by the total's digits, so the arrows keep their place from card to card.
        style={
          {
            ...resolvePileNavCounterStyle(navCounterVisible),
            '--pile-counter-digits': String(pileQuestions.length).length,
          } as React.CSSProperties
        }
      >
        <span>{pileQuestions.length === 0 ? 0 : activePileIndex + 1}</span>
        <span className={styles.pileNavCounterSlash}> / </span>
        <span>{pileQuestions.length}</span>
      </span>
      <button
        onClick={handleNext}
        disabled={nextDisabled}
        className={`${styles.pileNavArrow}${nextStands ? ` ${styles.pileNavArrowPrimary}` : ''}${nextStands && nextNudge ? ` ${styles.pileNavArrowNudge}` : ''}`}
        aria-label="Next Question"
        data-ce-control-appearance="frameless"
      >
        <FontAwesomeIcon icon={faChevronRight} />
      </button>
    </div>
  );
};

const renderPileActionControls = ({
  isFilterActive,
  toggleFilterModal,
  showCreate,
  toggleCreate,
  toggleListeningPanel = () => {},
  showVoiceModeControl = true,
  voiceModeActive = false,
  toggleVoiceModeModal = toggleListeningPanel,
  onViewAllClick,
  handleViewAllFromPile,
}: PileActionControlsProps): React.ReactElement => {
  const filterButtonStyle = resolvePileFilterButtonStyle(isFilterActive);
  const filterIconStyle = resolvePileFilterIconStyle(isFilterActive);

  return (
    <div className={`${styles.pileActions} ${styles.pileActionsMenuEligible}`}>
      <PileQuestionActionMenu>
        <button
          type="button"
          className={`${styles.actionButton} ${styles.pileActionMenuToggle}`}
          title="Question actions"
          aria-label="Question actions"
          aria-haspopup="menu"
          data-ce-control-appearance="frameless"
        >
          <FontAwesomeIcon icon={faBars} />
        </button>

        <div className={styles.pileActionButtonGroup}>
          <button
            onClick={toggleFilterModal}
            className={buildPileFilterButtonClassName(styles, isFilterActive)}
            style={filterButtonStyle}
            title="Filter Questions"
            data-testid={E2E_TESTIDS.SURVEY_FILTER_TOGGLE}
            data-ce-control-appearance="frameless"
          >
            <FontAwesomeIcon icon={faFilter} style={filterIconStyle} />
            <span className={styles.pileActionLabel}>Filter questions</span>
          </button>

          <button
            onClick={toggleCreate}
            className={styles.actionButton}
            title={showCreate ? 'Close Create Interface' : 'Create New Question'}
            data-testid={E2E_TESTIDS.SURVEY_CREATE_TOGGLE_PILE}
            data-ce-control-appearance="frameless"
          >
            <FontAwesomeIcon icon={showCreate ? faMinus : faPlus} />
            <span className={styles.pileActionLabel}>{showCreate ? 'Close question editor' : 'Add questions'}</span>
          </button>

          {onViewAllClick && (
            <button
              onClick={handleViewAllFromPile}
              className={styles.actionButton}
              title="View All Questions"
              data-testid={E2E_TESTIDS.SURVEY_VIEW_ALL}
              data-ce-control-appearance="frameless"
            >
              <FontAwesomeIcon icon={faCaretDown} />
              <span className={styles.pileActionLabel}>All questions</span>
            </button>
          )}
        </div>
      </PileQuestionActionMenu>
      {showVoiceModeControl ? (
        <button
          onClick={toggleVoiceModeModal}
          className={`${styles.actionButton} ${styles.pileVoiceModeToggle} ${voiceModeActive ? styles.actionButtonActive : ''}`}
          title={voiceModeActive ? 'Interview in progress' : 'Open voice mode'}
          aria-label="Open voice mode"
          aria-pressed={voiceModeActive}
          data-testid={E2E_TESTIDS.SESSION_LISTENING_TOGGLE}
          data-ce-control-appearance="frameless"
        >
          <FontAwesomeIcon icon={faMicrophone} />
        </button>
      ) : null}
    </div>
  );
};

// After a submit, Submit turns into a green "Submitted" in its place for ten seconds, then hides, keeping its
// place so nothing below it moves. It only reports the submit; it is no link.
const SUBMITTED_CHECK_MS = 10_000;

/**
 * What Submit becomes after a submit. `onShown` hears true while it shows and false once it hides or goes, so the
 * page holds the band above the card for it only while there is something in it.
 */
export const PileSubmittedCheck = ({ onShown }: { onShown?: (shown: boolean) => void } = {}): React.ReactElement => {
  const [gone, setGone] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  // The page hands a new copy of its handler on every render; each copy does the same, so the first one serves.
  const onShownRef = React.useRef(onShown);
  onShownRef.current = onShown;
  // Before the page's own update reads it, so the band is held from the check's first frame.
  React.useLayoutEffect(() => {
    if (gone) return undefined;
    const report = onShownRef.current;
    report?.(true);
    return () => report?.(false);
  }, [gone]);
  React.useEffect(() => {
    // Submit, which may have had focus, is gone: keep focus here rather than on the page.
    if (!document.activeElement || document.activeElement === document.body)
      ref.current?.focus({ preventScroll: true });
    const timer = setTimeout(() => {
      // A hidden element drops focus to the page, so hand it to the question card first.
      const check = ref.current;
      if (check && check === document.activeElement)
        check
          .closest(`.${styles.pileViewContainer}`)
          ?.querySelector<HTMLElement>('[data-testid="ce-pile-active-question"], [data-testid="ce-pile-end-of-set"]')
          ?.focus({ preventScroll: true });
      setGone(true);
    }, SUBMITTED_CHECK_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div
      ref={ref}
      className={`${styles.pileSubmitButton} ${styles.pileSubmitDone}${gone ? ` ${styles.pileSubmitDoneGone}` : ''}`}
      data-testid={E2E_TESTIDS.SURVEY_SUBMITTED_INDICATOR}
      tabIndex={-1}
    >
      Submitted
    </div>
  );
};

const renderPileFooterControls = ({
  pileTopRailVisible,
  showSuccessBadge,
  showSubmitButton,
  handlePileSubmitClick,
  hasPendingPileChanges,
  pendingAnswerCount = 0,
  shouldHidePileSubmitButton,
  isSubmitting,
  submitCountText,
  activePromptMasked,
  finalSubmitText,
  showClearPendingButton,
  handleRevertPendingChanges,
  endOfSetShown = false,
  onSubmittedCheckShown,
}: PileFooterControlsProps): React.ReactElement => {
  return (
    <div className={buildPileFooterClassName(styles, pileTopRailVisible)}>
      {/* Always present, so screen readers hear the text that arrives in it. */}
      <span className={styles.pileSubmitStatusText} role="status">
        {showSuccessBadge ? 'Your answers are submitted.' : ''}
      </span>
      {showSuccessBadge ? (
        <PileSubmittedCheck onShown={onSubmittedCheckShown} />
      ) : showSubmitButton ? (
        <>
          <Button
            onClick={handlePileSubmitClick}
            data-testid={E2E_TESTIDS.SURVEY_SUBMIT}
            className={`${buildPileSubmitButtonClassName(styles, hasPendingPileChanges, shouldHidePileSubmitButton)}${
              endOfSetShown ? ` ${styles.pileFooterControlAway}` : ''
            }`}
            disabled={isSubmitting || activePromptMasked}
            // The count shows in the corner without its brackets; the name keeps them.
            aria-label={isSubmitting ? undefined : finalSubmitText}
          >
            {isSubmitting ? (
              // Counts seconds from the Submit's start, as the AI flows' progress labels do.
              <span className={styles.pileSubmitProgress}>
                <ElapsedLoadingLabel label={submittingLabel(submitCountText)} />
                <FontAwesomeIcon icon={faSpinner} spin />
              </span>
            ) : (
              <span className={styles.pileSubmitButtonContent}>
                <span className={styles.pileSubmitButtonCopy}>
                  <SubmitCountLabel text={finalSubmitText} />
                </span>
                <span className={styles.pileSubmitButtonTrail} aria-hidden="true">
                  <FontAwesomeIcon icon={faChevronRight} className={styles.pileSubmitButtonTrailIcon} />
                  <FontAwesomeIcon icon={faChevronRight} className={styles.pileSubmitButtonTrailIcon} />
                  <FontAwesomeIcon icon={faChevronRight} className={styles.pileSubmitButtonTrailIcon} />
                </span>
              </span>
            )}
          </Button>
          {pendingAnswerCount > 0 && (
            <span className={styles.pilePendingAnswerNotice} role="status">
              {pendingAnswerCount}{' '}
              {pendingAnswerCount === 1 ? "answer on the page isn't" : "answers on the page aren't"} submitted yet.
            </span>
          )}
        </>
      ) : null}

      {showClearPendingButton && (
        <button
          type="button"
          className={`${styles.pileIconButton}${endOfSetShown ? ` ${styles.pileFooterControlAway}` : ''}`}
          onClick={handleRevertPendingChanges}
          title="Clear changes"
          aria-label="Clear pending changes"
          data-ce-control-appearance="frameless"
        >
          <FontAwesomeIcon icon={faTimes} />
        </button>
      )}
    </div>
  );
};

const renderPileDeckWindow = ({
  pileQuestions,
  activePileIndex,
  renderActiveQuestion,
}: PileDeckWindowProps): React.ReactNode[] => {
  const startIdx = Math.max(0, activePileIndex - 2);
  const endIdx = Math.min(pileQuestions.length, activePileIndex + 3);

  return pileQuestions.slice(startIdx, endIdx).map((q, sliceIdx) => {
    const idx = startIdx + sliceIdx;
    const offset = idx - activePileIndex;

    const status = resolvePileCardStatusClassName(styles, offset);

    return (
      <div
        key={q.id}
        className={buildPileCardClassName(styles, status)}
        data-testid={offset === 0 ? 'ce-pile-active-question' : undefined}
        tabIndex={offset === 0 ? -1 : undefined}
        role={offset === 0 ? 'group' : undefined}
        aria-label={offset === 0 ? `Question ${idx + 1} of ${pileQuestions.length}` : undefined}
      >
        {offset === 0 ? renderActiveQuestion(q) : <div className={styles.pileCardInner}></div>}
      </div>
    );
  });
};

const renderPileEmptyState = ({
  hasTerminalScanError,
  scanErrorMessage,
  hasError,
  requiresStorageLogin,
  isStillLoading,
  loadingElapsedSec,
  hydrateDone,
  hydrateDiscovered,
  isHydrating,
  showLongLoading,
  scanTotalBlocks,
  pileScanDisplay,
  scanPercent,
  showFilteredEmptyState,
  showGatedEmptyState,
  gatedEmptyPanel,
}: PileEmptyStateProps): React.ReactNode => {
  if (requiresStorageLogin) {
    return (
      <div role="status">
        <div>Sign in to view this session’s questions.</div>
        <div style={PILE_SCAN_ERROR_DETAIL_STYLE}>
          Question access is limited to eligible participants. Use Log in at the top of the page.
        </div>
      </div>
    );
  }

  if (hasTerminalScanError) {
    return <div>{scanErrorMessage}</div>;
  }

  if (hasError) {
    return (
      <>
        <div>Cache initialization error (RPC or metadata fetch failed).</div>
        <div style={PILE_SCAN_ERROR_DETAIL_STYLE}>Try refreshing questions/responses or reloading the page.</div>
      </>
    );
  }

  if (isStillLoading) {
    return (
      <>
        <div style={PILE_LOADING_ICON_WRAP_STYLE}>
          <FontAwesomeIcon icon={faSpinner} spin size="1x" />
        </div>
        <div className={styles.pileLoadingHeadline}>Loading... {Math.max(0, Number(loadingElapsedSec || 0))}s</div>
        <div className={styles.pileLoadingSubhead}>
          {isHydrating
            ? `Loading Metadata (${Math.min(hydrateDone, hydrateDiscovered)} / ${hydrateDiscovered})`
            : showLongLoading
              ? ''
              : ''}
        </div>
        {(scanTotalBlocks > 0 || isHydrating) && (
          <div className={styles.pileLoadingProgressWrap}>
            <div className={styles.pileLoadingProgressMeta}>
              <span>
                {isHydrating
                  ? `${Math.max(0, hydrateDiscovered - Math.min(hydrateDone, hydrateDiscovered))} items left`
                  : pileScanDisplay.metaLeftText}
              </span>
              <span>
                {isHydrating
                  ? `${Math.min(hydrateDone, hydrateDiscovered)} / ${hydrateDiscovered}`
                  : pileScanDisplay.metaRightText}
              </span>
            </div>
            <div className={styles.pileLoadingProgressBar}>
              <div
                className={styles.pileLoadingProgressFill}
                style={resolvePileLoadingProgressFillStyle({
                  isHydrating,
                  hydrateDone,
                  hydrateDiscovered,
                  scanPercent,
                })}
              />
            </div>
          </div>
        )}
      </>
    );
  }

  if (showFilteredEmptyState) {
    return 'No questions match current filters.';
  }

  if (showGatedEmptyState) {
    return gatedEmptyPanel;
  }

  return 'No questions available.';
};

// On a phone the card takes the screen below its own top less the controls row (--pile-phone-card-height). What sits
// above it (header, session title, sign-in hint) varies by session and changes as the page loads, so the top is
// measured: on mount, and whenever the page's size changes. A change applies on the next frame, as setting it resizes
// the page the observer watches (Safari reports a loop otherwise).
// Why a Submit failed, under the bar. On a phone the card and its bar fill the screen, so this line starts just
// below it: it is brought into view when it appears or changes, and a failed Submit is never silent.
const PileSubmitError = ({ message }: { message: string }) => {
  const line = React.useRef<HTMLParagraphElement>(null);
  React.useEffect(() => {
    line.current?.scrollIntoView?.({ block: 'nearest' });
  }, [message]);
  return (
    <p ref={line} className={styles.pileSubmitError} role="alert">
      {message}
    </p>
  );
};

const PileInteractionUnit = ({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}): React.ReactElement => {
  const unitRef = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const unit = unitRef.current;
    if (!unit || typeof ResizeObserver === 'undefined') return undefined;
    // The card's own top, so a notice above it inside the unit (saved answers that failed to load) counts too.
    const readTop = () => {
      const card = unit.querySelector(`:scope > .${styles.pileCardContainer}`) || unit;
      return `${Math.round(card.getBoundingClientRect().top + window.scrollY)}px`;
    };
    let frame = 0;
    unit.style.setProperty('--pile-card-top', readTop());
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const top = readTop();
        if (unit.style.getPropertyValue('--pile-card-top') !== top) unit.style.setProperty('--pile-card-top', top);
      });
    });
    observer.observe(document.body);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);
  return (
    <div ref={unitRef} className={className}>
      {children}
    </div>
  );
};

export const renderPileInteractionSurface = ({
  submissionError,
  draftPersistenceError,
  savedAnswersNotice,
  showMiniBackgroundSpinner,
  priorResponsesHydrating,
  showLongLoading,
  loadingElapsedSec,
  pileQuestions,
  activePileIndex,
  renderActiveQuestion,
  hasTerminalScanError,
  scanErrorMessage,
  hasError,
  requiresStorageLogin,
  isStillLoading,
  hydrateDone,
  hydrateDiscovered,
  isHydrating,
  scanTotalBlocks,
  pileScanDisplay,
  scanPercent,
  showFilteredEmptyState,
  showGatedEmptyState,
  gatedEmptyPanel,
  isFilterActive,
  toggleFilterModal,
  showCreate,
  toggleCreate,
  toggleListeningPanel,
  showVoiceModeControl,
  voiceModeActive,
  toggleVoiceModeModal,
  onViewAllClick,
  handleViewAllFromPile,
  pileTopRailVisible,
  showSuccessBadge,
  showSubmitButton,
  handlePileSubmitClick,
  hasPendingPileChanges,
  pendingAnswerCount = 0,
  shouldHidePileSubmitButton,
  isSubmitting,
  submitCountText,
  activePromptMasked,
  finalSubmitText,
  showClearPendingButton,
  handleRevertPendingChanges,
  onSubmittedCheckShown,
  navCounterVisible,
  nextIsPrimary,
  nextNudge,
  endOfSetCard = null,
  handlePrev,
  handleNext,
}: PileInteractionSurfaceProps): React.ReactElement => (
  <PileInteractionUnit className={styles.pileInteractionUnit}>
    {showMiniBackgroundSpinner && (
      <div className={styles.miniSpinnerWrapper}>
        <FontAwesomeIcon
          icon={faSpinner}
          spin
          className={styles.miniLoaderIcon}
          style={resolvePileMiniLoaderStyle(priorResponsesHydrating)}
          title={
            priorResponsesHydrating
              ? 'Loading your previous responses...'
              : showLongLoading
                ? 'Still scanning... checking network'
                : 'Background refresh active'
          }
        />
      </div>
    )}

    {savedAnswersNotice && (
      <p className={styles.pileSubmitError} role="status">
        Your saved answers did not load, so answers you saved earlier may be missing.{' '}
        <Button
          color="link"
          size="sm"
          className="p-0 align-baseline"
          onClick={savedAnswersNotice.onRetry}
          disabled={savedAnswersNotice.retrying}
        >
          {savedAnswersNotice.retrying ? 'Retrying…' : 'Retry'}
        </Button>
      </p>
    )}

    <div className={styles.pileCardContainer}>
      {pileQuestions.length === 0 ? (
        <div className={styles.pileEmptyState}>
          {renderPileEmptyState({
            hasTerminalScanError,
            scanErrorMessage,
            hasError,
            requiresStorageLogin,
            isStillLoading,
            loadingElapsedSec,
            hydrateDone,
            hydrateDiscovered,
            isHydrating,
            showLongLoading,
            scanTotalBlocks,
            pileScanDisplay,
            scanPercent,
            showFilteredEmptyState,
            showGatedEmptyState,
            gatedEmptyPanel,
          })}
        </div>
      ) : (
        // The end card sits where a question card does, so the arrows below stay put.
        (endOfSetCard && <div className={buildPileCardClassName(styles, styles.pileCardActive)}>{endOfSetCard}</div>) ||
        renderPileDeckWindow({
          pileQuestions,
          activePileIndex,
          renderActiveQuestion,
        })
      )}
    </div>

    <div className={styles.pileControls}>
      {renderPileActionControls({
        isFilterActive,
        toggleFilterModal,
        showCreate,
        toggleCreate,
        toggleListeningPanel,
        showVoiceModeControl,
        voiceModeActive,
        toggleVoiceModeModal,
        onViewAllClick,
        handleViewAllFromPile,
      })}
      {renderPileFooterControls({
        pileTopRailVisible,
        showSuccessBadge,
        showSubmitButton,
        handlePileSubmitClick,
        hasPendingPileChanges,
        pendingAnswerCount,
        shouldHidePileSubmitButton,
        isSubmitting,
        submitCountText,
        activePromptMasked,
        finalSubmitText,
        showClearPendingButton,
        handleRevertPendingChanges,
        endOfSetShown: !!endOfSetCard,
        onSubmittedCheckShown,
      })}
      {renderPileNavControls({
        pileQuestions,
        activePileIndex,
        navCounterVisible,
        nextIsPrimary,
        nextNudge,
        endOfSetShown: !!endOfSetCard,
        handlePrev,
        handleNext,
      })}
    </div>
    <p className={styles.draftPersistenceStatus} role="status" aria-atomic="true">
      {draftPersistenceError || ''}
    </p>
    {submissionError && <PileSubmitError message={submissionError} />}
  </PileInteractionUnit>
);
