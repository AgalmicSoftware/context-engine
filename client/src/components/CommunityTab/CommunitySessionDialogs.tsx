/** @file CommunitySessionDialogs.tsx: the Stats Groups and Questions dialogs, a list of sessions that opens one. */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faChevronLeft, faChevronRight, faSpinner } from '@fortawesome/free-solid-svg-icons';
import BeeswarmPlot, { type BeeswarmPoint } from '../Shared/BeeswarmPlot/BeeswarmPlot';
import { HelpButton } from '../Shared/WorkerGroupJoinChoiceHelp';
import styles from './CommunityTab.module.scss';

/**
 * One session in a dialog's list. `ready` sessions hold `count` and open; the others say why there is no number:
 * still being counted, not shown to this viewer, or not readable here.
 */
export type CommunityDialogSession = {
  slug: string;
  name: string;
  count: number;
  state: 'ready' | 'loading' | 'private' | 'unread';
};

export type CommunityDialogGroup = { key: string; name: string; open: boolean; href: string };

export const countOf = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? '' : 's'}`;

/** Most first. Where several sessions are in view, one counted at zero has nothing to open and is left out. */
export const dialogSessionList = (sessions: CommunityDialogSession[]): CommunityDialogSession[] =>
  sessions
    .filter((session) => sessions.length === 1 || session.state !== 'ready' || session.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug));

const SessionState = ({ session, noun }: { session: CommunityDialogSession; noun: string }) => {
  if (session.state === 'loading') {
    return (
      <>
        <FontAwesomeIcon icon={faSpinner} spin /> counting
      </>
    );
  }
  if (session.state === 'unread') return <>can’t be read here</>;
  if (session.state === 'private') {
    return (
      <>
        {noun}s not public
        <HelpButton label={`About ${noun}s not public`}>
          This session shows its {noun}s only to people signed in to it.
        </HelpButton>
      </>
    );
  }
  return (
    <>
      {countOf(session.count, noun)} <FontAwesomeIcon icon={faChevronRight} />
    </>
  );
};

/**
 * The sessions in view with their counts, sorted by `dialogSessionList`. Choosing one shows `renderSession` for it,
 * with a way back; with one session in view the dialog opens straight to it.
 */
export const CommunitySessionDialog = ({
  noun,
  sessions,
  total,
  totalHelp = '',
  emptyText,
  renderSession,
  testId,
}: {
  noun: string;
  sessions: CommunityDialogSession[];
  /** The tile's number, which counts once what several sessions share. */
  total: number;
  /** Said beside the total where the rows add up to more than it. */
  totalHelp?: string;
  emptyText: string;
  renderSession: (session: CommunityDialogSession) => React.ReactNode;
  testId: string;
}) => {
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const lastOpened = useRef<string | null>(null);
  const only = sessions.length === 1 && sessions[0].state === 'ready' ? sessions[0] : null;
  const open = only || sessions.find((session) => session.slug === openSlug && session.state === 'ready') || null;
  const single = !!only;
  const openedSlug = open?.slug ?? null;

  // Focus follows the view: into a session at its way back, and out of it to the row it was opened from.
  useEffect(() => {
    if (single) return;
    if (openedSlug !== null) {
      lastOpened.current = openedSlug;
      backRef.current?.focus();
    } else if (lastOpened.current !== null) {
      const rows = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[data-ce-session-slug]') || []);
      rows.find((row) => row.dataset.ceSessionSlug === lastOpened.current)?.focus();
      lastOpened.current = null;
    }
  }, [single, openedSlug]);

  if (open) {
    return (
      <div className={styles.dialogSession} data-testid={`${testId}-session`} data-ce-session-slug={open.slug}>
        {!only && (
          <button ref={backRef} type="button" className={styles.dialogBack} onClick={() => setOpenSlug(null)}>
            <FontAwesomeIcon icon={faChevronLeft} /> All sessions
          </button>
        )}
        {renderSession(open)}
      </div>
    );
  }
  if (!sessions.length) {
    return (
      <p className={styles.dialogNote} data-testid={testId}>
        {emptyText}
      </p>
    );
  }
  return (
    <div className={styles.sessionsContent} data-testid={testId}>
      <p className={styles.dialogNote}>
        {countOf(sessions.length, 'session')}, {countOf(total, noun)}
        {totalHelp && <HelpButton label={`About the ${noun} total`}>{totalHelp}</HelpButton>}
      </p>
      <div className={styles.sessionListScroller} role="region" aria-label="Sessions">
        <ul ref={listRef} className={styles.sessionList}>
          {sessions.map((session) => {
            const content = (
              <>
                <strong className={styles.sessionIdentity}>{session.name}</strong>
                <span className={styles.sessionKind}>
                  <SessionState session={session} noun={noun} />
                </span>
              </>
            );
            return (
              <li key={session.slug}>
                {session.state === 'ready' ? (
                  <button
                    type="button"
                    className={styles.sessionLink}
                    data-ce-session-slug={session.slug}
                    onClick={() => setOpenSlug(session.slug)}
                  >
                    {content}
                  </button>
                ) : (
                  <div className={styles.sessionLink} data-ce-session-slug={session.slug}>
                    {content}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

/** A session's groups, each opening its own page, then the session's groups page. `noun` is the site's word. */
export const CommunityGroupsSession = ({
  session,
  groups,
  href,
  noun,
}: {
  session: CommunityDialogSession;
  groups: CommunityDialogGroup[];
  /** The session's groups page. */
  href: string;
  noun: string;
}) => (
  <>
    <h6 className={styles.dialogHeading}>
      {session.name}: {countOf(groups.length, noun)}
    </h6>
    {groups.length ? (
      <ul className={styles.sessionList}>
        {groups.map((group) => (
          <li key={group.key}>
            <a className={styles.sessionLink} href={group.href}>
              <strong className={styles.sessionIdentity}>{group.name}</strong>
              <span className={styles.sessionKind}>
                {group.open ? 'Open to join' : 'Closed'} <FontAwesomeIcon icon={faChevronRight} />
              </span>
            </a>
          </li>
        ))}
      </ul>
    ) : (
      <p className={styles.dialogNote}>No {noun}s in this session yet.</p>
    )}
    <a className={styles.dialogMore} href={href}>
      See all of this session’s {noun}s <FontAwesomeIcon icon={faArrowRight} />
    </a>
  </>
);

export type CommunityDialogQuestion = { key: string; prompt: string; type: string };

/** Where an opened session's questions stand: in hand, being read, slow or failed to read, or not readable here. */
export type CommunityQuestionsState = 'ready' | 'loading' | 'slow' | 'failed' | 'unopened';

const QUESTION_KINDS: [string, string[]][] = [
  ['agree/disagree', ['binary']],
  ['choice', ['multichoice', 'multiple-choice', 'poll']],
  ['rating', ['rating']],
  ['written', ['freeform', 'text']],
  ['quadratic', ['quadratic']],
];

/** What kind of question a stored type is, in the words the dialog uses. */
export const questionKind = (type: string): string =>
  QUESTION_KINDS.find(([, types]) => types.includes(type.trim().toLowerCase()))?.[0] || 'other';

/** "31 agree/disagree, 5 choice, 4 written": each kind present, in a fixed order. */
export const questionKindSummary = (questions: CommunityDialogQuestion[]): string => {
  const counts = new Map<string, number>();
  questions.forEach(({ type }) => counts.set(questionKind(type), (counts.get(questionKind(type)) || 0) + 1));
  return [...QUESTION_KINDS.map(([kind]) => kind), 'other']
    .filter((kind) => counts.has(kind))
    .map((kind) => `${counts.get(kind)} ${kind}`)
    .join(', ');
};

/** Answered agree/disagree questions it takes for the chart to show first. */
export const CHART_FIRST_MIN_QUESTIONS = 3;

/** A box's laid-out width, kept current: 0 until measured, and where the browser cannot measure. */
const useBoxWidth = () => {
  const [width, setWidth] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((node: HTMLElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!node || typeof ResizeObserver === 'undefined') return;
    observer.current = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.current.observe(node);
  }, []);
  return [ref, width] as const;
};

/**
 * A session's questions as a chart of its answered agree/disagree questions or as a list; a dot or a row opens the
 * session's results at `href`. `onOpen` runs once the session is shown, to read what this browser does not hold.
 */
export const CommunityQuestionsSession = ({
  session,
  questions,
  points,
  href,
  state,
  answersNote = '',
  onOpen,
  onRetry,
  onOpenResults,
}: {
  session: CommunityDialogSession;
  questions: CommunityDialogQuestion[];
  /** Answered agree/disagree questions only. */
  points: BeeswarmPoint[];
  href: string;
  state: CommunityQuestionsState;
  answersNote?: string;
  onOpen?: () => void;
  onRetry?: () => void;
  /** Opens `href`, from a dot. */
  onOpenResults: () => void;
}) => {
  const [picked, setPicked] = useState<'chart' | 'list' | null>(null);
  // The chart is drawn at its box's own width, so a phone shows all of it without scrolling sideways.
  const [plotRef, plotWidth] = useBoxWidth();
  const opened = useRef(onOpen);
  opened.current = onOpen;
  // Also when a read becomes needed while the session is shown: the cache it was drawn from can start reading again.
  const wantsRead = !!onOpen;
  useEffect(() => opened.current?.(), [session.slug, wantsRead]);
  // Until a view is picked, the default follows what has been read.
  const view = picked || (points.length >= CHART_FIRST_MIN_QUESTIONS ? 'chart' : 'list');

  let body: React.ReactNode;
  if (state === 'unopened') {
    body = (
      <>
        <p className={styles.dialogNote}>This session’s questions can be read here once it has been opened.</p>
        <a className={styles.dialogMore} href={href}>
          Open the session <FontAwesomeIcon icon={faArrowRight} />
        </a>
      </>
    );
  } else if (state === 'loading') {
    body = (
      <p className={styles.dialogNote} role="status">
        <FontAwesomeIcon icon={faSpinner} spin /> Reading questions…
      </p>
    );
  } else if (state === 'slow' || state === 'failed') {
    body = (
      <>
        <p className={styles.dialogNote} role="status">
          {state === 'slow' ? 'This is taking too long.' : 'This session’s questions can’t be read here.'}
        </p>
        <button type="button" className={styles.dialogBack} onClick={onRetry}>
          Try again
        </button>
      </>
    );
  } else if (!questions.length) {
    body = <p className={styles.dialogNote}>No questions in this session yet.</p>;
  } else {
    body = (
      <>
        <p className={styles.dialogNote}>{questionKindSummary(questions)}</p>
        {points.length > 0 && (
          <div className={styles.dialogToggle} role="group" aria-label="Show questions as">
            {(['chart', 'list'] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={view === option}
                className={view === option ? styles.dialogTogglePressed : undefined}
                onClick={() => setPicked(option)}
              >
                {option === 'chart' ? 'Chart' : 'List'}
              </button>
            ))}
          </div>
        )}
        {view === 'chart' && points.length > 0 ? (
          <div className={styles.dialogPlot} ref={plotRef}>
            <BeeswarmPlot
              points={points}
              width={plotWidth || undefined}
              domain={[0, 1]}
              height={200}
              showIdleSummary={false}
              testIdPrefix="ce-community-questions-plot"
              onClick={onOpenResults}
            />
            <p className={styles.dialogNote}>Click a dot to open its results.</p>
            {/* The dots are no links to a keyboard or a screen reader, and all lead here. */}
            <a className={styles.dialogMore} href={href}>
              Open this session’s results <FontAwesomeIcon icon={faArrowRight} />
            </a>
          </div>
        ) : (
          <ul className={styles.sessionList}>
            {questions.map((question) => (
              <li key={question.key}>
                <a className={styles.sessionLink} href={href}>
                  <strong className={styles.sessionIdentity}>{question.prompt}</strong>
                  <span className={styles.sessionKind}>{questionKind(question.type)}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
        {answersNote && <p className={styles.dialogNote}>{answersNote}</p>}
      </>
    );
  }
  return (
    <>
      <h6 className={styles.dialogHeading}>
        {/* Once its questions are in hand, the heading counts what the list shows. */}
        {session.name}: {countOf(state === 'ready' ? questions.length : session.count, 'question')}
      </h6>
      {body}
    </>
  );
};
