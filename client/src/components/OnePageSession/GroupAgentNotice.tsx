/** @file GroupAgentNotice.tsx: the icon saying what the Group Agent may read, which opens how it works. */
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle, faRobot } from '@fortawesome/free-solid-svg-icons';

import CETooltip from '../Shared/CETooltip';
import { buildPublicRepoBlobUrl } from '../../variables/publicRepoMetadata';
import styles from './GroupAgentNotice.module.scss';

const GROUP_AGENT_README_URL = `${buildPublicRepoBlobUrl('README.md')}#group-agent`;

const NOTICES = {
  page:
    'This session’s Group Agent may draw on your answers and the files you add when it answers others, never ' +
    'naming you. You can turn that off in the Group Agent. Select it for how it works.',
  switch:
    'On unless you turn it off. The Group Agent may draw on the files you added, and Detailed answers on your ' +
    'answers too, never naming you. Turning it off stops future use; it can’t take back answers already given. ' +
    'Select it for how it works.',
};

type Props = { id: string; where: keyof typeof NOTICES; className?: string };

// A link, so selecting it opens the README's Group Agent section; hovering or focusing it shows the notice.
// By the session's title it shows the launcher's robot, as the session's own "?" sits beside it.
const GroupAgentNotice = ({ id, where, className }: Props) => (
  <>
    <a
      id={id}
      href={GROUP_AGENT_README_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      aria-label="How the Group Agent works"
      aria-describedby={`${id}-text`}
      data-ce-control-appearance="frameless"
      data-testid={`ce-group-agent-notice-${where}`}
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

export default GroupAgentNotice;
