export type SbtPageMintActionPlanLike = {
  blockedReason?: unknown;
  shouldRenderMintButton?: boolean;
};

export type SbtPageBurnActionPlanLike = {
  blockedReason?: unknown;
  shouldRenderBurnButton?: boolean;
};

export type SbtPageActionEventLike = {
  preventDefault?: () => void;
};

export type SbtPageMintActionControllerPorts = {
  dispatchMint?: (...args: unknown[]) => unknown;
  openMintTransaction?: () => unknown;
};

export type SbtPageBurnActionControllerPorts = {
  dispatchBurn?: () => unknown;
};

export type RunSbtPageMintActionControllerArgs = {
  canOpenMintTx?: boolean;
  disabled?: boolean;
  event?: SbtPageActionEventLike | null;
  mintArgs?: unknown[];
  plan?: SbtPageMintActionPlanLike | null;
  ports?: SbtPageMintActionControllerPorts;
};

export type RunSbtPageBurnActionControllerArgs = {
  disabled?: boolean;
  event?: SbtPageActionEventLike | null;
  plan?: SbtPageBurnActionPlanLike | null;
  ports?: SbtPageBurnActionControllerPorts;
};

export type SbtPageActionControllerResult = {
  blockedReason: unknown;
  status: 'blocked' | 'disabled' | 'dispatched' | 'hidden' | 'opened-transaction' | 'unhandled';
};

const isBlocked = (blockedReason: unknown): boolean => (
  !!blockedReason && blockedReason !== 'none'
);

const preventDefault = (event?: SbtPageActionEventLike | null): void => {
  if (typeof event?.preventDefault === 'function') {
    event.preventDefault();
  }
};

export const runSbtPageMintActionController = ({
  canOpenMintTx = false,
  disabled = false,
  event = null,
  mintArgs = [],
  plan = null,
  ports = {},
}: RunSbtPageMintActionControllerArgs = {}): SbtPageActionControllerResult => {
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
