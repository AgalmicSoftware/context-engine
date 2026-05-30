import {
  runSbtPageBurnActionController,
  runSbtPageMiniBurnActionController,
  runSbtPageMiniMintActionController,
  runSbtPageMintActionController,
  type SbtPageBurnActionControllerPorts,
  type SbtPageMiniBurnActionControllerPorts,
  type SbtPageMiniMintActionControllerPorts,
  type SbtPageMintActionControllerPorts,
} from './sbtPageActionController';

describe('sbtPageActionController', () => {
  it('does not dispatch hidden or blocked mint actions', () => {
    const dispatchMint = jest.fn();

    expect(runSbtPageMintActionController({
      plan: { blockedReason: 'missing-sbt', shouldRenderMintButton: false },
      ports: { dispatchMint },
    })).toEqual({
      blockedReason: 'missing-sbt',
      status: 'hidden',
    });
    expect(runSbtPageMintActionController({
      plan: { blockedReason: 'mint-ended', shouldRenderMintButton: true },
      ports: { dispatchMint },
    })).toEqual({
      blockedReason: 'mint-ended',
      status: 'blocked',
    });
    expect(dispatchMint).not.toHaveBeenCalled();
  });

  it('does not dispatch hidden or blocked burn actions', () => {
    const dispatchBurn = jest.fn();

    expect(runSbtPageBurnActionController({
      plan: { blockedReason: 'missing-token', shouldRenderBurnButton: false },
      ports: { dispatchBurn },
    })).toEqual({
      blockedReason: 'missing-token',
      status: 'hidden',
    });
    expect(runSbtPageBurnActionController({
      plan: { blockedReason: 'owner-burn-disabled', shouldRenderBurnButton: true },
      ports: { dispatchBurn },
    })).toEqual({
      blockedReason: 'owner-burn-disabled',
      status: 'blocked',
    });
    expect(dispatchBurn).not.toHaveBeenCalled();
  });

  it('calls the mint port with the same args when enabled', () => {
    const dispatchMint = jest.fn() satisfies SbtPageMintActionControllerPorts<[
      boolean,
      { sbtAddressOverride: string },
    ]>['dispatchMint'];
    const event = { preventDefault: jest.fn() };

    expect(runSbtPageMintActionController({
      event,
      mintArgs: [true, { sbtAddressOverride: '0xabc' }],
      plan: { blockedReason: 'none', shouldRenderMintButton: true },
      ports: { dispatchMint },
    })).toEqual({
      blockedReason: 'none',
      status: 'dispatched',
    });

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(dispatchMint).toHaveBeenCalledTimes(1);
    expect(dispatchMint).toHaveBeenCalledWith(true, { sbtAddressOverride: '0xabc' });
  });

  it('keeps each parent mint dispatch shape intact', () => {
    const dispatchNoArgMint = jest.fn() satisfies SbtPageMintActionControllerPorts<[]>['dispatchMint'];
    const dispatchInviteMint = jest.fn() satisfies SbtPageMintActionControllerPorts<[string]>['dispatchMint'];
    const dispatchForcedMint = jest.fn() satisfies SbtPageMintActionControllerPorts<[boolean]>['dispatchMint'];

    expect(runSbtPageMintActionController({
      plan: { blockedReason: 'none', shouldRenderMintButton: true },
      ports: { dispatchMint: dispatchNoArgMint },
    }).status).toBe('dispatched');
    expect(runSbtPageMintActionController({
      mintArgs: ['invite-code'],
      plan: { blockedReason: 'none', shouldRenderMintButton: true },
      ports: { dispatchMint: dispatchInviteMint },
    }).status).toBe('dispatched');
    expect(runSbtPageMintActionController({
      mintArgs: [true],
      plan: { blockedReason: 'none', shouldRenderMintButton: true },
      ports: { dispatchMint: dispatchForcedMint },
    }).status).toBe('dispatched');

    expect(dispatchNoArgMint).toHaveBeenCalledWith();
    expect(dispatchInviteMint).toHaveBeenCalledWith('invite-code');
    expect(dispatchForcedMint).toHaveBeenCalledWith(true);
  });

  it('calls the burn port when enabled', () => {
    const dispatchBurn = jest.fn() satisfies SbtPageBurnActionControllerPorts['dispatchBurn'];
    const event = { preventDefault: jest.fn() };

    expect(runSbtPageBurnActionController({
      event,
      plan: { blockedReason: 'none', shouldRenderBurnButton: true },
      ports: { dispatchBurn },
    })).toEqual({
      blockedReason: 'none',
      status: 'dispatched',
    });

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(dispatchBurn).toHaveBeenCalledTimes(1);
  });

  it('preserves disabled and unhandled inert paths without calling ports', () => {
    const dispatchMint = jest.fn();
    const dispatchBurn = jest.fn();

    expect(runSbtPageMintActionController({
      disabled: true,
      plan: { blockedReason: 'none', shouldRenderMintButton: true },
      ports: { dispatchMint },
    })).toEqual({
      blockedReason: 'none',
      status: 'disabled',
    });
    expect(runSbtPageBurnActionController({
      disabled: true,
      plan: { blockedReason: 'none', shouldRenderBurnButton: true },
      ports: { dispatchBurn },
    })).toEqual({
      blockedReason: 'none',
      status: 'disabled',
    });
    expect(runSbtPageMintActionController({
      plan: { blockedReason: 'none', shouldRenderMintButton: true },
      ports: {},
    })).toEqual({
      blockedReason: 'none',
      status: 'unhandled',
    });
    expect(runSbtPageBurnActionController({
      plan: { blockedReason: 'none', shouldRenderBurnButton: true },
      ports: {},
    })).toEqual({
      blockedReason: 'none',
      status: 'unhandled',
    });
    expect(dispatchMint).not.toHaveBeenCalled();
    expect(dispatchBurn).not.toHaveBeenCalled();
  });

  it('opens the mint transaction branch instead of dispatching mint', () => {
    const dispatchMint = jest.fn();
    const openMintTransaction = jest.fn();

    expect(runSbtPageMintActionController({
      canOpenMintTx: true,
      plan: { blockedReason: 'none', shouldRenderMintButton: true },
      ports: { dispatchMint, openMintTransaction },
    })).toEqual({
      blockedReason: 'none',
      status: 'opened-transaction',
    });

    expect(openMintTransaction).toHaveBeenCalledTimes(1);
    expect(dispatchMint).not.toHaveBeenCalled();
  });

  it('propagates dispatch errors exactly', () => {
    const error = new Error('dispatch failed');

    expect(() => runSbtPageMintActionController({
      plan: { blockedReason: 'none', shouldRenderMintButton: true },
      ports: { dispatchMint: () => { throw error; } },
    })).toThrow(error);
    expect(() => runSbtPageBurnActionController({
      plan: { blockedReason: 'none', shouldRenderBurnButton: true },
      ports: { dispatchBurn: () => { throw error; } },
    })).toThrow(error);
  });

  it('does not dispatch hidden, blocked, disabled, or unhandled mini mint actions', () => {
    const dispatchMiniMint = jest.fn();

    expect(runSbtPageMiniMintActionController({
      plan: {
        blockedReason: 'mini-mint-unavailable',
        handlerKind: 'mini-mint',
        shouldRenderMintArea: false,
      },
      ports: { dispatchMiniMint },
    })).toEqual({
      blockedReason: 'mini-mint-unavailable',
      status: 'hidden',
    });
    expect(runSbtPageMiniMintActionController({
      plan: {
        blockedReason: 'already-has-token',
        handlerKind: 'mini-mint',
        shouldRenderMintArea: true,
      },
      ports: { dispatchMiniMint },
    })).toEqual({
      blockedReason: 'already-has-token',
      status: 'blocked',
    });
    expect(runSbtPageMiniMintActionController({
      plan: {
        blockedReason: 'none',
        disabled: true,
        handlerKind: 'mini-mint',
        shouldRenderMintArea: true,
      },
      ports: { dispatchMiniMint },
    })).toEqual({
      blockedReason: 'none',
      status: 'disabled',
    });
    expect(runSbtPageMiniMintActionController({
      plan: {
        blockedReason: 'none',
        handlerKind: 'mini-mint',
        shouldRenderMintArea: true,
      },
      ports: {},
    })).toEqual({
      blockedReason: 'none',
      status: 'unhandled',
    });
    expect(runSbtPageMiniMintActionController({
      plan: {
        blockedReason: 'none',
        handlerKind: 'none',
        shouldRenderMintArea: true,
      },
      ports: { dispatchMiniMint },
    })).toEqual({
      blockedReason: 'none',
      status: 'unhandled',
    });
    expect(dispatchMiniMint).not.toHaveBeenCalled();
  });

  it('dispatches mini mint handler kinds through the matching fake ports', () => {
    const dispatchShowPasswordInput = jest.fn() satisfies SbtPageMiniMintActionControllerPorts<
      [],
      [],
      [],
      [boolean]
    >['dispatchShowPasswordInput'];
    const dispatchGroupPasswordMint = jest.fn() satisfies SbtPageMiniMintActionControllerPorts<
      [],
      [{ forceRefresh: boolean }]
    >['dispatchGroupPasswordMint'];
    const dispatchInviteCodeMint = jest.fn() satisfies SbtPageMiniMintActionControllerPorts<
      [],
      [],
      [string]
    >['dispatchInviteCodeMint'];
    const dispatchMiniMint = jest.fn() satisfies SbtPageMiniMintActionControllerPorts<
      [true],
      [],
      []
    >['dispatchMiniMint'];
    const event = { preventDefault: jest.fn() };

    expect(runSbtPageMiniMintActionController({
      event,
      plan: {
        blockedReason: 'none',
        handlerKind: 'show-password-input',
        shouldRenderMintArea: true,
      },
      ports: { dispatchShowPasswordInput },
      showPasswordInputArgs: [true],
    }).status).toBe('dispatched');
    expect(runSbtPageMiniMintActionController({
      groupPasswordMintArgs: [{ forceRefresh: true }],
      plan: {
        blockedReason: 'none',
        handlerKind: 'mint-unlimited-with-group-password',
        shouldRenderMintArea: true,
      },
      ports: { dispatchGroupPasswordMint },
    }).status).toBe('dispatched');
    expect(runSbtPageMiniMintActionController({
      inviteCodeMintArgs: ['invite-code'],
      plan: {
        blockedReason: 'none',
        handlerKind: 'claim-with-invite-code',
        shouldRenderMintArea: true,
      },
      ports: { dispatchInviteCodeMint },
    }).status).toBe('dispatched');
    expect(runSbtPageMiniMintActionController({
      miniMintArgs: [true],
      plan: {
        blockedReason: 'none',
        handlerKind: 'mini-mint',
        shouldRenderMintArea: true,
      },
      ports: { dispatchMiniMint },
    }).status).toBe('dispatched');

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(dispatchShowPasswordInput).toHaveBeenCalledWith(true);
    expect(dispatchGroupPasswordMint).toHaveBeenCalledWith({ forceRefresh: true });
    expect(dispatchInviteCodeMint).toHaveBeenCalledWith('invite-code');
    expect(dispatchMiniMint).toHaveBeenCalledWith(true);
  });

  it('does not dispatch hidden, blocked, disabled, or unhandled mini burn actions', () => {
    const dispatchMiniBurn = jest.fn();

    expect(runSbtPageMiniBurnActionController({
      plan: { blockedReason: 'missing-token', shouldRenderMiniBurnButton: false },
      ports: { dispatchMiniBurn },
    })).toEqual({
      blockedReason: 'missing-token',
      status: 'hidden',
    });
    expect(runSbtPageMiniBurnActionController({
      plan: { blockedReason: 'owner-burn-disabled', shouldRenderMiniBurnButton: true },
      ports: { dispatchMiniBurn },
    })).toEqual({
      blockedReason: 'owner-burn-disabled',
      status: 'blocked',
    });
    expect(runSbtPageMiniBurnActionController({
      disabled: true,
      plan: { blockedReason: 'none', shouldRenderMiniBurnButton: true },
      ports: { dispatchMiniBurn },
    })).toEqual({
      blockedReason: 'none',
      status: 'disabled',
    });
    expect(runSbtPageMiniBurnActionController({
      plan: { blockedReason: 'none', shouldRenderMiniBurnButton: true },
      ports: {},
    })).toEqual({
      blockedReason: 'none',
      status: 'unhandled',
    });
    expect(dispatchMiniBurn).not.toHaveBeenCalled();
  });

  it('calls the mini burn port without args and propagates errors', () => {
    const dispatchMiniBurn = jest.fn() satisfies SbtPageMiniBurnActionControllerPorts['dispatchMiniBurn'];
    const event = { preventDefault: jest.fn() };

    expect(runSbtPageMiniBurnActionController({
      event,
      plan: { blockedReason: 'none', shouldRenderMiniBurnButton: true },
      ports: { dispatchMiniBurn },
    })).toEqual({
      blockedReason: 'none',
      status: 'dispatched',
    });

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(dispatchMiniBurn).toHaveBeenCalledTimes(1);
    expect(dispatchMiniBurn).toHaveBeenCalledWith();

    const error = new Error('mini burn failed');
    expect(() => runSbtPageMiniBurnActionController({
      plan: { blockedReason: 'none', shouldRenderMiniBurnButton: true },
      ports: { dispatchMiniBurn: () => { throw error; } },
    })).toThrow(error);
  });
});
