/** @file SessionAgentNotice.tsx: the icon saying what the Session Agent may read, which opens how it works. */
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle, faRobot } from '@fortawesome/free-solid-svg-icons';

import CETooltip from '../Shared/CETooltip';
import { buildPublicRepoBlobUrl } from '../../variables/publicRepoMetadata';
import { SESSION_AGENT_USE_NOTICE, sessionAgentPageNotice } from './sessionAgentWording';
import styles from './SessionAgentNotice.module.scss';

const SESSION_AGENT_README_URL = `${buildPublicRepoBlobUrl('README.md')}#session-agent`;

// `sessionConfig` sets the words by the title: who else is shown a person's answers follows its results setting.
type Props = { id: string; where: 'page' | 'switch'; className?: string; sessionConfig?: unknown };

// A link, so selecting it opens the README's Session Agent section; hovering or focusing it shows the notice.
// By the session's title it shows the launcher's robot, as the session's own "?" sits beside it.
const SessionAgentNotice = ({ id, where, className, sessionConfig }: Props) => {
  const text = where === 'page' ? sessionAgentPageNotice(sessionConfig) : SESSION_AGENT_USE_NOTICE;
  return (
    <>
      <a
        id={id}
        href={SESSION_AGENT_README_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        aria-label="How the Session Agent works"
        aria-describedby={`${id}-text`}
        data-ce-control-appearance="frameless"
        data-testid={`ce-session-agent-notice-${where}`}
      >
        <FontAwesomeIcon icon={where === 'page' ? faRobot : faQuestionCircle} aria-hidden="true" />
      </a>
      <span id={`${id}-text`} className={styles.hidden}>
        {text}
      </span>
      <CETooltip target={id} placement="bottom" trigger="hover focus" autohide={false}>
        {text}
      </CETooltip>
    </>
  );
};

export default SessionAgentNotice;
