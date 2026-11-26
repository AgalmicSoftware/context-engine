/** @file CommunitySessionDialogs.tsx: the Stats Groups and Questions dialogs, a list of sessions that opens one. */
import React, { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faChevronLeft, faChevronRight, faSpinner } from '@fortawesome/free-solid-svg-icons';
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
