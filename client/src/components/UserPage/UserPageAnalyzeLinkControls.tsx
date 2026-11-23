import React, { useEffect, useRef, useState } from 'react';

import { faMagic } from '@fortawesome/free-solid-svg-icons';

import { AccountMenuRow } from '../Account/AccountMenu';
import { ANALYZE_LINK_EVENT, openAnalyzeLink, takeAnalyzeLinkArrival } from './userPageAnalyzeLink';

// How long the page must stay ready before Analyze starts by itself, where answers were still arriving: they
// arrive in steps, and the page is ready between them.
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

type AnalyzeLinkArrivalProps = {
  ready: boolean;
  /** Answers are still on their way to the page. */
  arriving?: boolean;
  /** The page has loaded and Analyze cannot be pressed: nothing to analyze, or no AI. */
  stuck?: boolean;
  onStart: () => void;
  /** Draws the Analyze button: whether a press is waiting to start, and how a press by hand takes its place. */
  children?: (starting: boolean, startedByHand: () => void) => React.ReactNode;
};

/**
 * On my own page: starts Analyze once, where "Analyze me" was pressed just before and the page is ready. A page
 * that is ready as it opens starts at once; one whose answers were still arriving waits until it has stayed ready.
 */
export const AnalyzeLinkArrival = ({
  ready,
  arriving = false,
  stuck = false,
  onStart,
  children,
}: AnalyzeLinkArrivalProps): React.ReactElement | null => {
  // The time until which the press may start Analyze; 0 once it has, or where there was no press.
  const [deadline, setDeadline] = useState(0);
  // Presses made while this page is on screen: each marks the address again, for this page to take.
  const [presses, setPresses] = useState(0);
  const taken = useRef(-1);
  const settle = useRef(false);
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
    settle.current = false;
    setDeadline(takeAnalyzeLinkArrival());
  }, [presses]);
  useEffect(() => {
    if (!deadline) return undefined;
    if (arriving) settle.current = true;
    if (!ready && !stuck) return undefined;
    // Ready: Analyze starts. Stuck for as long as the settle wait: the press is dropped, and the button stops
    // saying Analyze will start.
    const end = () => {
      setDeadline(0);
      if (ready && Date.now() <= deadline) start.current();
    };
    if (ready && !settle.current) return void end();
    const timer = setTimeout(end, ANALYZE_LINK_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [deadline, ready, arriving, stuck]);
  // Past its time the press starts nothing, and the button stops saying it will.
  useEffect(() => {
    if (!deadline) return undefined;
    const timer = setTimeout(() => setDeadline(0), Math.max(0, deadline - Date.now()));
    return () => clearTimeout(timer);
  }, [deadline]);
  return children ? <>{children(deadline > 0, () => setDeadline(0))}</> : null;
};
