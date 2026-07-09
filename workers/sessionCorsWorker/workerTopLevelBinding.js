import rpcDefaults from '../../client/src/variables/rpcDefaults.js';
import {
  createWorkerRuntimeDepsWithWorkerDeps as createWorkerRuntimeDepsWithWorkerDepsBoundary,
} from './workerRuntimeDepsBinding.js';
import { resolveOpenAiTranscribeUrl } from './endpointConfig.js';

const { getPathRpcUrl } = rpcDefaults;

const SESSION_REGISTRY_ABI = [
  'function getResourceGate(string,string) view returns (address[] sbtAddresses, uint256 chainId, uint8 mode, uint256 perMemberLimit)',
  'function sessionExists(string) view returns (bool)',
  'function getSessionBySlug(string) view returns (string,uint256,string,string,address,uint256,uint256,bytes16)',
];
const ERC721_ABI = ['function balanceOf(address owner) view returns (uint256)'];
const SBT_ADMIN_ABI = ['function admin() view returns (address)', 'function owner() view returns (address)'];
const HATS_ABI = ['function isWearerOfHat(address wearer, uint256 hatId) view returns (bool)'];
const FAUCET_SBT_GATE_ABI = [
  'function hasPasswordMint() view returns (bool)',
  'function isPasswordValid(bytes32 hashedPassword) view returns (bool)',
  'function groupPasswordHash() view returns (bytes32)',
];

const TOKEN_TTL_SECONDS = 60 * 60 * 4;
const NONCE_TTL_SECONDS = 60 * 5;
const NONCE_RATE_LIMIT_MAX = 5;
const NONCE_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const NONCE_RATE_LIMIT_TTL_SECONDS = 60;
const USED_NONCE_TTL_SECONDS = 60 * 10;
const LOGIN_SIWE_MAX_AGE_MS = 5 * 60 * 1000;
const LOGIN_SIWE_FUTURE_SKEW_MS = 60 * 1000;
const DEFAULT_FAUCET_RPC_URL = getPathRpcUrl(11155420) || '';
const DEFAULT_FAUCET_AMOUNT_ETH = '0.0002';
const DEFAULT_FAUCET_BALANCE_THRESHOLD_ETH = '0.001';
const ZERO_BYTES32 = `0x${'0'.repeat(64)}`;

const SESSION_CONFIG_NOT_FOUND_ERROR = 'Session config not found.';
const BOOTSTRAP_SESSION_CONFIG_REQUIRED_ERROR =
  'Session config not found. Provide arweaveJwk for bootstrap uploads or register session config first.';

const RESOURCE_GATE_KEYS = ['default', 'ai', 'arweave', 'txGas', 'rpc', 'lit'];
const ANONYMOUS_RATE_ID_HEADER = 'X-Anonymous-Client-Id';
const ANONYMOUS_GATE_UNAVAILABLE_ERROR = 'Access denied: on-chain gate data unavailable.';
const ANONYMOUS_ROUTE_DENIED_ERROR = 'Anonymous access denied: AI/transcribe require open default+ai gates or a request apiKey.';
const ANONYMOUS_SCOPE_DISABLED_ERROR = 'Anonymous access denied: route scope disabled in session config.';

export const createWorkerTopLevelRuntimeWithWorkerDeps = ({
  deps,
  env,
} = {}) => {
  const createWorkerRuntimeDepsWithWorkerDeps = (
    deps?.createWorkerRuntimeDepsWithWorkerDeps ||
    createWorkerRuntimeDepsWithWorkerDepsBoundary
  );

  return createWorkerRuntimeDepsWithWorkerDeps({
    deps: {
      ethers: deps?.ethers,
      URL: deps?.URL,
      Headers: deps?.Headers,
      log: deps?.log,
      fetch: deps?.fetch,
      rpcFetch: deps?.rpcFetch,
      now: deps?.now,
    },
    constants: {
      OPENAI_TRANSCRIBE_URL: resolveOpenAiTranscribeUrl({ env }),
      SESSION_REGISTRY_ABI,
      ERC721_ABI,
      SBT_ADMIN_ABI,
      HATS_ABI,
      FAUCET_SBT_GATE_ABI,
      TOKEN_TTL_SECONDS,
      NONCE_TTL_SECONDS,
      NONCE_RATE_LIMIT_MAX,
      NONCE_RATE_LIMIT_WINDOW_MS,
      NONCE_RATE_LIMIT_TTL_SECONDS,
      USED_NONCE_TTL_SECONDS,
      LOGIN_SIWE_MAX_AGE_MS,
      LOGIN_SIWE_FUTURE_SKEW_MS,
      ZERO_BYTES32,
      RESOURCE_GATE_KEYS,
      ANONYMOUS_RATE_ID_HEADER,
      ANONYMOUS_GATE_UNAVAILABLE_ERROR,
      ANONYMOUS_ROUTE_DENIED_ERROR,
      ANONYMOUS_SCOPE_DISABLED_ERROR,
      SESSION_CONFIG_NOT_FOUND_ERROR,
      BOOTSTRAP_SESSION_CONFIG_REQUIRED_ERROR,
    },
    defaults: {
      DEFAULT_FAUCET_RPC_URL,
      DEFAULT_FAUCET_AMOUNT_ETH,
      DEFAULT_FAUCET_BALANCE_THRESHOLD_ETH,
    },
  });
};
