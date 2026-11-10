import { ethers } from 'ethers';
import { createInMemorySoftSessionClient, type SoftSessionClient } from './sessionWorkerClient';
import { createSoftSessionPolicy } from './sessionPolicy';

const PRIVATE_KEY = `0x${'31'.repeat(32)}` as const;
const ADDRESS = new ethers.Wallet(PRIVATE_KEY).address as `0x${string}`;
const CHAIN_ID = 11155420;
const HASH = `0x${'ab'.repeat(32)}`;
let savedHandler: typeof self.onmessage;
let sequence = 0;

beforeAll(() => {
  savedHandler = self.onmessage;
  require('./sessionWorker');
});
afterAll(() => {
  self.onmessage = savedHandler;
});

const workerClient = (): SoftSessionClient => {
  const call = (payload: Record<string, unknown>): Promise<unknown> =>
    new Promise((resolve, reject) => {
      const id = `fixture-${sequence++}`;
      const spy = jest.spyOn(self, 'postMessage').mockImplementation((message: unknown) => {
        const reply = message as { id: string; ok: boolean; result?: unknown; error?: string };
        if (reply.id !== id) return;
        spy.mockRestore();
        if (reply.ok) resolve(reply.result);
        else reject(new Error(reply.error));
      });
      self.onmessage?.(new MessageEvent('message', { data: { ...payload, id } }));
    });
  return {
    init: async (options) => ((await call({ type: 'init', ...options })) as { address: string }).address,
    request: (args) => call({ type: 'request', ...args }),
    lock: async () => {
      await call({ type: 'lock' });
    },
  };
};

const invalidQuantities: unknown[] = [
  [1, 0],
  Uint8Array.of(1, 0),
  { _hex: '0x0100', _isBigNumber: true },
  { type: 'BigNumber', hex: '0x0100' },
  {},
  null,
  -1,
  -1n,
  ethers.BigNumber.from(-1),
  0.5,
  Number.MAX_SAFE_INTEGER + 1,
  NaN,
  Infinity,
  '',
  ' ',
  '-1',
  '1.5',
  true,
];
const quantityFields = [
  'value',
  'gas',
  'gasLimit',
  'gasPrice',
  'maxFeePerGas',
  'maxPriorityFeePerGas',
  'nonce',
  'chainId',
  'type',
];

for (const runtime of ['memory', 'worker'] as const)
  describe(`${runtime} transaction quantities`, () => {
    let client: SoftSessionClient;
    let send: jest.SpyInstance<
      ReturnType<typeof ethers.Wallet.prototype.sendTransaction>,
      Parameters<typeof ethers.Wallet.prototype.sendTransaction>
    >;
    let sign: jest.SpyInstance<
      ReturnType<typeof ethers.Wallet.prototype.signTransaction>,
      Parameters<typeof ethers.Wallet.prototype.signTransaction>
    >;
    beforeEach(async () => {
      send = jest
        .spyOn(ethers.Wallet.prototype, 'sendTransaction')
        .mockResolvedValue({ hash: HASH } as ethers.providers.TransactionResponse);
      sign = jest.spyOn(ethers.Wallet.prototype, 'signTransaction').mockResolvedValue('0x1234');
      client = runtime === 'memory' ? createInMemorySoftSessionClient() : workerClient();
      await client.init({
        privateKey: PRIVATE_KEY,
        rpcUrl: 'http://127.0.0.1:1',
        chainId: CHAIN_ID,
        policy: createSoftSessionPolicy({
          address: ADDRESS,
          ttlSeconds: 60,
          allowedChainIds: [CHAIN_ID],
          allowedMethods: ['eth_sendTransaction', 'eth_signTransaction'],
          maxTransactionValueWei: '0',
        }),
      });
    });
    afterEach(async () => {
      await client.lock();
      jest.restoreAllMocks();
    });

    for (const method of ['eth_sendTransaction', 'eth_signTransaction']) {
      it.each(quantityFields)(`${method} rejects invalid %s before signing`, async (field) => {
        for (const value of invalidQuantities) {
          await expect(client.request({ method, params: [{ to: ADDRESS, [field]: value }] })).rejects.toThrow(
            `Invalid transaction ${field}.`,
          );
          expect(send).not.toHaveBeenCalled();
          expect(sign).not.toHaveBeenCalled();
        }
      });
      it(`${method} allows only zero or omitted value under the zero-value policy`, async () => {
        for (const value of [0, '0x0', undefined, 0n, ethers.BigNumber.from(0)]) {
          await expect(client.request({ method, params: [{ to: ADDRESS, value }] })).resolves.toBe(
            method === 'eth_sendTransaction' ? HASH : '0x1234',
          );
          const passed = (method === 'eth_sendTransaction' ? send : sign).mock.calls.at(
            -1,
          )?.[0] as ethers.providers.TransactionRequest;
          expect(ethers.BigNumber.from(passed.value ?? 0).isZero()).toBe(true);
        }
        for (const value of ['256', '0x100', ethers.BigNumber.from(256)]) {
          await expect(client.request({ method, params: [{ to: ADDRESS, value }] })).rejects.toThrow(/Value-bearing/);
        }
      });
      it(`${method} accepts the largest safe integer without rounding`, async () => {
        await client.request({ method, params: [{ to: ADDRESS, gasLimit: Number.MAX_SAFE_INTEGER }] });
        const passed = (method === 'eth_sendTransaction' ? send : sign).mock.calls[0][0];
        expect(passed.gasLimit).toBe('0x1fffffffffffff');
      });
      it(`${method} normalizes every quantity and the gas alias before checking and signing`, async () => {
        await client.request({
          method,
          params: [
            {
              from: ADDRESS,
              to: ADDRESS,
              data: '0x',
              value: '00',
              gas: 21000,
              gasPrice: '1',
              nonce: 0n,
              chainId: '0xaa37dc',
              type: ethers.BigNumber.from(0),
            },
          ],
        });
        const passed = (method === 'eth_sendTransaction' ? send : sign).mock.calls[0][0];
        expect(passed).toMatchObject({
          from: ADDRESS,
          to: ADDRESS,
          data: '0x',
          value: '0x0',
          gasLimit: '0x5208',
          gasPrice: '0x1',
          nonce: '0x0',
          chainId: CHAIN_ID,
          type: 0,
        });
        expect(passed).not.toHaveProperty('gas');
        await expect(client.request({ method, params: [{ to: ADDRESS, gas: 21000, gasLimit: [] }] })).rejects.toThrow(
          'Invalid transaction gasLimit.',
        );
      });
    }

    it('still sends through ethers Web3Provider with provider-normalized hex quantities', async () => {
      const forwarded: Array<{ method: string; params: unknown[] }> = [];
      const provider = new ethers.providers.Web3Provider(
        {
          request: async ({ method, params = [] }) => {
            forwarded.push({ method, params });
            return client.request({ method, params });
          },
        },
        CHAIN_ID,
      );
      const result = await provider.getSigner(ADDRESS).sendUncheckedTransaction({
        to: ADDRESS,
        value: ethers.BigNumber.from(0),
        gasLimit: 21000,
        gasPrice: 1,
        nonce: 0,
      });
      expect(result).toBe(HASH);
      expect(forwarded.find(({ method }) => method === 'eth_sendTransaction')?.params[0]).toMatchObject({
        value: '0x0',
        gas: '0x5208',
        gasPrice: '0x1',
        nonce: '0x0',
      });
      expect(send).toHaveBeenCalledTimes(1);
    });
  });
