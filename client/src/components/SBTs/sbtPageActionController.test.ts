import {
  runSbtPageBurnActionController,
  runSbtPageMintActionController,
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
    const dispatchMint = jest.fn();
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

  it('calls the burn port when enabled', () => {
    const dispatchBurn = jest.fn();
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
});
