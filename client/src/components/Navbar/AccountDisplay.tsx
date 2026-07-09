/** @file AccountDisplay.tsx */
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown } from '@fortawesome/free-solid-svg-icons';

import styles from './Navbar.module.scss';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

export type AccountDisplayTorusProps = {
  account: string;
  launchAccountSettings: () => void;
  userImageURL?: string | null;
  avatarUrl?: string;
  loginComplete?: boolean;
  provider?: string | null;
};

export const AccountDisplayTorus = ({
  account,
  launchAccountSettings,
  userImageURL,
  avatarUrl,
}: AccountDisplayTorusProps) => {
  const shortenedAddress = `${account.slice(0, 4)}...${account.slice(-4)}`;

  // Primary image preference: use userImageURL if present; otherwise fall back to blockie
  const primaryImgSrc = userImageURL || avatarUrl;
  const showMiniBlockie = !!userImageURL && !!avatarUrl;

  return (
    <>
      <button
        className={styles.addressButton}
        data-testid={E2E_TESTIDS.WALLET_DISPLAY}
        data-ce-wallet-address={account || undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#ffffffbf',
          borderRadius: '20px',
          color: 'black',
          fontSize: '16px',
          fontWeight: `650`,
          padding: '6px 20px',
          width: '250px',
        }}
        onClick={() => {
          launchAccountSettings();
        }}
      >
        {primaryImgSrc && (
          <img
            src={primaryImgSrc}
            alt=""
            style={{
              borderRadius: '50%',
              height: '35px',
              marginRight: '10px',
              width: '35px',
            }}
          />
        )}
        {/* If a user image exists, also show a tiny deterministic blockie adjacent to it */}
        {showMiniBlockie && (
          <img
            src={avatarUrl}
            alt=""
            style={{
              borderRadius: '50%',
              height: '18px',
              width: '18px',
              marginRight: '10px',
              marginLeft: '-4px',
            }}
          />
        )}
        {shortenedAddress}
        <FontAwesomeIcon icon={faCaretDown} style={{ fontSize: '30px', marginLeft: '10px', marginRight: '10px' }} />
      </button>
    </>
  );
};
