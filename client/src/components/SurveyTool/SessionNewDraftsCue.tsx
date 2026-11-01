import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowDown } from '@fortawesome/free-solid-svg-icons';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import styles from './SurveyTool.module.scss';

type SessionNewDraftsCueProps = {
  // Drafts generated so far; the count only grows until the recording is cleared.
  count: number;
  // The draft list, which appends new drafts at its end.
  draftsRef: React.RefObject<HTMLElement | null>;
};

const firstNewDraft = (drafts: HTMLElement | null, unseen: number) => {
  const cards = drafts?.querySelectorAll<HTMLElement>(`[data-testid="${E2E_TESTIDS.CREATE_QUESTION}"]`) || [];
  return cards.length >= unseen ? cards[cards.length - unseen] : drafts;
};

// Drafts arrive after each chunk, usually below the fold. This cue says how many are new until the first
// of them scrolls into view, and its button scrolls there.
export function SessionNewDraftsCue({ count, draftsRef }: SessionNewDraftsCueProps) {
  const seenRef = useRef(count);
  const [unseen, setUnseen] = useState(0);
  useEffect(() => {
    seenRef.current = Math.min(seenRef.current, count);
    setUnseen(count - seenRef.current);
  }, [count]);
  const markSeen = useCallback(() => {
    seenRef.current = count;
    setUnseen(0);
  }, [count]);

  useEffect(() => {
    if (!unseen || typeof IntersectionObserver === 'undefined') return undefined;
    let observer: IntersectionObserver | undefined;
    // The draft list renders its new cards after this count changes.
    const frame = requestAnimationFrame(() => {
      const target = firstNewDraft(draftsRef.current, unseen);
      if (!target) return;
      observer = new IntersectionObserver(([entry]) => {
        if (entry?.isIntersecting) markSeen();
      });
      observer.observe(target);
    });
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [draftsRef, markSeen, unseen]);

  const showDrafts = () => {
    firstNewDraft(draftsRef.current, unseen)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // The cue disappears, so focus moves to the drafts instead of the page.
    draftsRef.current?.focus({ preventScroll: true });
    markSeen();
  };

  return (
    <div className={styles.sessionNewDraftsCue} aria-live="polite">
      {unseen > 0 ? (
        <button type="button" onClick={showDrafts}>
          {unseen} new draft {unseen === 1 ? 'question' : 'questions'}
          <FontAwesomeIcon icon={faArrowDown} />
        </button>
      ) : null}
    </div>
  );
}
