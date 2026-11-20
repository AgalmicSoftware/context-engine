import React from 'react';
import GlobalSessionSelector from '../Shared/GlobalSessionSelector';
import { normalizeSessionSlug } from '../../utilities/session/sessionNaming';
import { buildPublicRoute } from '../../utilities/ui/publicUrl';
import styles from './UserPage.module.scss';

/** The same person's profile in another session, with that session's `?worker=` (an unlisted one needs it). */
export const buildProfileSessionHref = (address: string, sessionSlug: string, sessionHref = ''): string => {
  const params = new URLSearchParams({ session: normalizeSessionSlug(sessionSlug) });
  try {
    const worker = new URL(sessionHref, 'https://site.invalid').searchParams.get('worker');
    if (worker) params.set('worker', worker);
  } catch {
    // No usable link: the session is opened by its name alone.
  }
  return buildPublicRoute(`/u/${encodeURIComponent(address)}?${params.toString()}`);
};

type UserPageSessionSwitchProps = {
  viewAddress: string;
  sessionSlug: string;
  sessionConfig?: unknown;
  /** Opens the picked profile; a new history entry, so back returns to this session. */
  openProfile?: (href: string) => void;
};

const loadPage = (href: string) => window.location.assign(href);

/**
 * Names the session this profile shows and opens the same profile in another one.
 * It loads that page: the site loads a session's questions, surveys, answers, names
 * and groups when a page opens on it, and the browser's back and forward follow.
 * Sign-in is untouched: a page load restores it as opening any link does.
 */
const UserPageSessionSwitch = ({
  viewAddress,
  sessionSlug,
  sessionConfig,
  openProfile = loadPage,
}: UserPageSessionSwitchProps): React.ReactElement => {
  const current = normalizeSessionSlug(sessionSlug);
  return (
    <div className={styles.sessionSwitchRow}>
      <GlobalSessionSelector
        selection={{ primarySessionSlug: current, selectedSessionScope: current ? 'active' : 'general' }}
        sessionConfig={sessionConfig}
        offerAll={false}
        testId="ce-user-page-session-select"
        className={styles.sessionSwitch}
        onChange={({ primarySessionSlug = '' }, { href }) => {
          if (normalizeSessionSlug(primarySessionSlug) === current) return;
          openProfile(buildProfileSessionHref(viewAddress, primarySessionSlug, href));
        }}
      />
    </div>
  );
};

export default UserPageSessionSwitch;
