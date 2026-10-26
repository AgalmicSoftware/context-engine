import { useLayoutEffect, useRef, type ReactNode } from 'react';
import styles from './SurveyTool.module.scss';

export default function PileQuestionPrompt({ children }: { children: ReactNode }) {
  const headerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const header = headerRef.current;
    const title = header?.querySelector<HTMLElement>(`#${styles.questionTitle}`);
    if (!header || !title || typeof window.matchMedia !== 'function' || typeof ResizeObserver === 'undefined') return;
    const mobile = window.matchMedia('(max-width: 480px)');
    let disposed = false;

    const fit = () => {
      if (disposed) return;
      title.style.removeProperty('font-size');
      header.removeAttribute('tabindex');
      if (!mobile.matches || !header.clientHeight) return;

      // The header's available space is independent of its text. Start at the
      // theme's normal size on every resize so a previously shrunk prompt grows
      // back when space returns; retain scrolling at the readable minimum.
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
    mobile.addEventListener('change', fit);
    void document.fonts?.ready.then(fit);
    return () => {
      disposed = true;
      observer.disconnect();
      mobile.removeEventListener('change', fit);
    };
  }, [children]);

  return <div ref={headerRef} className={styles.pileCardHeader}>{children}</div>;
}
