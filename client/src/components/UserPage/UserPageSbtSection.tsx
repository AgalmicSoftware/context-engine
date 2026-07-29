import React from 'react';

import SBTPage from '../SBTs/SBTPage';
import styles from './UserPage.module.scss';

type UserPageSbtDisplayState = {
  hasSbts?: boolean;
  shouldRenderMainEmptyText?: boolean;
};

type UserPageSbtEntry = {
  sbtInfo: {
    sbtAddress?: unknown;
  };
  slug?: unknown;
};

type UserPageSbtSectionProps = {
  account?: unknown;
  heading: React.ReactNode;
  isLoading?: boolean;
  isSBTCacheReady?: unknown;
  loadingIndicator?: React.ReactNode;
  loginComplete?: unknown;
  network?: unknown;
  onRefreshSbtData: (address: unknown, slug?: unknown) => unknown;
  provider?: unknown;
  sbtDisplayState: UserPageSbtDisplayState;
  sbtEmptyText: React.ReactNode;
  sbtEntries: UserPageSbtEntry[];
  wrapColumn?: boolean;
};

const UserPageSbtSection = ({
  account,
  heading,
  isLoading = false,
  isSBTCacheReady,
  loadingIndicator = null,
  loginComplete,
  network,
  onRefreshSbtData,
  provider,
  sbtDisplayState,
  sbtEmptyText,
  sbtEntries,
  wrapColumn = true,
}: UserPageSbtSectionProps): React.ReactElement => {
  const content = (
    <div className={styles.sbtSection}>
      <h2>
        {heading}
        {isLoading && loadingIndicator}
      </h2>
      {sbtDisplayState.hasSbts ? (
        <div className={styles.sbtGrid}>
          {sbtEntries.map((sbtItem, index: number) => (
            <SBTPage
              key={index}
              SBTAddress={sbtItem.sbtInfo.sbtAddress}
              account={account}
              provider={provider}
              network={network}
              miniaturized={true}
              loginComplete={loginComplete}
              isSBTCacheReady={isSBTCacheReady}
              metadataOnly={true}
              sessionSlug={sbtItem.slug}
              refreshSbtData={(addr: unknown) => onRefreshSbtData(addr, sbtItem.slug)}
            />
          ))}
        </div>
      ) : sbtDisplayState.shouldRenderMainEmptyText ? (
        <p>{sbtEmptyText}</p>
      ) : null}
    </div>
  );

  return wrapColumn ? <div className={styles.rightColumn}>{content}</div> : content;
};

export default UserPageSbtSection;
