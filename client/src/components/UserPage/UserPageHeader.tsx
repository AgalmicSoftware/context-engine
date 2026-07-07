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

const UserPageHeader = ({
  addressDisplay,
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
          {showPen && (
            <button
              onClick={onNicknameEdit}
              className={styles.copyButton}
              aria-label="Edit nickname"
              title="Edit nickname"
            >
              <FontAwesomeIcon icon={faPen} />
            </button>
          )}
          {showUsernamePen && (
            <button
              onClick={onUsernameEdit}
              className={styles.copyButton}
              aria-label="Set username"
              title="Set username"
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
            <button onClick={onCopyAddress} className={styles.copyButton}>
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
              placeholder="set nickname"
              aria-label="Set nickname"
              autoFocus
            />
            {nicknameEnteredIndicatorDisplayState.shouldRenderEnteredIndicator && (
              <button
                type="button"
                className={styles.usernameCheck}
                tabIndex={-1}
                aria-hidden="true"
                title="Nickname entered"
                disabled
              >
                <FontAwesomeIcon icon={faCheck} />
              </button>
            )}
          </div>
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
