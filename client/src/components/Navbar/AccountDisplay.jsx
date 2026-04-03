/** @file AccountDisplay.jsx */
import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCaretDown } from "@fortawesome/free-solid-svg-icons";

import styles from "./Navbar.module.scss";
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

export const AccountDisplayTorus = (props) => {

  const shortenedAddress = `${props.account.slice(0, 4)}...${props.account.slice(-4)}`;

  // Primary image preference: use userImageURL if present; otherwise fall back to blockie
  const primaryImgSrc = props.userImageURL || props.avatarUrl;
  const showMiniBlockie = !!props.userImageURL && !!props.avatarUrl;

  return (
    <>
        <button
        className={styles.addressButton}
        data-testid={E2E_TESTIDS.WALLET_DISPLAY}
        data-ce-wallet-address={props.account ? props.account : undefined}
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
        width: '250px'
        }}
        onClick={() => {
        props.launchAccountSettings();
        }
        }>
        {primaryImgSrc && (
          <img
            src={primaryImgSrc}
            alt=""
            style={{
              borderRadius: '50%',
              height: '35px',
              marginRight: '10px',
              width: '35px'
            }}
          />
        )}
        {/* If a user image exists, also show a tiny deterministic blockie adjacent to it */}
        {showMiniBlockie && (
          <img
            src={props.avatarUrl}
            alt=""
            style={{
              borderRadius: '50%',
              height: '18px',
              width: '18px',
              marginRight: '10px',
              marginLeft: '-4px'
            }}
          />
        )}
        {shortenedAddress}
        <FontAwesomeIcon icon={faCaretDown} style={{ fontSize: '30px', marginLeft: '10px', marginRight:'10px' }} />
        </button>
    </>
  );
};
