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
  /** The picture card another person shows on their page; it takes the column their groups would. */
  savedCard?: React.ReactNode;
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
  savedCard = null,
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
  // Their shown card, if they have one, is all that column then holds; with none it is left out.
  if (!isOwner && !showOnChainSbts) {
    return savedCard ? <div className={`${styles.rightColumn} ${styles.cardColumn}`}>{savedCard}</div> : null;
  }
  return (
    <div className={savedCard && !isOwner ? `${styles.rightColumn} ${styles.cardColumn}` : styles.rightColumn}>
      {isOwner ? null : savedCard}
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
