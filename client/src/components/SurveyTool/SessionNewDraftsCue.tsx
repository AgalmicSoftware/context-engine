import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowDown } from '@fortawesome/free-solid-svg-icons';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import styles from './SurveyTool.module.scss';

type SessionNewDraftsCueProps = {
  // Drafts still in review; removal and submission can lower the count.
  count: number;
  // The draft list, which appends new drafts at its end.
  draftsRef: React.RefObject<HTMLElement | null>;
};

const draftCards = (drafts: HTMLElement | null) =>
  drafts ? [...drafts.querySelectorAll<HTMLElement>(`[data-testid="${E2E_TESTIDS.CREATE_QUESTION}"]`)] : [];

const firstNewDraft = (drafts: HTMLElement | null, unseen: number) => {
  const cards = draftCards(drafts);
  return cards.length >= unseen ? cards[cards.length - unseen] : drafts;
};

// Drafts arrive after each chunk, usually below the fold. This cue says how many are new until the first
// of them is well in view, and its button scrolls there. While it shows, the submit button is not pinned
// (see .sessionNewDraftsCue), so uploading every draft means scrolling past the new ones first.
export function SessionNewDraftsCue({ count, draftsRef }: SessionNewDraftsCueProps) {
  const seenRef = useRef(count);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [unseen, setUnseen] = useState(0);
  useEffect(() => {
    seenRef.current = Math.min(seenRef.current, count);
    setUnseen(count - seenRef.current);
  }, [count]);
  const markSeen = useCallback(() => {
    // The cue is about to go; keep keyboard focus inside the dialog.
    if (buttonRef.current && document.activeElement === buttonRef.current) {
      draftsRef.current?.focus({ preventScroll: true });
    }
    seenRef.current = count;
    setUnseen(0);
  }, [count, draftsRef]);

  useEffect(() => {
    if (!unseen) return undefined;
    let observer: IntersectionObserver | undefined;
    // The draft list renders its new cards after this count changes.
    const frame = requestAnimationFrame(() => {
      const cards = draftCards(draftsRef.current);
      // An upload or a removal can leave fewer new cards than were counted.
      if (cards.length < unseen) {
        seenRef.current = count - cards.length;
        setUnseen(cards.length);
        return;
      }
      if (typeof IntersectionObserver === 'undefined') return;
      // Seen once the card is above the bottom fifth, clear of the pinned submit button.
      observer = new IntersectionObserver(([entry]) => entry?.isIntersecting && markSeen(), {
        rootMargin: '0px 0px -20% 0px',
      });
      observer.observe(cards[cards.length - unseen]);
    });
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [count, draftsRef, markSeen, unseen]);

  const showDrafts = () => {
    firstNewDraft(draftsRef.current, unseen)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    draftsRef.current?.focus({ preventScroll: true });
    markSeen();
  };

  return (
    <div className={styles.sessionNewDraftsCue} aria-live="polite">
      {unseen > 0 ? (
        <button ref={buttonRef} type="button" onClick={showDrafts}>
          {unseen} new draft {unseen === 1 ? 'question' : 'questions'}
          <FontAwesomeIcon icon={faArrowDown} />
        </button>
      ) : null}
    </div>
  );
}
