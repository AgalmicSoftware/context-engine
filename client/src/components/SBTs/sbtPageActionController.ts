export type SbtPageMintActionPlanLike = {
  blockedReason?: unknown;
  shouldRenderMintButton?: boolean;
};

export type SbtPageBurnActionPlanLike = {
  blockedReason?: unknown;
  shouldRenderBurnButton?: boolean;
};

export type SbtPageMiniBurnActionPlanLike = {
  blockedReason?: unknown;
  shouldRenderMiniBurnButton?: boolean;
};

export type SbtPageMiniMintActionPlanLike = {
  blockedReason?: unknown;
  disabled?: boolean;
  handlerKind?: unknown;
  shouldRenderMintArea?: boolean;
};

export type SbtPageActionEventLike = {
  preventDefault?: () => void;
};

export type SbtPageActionDispatch<Args extends readonly unknown[] = readonly unknown[]> = (...args: Args) => unknown;

export type SbtPageNoArgActionDispatch = () => unknown;

export type SbtPageMintActionControllerPorts<MintArgs extends readonly unknown[] = readonly unknown[]> = {
  dispatchMint?: SbtPageActionDispatch<MintArgs>;
  openMintTransaction?: () => unknown;
};

export type SbtPageBurnActionControllerPorts = {
  dispatchBurn?: SbtPageNoArgActionDispatch;
};

export type SbtPageMiniBurnActionControllerPorts = {
  dispatchMiniBurn?: SbtPageNoArgActionDispatch;
};

export type SbtPageMiniMintActionControllerPorts<
  MiniMintArgs extends readonly unknown[] = readonly unknown[],
  GroupPasswordMintArgs extends readonly unknown[] = readonly unknown[],
  InviteCodeMintArgs extends readonly unknown[] = readonly unknown[],
  ShowPasswordInputArgs extends readonly unknown[] = readonly unknown[],
> = {
  dispatchGroupPasswordMint?: SbtPageActionDispatch<GroupPasswordMintArgs>;
  dispatchInviteCodeMint?: SbtPageActionDispatch<InviteCodeMintArgs>;
  dispatchMiniMint?: SbtPageActionDispatch<MiniMintArgs>;
  dispatchShowPasswordInput?: SbtPageActionDispatch<ShowPasswordInputArgs>;
};

export type SbtPageMiniCardActionControllerPorts = SbtPageMiniBurnActionControllerPorts &
  SbtPageMiniMintActionControllerPorts<[], [], [unknown], []>;

export type RunSbtPageMintActionControllerArgs<MintArgs extends readonly unknown[] = readonly unknown[]> = {
  canOpenMintTx?: boolean;
  disabled?: boolean;
  event?: SbtPageActionEventLike | null;
  mintArgs?: MintArgs;
  plan?: SbtPageMintActionPlanLike | null;
  ports?: SbtPageMintActionControllerPorts<MintArgs>;
};

export type RunSbtPageBurnActionControllerArgs = {
  disabled?: boolean;
  event?: SbtPageActionEventLike | null;
  plan?: SbtPageBurnActionPlanLike | null;
  ports?: SbtPageBurnActionControllerPorts;
};

export type RunSbtPageMiniBurnActionControllerArgs = {
  burnArgs?: [];
  disabled?: boolean;
  event?: SbtPageActionEventLike | null;
  plan?: SbtPageMiniBurnActionPlanLike | null;
  ports?: SbtPageMiniBurnActionControllerPorts;
};

export type RunSbtPageMiniMintActionControllerArgs<
  MiniMintArgs extends readonly unknown[] = readonly unknown[],
  GroupPasswordMintArgs extends readonly unknown[] = readonly unknown[],
  InviteCodeMintArgs extends readonly unknown[] = readonly unknown[],
  ShowPasswordInputArgs extends readonly unknown[] = readonly unknown[],
> = {
  disabled?: boolean;
  event?: SbtPageActionEventLike | null;
  groupPasswordMintArgs?: GroupPasswordMintArgs;
  inviteCodeMintArgs?: InviteCodeMintArgs;
  miniMintArgs?: MiniMintArgs;
  plan?: SbtPageMiniMintActionPlanLike | null;
  ports?: SbtPageMiniMintActionControllerPorts<
    MiniMintArgs,
    GroupPasswordMintArgs,
    InviteCodeMintArgs,
    ShowPasswordInputArgs
  >;
  showPasswordInputArgs?: ShowPasswordInputArgs;
};

export type BuildSbtPageMiniCardActionHandlersArgs = {
  groupPasswordInput?: unknown;
  miniBurnActionPlan?: SbtPageMiniBurnActionPlanLike | null;
  miniBurnDisabled?: boolean;
  miniMintActionPlan?: SbtPageMiniMintActionPlanLike | null;
  ports?: SbtPageMiniCardActionControllerPorts;
};

export type SbtPageActionControllerResult = {
  blockedReason: unknown;
  status: 'blocked' | 'disabled' | 'dispatched' | 'hidden' | 'opened-transaction' | 'unhandled';
};

export type SbtPageMiniCardActionHandlers = {
  onClaimWithInviteCode: (event?: SbtPageActionEventLike | null) => SbtPageActionControllerResult;
  onMiniBurn: (event?: SbtPageActionEventLike | null) => SbtPageActionControllerResult;
  onMiniMint: (event?: SbtPageActionEventLike | null) => SbtPageActionControllerResult;
  onMintUnlimitedWithGroupPassword: (event?: SbtPageActionEventLike | null) => SbtPageActionControllerResult;
  onShowMiniPasswordInput: (event?: SbtPageActionEventLike | null) => SbtPageActionControllerResult;
};

const isBlocked = (blockedReason: unknown): boolean => !!blockedReason && blockedReason !== 'none';

const preventDefault = (event?: SbtPageActionEventLike | null): void => {
  if (typeof event?.preventDefault === 'function') {
    event.preventDefault();
  }
};

export const runSbtPageMintActionController = <MintArgs extends readonly unknown[] = readonly unknown[]>({
  canOpenMintTx = false,
  disabled = false,
  event = null,
  mintArgs = [] as unknown as MintArgs,
  plan = null,
  ports = {},
}: RunSbtPageMintActionControllerArgs<MintArgs> = {}): SbtPageActionControllerResult => {
  preventDefault(event);

  if (!plan?.shouldRenderMintButton) {
    return {
      blockedReason: plan?.blockedReason,
      status: 'hidden',
    };
  }

  if (isBlocked(plan.blockedReason)) {
    return {
      blockedReason: plan.blockedReason,
      status: 'blocked',
    };
  }

  if (disabled) {
    return {
      blockedReason: plan.blockedReason,
      status: 'disabled',
    };
  }

  if (canOpenMintTx) {
    if (typeof ports.openMintTransaction !== 'function') {
      return {
        blockedReason: plan.blockedReason,
        status: 'unhandled',
      };
    }
    ports.openMintTransaction();
    return {
      blockedReason: plan.blockedReason,
      status: 'opened-transaction',
    };
  }

  if (typeof ports.dispatchMint !== 'function') {
    return {
      blockedReason: plan.blockedReason,
      status: 'unhandled',
    };
  }

  ports.dispatchMint(...mintArgs);
  return {
    blockedReason: plan.blockedReason,
    status: 'dispatched',
  };
};

export const runSbtPageBurnActionController = ({
  disabled = false,
  event = null,
  plan = null,
  ports = {},
}: RunSbtPageBurnActionControllerArgs = {}): SbtPageActionControllerResult => {
  preventDefault(event);

  if (!plan?.shouldRenderBurnButton) {
    return {
      blockedReason: plan?.blockedReason,
      status: 'hidden',
    };
  }

  if (isBlocked(plan.blockedReason)) {
    return {
      blockedReason: plan.blockedReason,
      status: 'blocked',
    };
  }

  if (disabled) {
    return {
      blockedReason: plan.blockedReason,
      status: 'disabled',
    };
  }

  if (typeof ports.dispatchBurn !== 'function') {
    return {
      blockedReason: plan.blockedReason,
      status: 'unhandled',
    };
  }

  ports.dispatchBurn();
  return {
    blockedReason: plan.blockedReason,
    status: 'dispatched',
  };
};

export const runSbtPageMiniMintActionController = <
  MiniMintArgs extends readonly unknown[] = readonly unknown[],
  GroupPasswordMintArgs extends readonly unknown[] = readonly unknown[],
  InviteCodeMintArgs extends readonly unknown[] = readonly unknown[],
  ShowPasswordInputArgs extends readonly unknown[] = readonly unknown[],
>({
  disabled = false,
  event = null,
  groupPasswordMintArgs = [] as unknown as GroupPasswordMintArgs,
  inviteCodeMintArgs = [] as unknown as InviteCodeMintArgs,
  miniMintArgs = [] as unknown as MiniMintArgs,
  plan = null,
  ports = {},
  showPasswordInputArgs = [] as unknown as ShowPasswordInputArgs,
}: RunSbtPageMiniMintActionControllerArgs<
  MiniMintArgs,
  GroupPasswordMintArgs,
  InviteCodeMintArgs,
  ShowPasswordInputArgs
> = {}): SbtPageActionControllerResult => {
  preventDefault(event);

  if (!plan?.shouldRenderMintArea) {
    return {
      blockedReason: plan?.blockedReason,
      status: 'hidden',
    };
  }

  if (isBlocked(plan.blockedReason)) {
    return {
      blockedReason: plan.blockedReason,
      status: 'blocked',
    };
  }

  if (disabled || !!plan.disabled) {
    return {
      blockedReason: plan.blockedReason,
      status: 'disabled',
    };
  }

  if (plan.handlerKind === 'show-password-input') {
    if (typeof ports.dispatchShowPasswordInput !== 'function') {
      return {
        blockedReason: plan.blockedReason,
        status: 'unhandled',
      };
    }
    ports.dispatchShowPasswordInput(...showPasswordInputArgs);
    return {
      blockedReason: plan.blockedReason,
      status: 'dispatched',
    };
  }

  if (plan.handlerKind === 'mint-unlimited-with-group-password') {
    if (typeof ports.dispatchGroupPasswordMint !== 'function') {
      return {
        blockedReason: plan.blockedReason,
        status: 'unhandled',
      };
    }
    ports.dispatchGroupPasswordMint(...groupPasswordMintArgs);
    return {
      blockedReason: plan.blockedReason,
      status: 'dispatched',
    };
  }

  if (plan.handlerKind === 'claim-with-invite-code') {
    if (typeof ports.dispatchInviteCodeMint !== 'function') {
      return {
        blockedReason: plan.blockedReason,
        status: 'unhandled',
      };
    }
    ports.dispatchInviteCodeMint(...inviteCodeMintArgs);
    return {
      blockedReason: plan.blockedReason,
      status: 'dispatched',
    };
  }

  if (plan.handlerKind === 'mini-mint') {
    if (typeof ports.dispatchMiniMint !== 'function') {
      return {
        blockedReason: plan.blockedReason,
        status: 'unhandled',
      };
    }
    ports.dispatchMiniMint(...miniMintArgs);
    return {
      blockedReason: plan.blockedReason,
      status: 'dispatched',
    };
  }

  return {
    blockedReason: plan.blockedReason,
    status: 'unhandled',
  };
};

export const runSbtPageMiniBurnActionController = ({
  burnArgs = [],
  disabled = false,
  event = null,
  plan = null,
  ports = {},
}: RunSbtPageMiniBurnActionControllerArgs = {}): SbtPageActionControllerResult => {
  preventDefault(event);

  if (!plan?.shouldRenderMiniBurnButton) {
    return {
      blockedReason: plan?.blockedReason,
      status: 'hidden',
    };
  }

  if (isBlocked(plan.blockedReason)) {
    return {
      blockedReason: plan.blockedReason,
      status: 'blocked',
    };
  }

  if (disabled) {
    return {
      blockedReason: plan.blockedReason,
      status: 'disabled',
    };
  }

  if (typeof ports.dispatchMiniBurn !== 'function') {
    return {
      blockedReason: plan.blockedReason,
      status: 'unhandled',
    };
  }

  ports.dispatchMiniBurn(...burnArgs);
  return {
    blockedReason: plan.blockedReason,
    status: 'dispatched',
  };
};

export const buildSbtPageMiniCardActionHandlers = ({
  groupPasswordInput = '',
  miniBurnActionPlan = null,
  miniBurnDisabled = false,
  miniMintActionPlan = null,
  ports = {},
}: BuildSbtPageMiniCardActionHandlersArgs = {}): SbtPageMiniCardActionHandlers => ({
  onClaimWithInviteCode: (event = null) =>
    runSbtPageMiniMintActionController({
      event,
      inviteCodeMintArgs: [groupPasswordInput],
      plan: miniMintActionPlan,
      ports,
    }),
  onMiniBurn: (event = null) =>
    runSbtPageMiniBurnActionController({
      disabled: miniBurnDisabled,
      event,
      plan: miniBurnActionPlan,
      ports,
    }),
  onMiniMint: (event = null) =>
    runSbtPageMiniMintActionController({
      event,
      plan: miniMintActionPlan,
      ports,
    }),
  onMintUnlimitedWithGroupPassword: (event = null) =>
    runSbtPageMiniMintActionController({
      event,
      plan: miniMintActionPlan,
      ports,
    }),
  onShowMiniPasswordInput: (event = null) =>
    runSbtPageMiniMintActionController({
      event,
      plan: miniMintActionPlan,
      ports,
    }),
});
