import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';

import styles from './CreateSBTGroup.module.scss';
import CEDateTimeInput from '../Shared/CEDateTimeInput';
import CETooltip from '../Shared/CETooltip';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { t } from '../../utilities/ui/terminology.js';
import { buildCreateSbtActiveClassName, resolveCreateSbtTooltipIconStyle } from './createSbtGroupHelpers';

type CreateSbtDistributionState = Record<string, unknown> & {
  burnAdmin?: string;
  burnAuth?: string;
  distributionOption?: string;
  groupPassword?: string;
  isLimited?: boolean;
  isTimeLimited?: boolean;
  limitedNumber?: number | string;
  mintingEndTime?: Date | null;
  unlisted?: boolean;
};

type CreateSbtChainOption = {
  id: number | string;
  name: string;
};

type MintOptionsDisplayState = Record<string, unknown> & {
  shouldUseLimitedOptionActiveClass?: boolean;
  shouldRenderLimitedNumberInput?: boolean;
  shouldUseTimeLimitedOptionActiveClass?: boolean;
  shouldRenderTimeLimitedInput?: boolean;
  shouldRenderNetworkSelector?: boolean;
  shouldRenderNetworkReadonly?: boolean;
  shouldUsePredictableAddressActiveClass?: boolean;
  shouldRenderPredictableAddressDetails?: boolean;
  shouldRenderPredictableAddressBusy?: boolean;
};

type SelectableDistributionOptionConfig = {
  value: string;
  label: string;
  tooltipId: string;
  tooltipText: string;
  selected: boolean;
  shouldUseActiveClass: boolean;
};

type ActionDisplayState = Record<string, unknown> & {
  shouldRenderGroupPasswordInput?: boolean;
};

type RenderCreateSbtMintOptionsSectionArgs = {
  sbtDistribution: CreateSbtDistributionState;
  mintOptionsDisplayState: MintOptionsDisplayState;
  authoringChainId: number | string;
  authoringChain?: CreateSbtChainOption | null;
  chainOptions: CreateSbtChainOption[];
  predictableAddressActive: boolean;
  predictableAddressLocked: boolean;
  predictedAddressDisplayText: string;
  handleInputChange: React.ChangeEventHandler<HTMLInputElement>;
  handleBurnAuthChange: React.ChangeEventHandler<HTMLSelectElement>;
  handleNetworkChange: React.ChangeEventHandler<HTMLSelectElement>;
  handleMintingEndTimeChange: (value: unknown) => void;
  onPredictableAddressToggle: (checked: boolean) => void;
};

export const renderCreateSbtMintOptionsSection = ({
  sbtDistribution,
  mintOptionsDisplayState,
  authoringChainId,
  authoringChain,
  chainOptions,
  predictableAddressActive,
  predictableAddressLocked,
  predictedAddressDisplayText,
  handleInputChange,
  handleBurnAuthChange,
  handleNetworkChange,
  handleMintingEndTimeChange,
  onPredictableAddressToggle,
}: RenderCreateSbtMintOptionsSectionArgs) => {
  const calendarStyles = { color: 'var(--ce-document-text)' };

  return (
    <div className={styles.sbtTokenOptions}>
      <div className={styles.optionsGrid}>
        <div
          className={buildCreateSbtActiveClassName({
            activeClassName: styles.activeOption,
            baseClassNames: styles.optionCard,
            shouldUseActiveClass: mintOptionsDisplayState.shouldUseLimitedOptionActiveClass,
          })}
        >
          <label className={styles.optionHeader}>
            <input
              type="checkbox"
              name="sbtDistribution.isLimited"
              checked={Boolean(sbtDistribution.isLimited)}
              onChange={handleInputChange}
            />
            <span>Limited Tokens</span>
            <FontAwesomeIcon
              icon={faQuestionCircle}
              className={styles.tooltip}
              id="limitedNumberTooltip"
              style={resolveCreateSbtTooltipIconStyle()}
            />
            <CETooltip placement="right" target="limitedNumberTooltip" className={styles.tooltipBubble}>
              {`Specify the maximum number of ${t('sbts')} that can be ${t('mintedLower')}.`}
            </CETooltip>
          </label>

          {mintOptionsDisplayState.shouldRenderLimitedNumberInput && (
            <div className={styles.optionBody}>
              <input
                type="number"
                name="sbtDistribution.limitedNumber"
                value={sbtDistribution.limitedNumber as number | string}
                onChange={handleInputChange}
                placeholder="Qty (e.g. 100)"
                className={styles.inlineNumberInput}
              />
            </div>
          )}
        </div>

        <div
          className={buildCreateSbtActiveClassName({
            activeClassName: styles.activeOption,
            baseClassNames: styles.optionCard,
            shouldUseActiveClass: mintOptionsDisplayState.shouldUseTimeLimitedOptionActiveClass,
          })}
        >
          <label className={styles.optionHeader}>
            <input
              type="checkbox"
              name="sbtDistribution.isTimeLimited"
              checked={Boolean(sbtDistribution.isTimeLimited)}
              onChange={handleInputChange}
            />
            <span>Time-Limited</span>
            <FontAwesomeIcon
              icon={faQuestionCircle}
              className={styles.tooltip}
              id="timeLimitedTooltip"
              style={resolveCreateSbtTooltipIconStyle()}
            />
            <CETooltip placement="right" target="timeLimitedTooltip" className={styles.tooltipBubble}>
              Set an end time for the minting period.
            </CETooltip>
          </label>

          {mintOptionsDisplayState.shouldRenderTimeLimitedInput && (
            <div className={styles.timeLimitedOptions}>
              <CEDateTimeInput
                selected={sbtDistribution.mintingEndTime}
                onChange={handleMintingEndTimeChange}
                showTimeSelect
                timeFormat="HH:mm"
                timeIntervals={15}
                timeCaption="time"
                dateFormat="MMMM d, yyyy h:mm aa"
                calendarClassName={styles.blackText}
                style={calendarStyles}
                placeholderText="Select End Date"
              />
            </div>
          )}
        </div>
      </div>

      <div className={styles.settingsStack}>
        <div className={styles.settingRow}>
          <div className={styles.settingCopy}>
            <span className={styles.settingLabel}>
              {`${t('burn')} Auth`}
              <FontAwesomeIcon
                icon={faQuestionCircle}
                className={styles.tooltip}
                id="burnAuthTooltip"
                style={resolveCreateSbtTooltipIconStyle()}
              />
            </span>
            <CETooltip placement="right" target="burnAuthTooltip" className={styles.tooltipBubble}>
              Specify who can burn the token.
            </CETooltip>
          </div>
          <select
            name="sbtDistribution.burnAuth"
            value={sbtDistribution.burnAuth}
            onChange={handleBurnAuthChange}
            className={styles.compactSelect}
          >
            <option value="AdminOnly">Admin Only</option>
            <option value="OwnerOnly">Owner Only</option>
            <option value="Both">Both</option>
            <option value="Neither">Neither</option>
          </select>
        </div>

        <div className={styles.settingRow}>
          <div className={styles.settingCopy}>
            <span className={styles.settingLabel}>
              Admin Address
              <FontAwesomeIcon
                icon={faQuestionCircle}
                className={styles.tooltip}
                id="burnAdminTooltip"
                style={resolveCreateSbtTooltipIconStyle()}
              />
            </span>
            <CETooltip placement="right" target="burnAdminTooltip" className={styles.tooltipBubble}>
              Enter the address that can burn the token.
            </CETooltip>
          </div>
          <input
            type="text"
            name="sbtDistribution.burnAdmin"
            value={sbtDistribution.burnAdmin}
            onChange={handleInputChange}
            placeholder="0x... (default: deployer)"
            className={styles.compactTextInput}
          />
        </div>

        {mintOptionsDisplayState.shouldRenderNetworkSelector ? (
          <div className={styles.settingRow}>
            <div className={styles.settingCopy}>
              <span className={styles.settingLabel}>
                Network
                <FontAwesomeIcon
                  icon={faQuestionCircle}
                  className={styles.tooltip}
                  id="networkTooltip"
                  style={resolveCreateSbtTooltipIconStyle()}
                />
              </span>
              <CETooltip placement="right" target="networkTooltip" className={styles.tooltipBubble}>
                Select the network for minting.
              </CETooltip>
            </div>
            <select className={styles.compactSelect} value={authoringChainId} onChange={handleNetworkChange}>
              {chainOptions.map((c: CreateSbtChainOption) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.id})
                </option>
              ))}
            </select>
          </div>
        ) : mintOptionsDisplayState.shouldRenderNetworkReadonly ? (
          <div className={styles.settingRow}>
            <div className={styles.settingCopy}>
              <span className={styles.settingLabel}>Network</span>
            </div>
            <span className={styles.readonlyPill}>{authoringChain?.name || 'Session chain'}</span>
          </div>
        ) : null}

        <div
          className={buildCreateSbtActiveClassName({
            activeClassName: styles.settingRowActive,
            baseClassNames: [styles.settingRow, styles.settingToggleRow],
            shouldUseActiveClass: mintOptionsDisplayState.shouldUsePredictableAddressActiveClass,
          })}
        >
          <label className={styles.settingToggleLabel}>
            <input
              type="checkbox"
              checked={predictableAddressActive}
              disabled={predictableAddressLocked}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onPredictableAddressToggle(e.target.checked)}
              data-testid={E2E_TESTIDS.SBT_CREATE_PREDICTABLE_TOGGLE}
            />
            <span className={styles.settingCopy}>
              <span className={styles.settingLabel}>
                Make address predictable before deploy
                <FontAwesomeIcon
                  icon={faQuestionCircle}
                  className={styles.tooltip}
                  id="create2SaltTooltip"
                  style={resolveCreateSbtTooltipIconStyle()}
                />
              </span>
            </span>
            <CETooltip placement="right" target="create2SaltTooltip" className={styles.tooltipBubble}>
              {`Use deterministic deployment so the ${t('sbt')} address is known before on-chain creation.`}
            </CETooltip>
          </label>
          {mintOptionsDisplayState.shouldRenderPredictableAddressDetails && (
            <div className={styles.settingRowDetails}>
              <div className={styles.addressPreviewRow}>
                <span className={styles.previewLabel}>Predicted address</span>
                <code className={styles.addressPreviewValue} data-testid={E2E_TESTIDS.SBT_CREATE_PREDICTED_ADDRESS}>
                  {predictedAddressDisplayText}
                </code>
              </div>
              {mintOptionsDisplayState.shouldRenderPredictableAddressBusy && (
                <div className={styles.fieldHelpText}>Calculating address…</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

type RenderCreateSbtDistributionOptionsSectionArgs = {
  distributionOptions: SelectableDistributionOptionConfig[];
  actionDisplayState: ActionDisplayState;
  groupPassword: string;
  sbtDistribution: CreateSbtDistributionState;
  handleInputChange: React.ChangeEventHandler<HTMLInputElement>;
};

export const renderCreateSbtDistributionOptionsSection = ({
  distributionOptions,
  actionDisplayState,
  groupPassword,
  sbtDistribution,
  handleInputChange,
}: RenderCreateSbtDistributionOptionsSectionArgs) => (
  <div className={styles.distributionSection}>
    <div className={styles.distributionGrid}>
      {distributionOptions.map((option) => (
        <label
          key={option.value}
          className={buildCreateSbtActiveClassName({
            activeClassName: styles.distributionCardActive,
            baseClassNames: styles.distributionCard,
            shouldUseActiveClass: option.shouldUseActiveClass,
          })}
        >
          <span className={styles.distributionCardTop}>
            <span className={styles.distributionChoice}>
              <input
                type="radio"
                name="sbtDistribution.distributionOption"
                value={option.value}
                checked={option.selected}
                onChange={handleInputChange}
              />
              <span>{option.label}</span>
            </span>
            <span className={styles.distributionTooltipWrap}>
              <FontAwesomeIcon
                icon={faQuestionCircle}
                className={styles.tooltip}
                id={option.tooltipId}
                style={resolveCreateSbtTooltipIconStyle()}
              />
              <CETooltip placement="right" target={option.tooltipId} className={styles.tooltipBubble}>
                {option.tooltipText}
              </CETooltip>
            </span>
          </span>
        </label>
      ))}
    </div>

    {actionDisplayState.shouldRenderGroupPasswordInput && (
      <div className={styles.groupPasswordInputContainer}>
        <input
          type="text"
          name="groupPassword"
          value={groupPassword}
          onChange={handleInputChange}
          placeholder="Enter the group password"
          className={styles.groupPasswordInput}
        />
      </div>
    )}

    <label className={styles.distributionCheckboxRow}>
      <span className={styles.distributionChoice}>
        <input
          type="checkbox"
          name="sbtDistribution.unlisted"
          checked={Boolean(sbtDistribution.unlisted)}
          onChange={handleInputChange}
        />
        <span>Unlisted</span>
      </span>
      <span className={styles.distributionTooltipWrap}>
        <FontAwesomeIcon
          icon={faQuestionCircle}
          className={styles.tooltip}
          id="unlistedTooltip"
          style={resolveCreateSbtTooltipIconStyle()}
        />
        <CETooltip placement="right" target="unlistedTooltip" className={styles.tooltipBubble}>
          {`If checked, the ${t('sbtLower')} will not appear in the public list but will still be discoverable via the Arweave transaction if not encrypted.`}
        </CETooltip>
      </span>
    </label>
  </div>
);
