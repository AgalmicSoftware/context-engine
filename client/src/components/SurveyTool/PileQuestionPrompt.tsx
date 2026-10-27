import { useLayoutEffect, useRef, type ReactNode } from 'react';
import styles from './SurveyTool.module.scss';

export default function PileQuestionPrompt({ children }: { children: ReactNode }) {
  const headerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const header = headerRef.current;
    const title = header?.querySelector<HTMLElement>(`#${styles.questionTitle}`);
    if (!header || !title || typeof window.matchMedia !== 'function' || typeof ResizeObserver === 'undefined') return;
    const body = header.parentElement;
    const content = body?.querySelector<HTMLElement>(`.${styles.pileCardMainContent}`);
    const footer = body?.querySelector<HTMLElement>(`.${styles.pileCardFooter}`);
    const binaryChoices = content?.querySelector<HTMLElement>(`#${styles.binaryChoice}`);
    const rating = content?.querySelector<HTMLElement>(`.${styles.ratingQuestionContainer}`);
    const mobile = window.matchMedia('(max-width: 480px)');
    let disposed = false;

    const fit = () => {
      if (disposed) return;
      title.style.removeProperty('font-size');
      header.removeAttribute('tabindex');
      if (body) delete body.dataset.pileAnswerLayout;
      if (!mobile.matches || !header.clientHeight) return;

      // Try the comfortable answer layout with the normal-size prompt first.
      // A long prompt or an expanded footer takes priority over large answers;
      // only the compact fallback may shrink the prompt or make it scroll.
      if (body && content && footer && binaryChoices) {
        body.dataset.pileAnswerLayout = 'roomy';
        if (binaryChoices.scrollHeight > content.clientHeight + 1 || body.scrollHeight > body.clientHeight + 1) {
          delete body.dataset.pileAnswerLayout;
        }
      } else if (body && content && footer && rating) {
        body.dataset.pileAnswerLayout = 'centered';
        const gap = parseFloat(getComputedStyle(body).rowGap) || 0;
        const answerBox = content.getBoundingClientRect();
        if (
          header.getBoundingClientRect().bottom + gap > answerBox.top ||
          answerBox.bottom + gap > footer.getBoundingClientRect().top
        ) {
          delete body.dataset.pileAnswerLayout;
        }
      }

      // Start at the theme's normal size on every resize so a previously shrunk
      // prompt grows back when space returns; retain scrolling at the minimum.
      let size = parseFloat(getComputedStyle(title).fontSize);
      const minimum = Math.min(size, parseFloat(getComputedStyle(document.documentElement).fontSize));
      while (header.scrollHeight > header.clientHeight + 1 && size > minimum) {
        size = Math.max(minimum, size - 1);
        title.style.fontSize = `${size}px`;
      }
      if (header.scrollHeight > header.clientHeight + 1) header.tabIndex = 0;
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(header);
    if (body) observer.observe(body);
    if (footer) observer.observe(footer);
    if (binaryChoices) observer.observe(binaryChoices);
    mobile.addEventListener('change', fit);
    void document.fonts?.ready.then(fit);
    return () => {
      disposed = true;
      observer.disconnect();
      mobile.removeEventListener('change', fit);
      if (body) delete body.dataset.pileAnswerLayout;
    };
  }, [children]);

  return (
    <div ref={headerRef} className={styles.pileCardHeader}>
      {children}
    </div>
  );
}
