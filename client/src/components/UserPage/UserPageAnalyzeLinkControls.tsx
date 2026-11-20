import React, { useEffect, useRef, useState } from 'react';

import { faMagic } from '@fortawesome/free-solid-svg-icons';

import { AccountMenuRow } from '../Account/AccountMenu';
import { openAnalyzeLink, takeAnalyzeLinkArrival } from './userPageAnalyzeLink';

// How long the page must stay ready before Analyze starts by itself: answers arrive in steps.
export const ANALYZE_LINK_SETTLE_MS = 1500;

/** In the account dialog's list, first. */
export const AnalyzeMeButton = ({ href }: { href: string }): React.ReactElement => (
  <AccountMenuRow
    icon={faMagic}
    title="Opens your page and makes your AI analysis"
    onClick={() => openAnalyzeLink(href)}
    testId="ce-account-analyze-me"
  >
    Analyze me
  </AccountMenuRow>
);

/** On my own page: starts Analyze once, where "Analyze me" was pressed just before and the page is ready. */
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
