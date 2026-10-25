import { uploadAudioForTranscription } from './aiClientTranscriptionWorkerTransport';
import { clearAllWorkerSessionTokens } from '../worker/workerAuth.js';
import store from '../../store.js';

const TEST_ADDRESS = '0x00000000000000000000000000000000000000aa';
const WORKER_URL = 'https://worker.example';
const ANONYMOUS_DENIAL = 'Anonymous access denied: AI/transcribe require open default+ai gates or a request apiKey.';
const mockSignMessage = jest.fn(async () => '0xfixture-signature');
const mockProviderRequest = jest.fn(async () => [TEST_ADDRESS]);

jest.mock('ethers', () => ({
  ethers: {
    providers: {
      Web3Provider: class {
        getSigner() {
          return { signMessage: mockSignMessage };
        }
      },
    },
  },
}));
jest.mock('../../store.js', () => ({
  __esModule: true,
  default: { getState: jest.fn() },
}));
jest.mock('../crypto/cryptography.js', () => ({
  cryptoUtils: { _getProvider: () => ({ request: mockProviderRequest }) },
}));
jest.mock('../worker/corsProxy.js', () => ({
  getCorsProxyUrlOrThrow: jest.fn(async () => WORKER_URL),
}));
jest.mock('../../variables/appConfig.js', () => ({ USE_ONCHAIN_SESSION_REGISTRY: true }));
jest.mock('../session/sessionRegistryReader.js', () => ({ getRegistrySessionConfig: () => null }));
jest.mock('../logging.js', () => ({
  createLogger: () => ({ log: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

const jsonResponse = (status, body) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => body,
  text: async () => JSON.stringify(body),
  clone: () => jsonResponse(status, body),
});

const upload = () =>
  uploadAudioForTranscription(new Blob(['fixture audio'], { type: 'audio/wav' }), {
    endpoint: `${WORKER_URL}/transcribe`,
    baseUrl: WORKER_URL,
    sessionSlug: 'audio-session',
    transcriptionCfg: { provider: 'openai', model: 'whisper-1' },
  });

describe('transcription through worker authentication', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    clearAllWorkerSessionTokens();
    localStorage.clear();
    store.getState.mockReturnValue({
      profile: { account: TEST_ADDRESS, provider: 'wagmi', network: { id: 11155420 } },
      sessionState: {},
    });
    mockProviderRequest.mockResolvedValue([TEST_ADDRESS]);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    clearAllWorkerSessionTokens();
  });

  it.each([false, true])('keeps open-session transcription anonymous (signed in: %s)', async (signedIn) => {
    if (!signedIn) {
      store.getState.mockReturnValue({ profile: {}, sessionState: {} });
      mockProviderRequest.mockResolvedValue([]);
    }
    global.fetch = jest.fn(async () => jsonResponse(200, { text: 'public transcript' }));

    await expect(upload()).resolves.toBe('public transcript');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(new Headers(global.fetch.mock.calls[0][1].headers).get('Authorization')).toBeNull();
    expect(mockProviderRequest).not.toHaveBeenCalled();
    expect(mockSignMessage).not.toHaveBeenCalled();
  });

  it('authenticates a signed-in holder after anonymous denial and reuses the session token', async () => {
    global.fetch = jest.fn(async (url, options) => {
      if (url.endsWith('/auth/nonce')) return jsonResponse(200, { nonce: 'fixture-nonce' });
      if (url.endsWith('/auth/login')) {
        return jsonResponse(200, { token: 'fixture-holder-token', exp: Math.floor(Date.now() / 1000) + 3600 });
      }
      return new Headers(options.headers).get('Authorization') === 'Bearer fixture-holder-token'
        ? jsonResponse(200, { text: 'session key transcript' })
        : jsonResponse(403, { error: ANONYMOUS_DENIAL });
    });

    await expect(upload()).resolves.toBe('session key transcript');
    await expect(upload()).resolves.toBe('session key transcript');

    const uploads = global.fetch.mock.calls.filter(([url]) => url.endsWith('/transcribe'));
    expect(uploads).toHaveLength(4);
    expect(uploads.map(([, options]) => new Headers(options.headers).get('Authorization'))).toEqual([
      null,
      'Bearer fixture-holder-token',
      null,
      'Bearer fixture-holder-token',
    ]);
    for (const [, options] of uploads) {
      expect(new Headers(options.headers).get('X-Group-Slug')).toBe('audio-session');
      expect(options.body.get('apiKey')).toBeNull();
      expect(options.body.get('file').size).toBeGreaterThan(0);
    }
    expect(uploads[0][1].body).toBe(uploads[1][1].body);
    expect(global.fetch.mock.calls.filter(([url]) => url.endsWith('/auth/login'))).toHaveLength(1);
    expect(mockSignMessage).toHaveBeenCalledTimes(1);
    expect(mockSignMessage).toHaveBeenCalledWith(
      expect.stringContaining('urn:context-engine:session:slug:audio-session'),
    );
  });

  it('keeps a signed-out gated-session denial without requesting wallet connection or a signature', async () => {
    store.getState.mockReturnValue({ profile: {}, sessionState: {} });
    mockProviderRequest.mockResolvedValue([]);
    global.fetch = jest.fn(async () => jsonResponse(403, { error: ANONYMOUS_DENIAL }));

    await expect(upload()).rejects.toThrow(ANONYMOUS_DENIAL);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(mockSignMessage).not.toHaveBeenCalled();
    expect(mockProviderRequest.mock.calls.map(([request]) => request.method)).not.toContain('eth_requestAccounts');
  });

  it('preserves terminal scope denial without requesting another signature', async () => {
    global.fetch = jest.fn(async (url, options) => {
      if (url.endsWith('/auth/nonce')) return jsonResponse(200, { nonce: 'fixture-nonce' });
      if (url.endsWith('/auth/login')) {
        return jsonResponse(200, { token: 'fixture-no-scope-token', exp: Math.floor(Date.now() / 1000) + 3600 });
      }
      return jsonResponse(403, {
        error: new Headers(options.headers).has('Authorization') ? 'Token missing transcribe scope' : ANONYMOUS_DENIAL,
      });
    });

    await expect(upload()).rejects.toThrow('Token missing transcribe scope');
    const uploads = global.fetch.mock.calls.filter(([url]) => url.endsWith('/transcribe'));
    expect(uploads.map(([, options]) => new Headers(options.headers).get('Authorization'))).toEqual([
      null,
      'Bearer fixture-no-scope-token',
    ]);
    expect(global.fetch.mock.calls.filter(([url]) => url.endsWith('/auth/login'))).toHaveLength(1);
    expect(mockSignMessage).toHaveBeenCalledTimes(1);

    await expect(upload()).rejects.toThrow('Token missing transcribe scope');
    expect(global.fetch.mock.calls.filter(([url]) => url.endsWith('/auth/login'))).toHaveLength(1);
    expect(mockSignMessage).toHaveBeenCalledTimes(1);
  });
});
