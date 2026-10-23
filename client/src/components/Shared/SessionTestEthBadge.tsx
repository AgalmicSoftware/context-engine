import React from 'react';
import { UncontrolledTooltip } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import { describeTestEthOffer } from '@ce-shared/sessions/testEthOffer.mjs';
import {
  getCachedWorkerResourcePresence,
  readWorkerResourcePresence,
} from '../../utilities/worker/workerResourcePresence';
import styles from './SessionTestEthBadge.module.scss';

type Props = {
  sessionConfig?: unknown;
  sessionSlug?: string;
  resourcePresence?: unknown;
  loadPresence?: boolean;
};

export default function SessionTestEthBadge({
  sessionConfig,
  sessionSlug = '',
  resourcePresence,
  loadPresence = false,
}: Props) {
  const id = `ce-test-eth-${React.useId().replace(/:/g, '')}`;
  const [loaded, setLoaded] = React.useState<{ config: unknown; slug: string; presence: unknown } | null>(null);
  const config = sessionConfig && typeof sessionConfig === 'object' ? (sessionConfig as Record<string, unknown>) : null;
  React.useEffect(() => {
    if (!loadPresence || !sessionConfig) return;
    let active = true;
    void readWorkerResourcePresence({ sessionSlug, sessionConfig })
      .catch(() => null)
      .then((presence) => {
        if (active) setLoaded({ config: sessionConfig, slug: sessionSlug, presence });
      });
    return () => {
      active = false;
    };
  }, [sessionConfig, sessionSlug, loadPresence]);
  const presence =
    resourcePresence ??
    (loaded?.config === sessionConfig && loaded?.slug === sessionSlug ? loaded.presence : null) ??
    getCachedWorkerResourcePresence({ sessionSlug, workerUrl: config?.corsWorkerUrl });
  const offer = describeTestEthOffer({ config, resourcePresence: presence });
  if (!offer.offered) return null;
  const audience =
    offer.audience === 'participants'
      ? 'participants whose balance is low, to pay for gas.'
      : "participants who pass the session's gas gate.";
  const description = `This session sends a little test ETH on ${offer.network} to ${audience}`;
  return (
    <>
      <span
        id={id}
        className={styles.badge}
        data-testid="ce-session-test-eth-badge"
        title={description}
        tabIndex={loadPresence ? 0 : undefined}
      >
        Test ETH <FontAwesomeIcon icon={faQuestionCircle} />
      </span>
      <UncontrolledTooltip target={id} placement="bottom" trigger="hover focus">
        {description}
      </UncontrolledTooltip>
    </>
  );
}
