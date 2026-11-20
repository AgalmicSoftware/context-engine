import React, { useEffect, useRef, useState } from 'react';

import styles from './UserPage.module.scss';
import { openAnalyzeLink, takeAnalyzeLinkArrival } from './userPageAnalyzeLink';

// How long the page must stay ready before Analyze starts by itself: answers arrive in steps.
export const ANALYZE_LINK_SETTLE_MS = 1500;

/** In the account dialog, under my address and user-name. */
export const AnalyzeUserButton = ({ href }: { href: string }): React.ReactElement => (
  <button
    type="button"
    className={styles.usernameButton}
    title="Opens your page and makes your AI analysis"
    onClick={() => openAnalyzeLink(href)}
  >
    Analyze user
  </button>
);

/** On my own page: starts Analyze once, where "Analyze user" was pressed just before and the page is ready. */
export const AnalyzeLinkArrival = ({ ready, onStart }: { ready: boolean; onStart: () => void }): null => {
  const [deadline, setDeadline] = useState(0);
  const taken = useRef(false);
  const started = useRef(false);
  const start = useRef(onStart);
  start.current = onStart;
  useEffect(() => {
    if (taken.current) return;
    taken.current = true;
    setDeadline(takeAnalyzeLinkArrival());
  }, []);
  useEffect(() => {
    if (!deadline || !ready || started.current) return undefined;
    const timer = setTimeout(() => {
      if (started.current || Date.now() > deadline) return;
      started.current = true;
      start.current();
    }, ANALYZE_LINK_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [deadline, ready]);
  return null;
};
