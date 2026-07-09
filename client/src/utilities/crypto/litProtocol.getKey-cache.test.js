import { __test__wrapLitGetKeyWithCache } from './litProtocol.js';

const ADDR_A = '0x00000000000000000000000000000000000000aa';
const ADDR_B = '0x00000000000000000000000000000000000000bb';

const BASE_OPTS = Object.freeze({
  litNetwork: 'naga-dev',
  chain: 'baseSepolia',
  accessControlConditions: [
    {
      contractAddress: '0x0000000000000000000000000000000000000101',
      standardContractType: 'ERC721',
      chain: 'baseSepolia',
      method: 'balanceOf',
      parameters: [':userAddress'],
      returnValueTest: { comparator: '>', value: '0' },
    },
  ],
  resourceId: { baseUrl: 'context-engine', path: '/question/1' },
  ciphertext: 'ciphertext-1',
  dataToEncryptHash: 'hash-1',
});

describe('litProtocol getKey memoization', () => {
  it('caches successful getKey calls for the same requester + resource', async () => {
    const cek = new Uint8Array(32).fill(7);
    const getKeyUncached = jest.fn(async () => cek);
    const { getKey } = __test__wrapLitGetKeyWithCache(getKeyUncached, {
      account: ADDR_A,
      litNetwork: BASE_OPTS.litNetwork,
      chain: BASE_OPTS.chain,
      accessControlConditions: BASE_OPTS.accessControlConditions,
    });

    const r1 = await getKey({ ...BASE_OPTS, requesterAddress: ADDR_A });
    const r2 = await getKey({ ...BASE_OPTS, requesterAddress: ADDR_A });

    expect(getKeyUncached).toHaveBeenCalledTimes(1);
    expect(r1).toBe(cek);
    expect(r2).toBe(cek);
  });

  it('does not share cache entries across requester addresses', async () => {
    const cekA = new Uint8Array(32).fill(1);
    const cekB = new Uint8Array(32).fill(2);
    const getKeyUncached = jest.fn(async ({ requesterAddress }) =>
      String(requesterAddress).toLowerCase() === ADDR_A ? cekA : cekB,
    );
    const { getKey } = __test__wrapLitGetKeyWithCache(getKeyUncached, {
      litNetwork: BASE_OPTS.litNetwork,
      chain: BASE_OPTS.chain,
      accessControlConditions: BASE_OPTS.accessControlConditions,
    });

    const r1 = await getKey({ ...BASE_OPTS, requesterAddress: ADDR_A });
    const r2 = await getKey({ ...BASE_OPTS, requesterAddress: ADDR_B });

    expect(getKeyUncached).toHaveBeenCalledTimes(2);
    expect(r1).toBe(cekA);
    expect(r2).toBe(cekB);
  });

  it('starts the success-cache ttl after the uncached call settles', async () => {
    const realNow = Date.now;
    const cek = new Uint8Array(32).fill(9);
    let t = 1000;
    // eslint-disable-next-line no-global-assign
    Date.now = () => t;
    try {
      const getKeyUncached = jest.fn(async () => {
        t = 591000;
        return cek;
      });
      const { getKey } = __test__wrapLitGetKeyWithCache(getKeyUncached, {
        account: ADDR_A,
        litNetwork: BASE_OPTS.litNetwork,
        chain: BASE_OPTS.chain,
        accessControlConditions: BASE_OPTS.accessControlConditions,
      });

      await expect(getKey({ ...BASE_OPTS, requesterAddress: ADDR_A })).resolves.toBe(cek);
      expect(getKeyUncached).toHaveBeenCalledTimes(1);

      // The old pre-await expiry would have been 601000. This should still hit because
      // the cached value settled at 591000 and expires around 1191000.
      t = 602000;
      await expect(getKey({ ...BASE_OPTS, requesterAddress: ADDR_A })).resolves.toBe(cek);
      expect(getKeyUncached).toHaveBeenCalledTimes(1);
    } finally {
      // eslint-disable-next-line no-global-assign
      Date.now = realNow;
    }
  });

  it('negative-caches transient failures briefly to avoid hammering Lit', async () => {
    const realNow = Date.now;
    let t = 1000;
    // eslint-disable-next-line no-global-assign
    Date.now = () => t;
    try {
      const getKeyUncached = jest.fn(async () => {
        throw new Error('network timeout');
      });
      const { getKey } = __test__wrapLitGetKeyWithCache(getKeyUncached, {
        account: ADDR_A,
        litNetwork: BASE_OPTS.litNetwork,
        chain: BASE_OPTS.chain,
        accessControlConditions: BASE_OPTS.accessControlConditions,
      });

      await expect(getKey({ ...BASE_OPTS, requesterAddress: ADDR_A })).rejects.toThrow(/timeout/i);
      expect(getKeyUncached).toHaveBeenCalledTimes(1);

      t = 6000;
      await expect(getKey({ ...BASE_OPTS, requesterAddress: ADDR_A })).rejects.toThrow(/timeout/i);
      expect(getKeyUncached).toHaveBeenCalledTimes(1);

      // After transient neg-cache TTL (~10s), try again.
      t = 12001;
      await expect(getKey({ ...BASE_OPTS, requesterAddress: ADDR_A })).rejects.toThrow(/timeout/i);
      expect(getKeyUncached).toHaveBeenCalledTimes(2);
    } finally {
      // eslint-disable-next-line no-global-assign
      Date.now = realNow;
    }
  });

  it('uses a very short negative-cache for access control failures', async () => {
    const realNow = Date.now;
    let t = 1000;
    // eslint-disable-next-line no-global-assign
    Date.now = () => t;
    try {
      const getKeyUncached = jest.fn(async () => {
        throw new Error('access control conditions not satisfied');
      });
      const { getKey } = __test__wrapLitGetKeyWithCache(getKeyUncached, {
        account: ADDR_A,
        litNetwork: BASE_OPTS.litNetwork,
        chain: BASE_OPTS.chain,
        accessControlConditions: BASE_OPTS.accessControlConditions,
      });

      await expect(getKey({ ...BASE_OPTS, requesterAddress: ADDR_A })).rejects.toThrow(/access control/i);
      expect(getKeyUncached).toHaveBeenCalledTimes(1);

      t = 1200;
      await expect(getKey({ ...BASE_OPTS, requesterAddress: ADDR_A })).rejects.toThrow(/access control/i);
      expect(getKeyUncached).toHaveBeenCalledTimes(1);

      // After ACC neg-cache TTL (~500ms), the underlying call should be attempted again.
      t = 1601;
      await expect(getKey({ ...BASE_OPTS, requesterAddress: ADDR_A })).rejects.toThrow(/access control/i);
      expect(getKeyUncached).toHaveBeenCalledTimes(2);
    } finally {
      // eslint-disable-next-line no-global-assign
      Date.now = realNow;
    }
  });
});
