import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBookmark,
  faCheck,
  faChevronDown,
  faChevronUp,
  faCopy,
  faExclamationTriangle,
  faExternalLinkAlt,
  faPen,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons';

import CETooltip from '../Shared/CETooltip';
import styles from './UserPage.module.scss';

type UserPageAnalyzeButtonDisplayState = {
  ariaBusy?: React.AriaAttributes['aria-busy'];
  disabled?: boolean;
  label?: React.ReactNode;
  shouldRenderAnalyzing?: boolean;
  title?: string;
};

type UserPageBookmarkButtonDisplayState = {
  ariaLabel?: string;
  iconStyle?: React.CSSProperties;
  title?: string;
};

type UserPageBookmarksLinkDisplayState = {
  className?: string;
  style?: React.CSSProperties;
};

type UserPageCompareButtonDisplayState = {
  disabled?: boolean;
  shouldRenderCollapseClosedIcon?: boolean;
  shouldRenderCollapseOpenIcon?: boolean;
  title?: string;
};

type UserPageCopyIconDisplayState = {
  copiedIconStyle?: React.CSSProperties;
  defaultIconStyle?: React.CSSProperties;
};

type UserPageHeaderActionVisibility = {
  showBookmarkButton?: boolean;
  showBookmarksLink?: boolean;
  showCopyAddressButton?: boolean;
  showExplorerLink?: boolean;
  showNicknameEditor?: boolean;
  showSimulatedBadge?: boolean;
};

type UserPageInlineEnteredIndicatorDisplayState = {
  shouldRenderEnteredIndicator?: boolean;
};

type UserPageUsernameErrorDisplayState = {
  shouldRenderUsernameError?: boolean;
  usernameErrorText?: React.ReactNode;
};

type UserPageAvatarDisplayState = {
  avatarStyle?: React.CSSProperties;
};

type UserPageHeaderProps = {
  addressDisplay: React.ReactNode;
  /** Your private label for someone else's account, shown beside their name: 'your label' when it stands in for it. */
  privateLabelTag?: string;
  /** Where your own username is saved: the session's store, or only this device. */
  usernameSavedTo?: 'session' | 'device';
  analyzeButtonDisplayState: UserPageAnalyzeButtonDisplayState;
  avatarDisplayState: UserPageAvatarDisplayState;
  bookmarkButtonDisplayState: UserPageBookmarkButtonDisplayState;
  bookmarksHref: string;
  bookmarksLinkDisplayState: UserPageBookmarksLinkDisplayState;
  compareButtonDisplayState: UserPageCompareButtonDisplayState;
  copyIconDisplayState: UserPageCopyIconDisplayState;
  explorerUrl?: string | null;
  headerActionVisibility: UserPageHeaderActionVisibility;
  headerBookmarkClassName: string;
  isEditingUsername?: boolean;
  isOwner?: boolean;
  minimized?: boolean;
  nicknameEnteredIndicatorDisplayState: UserPageInlineEnteredIndicatorDisplayState;
  nicknameInput?: string;
  onAnalyzeUser: React.MouseEventHandler<HTMLButtonElement>;
  onBookmark: React.MouseEventHandler<HTMLButtonElement>;
  onCollapseToggle: React.MouseEventHandler<HTMLButtonElement>;
  onCopyAddress: React.MouseEventHandler<HTMLButtonElement>;
  onNicknameBlur: React.FocusEventHandler<HTMLInputElement>;
  onNicknameChange: React.ChangeEventHandler<HTMLInputElement>;
  onNicknameEdit: React.MouseEventHandler<HTMLButtonElement>;
  onNicknameKeyDown: React.KeyboardEventHandler<HTMLInputElement>;
  onUsernameBlur: React.FocusEventHandler<HTMLInputElement>;
  onUsernameChange: React.ChangeEventHandler<HTMLInputElement>;
  onUsernameEdit: React.MouseEventHandler<HTMLButtonElement>;
  onUsernameKeyDown: React.KeyboardEventHandler<HTMLInputElement>;
  showPen?: boolean;
  showUsernamePen?: boolean;
  username?: string;
  usernameEnteredIndicatorDisplayState: UserPageInlineEnteredIndicatorDisplayState;
  usernameErrorDisplayState: UserPageUsernameErrorDisplayState;
};

// A label set on someone else's account is only this browser's note, never their name.
const PRIVATE_LABEL_NOTE = "Your private label for this account. Only you see it, on this device; it isn't their name.";

const UserPageHeader = ({
  addressDisplay,
  privateLabelTag = '',
  usernameSavedTo = 'device',
  analyzeButtonDisplayState,
  avatarDisplayState,
  bookmarkButtonDisplayState,
  bookmarksHref,
  bookmarksLinkDisplayState,
  compareButtonDisplayState,
  copyIconDisplayState,
  explorerUrl,
  headerActionVisibility,
  headerBookmarkClassName,
  isEditingUsername = false,
  isOwner = false,
  minimized = false,
  nicknameEnteredIndicatorDisplayState,
  nicknameInput = '',
  onAnalyzeUser,
  onBookmark,
  onCollapseToggle,
  onCopyAddress,
  onNicknameBlur,
  onNicknameChange,
  onNicknameEdit,
  onNicknameKeyDown,
  onUsernameBlur,
  onUsernameChange,
  onUsernameEdit,
  onUsernameKeyDown,
  showPen = false,
  showUsernamePen = false,
  username = '',
  usernameEnteredIndicatorDisplayState,
  usernameErrorDisplayState,
}: UserPageHeaderProps): React.ReactElement => (
  <div className={styles.header}>
    <div className={styles.addressAndActionsContainer}>
      <div className={styles.userInfo}>
        <div className={styles.avatarContainer}>
          <div
            className={styles.avatar}
            style={avatarDisplayState.avatarStyle}
            aria-label="User avatar"
            role="img"
          ></div>
        </div>
        <h1 id={styles.userPageAddress}>
          {addressDisplay}
          {privateLabelTag && (
            <span className={styles.privateLabelTag} title={PRIVATE_LABEL_NOTE}>
              <span className={styles.visuallyHidden}>, </span>
              {privateLabelTag}
            </span>
          )}
          {showPen && (
            <button
              onClick={onNicknameEdit}
              className={styles.copyButton}
              data-ce-control-appearance="frameless"
              aria-label="Edit private label"
              title={PRIVATE_LABEL_NOTE}
            >
              <FontAwesomeIcon icon={faPen} />
            </button>
          )}
          {showUsernamePen && (
            <button
              onClick={onUsernameEdit}
              className={styles.copyButton}
              data-ce-control-appearance="frameless"
              aria-label="Set username"
              title={
                usernameSavedTo === 'session'
                  ? 'Set your name in this session'
                  : 'Set username, saved on this device only'
              }
            >
              <FontAwesomeIcon icon={faPen} />
            </button>
          )}
          {headerActionVisibility.showSimulatedBadge && (
            <span className={styles.simulatedBadge} id="simulatedUserTooltip">
              <FontAwesomeIcon icon={faExclamationTriangle} />
            </span>
          )}
          {headerActionVisibility.showSimulatedBadge && (
            <CETooltip placement="right" target="simulatedUserTooltip">
              This is a simulated user whose answers are generated based on documents.
            </CETooltip>
          )}
          {headerActionVisibility.showCopyAddressButton && (
            <button
              onClick={onCopyAddress}
              className={styles.copyButton}
              data-ce-control-appearance="frameless"
              aria-label="Copy address"
            >
              <FontAwesomeIcon icon={faCheck} style={copyIconDisplayState.copiedIconStyle} />
              <FontAwesomeIcon icon={faCopy} style={copyIconDisplayState.defaultIconStyle} />
            </button>
          )}
          {headerActionVisibility.showExplorerLink && (
            <a
              href={explorerUrl || undefined}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.expandButton}
              data-ce-control-appearance="frameless"
              aria-label="View address on explorer"
              title="View address on explorer"
            >
              <FontAwesomeIcon icon={faExternalLinkAlt} />
            </a>
          )}
          {headerActionVisibility.showBookmarkButton && (
            <button
              onClick={onBookmark}
              className={headerBookmarkClassName}
              data-ce-control-appearance="frameless"
              style={bookmarkButtonDisplayState.iconStyle}
              aria-label={bookmarkButtonDisplayState.ariaLabel}
              title={bookmarkButtonDisplayState.title}
            >
              <FontAwesomeIcon icon={faBookmark} />
            </button>
          )}
        </h1>

        {headerActionVisibility.showBookmarksLink && (
          <a
            href={bookmarksHref}
            className={bookmarksLinkDisplayState.className}
            style={bookmarksLinkDisplayState.style}
          >
            My Bookmarks <FontAwesomeIcon icon={faExternalLinkAlt} />
          </a>
        )}

        {headerActionVisibility.showNicknameEditor && (
          <div className={styles.usernameInline}>
            <input
              type="text"
              value={nicknameInput || ''}
              onChange={onNicknameChange}
              onBlur={onNicknameBlur}
              onKeyDown={onNicknameKeyDown}
              placeholder="private label"
              aria-label="Private label"
              aria-describedby="ce-private-label-note"
              autoFocus
            />
            {nicknameEnteredIndicatorDisplayState.shouldRenderEnteredIndicator && (
              <button
                type="button"
                className={styles.usernameCheck}
                tabIndex={-1}
                aria-hidden="true"
                title="Label entered"
                disabled
              >
                <FontAwesomeIcon icon={faCheck} />
              </button>
            )}
          </div>
        )}
        {headerActionVisibility.showNicknameEditor && (
          <span id="ce-private-label-note" className={styles.usernameHint}>
            Only you see this, on this device
          </span>
        )}

        {isOwner && isEditingUsername && (
          <div className={styles.usernameInline}>
            <input
              type="text"
              value={username}
              onChange={onUsernameChange}
              onBlur={onUsernameBlur}
              onKeyDown={onUsernameKeyDown}
              placeholder="set username"
              aria-label="Set username"
              aria-describedby="ce-username-note"
              autoFocus
            />
            {usernameEnteredIndicatorDisplayState.shouldRenderEnteredIndicator && (
              <button
                type="button"
                className={styles.usernameCheck}
                tabIndex={-1}
                aria-hidden="true"
                title="Username entered"
                disabled
              >
                <FontAwesomeIcon icon={faCheck} />
              </button>
            )}
          </div>
        )}
        {isOwner && isEditingUsername && (
          <span id="ce-username-note" className={styles.usernameHint}>
            {usernameSavedTo === 'session' ? 'Shown to people in this session' : 'Saved on this device only'}
          </span>
        )}
      </div>

      {!minimized && (
        <div className={styles.headerActionsRight}>
          {usernameErrorDisplayState.shouldRenderUsernameError && (
            <span className={styles.error}>{usernameErrorDisplayState.usernameErrorText}</span>
          )}

          <button
            onClick={onCollapseToggle}
            className={styles.collapseButton}
            disabled={compareButtonDisplayState.disabled}
            title={compareButtonDisplayState.title}
          >
            Compare {compareButtonDisplayState.shouldRenderCollapseOpenIcon && <FontAwesomeIcon icon={faChevronUp} />}
            {compareButtonDisplayState.shouldRenderCollapseClosedIcon && <FontAwesomeIcon icon={faChevronDown} />}
          </button>

          <button
            onClick={onAnalyzeUser}
            className={styles.analyzeButton}
            disabled={analyzeButtonDisplayState.disabled}
            aria-busy={analyzeButtonDisplayState.ariaBusy}
            title={analyzeButtonDisplayState.title}
          >
            {analyzeButtonDisplayState.shouldRenderAnalyzing ? (
              <>
                <FontAwesomeIcon icon={faSpinner} spin />
                &nbsp;{analyzeButtonDisplayState.label}
              </>
            ) : (
              analyzeButtonDisplayState.label
            )}
          </button>
        </div>
      )}

      {minimized && (
        <div className={styles.headerActionsRight}>
          {usernameErrorDisplayState.shouldRenderUsernameError && (
            <span className={styles.error}>{usernameErrorDisplayState.usernameErrorText}</span>
          )}
        </div>
      )}
    </div>
  </div>
);

export default UserPageHeader;
