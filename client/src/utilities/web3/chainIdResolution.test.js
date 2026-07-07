import { DEFAULT_CHAIN_ID, extractChainId, extractChainIdOrUndefined } from './chainIdResolution.js';

describe('chainIdResolution', () => {
  it('uses networkChainId first when no contract preference is provided', () => {
    expect(
      extractChainId({
        networkChainId: 84532,
        contracts: {
          sbtFactory: { chainId: 8453 },
          surveys: { chainId: 11155420 },
        },
      }),
    ).toBe(84532);
  });

  it('prefers cfg.contracts.sbtFactory.chainId for sbtFactory reads', () => {
    expect(
      extractChainId(
        {
          networkChainId: 84532,
          contracts: {
            sbtFactory: { chainId: 8453 },
            surveys: { chainId: 11155420 },
          },
        },
        { contractKey: 'sbtFactory' },
      ),
    ).toBe(8453);
  });

  it('prefers cfg.contracts.surveys.chainId for surveys reads', () => {
    expect(
      extractChainId(
        {
          networkChainId: 84532,
          contracts: {
            sbtFactory: { chainId: 8453 },
            surveys: { chainId: 11155420 },
          },
        },
        { contractKey: 'surveys' },
      ),
    ).toBe(11155420);
  });

  it('falls back through __registry.chainId and then DEFAULT_CHAIN_ID', () => {
    expect(
      extractChainId({
        __registry: { chainId: 8453 },
      }),
    ).toBe(8453);

    expect(
      extractChainId({
        __registry: { chainId: 0 },
      }),
    ).toBe(DEFAULT_CHAIN_ID);
  });

  it('returns 0 in strict mode when only __registry.chainId or DEFAULT_CHAIN_ID would resolve the chain', () => {
    expect(
      extractChainId(
        {
          __registry: { chainId: 8453 },
        },
        { strict: true },
      ),
    ).toBe(0);
  });

  it('still honors contractKey precedence in strict mode', () => {
    expect(
      extractChainId(
        {
          contracts: {
            sbtFactory: { chainId: 1 },
            surveys: { chainId: 2 },
          },
        },
        { contractKey: 'sbtFactory', strict: true },
      ),
    ).toBe(1);

    expect(
      extractChainId(
        {
          contracts: {
            sbtFactory: { chainId: 1 },
            surveys: { chainId: 2 },
          },
        },
        { contractKey: 'surveys', strict: true },
      ),
    ).toBe(2);
  });

  it('preserves contract-key strict chain resolution for contract helper survey reads', () => {
    expect(
      extractChainId(
        {
          networkChainId: 10,
          contracts: {
            surveys: { chainId: 11 },
            sbtFactory: { chainId: 12 },
          },
        },
        { contractKey: 'surveys', strict: true },
      ),
    ).toBe(11);

    expect(extractChainId({}, { contractKey: 'surveys', strict: true })).toBe(0);

    expect(
      extractChainId(
        {
          networkChainId: 0,
          contracts: {
            surveys: { chainId: 84532 },
          },
        },
        { contractKey: 'surveys', strict: true },
      ),
    ).toBe(84532);
  });

  it('preserves generic strict chain resolution without registry or default fallback', () => {
    expect(
      extractChainId(
        {
          networkChainId: 0,
          contracts: {
            surveys: { chainId: 84532 },
          },
        },
        { strict: true },
      ),
    ).toBe(84532);

    expect(extractChainId({}, { strict: true })).toBe(0);

    expect(
      extractChainId(
        {
          __registry: { chainId: 8453 },
        },
        { strict: true },
      ),
    ).toBe(0);
  });

  it('preserves strict chain resolution nulling for session config resolver reads', () => {
    expect(extractChainId({}, { strict: true }) || null).toBeNull();
    expect(
      extractChainId(
        {
          networkChainId: 5,
        },
        { strict: true },
      ) || null,
    ).toBe(5);
  });

  it('keeps non-strict fallback behavior and returns __registry.chainId when contract fields are empty', () => {
    expect(
      extractChainId({
        __registry: { chainId: 8453 },
      }),
    ).toBe(8453);
  });

  it('uses sbtFactory-first precedence when contractKey is sbtFactory on mixed-chain configs', () => {
    const cfg = {
      contracts: {
        sbtFactory: { chainId: 1 },
        surveys: { chainId: 2 },
      },
    };

    expect(extractChainId(cfg)).toBe(2);
    expect(extractChainId(cfg, { contractKey: 'sbtFactory' })).toBe(1);
  });

  it('uses surveys-first precedence when contractKey is surveys on mixed-chain configs', () => {
    const cfg = {
      networkChainId: 3,
      contracts: {
        sbtFactory: { chainId: 1 },
        surveys: { chainId: 2 },
      },
    };

    expect(extractChainId(cfg)).toBe(3);
    expect(extractChainId(cfg, { contractKey: 'surveys' })).toBe(2);
  });

  it('returns undefined instead of 0 when extractChainIdOrUndefined has no usable candidate', () => {
    expect(extractChainIdOrUndefined({})).toBeUndefined();
    expect(extractChainIdOrUndefined(null)).toBeUndefined();
  });

  it('skips invalid, negative, and non-finite candidates', () => {
    expect(
      extractChainId({
        networkChainId: -1,
        contracts: {
          surveys: { chainId: Infinity },
          sbtFactory: { chainId: '8453.9' },
        },
        __registry: { chainId: NaN },
      }),
    ).toBe(8453);

    expect(
      extractChainIdOrUndefined({
        networkChainId: -1,
        contracts: {
          surveys: { chainId: Infinity },
          sbtFactory: { chainId: Number.NaN },
        },
        __registry: { chainId: 0 },
      }),
    ).toBeUndefined();
  });
});
