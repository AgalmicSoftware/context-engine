import React from 'react';

import WorkerSessionGroupsPanel from '../OnePageSession/WorkerSessionGroupsPanel';
import styles from './UserPage.module.scss';

type UserPageWorkerGroupSectionProps = {
  account?: unknown;
  provider?: unknown;
  sessionConfig: unknown;
  sessionSlug: string;
  showMemberships?: boolean;
  unavailableMessage?: string;
};

const UserPageWorkerGroupSection = ({
  account,
  provider,
  sessionConfig,
  sessionSlug,
  showMemberships = true,
  unavailableMessage = 'Group memberships are unavailable for this session.',
}: UserPageWorkerGroupSectionProps): React.ReactElement => (
  <section className={styles.sbtSection} aria-labelledby="user-profile-worker-groups-heading">
    <h2 id="user-profile-worker-groups-heading">Groups Joined:</h2>
    {showMemberships ? (
      <WorkerSessionGroupsPanel
        account={account}
        provider={provider}
        networkChainId={null}
        sessionConfig={sessionConfig}
        sessionSlug={sessionSlug}
        showCreate={false}
        showGroupDescriptions={false}
        showMembershipListHeader={false}
        membershipsOnly={true}
      />
    ) : (
      <p>{unavailableMessage}</p>
    )}
  </section>
);

export default UserPageWorkerGroupSection;
