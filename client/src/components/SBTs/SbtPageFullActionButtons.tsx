import React from 'react';

import styles from './SBTPage.module.scss';
import SbtPageMintInputAction from './SbtPageMintInputAction';
import SbtPageStatusActionButton from './SbtPageStatusActionButton';
import { runSbtPageBurnActionController, runSbtPageMintActionController } from './sbtPageActionController';
import type {
  SbtPageBurnActionPlan,
  SbtPageBurnStatusButtonState,
  SbtPageFullActionDisplayPlan,
  SbtPageMintButtonDisplayState,
  SbtPageStatusButtonContentState,
} from './sbtPageActionDisplayHelpers';

export type SbtPageFullMintActionExecutionProps = {
  onClaimWithInviteCode: (inviteCode?: unknown) => unknown;
  onGroupPasswordInputChange: React.ChangeEventHandler<HTMLInputElement>;
  onManualPasswordInputChange: React.ChangeEventHandler<HTMLInputElement>;
  onMint: (forceEventRefreshOnSuccess?: boolean) => unknown;
  onMintUnlimitedWithGroupPassword: () => unknown;
  onOpenMintTransaction: () => unknown;
};

export type SbtPageFullBurnActionExecutionProps = {
  onBurn: () => unknown;
};

export type SbtPageFullActionSurfaces = {
  burnButton: React.ReactNode;
  mintButton: React.ReactNode;
};

type RenderSbtPageFullActionSurfacesArgs = {
  actionDisplayPlan: SbtPageFullActionDisplayPlan;
  burnExecution: SbtPageFullBurnActionExecutionProps;
  groupPasswordInput?: string;
  mintExecution: SbtPageFullMintActionExecutionProps;
};

type SbtPageMintActionSurfaceProps = {
  buttonClassName: string;
  displayState: SbtPageMintButtonDisplayState;
  groupPasswordInput?: string;
  onClaimWithInviteCode: (inviteCode?: unknown) => unknown;
  onGroupPasswordInputChange: React.ChangeEventHandler<HTMLInputElement>;
  onManualPasswordInputChange: React.ChangeEventHandler<HTMLInputElement>;
  onMint: (forceEventRefreshOnSuccess?: boolean) => unknown;
  onMintUnlimitedWithGroupPassword: () => unknown;
  onOpenMintTransaction: () => unknown;
};

export const SbtPageMintActionSurface = ({
  buttonClassName,
  displayState,
  groupPasswordInput = '',
  onClaimWithInviteCode,
  onGroupPasswordInputChange,
  onManualPasswordInputChange,
  onMint,
  onMintUnlimitedWithGroupPassword,
  onOpenMintTransaction,
}: SbtPageMintActionSurfaceProps): React.ReactElement | null => {
  const {
    manualClaimActionRequest,
    mintActionPlan,
    mintFlowDisplayState,
    openMintButtonContentState,
    openMintButtonState,
    passwordJoinButtonState,
    passwordJoinContentState,
  } = displayState;

  if (!mintActionPlan.shouldRenderMintButton) return null;
  if (mintFlowDisplayState.shouldSuppressMintControls) return null;

  if (mintFlowDisplayState.shouldRenderGroupPasswordJoin) {
    return (
      <SbtPageMintInputAction
        buttonClassName={buttonClassName}
        contentState={passwordJoinContentState}
        disabled={passwordJoinButtonState.disabled}
        inputType="password"
        inputValue={groupPasswordInput || ''}
        onInputChange={onGroupPasswordInputChange}
        placeholder="Group Password"
        onAction={(event) =>
          runSbtPageMintActionController({
            disabled: passwordJoinButtonState.disabled,
            event,
            plan: mintActionPlan,
            ports: {
              dispatchMint: onMintUnlimitedWithGroupPassword,
            },
          })
        }
      />
    );
  }

  if (mintFlowDisplayState.shouldRenderInviteJoin) {
    return (
      <SbtPageMintInputAction
        buttonClassName={buttonClassName}
        contentState={passwordJoinContentState}
        disabled={passwordJoinButtonState.disabled}
        inputType="password"
        inputValue={groupPasswordInput || ''}
        onInputChange={onGroupPasswordInputChange}
        placeholder="Group Password"
        onAction={(event) =>
          runSbtPageMintActionController({
            disabled: passwordJoinButtonState.disabled,
            event,
            mintArgs: [groupPasswordInput],
            plan: mintActionPlan,
            ports: {
              dispatchMint: onClaimWithInviteCode,
            },
          })
        }
      />
    );
  }

  if (mintFlowDisplayState.shouldRenderOpenMintButton) {
    const { canOpenMintTx, disabled, title } = openMintButtonState;
    return (
      <SbtPageStatusActionButton
        className={buttonClassName}
        contentState={openMintButtonContentState}
        disabled={disabled}
        onClick={(event) =>
          runSbtPageMintActionController({
            canOpenMintTx,
            disabled,
            event,
            mintArgs: [true],
            plan: mintActionPlan,
            ports: {
              dispatchMint: onMint,
              openMintTransaction: onOpenMintTransaction,
            },
          })
        }
        title={title}
      />
    );
  }

  if (manualClaimActionRequest.shouldRenderInputAction) {
    return (
      <SbtPageMintInputAction
        buttonClassName={buttonClassName}
        contentState={manualClaimActionRequest.contentState}
        disabled={manualClaimActionRequest.disabled}
        inputType={manualClaimActionRequest.inputType}
        inputValue={manualClaimActionRequest.inputValue}
        onInputChange={onManualPasswordInputChange}
        placeholder={manualClaimActionRequest.placeholder}
        onAction={(event) =>
          runSbtPageMintActionController({
            disabled: manualClaimActionRequest.disabled,
            event,
            mintArgs: manualClaimActionRequest.mintArgs,
            plan: mintActionPlan,
            ports: {
              dispatchMint: onMint,
            },
          })
        }
      />
    );
  }

  if (manualClaimActionRequest.viewKind === 'manual-claim-countdown') {
    return (
      <div className={styles.mintProcess}>
        <p className={styles.claimCountdown}>{manualClaimActionRequest.statusText}</p>
      </div>
    );
  }

  if (manualClaimActionRequest.viewKind === 'manual-claim-success') {
    return (
      <div className={styles.mintProcess}>
        <p className={styles.mintSuccess}>{manualClaimActionRequest.statusText}</p>
      </div>
    );
  }

  return null;
};

type SbtPageBurnActionSurfaceProps = {
  buttonClassName: string;
  contentState: SbtPageStatusButtonContentState;
  displayState: SbtPageBurnStatusButtonState;
  plan: SbtPageBurnActionPlan;
  onBurn: () => unknown;
};

export const SbtPageBurnActionSurface = ({
  buttonClassName,
  contentState,
  displayState,
  onBurn,
  plan,
}: SbtPageBurnActionSurfaceProps): React.ReactElement | null => {
  if (!plan.shouldRenderBurnButton) return null;

  return (
    <SbtPageStatusActionButton
      className={buttonClassName}
      contentState={contentState}
      disabled={displayState.disabled}
      onClick={(event) =>
        runSbtPageBurnActionController({
          disabled: displayState.disabled,
          event,
          plan,
          ports: {
            dispatchBurn: onBurn,
          },
        })
      }
    />
  );
};

export const renderSbtPageFullActionSurfaces = ({
  actionDisplayPlan,
  burnExecution,
  groupPasswordInput = '',
  mintExecution,
}: RenderSbtPageFullActionSurfacesArgs): SbtPageFullActionSurfaces => ({
  burnButton: actionDisplayPlan.shouldRenderBurnSurface ? (
    <SbtPageBurnActionSurface
      buttonClassName={actionDisplayPlan.burnActionButtonClassName}
      contentState={actionDisplayPlan.burnButtonContentState}
      displayState={actionDisplayPlan.burnStatusButtonState}
      onBurn={burnExecution.onBurn}
      plan={actionDisplayPlan.burnActionPlan}
    />
  ) : null,
  mintButton: actionDisplayPlan.shouldRenderMintSurface ? (
    <SbtPageMintActionSurface
      buttonClassName={actionDisplayPlan.mintActionButtonClassName}
      displayState={actionDisplayPlan.mintButtonDisplayState}
      groupPasswordInput={groupPasswordInput || ''}
      onClaimWithInviteCode={mintExecution.onClaimWithInviteCode}
      onGroupPasswordInputChange={mintExecution.onGroupPasswordInputChange}
      onManualPasswordInputChange={mintExecution.onManualPasswordInputChange}
      onMint={mintExecution.onMint}
      onMintUnlimitedWithGroupPassword={mintExecution.onMintUnlimitedWithGroupPassword}
      onOpenMintTransaction={mintExecution.onOpenMintTransaction}
    />
  ) : null,
});
