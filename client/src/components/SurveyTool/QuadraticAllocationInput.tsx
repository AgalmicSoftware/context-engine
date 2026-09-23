import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronUp, faQuestionCircle, faUndo } from '@fortawesome/free-solid-svg-icons';
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
};

export default function QuadraticAllocationInput({
  questionId,
  options = [],
  voiceCredits,
  value,
  disabled = false,
  deferDragUpdates = false,
  onChange,
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
      const peeks = Array.from(list.querySelectorAll('label')).map((label) => {
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
        <span className={styles.oppose}>− Oppose</span>
        <div className={styles.budget}>
          <p role="status" data-testid="ce-quadratic-budget">
            <strong>{budget - spent}</strong> credits left
          </p>
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
            title="Reset all votes to neutral"
            disabled={disabled || (!valueError && votes.every((vote) => vote === 0))}
            onClick={() => {
              dragSourceRef.current = null;
              draggedOptionRef.current = null;
              pendingRef.current = null;
              setPreview(null);
              onChange?.(options.map(() => 0));
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
          Votes cost their square: +7 or −7 uses 49 credits. Share your {budget} credits across the options. You may
          leave credits unused.
        </CETooltip>
        <span className={styles.support}>+ Support</span>
      </div>
      <div className={styles.optionsViewport} ref={viewportRef}>
        <div id={optionsId} className={styles.options} ref={optionsRef} style={{ height: optionsHeight }}>
          {options.map((option, index) => {
            const vote = votes[index];
            const inputId = `quadratic-${instanceId}-${index}`;
            const position = 50 + (vote / limit) * 50;
            return (
              <div
                className={styles.option}
                key={index}
                data-direction={vote > 0 ? 'positive' : vote < 0 ? 'negative' : 'neutral'}
              >
                <div className={styles.optionHeading}>
                  <label htmlFor={inputId}>{String(option)}</label>
                  <span className={styles.vote} aria-hidden="true">
                    {vote > 0 ? '+' : ''}
                    {vote}
                  </span>
                  <span className={styles.cost} data-testid={`ce-quadratic-cost-${index}`}>
                    {vote === 0 ? '' : `${vote ** 2} credits`}
                  </span>
                </div>
                <input
                  id={inputId}
                  className={styles.slider}
                  type="range"
                  min={-limit}
                  max={limit}
                  step={1}
                  value={vote}
                  disabled={disabled}
                  aria-valuetext={`${vote > 0 ? '+' : ''}${vote} votes, ${vote ** 2} credits${vote === 0 ? ', neutral' : vote > 0 ? ', support' : ', oppose'}`}
                  style={
                    {
                      '--vote-start': `${Math.min(position, 50)}%`,
                      '--vote-end': `${Math.max(position, 50)}%`,
                    } as React.CSSProperties
                  }
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
            );
          })}
        </div>
      </div>
      {scrollState.overflow && (
        <div className={styles.scrollControls}>
          {scrollState.canScrollUp && (
            <button
              type="button"
              className={styles.moreOptions}
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
              className={styles.moreOptions}
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
