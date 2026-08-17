const mockFetchWorkerWithAuth = jest.fn();
const mockUploadDataToArweave = jest.fn();
const mockDownloadDataFromArweave = jest.fn();
const { webcrypto } = require('crypto');
const { ethers } = require('ethers');
const { buildLitChipotlePolicy, fingerprintLitChipotlePolicy } = require('./litChipotlePolicy.js');

const TEST_ACTION_CID = 'QmAction123';
const TEST_PKP_ID = '0xpkp123';
const TEST_GATE_ADDRESS = '0x29563ff3aCC8AFb220D810F8022218095e25C1f6';

const makePolicy = ({
  chainId = 11155420,
  gateMode = 'any',
  sbtAddresses = [TEST_GATE_ADDRESS],
  litActionCid = TEST_ACTION_CID,
  litPkpId = TEST_PKP_ID,
} = {}) =>
  buildLitChipotlePolicy({
    chainId,
    gateMode,
    sbtAddresses,
    litActionCid,
    litPkpId,
  });

jest.mock('../worker/workerAuth.js', () => ({
  fetchWorkerWithAuth: (...args) => mockFetchWorkerWithAuth(...args),
  buildSignedBootstrapAdminAuth: jest.fn(),
  normalizeWorkerUrl: (value) => {
    const raw = typeof value === 'string' ? value.trim() : '';
    return raw.replace(/\/+$/, '');
  },
}));

jest.mock('../arweave/arweaveClient.js', () => ({
  arweaveClient: {
    uploadDataToArweave: (...args) => mockUploadDataToArweave(...args),
    downloadDataFromArweave: (...args) => mockDownloadDataFromArweave(...args),
    buildArweaveGatewayUrl: (txId) => `https://arweave.example.test/${txId}`,
  },
}));

describe('litProtocol Chipotle hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    if (typeof window !== 'undefined' && !window.crypto) {
      Object.defineProperty(window, 'crypto', {
        configurable: true,
        value: webcrypto,
      });
    }
  });

  it('extracts SBT gate details from ACCs', () => {
    const { __test__extractSbtGateFromAccessControlConditions: extractGate } = require('./litProtocol.js');

    const result = extractGate([
      {
        contractAddress: '0x00000000000000000000000000000000000000aa',
        standardContractType: 'ERC721',
        chain: 'optimismSepolia',
        method: 'balanceOf',
        parameters: [':userAddress'],
        returnValueTest: { comparator: '>', value: '0' },
      },
      { operator: 'and' },
      {
        contractAddress: '0x00000000000000000000000000000000000000bb',
        standardContractType: 'ERC721',
        chain: 'optimismSepolia',
        method: 'balanceOf',
        parameters: [':userAddress'],
        returnValueTest: { comparator: '>', value: '0' },
      },
    ]);

    expect(result.gateMode).toBe('all');
    expect(result.litChain).toBe('optimismSepolia');
    expect(result.chainId).toBe(11155420);
    expect(result.sbtAddresses.map((value) => value.toLowerCase())).toEqual([
      '0x00000000000000000000000000000000000000aa',
      '0x00000000000000000000000000000000000000bb',
    ]);
  });

  it('uses worker-mediated Chipotle hooks to wrap and unwrap a CEK', async () => {
    const { createLitHooks } = require('./litProtocol.js');

    mockFetchWorkerWithAuth.mockImplementation(async (_url, options) => {
      const body = JSON.parse(options.body);
      if (body.op === 'encrypt') {
        const policy = makePolicy({
          chainId: body.chainId,
          gateMode: body.gateMode,
          sbtAddresses: body.sbtAddresses,
        });
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            response: {
              response: {
                ok: true,
                ciphertext: 'wrapped-cek',
                policy,
                policyFingerprint: fingerprintLitChipotlePolicy(policy),
              },
            },
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          response: {
            response: {
              ok: true,
              plaintext: body.ciphertext === 'wrapped-cek' ? '0x' + '11'.repeat(32) : '',
            },
          },
        }),
      };
    });

    const accessControlConditions = [
      {
        contractAddress: '0x29563ff3aCC8AFb220D810F8022218095e25C1f6',
        standardContractType: 'ERC721',
        chain: 'optimismSepolia',
        method: 'balanceOf',
        parameters: [':userAddress'],
        returnValueTest: { comparator: '>', value: '0' },
      },
    ];

    const hooks = createLitHooks({
      providerLike: 'wagmi',
      account: '0x00000000000000000000000000000000000000aa',
      chainId: 11155420,
      accessControlConditions,
      chipotle: {
        workerUrl: 'https://worker.example.test',
        sessionSlug: 'session-a',
        sessionConfig: {
          slug: 'session-a',
          corsWorkerUrl: 'https://worker.example.test',
          litCredentials: {
            litApiBase: 'https://api.chipotle.litprotocol.com',
            litActionCid: TEST_ACTION_CID,
            litGroupId: '7',
            litPkpId: TEST_PKP_ID,
          },
        },
        litCredentials: {
          litApiBase: 'https://api.chipotle.litprotocol.com',
          litActionCid: TEST_ACTION_CID,
          litGroupId: '7',
          litPkpId: TEST_PKP_ID,
        },
      },
    });

    const keyBytes = new Uint8Array(32).fill(0x11);
    const wrapped = await hooks.saveKey(keyBytes, { accessControlConditions });
    expect(mockFetchWorkerWithAuth.mock.calls[0][0]).toBe('https://worker.example.test/lit/chipotle-action');
    expect(wrapped).toEqual(
      expect.objectContaining({
        ciphertext: 'wrapped-cek',
      }),
    );
    expect(wrapped.chipotle).toEqual(
      expect.objectContaining({
        version: 2,
        chainId: 11155420,
        gateMode: 'any',
        litActionCid: TEST_ACTION_CID,
        litPkpId: TEST_PKP_ID,
        policyFingerprint: fingerprintLitChipotlePolicy(makePolicy()),
        policy: makePolicy(),
        sbtAddresses: [TEST_GATE_ADDRESS.toLowerCase()],
      }),
    );
    expect(wrapped.chipotle.rpcUrl).toBeUndefined();

    const unwrapped = await hooks.getKey({
      accessControlConditions,
      ciphertext: wrapped.ciphertext,
      chipotle: wrapped.chipotle,
    });
    expect(Array.from(unwrapped)).toEqual(Array.from(keyBytes));
    expect(mockFetchWorkerWithAuth).toHaveBeenCalledTimes(2);
    expect(JSON.parse(mockFetchWorkerWithAuth.mock.calls[0][1].body)).toEqual(
      expect.objectContaining({
        action: 'lit_chipotle_execute',
        op: 'encrypt',
        sbtAddresses: [TEST_GATE_ADDRESS],
        gateMode: 'any',
        message: '0x' + '11'.repeat(32),
      }),
    );
    expect(JSON.parse(mockFetchWorkerWithAuth.mock.calls[0][1].body).rpcUrl).toBeUndefined();
  });

  it('initializes worker-mediated Chipotle hooks when Lit credentials stay server-side', async () => {
    const { createLitHooks } = require('./litProtocol.js');

    mockFetchWorkerWithAuth.mockImplementation(async (_url, options) => {
      const body = JSON.parse(options.body);
      expect(body.op).toBe('encrypt');
      const policy = makePolicy({
        chainId: body.chainId,
        gateMode: body.gateMode,
        sbtAddresses: body.sbtAddresses,
      });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          response: {
            response: {
              ok: true,
              ciphertext: 'wrapped-server-side-runtime-cek',
              policy,
              policyFingerprint: fingerprintLitChipotlePolicy(policy),
            },
          },
        }),
      };
    });

    const accessControlConditions = [
      {
        contractAddress: '0x29563ff3aCC8AFb220D810F8022218095e25C1f6',
        standardContractType: 'ERC721',
        chain: 'optimismSepolia',
        method: 'balanceOf',
        parameters: [':userAddress'],
        returnValueTest: { comparator: '>', value: '0' },
      },
    ];

    const hooks = createLitHooks({
      providerLike: 'wagmi',
      account: '0x00000000000000000000000000000000000000aa',
      chainId: 11155420,
      accessControlConditions,
      chipotle: {
        workerUrl: 'https://worker.example.test',
        sessionSlug: 'session-a',
        sessionConfig: {
          slug: 'session-a',
          corsWorkerUrl: 'https://worker.example.test',
        },
      },
    });

    expect(hooks).toEqual(
      expect.objectContaining({
        litNetwork: 'chipotle',
        saveKey: expect.any(Function),
      }),
    );

    const wrapped = await hooks.saveKey(new Uint8Array(32).fill(0x22), { accessControlConditions });
    expect(mockFetchWorkerWithAuth.mock.calls[0][0]).toBe('https://worker.example.test/lit/chipotle-action');
    expect(wrapped).toEqual(
      expect.objectContaining({
        ciphertext: 'wrapped-server-side-runtime-cek',
        dataToEncryptHash: expect.stringContaining('chipotle-v3:QmAction123:11155420:any:'),
        chipotle: expect.objectContaining({
          version: 2,
          litActionCid: TEST_ACTION_CID,
          litPkpId: TEST_PKP_ID,
          chainId: 11155420,
          gateMode: 'any',
          policyFingerprint: fingerprintLitChipotlePolicy(makePolicy()),
          policy: makePolicy(),
        }),
      }),
    );
    expect(mockFetchWorkerWithAuth).toHaveBeenCalledTimes(1);
  });

  it('round-trips encrypted document payloads through the Chipotle hooks used by lit-arweave docs', async () => {
    const stored = { envelope: '' };
    const chipotleState = { ciphertext: '', plaintext: '' };
    const makeProvider = (signer) => ({
      request: async ({ method, params }) => {
        if (method === 'eth_accounts' || method === 'eth_requestAccounts') {
          return [signer.address];
        }
        if (method === 'eth_chainId') {
          return '0xaa37dc';
        }
        if (method === 'eth_signTypedData_v4') {
          const [, payload] = Array.isArray(params) ? params : [];
          const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload || {};
          const { domain = {}, message = {} } = parsed;
          const types = { ...(parsed.types || {}) };
          delete types.EIP712Domain;
          return signer._signTypedData(domain, types, message);
        }
        throw new Error(`Unsupported provider request in test: ${method}`);
      },
    });
    const uploaderSigner = new ethers.Wallet('0x59c6995e998f97a5a0044976f4d4d4f498a8e09d5405cb918f0a95c31a01d10b');
    const viewerSigner = new ethers.Wallet('0x8b3a350cf5c34c9194ca85829f4140c8828f4f53f7e55b6d7a5a1f9d0b5b8f37');
    const uploaderProvider = makeProvider(uploaderSigner);
    const viewerProvider = makeProvider(viewerSigner);
    const {
      createLitHooks,
      decodeLitPayloadToText,
      downloadEncryptedArweaveData,
      uploadEncryptedArweaveData,
    } = require('./litProtocol.js');

    mockFetchWorkerWithAuth.mockImplementation(async (_url, options) => {
      const body = JSON.parse(options.body);
      if (body.op === 'encrypt') {
        const policy = makePolicy({
          chainId: body.chainId,
          gateMode: body.gateMode,
          sbtAddresses: body.sbtAddresses,
        });
        chipotleState.ciphertext = 'wrapped-doc-cek';
        chipotleState.plaintext = body.message;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            response: {
              response: {
                ok: true,
                ciphertext: chipotleState.ciphertext,
                policy,
                policyFingerprint: fingerprintLitChipotlePolicy(policy),
              },
            },
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          response: {
            response: {
              ok: true,
              plaintext: body.ciphertext === chipotleState.ciphertext ? chipotleState.plaintext : '',
            },
          },
        }),
      };
    });

    mockUploadDataToArweave.mockImplementation(async (envelope) => {
      stored.envelope = envelope;
      return 'A'.repeat(43);
    });
    mockDownloadDataFromArweave.mockImplementation(async () => stored.envelope);

    const accessControlConditions = [
      {
        contractAddress: '0x29563ff3aCC8AFb220D810F8022218095e25C1f6',
        standardContractType: 'ERC721',
        chain: 'optimismSepolia',
        method: 'balanceOf',
        parameters: [':userAddress'],
        returnValueTest: { comparator: '>', value: '0' },
      },
    ];

    const uploaderHooks = createLitHooks({
      providerLike: uploaderProvider,
      account: uploaderSigner.address,
      chainId: 11155420,
      accessControlConditions,
      chipotle: {
        workerUrl: 'https://worker.example.test',
        sessionSlug: 'session-docs',
        sessionConfig: {
          slug: 'session-docs',
          corsWorkerUrl: 'https://worker.example.test',
          litCredentials: {
            litApiBase: 'https://api.chipotle.litprotocol.com',
            litActionCid: 'QmAction123',
            litGroupId: '7',
            litPkpId: '0xpkp123',
          },
        },
        litCredentials: {
          litApiBase: 'https://api.chipotle.litprotocol.com',
          litActionCid: 'QmAction123',
          litGroupId: '7',
          litPkpId: '0xpkp123',
        },
      },
    });
    const viewerHooks = createLitHooks({
      providerLike: viewerProvider,
      account: viewerSigner.address,
      chainId: 11155420,
      accessControlConditions,
      chipotle: {
        workerUrl: 'https://worker.example.test',
        sessionSlug: 'session-docs',
        sessionConfig: {
          slug: 'session-docs',
          corsWorkerUrl: 'https://worker.example.test',
          litCredentials: {
            litApiBase: 'https://api.chipotle.litprotocol.com',
            litActionCid: 'QmAction123',
            litGroupId: '7',
            litPkpId: '0xpkp123',
          },
        },
        litCredentials: {
          litApiBase: 'https://api.chipotle.litprotocol.com',
          litActionCid: 'QmAction123',
          litGroupId: '7',
          litPkpId: '0xpkp123',
        },
      },
    });

    const uploadResult = await uploadEncryptedArweaveData({
      data: 'hello chipotle doc',
      name: 'hello.txt',
      mime: 'text/plain',
      providerLike: uploaderProvider,
      account: uploaderSigner.address,
      chainId: 11155420,
      lit: uploaderHooks,
    });

    expect(uploadResult).toEqual(
      expect.objectContaining({
        txId: 'A'.repeat(43),
        url: expect.stringContaining('lit://arweave/'),
        arweaveUrl: 'https://arweave.example.test/' + 'A'.repeat(43),
        envelope: expect.any(String),
      }),
    );
    expect(stored.envelope).toBeTruthy();

    const { payload, txId } = await downloadEncryptedArweaveData({
      txId: uploadResult.txId,
      providerLike: viewerProvider,
      account: viewerSigner.address,
      chainId: 11155420,
      lit: viewerHooks,
    });

    expect(txId).toBe('A'.repeat(43));
    expect(decodeLitPayloadToText(payload)).toBe('hello chipotle doc');
    expect(mockUploadDataToArweave).toHaveBeenCalledTimes(1);
    expect(mockDownloadDataFromArweave).toHaveBeenCalledTimes(1);
    expect(mockFetchWorkerWithAuth).toHaveBeenCalledTimes(2);
  });
});
