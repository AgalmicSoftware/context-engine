import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './SurveyTool.module.scss';

/** Keep desktop actions inline; compact layouts open a labelled, dismissible popover. */
export default function PileQuestionActionMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [toggle, actions] = React.Children.toArray(children) as React.ReactElement<React.HTMLAttributes<HTMLElement>>[];
  const close = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) anchor.current?.querySelector('button')?.focus();
  };

  useLayoutEffect(() => {
    if (!open || !panel.current) return;
    const trigger = anchor.current?.querySelector('button')?.getBoundingClientRect();
    if (!trigger) return;
    const popup = panel.current.getBoundingClientRect();
    setPosition({
      left: Math.max(8, Math.min(trigger.left, window.innerWidth - popup.width - 8)),
      top: Math.max(
        8,
        Math.min(
          trigger.bottom + 8 + popup.height <= window.innerHeight - 8
            ? trigger.bottom + 8
            : trigger.top - popup.height - 8,
          window.innerHeight - popup.height - 8,
        ),
      ),
    });
  }, [open]);

  useLayoutEffect(() => {
    if (open && position) panel.current?.querySelector('button')?.focus({ preventScroll: true });
  }, [open, position]);

  useEffect(() => {
    if (!open) return;
    const dismiss = () => setOpen(false);
    window.addEventListener('resize', dismiss);
    window.addEventListener('scroll', dismiss, true);
    return () => {
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('scroll', dismiss, true);
    };
  }, [open]);

  return (
    <div className={styles.pileActionMenu} ref={anchor}>
      {React.cloneElement(toggle, {
        'aria-expanded': open,
        'aria-haspopup': 'dialog',
        onClick: () => {
          setPosition(null);
          setOpen((value) => !value);
        },
      })}
      {open
        ? createPortal(
            <>
              <div
                className={styles.pileActionBackdrop}
                data-testid="ce-question-actions-backdrop"
                onClick={() => close()}
              />
              <div
                ref={panel}
                role="dialog"
                aria-label="Question actions"
                className={styles.pileActionPopover}
                style={{ ...position, visibility: position ? 'visible' : 'hidden' }}
                onClick={(event) => {
                  if ((event.target as Element).closest('button')) close(false);
                }}
                onBlur={(event) => {
                  if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) close(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    close();
                  }
                  if (event.key === 'Tab') {
                    const buttons = panel.current?.querySelectorAll('button');
                    if (buttons && event.target === buttons[event.shiftKey ? 0 : buttons.length - 1]) {
                      event.preventDefault();
                      close();
                    }
                  }
                }}
              >
                {React.cloneElement(actions, { className: styles.pileActionPopoverButtons })}
              </div>
            </>,
            document.body,
          )
        : actions}
    </div>
  );
}
