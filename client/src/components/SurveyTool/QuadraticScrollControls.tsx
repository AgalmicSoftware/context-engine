import React, { createContext, useContext, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons';
import styles from './QuadraticAllocationInput.module.scss';

type ScrollControlsTarget = {
  target: HTMLDivElement | null;
  setTarget: (target: HTMLDivElement | null) => void;
};

const ScrollControlsContext = createContext<ScrollControlsTarget | null>(null);

export function QuadraticScrollControlsProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const value = useMemo(() => ({ target, setTarget }), [target]);
  return <ScrollControlsContext.Provider value={value}>{children}</ScrollControlsContext.Provider>;
}

export function QuadraticScrollControlsSlot() {
  const context = useContext(ScrollControlsContext);
  return <div ref={context?.setTarget} className={styles.scrollSlot} />;
}

export function QuadraticScrollControls({ children, inline = true }: { children: React.ReactNode; inline?: boolean }) {
  const context = useContext(ScrollControlsContext);
  // The input owns its controls; a per-card target keeps concurrent cards isolated.
  // Standalone inputs and temporarily absent footers retain the inline controls, unless they would take a line.
  if (context?.target) return createPortal(children, context.target);
  return inline ? <>{children}</> : null;
}

const scrollBehavior = (): ScrollBehavior =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

/** Brings the first option not wholly in view to the top; one option taller than the list advances through itself. */
const scrollToMoreOptions = (list: HTMLElement, rows: Element[]): void => {
  const bounds = list.getBoundingClientRect();
  const next = rows.find((option) => option.getBoundingClientRect().bottom > bounds.bottom + 1);
  const nextTop = next ? next.getBoundingClientRect().top - bounds.top + list.scrollTop : list.scrollHeight;
  const top = nextTop > list.scrollTop + 1 ? nextTop : list.scrollTop + list.clientHeight * 0.8;
  list.scrollTo({ top, behavior: scrollBehavior() });
};

type ListScrollCueProps = {
  listRef: React.RefObject<HTMLElement | null>;
  /** The options, top to bottom; the down chevron brings the first one cut off into view. */
  rows: () => Element[];
  controlsId: string;
  canScrollUp: boolean;
  canScrollDown: boolean;
  nextTestId?: string;
  /** Whether to show in place when the card has no footer slot for them. */
  inline?: boolean;
};

/** The up and down chevrons under a list with more options out of view, placed in the card's footer slot. */
export function ListScrollCue({
  listRef,
  rows,
  controlsId,
  canScrollUp,
  canScrollDown,
  nextTestId,
  inline,
}: ListScrollCueProps) {
  return (
    <QuadraticScrollControls inline={inline}>
      <div className={styles.scrollControls}>
        {canScrollUp && (
          <button
            type="button"
            className={`${styles.moreOptions} ${styles.scrollPrevious}`}
            aria-label="Scroll to previous options"
            aria-controls={controlsId}
            onClick={() => {
              const list = listRef.current;
              list?.scrollBy({ top: -list.clientHeight * 0.8, behavior: scrollBehavior() });
            }}
          >
            <FontAwesomeIcon icon={faChevronUp} />
          </button>
        )}
        {canScrollDown && (
          <button
            type="button"
            className={`${styles.moreOptions} ${styles.scrollNext}`}
            aria-label="Scroll to more options"
            aria-controls={controlsId}
            title="More options below"
            data-testid={nextTestId}
            onClick={() => listRef.current && scrollToMoreOptions(listRef.current, rows())}
          >
            <FontAwesomeIcon icon={faChevronDown} />
          </button>
        )}
      </div>
    </QuadraticScrollControls>
  );
}
