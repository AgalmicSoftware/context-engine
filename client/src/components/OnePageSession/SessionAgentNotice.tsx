/** @file SessionAgentNotice.tsx: the icon saying what the Session Agent may read, which opens how it works. */
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle, faRobot } from '@fortawesome/free-solid-svg-icons';

import CETooltip from '../Shared/CETooltip';
import { buildPublicRepoBlobUrl } from '../../variables/publicRepoMetadata';
import styles from './SessionAgentNotice.module.scss';

const SESSION_AGENT_README_URL = `${buildPublicRepoBlobUrl('README.md')}#session-agent`;

const NOTICES = {
  page:
    'The Session Agent may draw on your answers and the files you add when it answers others, never ' +
    'naming you. You can turn that off in the Session Agent. Select it for how it works.',
  switch:
    'On unless you turn it off. The Session Agent may draw on the files you added, and Detailed answers on your ' +
    'answers too, never naming you. Turning it off stops future use; it can’t take back answers already given. ' +
    'Select it for how it works.',
};

type Props = { id: string; where: keyof typeof NOTICES; className?: string };

// A link, so selecting it opens the README's Session Agent section; hovering or focusing it shows the notice.
// By the session's title it shows the launcher's robot, as the session's own "?" sits beside it.
const SessionAgentNotice = ({ id, where, className }: Props) => (
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
      {NOTICES[where]}
    </span>
    <CETooltip target={id} placement="bottom" trigger="hover focus" autohide={false}>
      {NOTICES[where]}
    </CETooltip>
  </>
);

export default SessionAgentNotice;
