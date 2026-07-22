import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faSpinner, faTimes } from '@fortawesome/free-solid-svg-icons';

import { getShortenedAddress } from '../../utilities/ui/displayHelpers.js';
import styles from './SBTPage.module.scss';
import SbtPageOpenMintUrlCard from './SbtPageOpenMintUrlCard';
import SbtEncryptedRecoveryControl from './SbtEncryptedRecoveryControl';
import { buildSbtPagePasswordInviteLink } from './sbtPagePasswordExportHelpers';
import type { SbtPageAdminActionDisplayPlan } from './sbtPageHelpers';

type SbtPageCopyIconState = {
  shouldRenderCopiedIcon?: boolean;
  shouldRenderDefaultIcon?: boolean;
};

type SbtPageBurnSearchResultRecord = {
  address?: unknown;
  tokenId?: unknown;
};

type SbtPagePasswordInviteLinkContext = {
  baseUrl: string;
  demoPath: string;
  encodeGroupPassword?: ((code: string) => string) | null;
  isInvite: boolean;
  sbtAddr: string;
  sbtBasePathValue: string;
};

export type SbtPageAdminActionsProps = {
  burnLabel: string;
  burnSearchInput: unknown;
  burnSearchResultRecord: SbtPageBurnSearchResultRecord | null;
  displayPlan: SbtPageAdminActionDisplayPlan;
  exportFormat: unknown;
  encryptedRecoveryEnabled: boolean;
  encryptedRecoveryStatus: string;
  hasLocalRecovery: boolean;
  onAdminBurn: React.MouseEventHandler<HTMLButtonElement>;
  onBurnSearchChange: React.ChangeEventHandler<HTMLInputElement>;
  onCopyOpenMintUrl: React.MouseEventHandler<HTMLButtonElement>;
  onExportFormatChange: React.ChangeEventHandler<HTMLSelectElement>;
  onExportPasswords: React.MouseEventHandler<HTMLButtonElement>;
  onGenerateAdminInvites: React.MouseEventHandler<HTMLButtonElement>;
  onClearLocalRecovery: React.MouseEventHandler<HTMLButtonElement>;
  onEncryptedRecoveryChange: React.ChangeEventHandler<HTMLInputElement>;
  onIncludePreviousPasswordsChange: React.ChangeEventHandler<HTMLInputElement>;
  onPasswordGenerationCountChange: React.ChangeEventHandler<HTMLInputElement>;
  openMintAutoJoinUrl: string;
  openMintUrlCopyIconState: SbtPageCopyIconState;
  passwordInviteLinkContext: SbtPagePasswordInviteLinkContext;
  passwordGenerationCount: unknown;
  sbtLabel: string;
};

type SbtPagePasswordInviteRowsProps = {
  combinedPasswords: string[];
  passwordInviteLinkContext: SbtPagePasswordInviteLinkContext;
};

const SbtPagePasswordInviteRows = ({
  combinedPasswords,
  passwordInviteLinkContext,
}: SbtPagePasswordInviteRowsProps): React.ReactElement => (
  <ul>
    {combinedPasswords.map((password, index) => {
      const passwordText = String(password);
      const inviteLink = buildSbtPagePasswordInviteLink({
        ...passwordInviteLinkContext,
        code: passwordText,
      });
      return (
        <li key={index}>
          {passwordText} -{' '}
          <a href={inviteLink} target="_blank" rel="noopener noreferrer">
            {inviteLink}
          </a>
        </li>
      );
    })}
  </ul>
);

type SbtPagePasswordExportControlsProps = {
  exportFormat: unknown;
  onExportFormatChange: React.ChangeEventHandler<HTMLSelectElement>;
  onExportPasswords: React.MouseEventHandler<HTMLButtonElement>;
  onIncludePreviousPasswordsChange: React.ChangeEventHandler<HTMLInputElement>;
  passwordExportControlsState: SbtPageAdminActionDisplayPlan['passwordExportControlsState'];
};

const SbtPagePasswordExportControls = ({
  exportFormat,
  onExportFormatChange,
  onExportPasswords,
  onIncludePreviousPasswordsChange,
  passwordExportControlsState,
}: SbtPagePasswordExportControlsProps): React.ReactElement => (
  <div className={styles.exportOptions}>
    {passwordExportControlsState.renderIncludePreviousCheckbox && (
      <label>
        <input
          type="checkbox"
          checked={!!passwordExportControlsState.effectiveIncludePreviousPasswordsChecked}
          onChange={onIncludePreviousPasswordsChange}
        />
        Include previous passwords
      </label>
    )}
    {passwordExportControlsState.showCachedPasswordsIncludedNote && (
      <p style={{ fontStyle: 'italic' }}>All previously cached passwords are included.</p>
    )}
    <select
      value={String(exportFormat || 'json')}
      onChange={onExportFormatChange}
      className={styles.exportFormatSelect}
    >
      <option value="json">JSON</option>
      <option value="csv">CSV</option>
    </select>
    <button type="button" onClick={onExportPasswords} className={styles.exportButton}>
      Export Passwords
    </button>
  </div>
);

const SbtPageAdminActions = ({
  burnLabel,
  burnSearchInput,
  burnSearchResultRecord,
  displayPlan: {
    adminBurnButtonContentState,
    adminBurnStatusButtonState,
    canAdminBurn,
    combinedPasswords,
    hasPasswordMint,
    passwordExportControlsState,
    passwordGenerationButtonState,
    passwordInventoryDisplayState,
  },
  exportFormat,
  encryptedRecoveryEnabled,
  encryptedRecoveryStatus,
  hasLocalRecovery,
  onAdminBurn,
  onBurnSearchChange,
  onCopyOpenMintUrl,
  onExportFormatChange,
  onExportPasswords,
  onGenerateAdminInvites,
  onClearLocalRecovery,
  onEncryptedRecoveryChange,
  onIncludePreviousPasswordsChange,
  onPasswordGenerationCountChange,
  openMintAutoJoinUrl,
  openMintUrlCopyIconState,
  passwordInviteLinkContext,
  passwordGenerationCount,
  sbtLabel,
}: SbtPageAdminActionsProps): React.ReactElement => (
  <div className={styles.adminActions}>
    {openMintAutoJoinUrl && (
      <SbtPageOpenMintUrlCard
        copyIconState={openMintUrlCopyIconState}
        onCopy={onCopyOpenMintUrl}
        openMintAutoJoinUrl={openMintAutoJoinUrl}
      />
    )}
    {canAdminBurn && (
      <div className={styles.adminBurnSection}>
        <h4>{`${burnLabel} ${sbtLabel}`}</h4>
        <div className={styles.burnInputGroup}>
          <input
            type="text"
            value={String(burnSearchInput || '')}
            onChange={onBurnSearchChange}
            placeholder="Enter Address (0x...) or Token ID"
            className={styles.input}
          />
          {burnSearchResultRecord && (
            <div className={styles.burnSearchResult}>
              {Boolean(burnSearchResultRecord.tokenId) && <p>Token ID: {String(burnSearchResultRecord.tokenId)}</p>}
              {Boolean(burnSearchResultRecord.address) && (
                <p>Owner: {getShortenedAddress(burnSearchResultRecord.address, false)}</p>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={onAdminBurn}
            className={styles.actionButton}
            disabled={!!adminBurnStatusButtonState.disabled}
          >
            {adminBurnButtonContentState.shouldRenderIdleLabel && adminBurnButtonContentState.idleLabel}
            {adminBurnButtonContentState.shouldRenderPendingIcon && <FontAwesomeIcon icon={faSpinner} spin />}
            {adminBurnButtonContentState.shouldRenderSuccess && (
              <>
                {adminBurnButtonContentState.successLabel} <FontAwesomeIcon icon={faCheck} />
              </>
            )}
            {adminBurnButtonContentState.shouldRenderFailure && (
              <>
                {adminBurnButtonContentState.failureLabel} <FontAwesomeIcon icon={faTimes} />
              </>
            )}
          </button>
        </div>
      </div>
    )}

    {hasPasswordMint && (
      <div className={styles.inviteGenerationSection}>
        <SbtEncryptedRecoveryControl
          checked={encryptedRecoveryEnabled}
          clearButtonClassName={styles.actionButton}
          hasLocalRecovery={hasLocalRecovery}
          mode="admin"
          onChange={onEncryptedRecoveryChange}
          onClear={onClearLocalRecovery}
          status={encryptedRecoveryStatus}
        />
      </div>
    )}

    {passwordInventoryDisplayState.shouldRenderPasswordGenerationSection && (
      <div className={styles.inviteGenerationSection}>
        <h4>Generate Additional Password Invites</h4>
        <p>Since there&apos;s no max token limit, you can generate more password-based invites as admin.</p>
        <div className={styles.inviteGenerationControls}>
          <input
            type="number"
            value={String(passwordGenerationCount || '')}
            onChange={onPasswordGenerationCountChange}
            placeholder="Number of additional passwords"
            className={styles.input}
          />
          <button
            type="button"
            onClick={onGenerateAdminInvites}
            className={styles.actionButton}
            disabled={!!passwordGenerationButtonState.disabled}
          >
            Generate Invites
          </button>
        </div>
        {passwordInventoryDisplayState.shouldRenderGeneratedPasswordList ? (
          <div className={styles.generatedPasswordsList}>
            <h5>Generated Passwords (including legacy cached passwords):</h5>
            {SbtPagePasswordInviteRows({
              combinedPasswords,
              passwordInviteLinkContext,
            })}
            <p>
              Export remains the primary recovery path. New passwords are stored only when encrypted local recovery is
              enabled.
            </p>
            {SbtPagePasswordExportControls({
              exportFormat,
              onExportFormatChange,
              onExportPasswords,
              onIncludePreviousPasswordsChange,
              passwordExportControlsState,
            })}
          </div>
        ) : null}
      </div>
    )}

    {passwordInventoryDisplayState.shouldRenderPreviousPasswordsSection && (
      <div className={styles.inviteGenerationSection}>
        <h4>Previously Generated Password Invites</h4>
        <p>{`These were previously cached or generated passwords from when the ${sbtLabel} was created:`}</p>
        {SbtPagePasswordInviteRows({
          combinedPasswords,
          passwordInviteLinkContext,
        })}
        {SbtPagePasswordExportControls({
          exportFormat,
          onExportFormatChange,
          onExportPasswords,
          onIncludePreviousPasswordsChange,
          passwordExportControlsState,
        })}
      </div>
    )}

    {passwordInventoryDisplayState.shouldRenderNoMoreInvitesEmptyState && (
      <div className={styles.inviteGenerationSection}>
        <h4>No Additional Password Invites</h4>
        <p>
          Max tokens are set, so all invites should have been created initially. No more invites can be generated, and
          there are no cached passwords found.
        </p>
      </div>
    )}
  </div>
);

export default SbtPageAdminActions;
