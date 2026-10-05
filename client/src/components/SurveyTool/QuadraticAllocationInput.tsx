import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronDown,
  faChevronUp,
  faMinus,
  faPlus,
  faQuestionCircle,
  faUndo,
} from '@fortawesome/free-solid-svg-icons';
import CETooltip from '../Shared/CETooltip';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import {
  getVoiceCredits,
  quadraticCreditsSpent,
  validateQuadraticAllocation,
  validateQuadraticQuestion,
} from '../../../../shared/questions/quadraticAllocation.mjs';
import styles from './QuadraticAllocationInput.module.scss';

type Props = {
  questionId: string;
  options?: unknown[];
  voiceCredits?: unknown;
  value?: unknown;
  disabled?: boolean;
  deferDragUpdates?: boolean;
  onChange?: (value: number[]) => void;
  onReset?: () => void;
  canReset?: boolean;
};

export default function QuadraticAllocationInput({
  questionId,
  options = [],
  voiceCredits,
  value,
  disabled = false,
  deferDragUpdates = false,
  onChange,
  onReset,
  canReset,
}: Props) {
  const instanceId = useId().replace(/:/g, '');
  const viewportRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const [optionsHeight, setOptionsHeight] = useState<number>();
  const [scrollState, setScrollState] = useState({ overflow: false, canScrollDown: false, canScrollUp: false });
  const optionsId = `quadratic-options-${instanceId}`;
  // Leave half of the next label visible in a bounded pile card. Measure the
  // available parent, not the fitted list, to avoid resize feedback loops.
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const list = optionsRef.current;
    if (!viewport || !list || typeof ResizeObserver === 'undefined') return;
    list.scrollTop = 0;
    const updateScrollState = () => {
      const overflow = list.scrollHeight > list.clientHeight + 1;
      const canScrollDown = overflow && list.scrollTop + list.clientHeight < list.scrollHeight - 1;
      const canScrollUp = overflow && list.scrollTop > 1;
      setScrollState((previous) =>
        previous.overflow === overflow &&
        previous.canScrollDown === canScrollDown &&
        previous.canScrollUp === canScrollUp
          ? previous
          : { overflow, canScrollDown, canScrollUp },
      );
    };
    const fit = () => {
      const available = viewport.clientHeight;
      if (!available || list.scrollHeight <= available) {
        setOptionsHeight(undefined);
        return;
      }
      const top = list.getBoundingClientRect().top;
      const peeks = Array.from(list.querySelectorAll('[data-quadratic-option-label]')).map((label) => {
        const rect = label.getBoundingClientRect();
        return rect.top - top + list.scrollTop + rect.height / 2;
      });
      const height = peeks.filter((peek) => peek <= available && peek > 44).pop();
      setOptionsHeight(height);
    };
    const observer = new ResizeObserver(() => {
      fit();
      updateScrollState();
    });
    observer.observe(viewport);
    observer.observe(list);
    Array.from(list.children).forEach((option) => observer.observe(option));
    fit();
    updateScrollState();
    list.addEventListener('scroll', updateScrollState, { passive: true });
    return () => {
      observer.disconnect();
      list.removeEventListener('scroll', updateScrollState);
    };
  }, [options.length, questionId]);
  const scrollToMoreOptions = () => {
    const list = optionsRef.current;
    if (!list) return;
    const bounds = list.getBoundingClientRect();
    const next = Array.from(list.children).find((option) => option.getBoundingClientRect().bottom > bounds.bottom + 1);
    const nextTop = next ? next.getBoundingClientRect().top - bounds.top + list.scrollTop : list.scrollHeight;
    // If one long option fills the viewport, advance through it instead of
    // repeatedly aligning its already-visible top.
    const top = nextTop > list.scrollTop + 1 ? nextTop : list.scrollTop + list.clientHeight * 0.8;
    list.scrollTo({ top, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  const helpId = `quadratic-help-${instanceId}`;
  const question = { options, voiceCredits };
  const questionError = validateQuadraticQuestion(question);
  const budget = getVoiceCredits(question);
  const hasValue = value !== undefined && value !== null && value !== '';
  const valueError = hasValue ? validateQuadraticAllocation(value, question) : '';
  const committedVotes: number[] = hasValue && !valueError ? (value as number[]) : options.map(() => 0);
  const sourceKey = JSON.stringify(
    questionError ? [questionId, questionError] : [questionId, options, budget, hasValue, valueError, committedVotes],
  );
  const [preview, setPreview] = useState<{ sourceKey: string; votes: number[] } | null>(null);
  const dragSourceRef = useRef<string | null>(null);
  const draggedOptionRef = useRef<number | null>(null);
  const pendingRef = useRef<typeof preview>(null);
  const votes = deferDragUpdates && !disabled && preview?.sourceKey === sourceKey ? preview.votes : committedVotes;

  // Keep pointer movement inside this small component; the full question engine
  // still receives the final allocation through its normal edit/save handler.
  const finishDrag = () => {
    dragSourceRef.current = null;
    draggedOptionRef.current = null;
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (!pending) return;
    setPreview(null);
    if (disabled || pending.sourceKey !== sourceKey) return;
    if (!hasValue || pending.votes.some((vote, index) => vote !== committedVotes[index])) onChange?.(pending.votes);
  };
  const finishDragRef = useRef(finishDrag);
  finishDragRef.current = finishDrag;

  useEffect(() => {
    if (!deferDragUpdates) return;
    const finish = () => finishDragRef.current();
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    window.addEventListener('blur', finish);
    return () => {
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      window.removeEventListener('blur', finish);
    };
  }, [deferDragUpdates]);

  useEffect(() => {
    if (disabled || !deferDragUpdates || (dragSourceRef.current !== null && dragSourceRef.current !== sourceKey)) {
      dragSourceRef.current = null;
      draggedOptionRef.current = null;
      pendingRef.current = null;
      setPreview(null);
    }
  }, [sourceKey, disabled, deferDragUpdates]);

  if (questionError) return <p role="alert">{questionError}</p>;
  const spent = quadraticCreditsSpent(votes);
  // Keep a fixed, symmetric scale so neutral never moves as other options change.
  const limit = Math.floor(Math.sqrt(budget));
  // Keep the help example enactable on small budgets.
  const example = Math.min(7, limit);
  // Cost squares: one small square per credit, n×n for n votes. The unit keeps
  // blocks through 12 votes inside a fixed 36px box for any budget.
  const squareUnit = Math.floor(36 / Math.min(limit, 12));
  const formatVote = (vote: number) => (vote > 0 ? `+${vote}` : vote < 0 ? `−${Math.abs(vote)}` : '0');
  const credits = (count: number) => `${count} credit${count === 1 ? '' : 's'}`;
  const canStep = (index: number, step: number) => {
    const next = votes[index] + step;
    return Math.abs(next) <= limit && spent - votes[index] ** 2 + next ** 2 <= budget;
  };
  const updateVote = (index: number, requested: number) => {
    if (disabled || !Number.isSafeInteger(requested)) return;
    const available = budget - (spent - votes[index] ** 2);
    const affordable = Math.floor(Math.sqrt(available));
    const next = [...votes];
    next[index] = Math.max(-affordable, Math.min(affordable, requested));
    if (validateQuadraticAllocation(next, question)) return;
    if (deferDragUpdates && dragSourceRef.current === sourceKey) {
      const nextPreview = { sourceKey, votes: next };
      pendingRef.current = nextPreview;
      setPreview(nextPreview);
    } else {
      onChange?.(next);
    }
  };
  return (
    <fieldset className={styles.allocation} data-testid="ce-quadratic-allocation" data-question-id={questionId}>
      <legend className={styles.srOnly}>Quadratic allocation</legend>
      <div className={styles.header}>
        <div className={styles.budget}>
          <p role="status" data-testid="ce-quadratic-budget">
            <strong>{budget - spent}</strong> credit{budget - spent === 1 ? '' : 's'} left
          </p>
          <span className={styles.rule} aria-hidden="true">
            Votes cost their square
          </span>
          <button
            type="button"
            id={helpId}
            className={styles.help}
            data-ce-control-appearance="frameless"
            aria-label="How voice credits work"
          >
            <FontAwesomeIcon icon={faQuestionCircle} />
          </button>
          <button
            className={styles.reset}
            data-ce-control-appearance="frameless"
            type="button"
            aria-label="Reset"
            title={onReset ? 'Undo answer changes' : 'Reset all votes to neutral'}
            disabled={disabled || !(canReset ?? (Boolean(valueError) || votes.some((vote) => vote !== 0)))}
            onClick={() => {
              dragSourceRef.current = null;
              draggedOptionRef.current = null;
              pendingRef.current = null;
              setPreview(null);
              if (onReset) onReset();
              else onChange?.(options.map(() => 0));
            }}
          >
            <FontAwesomeIcon icon={faUndo} />
          </button>
        </div>
        <CETooltip
          target={helpId}
          trigger="hover focus"
          placement="top"
          autohide={false}
          innerClassName={styles.helpContent}
          popperClassName={styles.helpTooltip}
        >
          Votes cost their square: +{example} or −{example} uses {example ** 2} credit{example === 1 ? '' : 's'}. Share
          your {budget} credit{budget === 1 ? '' : 's'} across the options. You may leave credits unused. Use + to
          support an option and − to oppose it.
        </CETooltip>
      </div>
      <div className={styles.meter} aria-hidden="true" data-testid="ce-quadratic-meter">
        {votes.map((vote, index) =>
          vote === 0 ? null : (
            <span
              key={index}
              data-direction={vote > 0 ? 'positive' : 'negative'}
              style={{ width: `${(vote ** 2 / budget) * 100}%` }}
            />
          ),
        )}
      </div>
      <div className={styles.optionsViewport} ref={viewportRef}>
        <div id={optionsId} className={styles.options} ref={optionsRef} style={{ height: optionsHeight }}>
          {options.map((option, index) => {
            const vote = votes[index];
            const inputId = `quadratic-${instanceId}-${index}`;
            return (
              <div
                className={styles.option}
                key={index}
                data-direction={vote > 0 ? 'positive' : vote < 0 ? 'negative' : 'neutral'}
              >
                <label htmlFor={inputId} className={styles.optionLabel} data-quadratic-option-label>
                  {String(option)}
                </label>
                <div className={styles.stepper}>
                  {/* Pointer shortcuts; the range input below is the keyboard and assistive control. */}
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-hidden="true"
                    className={styles.step}
                    data-step="down"
                    data-ce-control-appearance="frameless"
                    disabled={disabled || !canStep(index, -1)}
                    title={`${formatVote(vote - 1)} (${credits((vote - 1) ** 2)})`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => updateVote(index, vote - 1)}
                    data-testid={`ce-quadratic-decrease-${index}`}
                  >
                    <FontAwesomeIcon icon={faMinus} />
                  </button>
                  <span className={styles.vote} aria-hidden="true">
                    {formatVote(vote)}
                  </span>
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-hidden="true"
                    className={styles.step}
                    data-step="up"
                    data-ce-control-appearance="frameless"
                    disabled={disabled || !canStep(index, 1)}
                    title={`${formatVote(vote + 1)} (${credits((vote + 1) ** 2)})`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => updateVote(index, vote + 1)}
                    data-testid={`ce-quadratic-increase-${index}`}
                  >
                    <FontAwesomeIcon icon={faPlus} />
                  </button>
                  <input
                    id={inputId}
                    className={styles.voteInput}
                    type="range"
                    min={-limit}
                    max={limit}
                    step={1}
                    value={vote}
                    disabled={disabled}
                    aria-valuetext={`${vote > 0 ? '+' : ''}${vote} vote${Math.abs(vote) === 1 ? '' : 's'}, ${credits(vote ** 2)}${vote === 0 ? ', neutral' : vote > 0 ? ', support' : ', oppose'}`}
                    onPointerDown={() => {
                      if (deferDragUpdates && !disabled) {
                        dragSourceRef.current = sourceKey;
                        draggedOptionRef.current = index;
                      }
                    }}
                    onBlur={() => {
                      // A new slider's pointerdown precedes the old slider's blur.
                      // Only blur on the dragged option may end the new interaction.
                      if (draggedOptionRef.current === index) finishDrag();
                    }}
                    onKeyDown={finishDrag}
                    onChange={(event) => updateVote(index, Number(event.target.value))}
                    data-testid={`ce-quadratic-vote-${index}`}
                  />
                </div>
                <span
                  className={styles.squares}
                  aria-hidden="true"
                  data-testid={`ce-quadratic-squares-${index}`}
                  data-solid={Math.abs(vote) > 12 ? '' : undefined}
                  style={{ '--votes': Math.abs(vote), '--unit': `${squareUnit}px` } as React.CSSProperties}
                >
                  {vote !== 0 &&
                    (Math.abs(vote) <= 12 ? (
                      Array.from({ length: vote ** 2 }, (_, cell) => <i key={cell} />)
                    ) : (
                      <i className={styles.solidSquare} />
                    ))}
                </span>
                <span className={styles.cost} data-testid={`ce-quadratic-cost-${index}`}>
                  {vote === 0 ? '' : credits(vote ** 2)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      {scrollState.overflow && (
        <div className={styles.scrollControls}>
          {scrollState.canScrollUp && (
            <button
              type="button"
              className={`${styles.moreOptions} ${styles.scrollPrevious}`}
              aria-label="Scroll to previous options"
              aria-controls={optionsId}
              onClick={() =>
                optionsRef.current?.scrollBy({
                  top: -optionsRef.current.clientHeight * 0.8,
                  behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
                })
              }
            >
              <FontAwesomeIcon icon={faChevronUp} />
            </button>
          )}
          {scrollState.canScrollDown && (
            <button
              type="button"
              className={`${styles.moreOptions} ${styles.scrollNext}`}
              onClick={scrollToMoreOptions}
              aria-label="Scroll to more options"
              aria-controls={optionsId}
              title="More options below"
              data-testid={E2E_TESTIDS.QUADRATIC_SCROLL_MORE}
            >
              <FontAwesomeIcon icon={faChevronDown} />
            </button>
          )}
        </div>
      )}
      {valueError && (
        <p className={styles.error} role="alert">
          {valueError}
        </p>
      )}
    </fieldset>
  );
}
