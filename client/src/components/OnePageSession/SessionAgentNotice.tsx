/** @file SessionAgentNotice.tsx: the robot by a session's title, saying what the Session Agent may read; it opens the agent or how it works. */
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRobot } from '@fortawesome/free-solid-svg-icons';

import CETooltip from '../Shared/CETooltip';
import { buildPublicRepoBlobUrl } from '../../variables/publicRepoMetadata';
import { sessionAgentPageNotice } from './sessionAgentWording';
import styles from './SessionAgentNotice.module.scss';

export const SESSION_AGENT_README_URL = `${buildPublicRepoBlobUrl('README.md')}#session-agent`;

// `sessionConfig` sets the words by the title: who else is shown a person's answers follows its results setting.
// `note` is the session's own words on where its data goes, read after the notice as plain text: a link in it
// is shown where it can be selected, not here. `onOpen`, where this person can ask the agent, opens it.
type Props = {
  id: string;
  className?: string;
  sessionConfig?: unknown;
  note?: string;
  onOpen?: () => void;
};

// Hovering or focusing it shows the notice. With `onOpen` it is a button that opens the Session Agent, whose
// dialog has its own "?" to the README; otherwise a link to the README's Session Agent section. It shows the
// launcher's robot, as the session's own "?" sits beside it.
const SessionAgentNotice = ({ id, className, sessionConfig, note = '', onOpen }: Props) => {
  const notice = sessionAgentPageNotice(sessionConfig);
  const text = note ? `${notice} ${note}` : notice;
  const shared = {
    id,
    className,
    'aria-describedby': `${id}-text`,
    'data-ce-control-appearance': 'frameless',
    'data-testid': 'ce-session-agent-notice-page',
  };
  const icon = <FontAwesomeIcon icon={faRobot} aria-hidden="true" />;
  return (
    <>
      {onOpen ? (
        <button type="button" {...shared} aria-label="Open the Session Agent" onClick={onOpen}>
          {icon}
        </button>
      ) : (
        <a
          {...shared}
          href={SESSION_AGENT_README_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="How the Session Agent works"
        >
          {icon}
        </a>
      )}
      <span id={`${id}-text`} className={styles.hidden}>
        {text}
      </span>
      <CETooltip target={id} placement="bottom" trigger="hover focus" autohide={false}>
        {onOpen ? `Opens the Session Agent. ${text}` : text}
      </CETooltip>
    </>
  );
};

export default SessionAgentNotice;
