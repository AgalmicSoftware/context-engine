import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'util';

if (!global.TextEncoder) {
  global.TextEncoder = TextEncoder;
}

if (!global.TextDecoder) {
  global.TextDecoder = TextDecoder;
}

if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = () => ({
    fillRect: () => {},
    clearRect: () => {},
    getImageData: () => ({ data: [] }),
    putImageData: () => {},
    createImageData: () => [],
    setTransform: () => {},
    drawImage: () => {},
    save: () => {},
    fillText: () => {},
    restore: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    stroke: () => {},
    translate: () => {},
    scale: () => {},
    rotate: () => {},
    arc: () => {},
    fill: () => {},
    measureText: () => ({ width: 0 }),
    transform: () => {},
    rect: () => {},
    clip: () => {},
  });
}

jest.mock('./utilities/useWhisper.js', () => ({
  __esModule: true,
  RECORDING_STATUS: {
    IDLE: 'idle',
    REQUESTING_PERMISSION: 'requesting_permission',
    PERMISSION_DENIED: 'permission_denied',
    READY: 'ready',
    RECORDING: 'recording',
    PAUSED: 'paused',
    PROCESSING: 'processing',
    STREAMING: 'streaming',
    ERROR: 'error',
  },
  useWhisper: () => ({
    status: 'idle',
    isRecording: false,
    isPaused: false,
    isProcessing: false,
    isStreaming: false,
    transcript: { live: '', final: '' },
    errorMessage: '',
    startRecording: jest.fn(),
    stopRecording: jest.fn(),
    pauseRecording: jest.fn(),
    resumeRecording: jest.fn(),
    audioContextRef: { current: null },
    mediaStreamRef: { current: null },
    lastRecordingBlobRef: { current: { blob: null, mimeType: '' } },
    getLastRecordingBlob: jest.fn(() => null),
  }),
}));

jest.mock('d3', () => {
  const chain = () => {
    const fn = jest.fn();
    fn.domain = () => fn;
    fn.range = () => fn;
    fn.ticks = () => [];
    return fn;
  };
  return {
    __esModule: true,
    scaleLinear: chain,
    scaleOrdinal: chain,
    line: chain,
    polygonHull: jest.fn(() => null),
    min: jest.fn(() => 0),
    max: jest.fn(() => 0),
    schemeCategory10: [],
    schemeTableau10: [],
    color: jest.fn(),
  };
});

jest.mock('networkanalysis-ts', () => {
  class Network {
    constructor({ nNodes = 0 } = {}) {
      this._nNodes = nNodes;
    }

    createNormalizedNetworkUsingAssociationStrength() {
      return this;
    }

    getNNodes() {
      return this._nNodes;
    }
  }

  class Clustering {
    constructor({ nNodes = 0 } = {}) {
      this._nNodes = nNodes;
    }

    getCluster() {
      return 0;
    }
  }

  class LeidenAlgorithm {
    setResolution() {}
    setNIterations() {}
    improveClustering() {}
    calcQuality() {
      return 0;
    }
  }

  return {
    __esModule: true,
    Network,
    Clustering,
    LeidenAlgorithm,
  };
});

jest.mock('node:os', () => require('os'), { virtual: true });
jest.mock('node:events', () => require('events'), { virtual: true });

jest.mock('@lit-protocol/contracts', () => ({
  __esModule: true,
  datil: {},
  naga: {},
  nagaDev: {},
  nagaTest: {},
  nagaStaging: {},
  nagaProto: {},
  develop: {},
  datilSignatures: {},
  nagaSignatures: {},
  nagaDevSignatures: {},
  nagaTestSignatures: {},
  nagaStagingSignatures: {},
  nagaProtoSignatures: {},
  developSignatures: {},
}), { virtual: true });

jest.mock('@lit-protocol/networks', () => {
  const makeNetwork = (name, rpcUrl = `https://${name}.mock.lit`) => ({
    getNetworkName: () => name,
    getRpcUrl: () => rpcUrl,
    withOverrides: ({ rpcUrl: nextRpcUrl } = {}) => makeNetwork(name, nextRpcUrl || rpcUrl),
  });

  return {
    __esModule: true,
    nagaDev: makeNetwork('naga-dev'),
    nagaTest: makeNetwork('naga-test'),
    naga: makeNetwork('naga'),
  };
});

jest.mock('@lit-protocol/auth', () => ({
  __esModule: true,
  storagePlugins: {
    localStorage: jest.fn(() => ({
      config: {},
      read: async () => null,
      write: async () => {},
      writeInnerDelegationAuthSig: async () => {},
      readInnerDelegationAuthSig: async () => null,
      writePKPTokens: async () => {},
      readPKPTokens: async () => null,
    })),
  },
  createAuthManager: jest.fn(() => ({
    createEoaAuthContext: jest.fn(async ({ config }) => ({
      chain: 'ethereum',
      sessionKeyPair: { publicKey: 'mock-session-pub', secretKey: 'mock-session-secret' },
      authNeededCallback: async () => ({ sig: 'mock-sig' }),
      authConfig: {
        domain: 'localhost',
        statement: 'Authorize Lit session',
        expiration: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        resources: [],
        capabilityAuthSigs: [],
      },
      authData: {
        authMethodType: 1,
        accessToken: 'mock-access-token',
        authMethodId: 'mock-auth-method-id',
      },
      account: config?.account,
    })),
  })),
}));

jest.mock('@lit-protocol/lit-client', () => ({
  __esModule: true,
  createLitClient: jest.fn(async () => ({
    encrypt: async () => ({
      ciphertext: 'mock-ciphertext',
      dataToEncryptHash: 'mock-data-to-encrypt-hash',
    }),
    decrypt: async () => ({
      decryptedData: new Uint8Array(32),
    }),
    disconnect: () => {},
    getContext: async () => ({
      latestBlockhash: 'mock-blockhash',
    }),
  })),
}));
