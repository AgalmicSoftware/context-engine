/** @file SessionInterviewResearchWhat.tsx: "What's this?" beside Share for research, whose tooltip stays open long enough to reach its links. */
import { useCallback, useEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Tooltip } from 'reactstrap';
import styles from './SessionInterviewResearchConsent.module.scss';

/** How long the tooltip stays after the pointer or focus leaves, so a link in it can still be reached. */
export const RESEARCH_WHAT_LINGER_MS = 2000;

type Props = { id: string; descriptionId: string; children: ReactNode };

// Open on a hover, a tap or focus; it goes 2 s after the pointer or focus leaves both the button and the
// tooltip, or at once on Escape. The tooltip sits at the end of the page, so Tab steps from the button into
// its links, and on past the last one to whatever follows the button.
export default function SessionInterviewResearchWhat({ id, descriptionId, children }: Props) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const button = useRef<HTMLButtonElement | null>(null);
  // Escape that closed the tooltip, so its key-up doesn't go on to close the dialog too.
  const closedByEscape = useRef(false);
  const tip = useRef<HTMLDivElement | null>(null);
  const cancel = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = undefined;
  }, []);
  const show = useCallback(() => {
    cancel();
    setOpen(true);
  }, [cancel]);
  const hideSoon = useCallback(() => {
    cancel();
    timer.current = setTimeout(() => setOpen(false), RESEARCH_WHAT_LINGER_MS);
  }, [cancel]);
  const hideNow = useCallback(() => {
    cancel();
    setOpen(false);
  }, [cancel]);
  useEffect(() => cancel, [cancel]);

  const within = (node: unknown) =>
    node instanceof Node && Boolean(button.current?.contains(node) || tip.current?.contains(node));
  const leaving = (event: FocusEvent) => {
    if (!within(event.relatedTarget)) hideSoon();
  };
  const links = () => Array.from(tip.current?.querySelectorAll<HTMLElement>('a[href]') || []);
  // What Tab reaches after the button when the tooltip isn't in the way.
  const afterButton = () => {
    const scope = button.current?.closest('[role="dialog"]') || document.body;
    const focusable = Array.from(
      scope.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'),
    ).filter(
      (element) =>
        element === button.current ||
        (!element.hasAttribute('disabled') &&
          !tip.current?.contains(element) &&
          !element.closest('[hidden], [aria-hidden="true"]')),
    );
    return focusable[focusable.indexOf(button.current as HTMLElement) + 1] || null;
  };
  // The tooltip renders in a portal, but its key events still bubble to the dialog, which closes on Escape and
  // wraps Tab: the keys handled here go no further.
  const escape = (event: KeyboardEvent) => {
    closedByEscape.current = open;
    if (open) event.stopPropagation();
    hideNow();
  };
  const onKeyUp = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !closedByEscape.current) return;
    closedByEscape.current = false;
    event.stopPropagation();
  };
  const onButtonKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') escape(event);
    else if (event.key === 'Tab' && !event.shiftKey && open && links().length) {
      event.preventDefault();
      event.stopPropagation();
      links()[0].focus();
    }
  };
  const onTipKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      button.current?.focus();
      escape(event);
      return;
    }
    if (event.key !== 'Tab') return;
    const all = links();
    const at = all.indexOf(document.activeElement as HTMLElement);
    if (event.shiftKey && at <= 0) {
      event.preventDefault();
      event.stopPropagation();
      button.current?.focus();
    } else if (!event.shiftKey && at === all.length - 1) {
      event.preventDefault();
      event.stopPropagation();
      hideNow();
      (afterButton() || button.current)?.focus();
    }
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        id={id}
        className={`${styles.researchLink} ${styles.researchWhat}`}
        data-ce-control-appearance="frameless"
        aria-label="What’s this? About sharing for research"
        aria-describedby={descriptionId}
        onMouseEnter={show}
        onMouseLeave={hideSoon}
        onFocus={show}
        onBlur={leaving}
        onClick={show}
        onKeyDown={onButtonKey}
        onKeyUp={onKeyUp}
      >
        What’s this?
      </button>
      <Tooltip target={id} isOpen={open} placement="top" trigger="manual" autohide={false}>
        <div
          ref={tip}
          onMouseEnter={cancel}
          onMouseLeave={hideSoon}
          onFocus={cancel}
          onBlur={leaving}
          onKeyDown={onTipKey}
          onKeyUp={onKeyUp}
          data-testid="ce-interview-research-what-tip"
        >
          {children}
        </div>
      </Tooltip>
    </>
  );
}
