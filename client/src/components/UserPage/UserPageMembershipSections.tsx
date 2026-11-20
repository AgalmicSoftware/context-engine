import React from 'react';

import { resolveSessionCapabilityProjection } from '../../utilities/session/sessionCapabilityProjection.js';
import styles from './UserPage.module.scss';
import UserPageSbtSection from './UserPageSbtSection';
import UserPageWorkerGroupSection from './UserPageWorkerGroupSection';

type UserPageMembershipSectionsArgs = {
  account: unknown;
  activeSessionSlug: string;
  isOwner: boolean;
  isSimulated: boolean;
  onChainProfileEnabled?: boolean;
  provider: unknown;
  sessionConfig: unknown;
  sbtSectionProps: Omit<React.ComponentProps<typeof UserPageSbtSection>, 'account' | 'provider' | 'wrapColumn'>;
};

export const renderUserPageMembershipSections = ({
  account,
  activeSessionSlug,
  isOwner,
  isSimulated,
  onChainProfileEnabled,
  provider,
  sessionConfig,
  sbtSectionProps,
}: UserPageMembershipSectionsArgs): React.ReactNode => {
  const capabilities = resolveSessionCapabilityProjection(sessionConfig);
  const showWorkerGroups =
    capabilities.source === 'profile' &&
    capabilities.profileValid &&
    capabilities.usesWorkerGroups &&
    isOwner &&
    !isSimulated &&
    Boolean(activeSessionSlug);
  const showOnChainSbts = onChainProfileEnabled !== false;

  // Someone else's groups can't be shown yet, so their page leaves the section out. "Own" is the
  // signed-in account matching the address in the URL, checked on every render; signed out isn't.
  if (!isOwner && !showOnChainSbts) return null;
  return (
    <div className={styles.rightColumn}>
      {isOwner && (
        <UserPageWorkerGroupSection
          account={account}
          provider={provider}
          sessionConfig={sessionConfig}
          sessionSlug={activeSessionSlug}
          showMemberships={showWorkerGroups}
          unavailableMessage={
            !activeSessionSlug
              ? 'Choose a session to view group memberships.'
              : 'Group memberships are unavailable for this session.'
          }
        />
      )}
      {showOnChainSbts ? (
        <UserPageSbtSection {...sbtSectionProps} account={account} provider={provider} wrapColumn={false} />
      ) : null}
    </div>
  );
};
