import React, { useEffect, useRef, useState } from 'react';

import { faMagic } from '@fortawesome/free-solid-svg-icons';

import { AccountMenuRow } from '../Account/AccountMenu';
import { ANALYZE_LINK_EVENT, openAnalyzeLink, takeAnalyzeLinkArrival } from './userPageAnalyzeLink';

// How long the page must stay ready before Analyze starts by itself: answers arrive in steps.
export const ANALYZE_LINK_SETTLE_MS = 1500;

/** In the account dialog's list, first. `onOpened` closes the dialog once my page has opened beneath it. */
export const AnalyzeMeButton = ({ href, onOpened }: { href: string; onOpened?: () => void }): React.ReactElement => (
  <AccountMenuRow
    icon={faMagic}
    title="Opens your page and makes your AI analysis"
    onClick={() => {
      if (openAnalyzeLink(href) === 'in-app') onOpened?.();
    }}
    testId="ce-account-analyze-me"
  >
    Analyze me
  </AccountMenuRow>
);

/** On my own page: starts Analyze once, where "Analyze me" was pressed just before and the page is ready. */
export const AnalyzeLinkArrival = ({ ready, onStart }: { ready: boolean; onStart: () => void }): null => {
  const [deadline, setDeadline] = useState(0);
  // Presses made while this page is on screen: each marks the address again, for this page to take.
  const [presses, setPresses] = useState(0);
  const taken = useRef(-1);
  const started = useRef(false);
  const start = useRef(onStart);
  start.current = onStart;
  useEffect(() => {
    const onPress = () => setPresses((count) => count + 1);
    window.addEventListener(ANALYZE_LINK_EVENT, onPress);
    return () => window.removeEventListener(ANALYZE_LINK_EVENT, onPress);
  }, []);
  // The press is counted in state, not taken in the listener: a page the press replaces is gone before this
  // runs, and leaves the note for the page that opens.
  useEffect(() => {
    if (taken.current === presses) return;
    taken.current = presses;
    const next = takeAnalyzeLinkArrival();
    if (next) started.current = false;
    setDeadline(next);
  }, [presses]);
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
