import { normalizeGatewayBase } from './arweaveUrls';

const ARWEAVE_GATEWAY_COOLDOWN_BASE_MS = 8 * 1000;
const ARWEAVE_GATEWAY_COOLDOWN_MAX_MS = 90 * 1000;
const ARWEAVE_GRAPHQL_COOLDOWN_BASE_MS = 30 * 1000;
const ARWEAVE_GRAPHQL_COOLDOWN_MAX_MS = 5 * 60 * 1000;

type EndpointHealth = {
  cooldownUntilMs: number;
  failures: number;
  lastStatus: number | null;
};

const arweaveGraphqlEndpointHealth = new Map<string, EndpointHealth>();
const arweaveGatewayHealth = new Map<string, EndpointHealth>();

const emptyHealth = (): EndpointHealth => ({ failures: 0, cooldownUntilMs: 0, lastStatus: null });

const readGraphqlEndpointHealth = (endpoint: unknown): EndpointHealth => {
  const key = String(endpoint || '').trim();
  if (!key) return emptyHealth();
  const raw = arweaveGraphqlEndpointHealth.get(key);
  if (!raw || typeof raw !== 'object') {
    return emptyHealth();
  }
  return {
    failures: Math.max(0, Number(raw.failures || 0)),
    cooldownUntilMs: Math.max(0, Number(raw.cooldownUntilMs || 0)),
    lastStatus: Number.isFinite(Number(raw.lastStatus)) ? Number(raw.lastStatus) : null,
  };
};

export const markGraphqlEndpointSuccess = (endpoint: unknown): void => {
  const key = String(endpoint || '').trim();
  if (!key) return;
  arweaveGraphqlEndpointHealth.set(key, {
    failures: 0,
    cooldownUntilMs: 0,
    lastStatus: 200,
  });
};

export const markGraphqlEndpointFailure = (endpoint: unknown, status: unknown = null): void => {
  const key = String(endpoint || '').trim();
  if (!key) return;
  const prev = readGraphqlEndpointHealth(key);
  const failures = Math.max(1, Number(prev.failures || 0) + 1);
  const exponent = Math.max(0, Math.min(8, failures - 1));
  const cooldownMs = Math.min(
    ARWEAVE_GRAPHQL_COOLDOWN_MAX_MS,
    Math.round(ARWEAVE_GRAPHQL_COOLDOWN_BASE_MS * Math.pow(2, exponent)),
  );
  arweaveGraphqlEndpointHealth.set(key, {
    failures,
    cooldownUntilMs: Date.now() + cooldownMs,
    lastStatus: Number.isFinite(Number(status)) ? Number(status) : null,
  });
};

export const isGraphqlEndpointCoolingDown = (endpoint: unknown): boolean => {
  const health = readGraphqlEndpointHealth(endpoint);
  return Number(health.cooldownUntilMs || 0) > Date.now();
};

export const getGraphqlEndpointSortScore = (endpoint: unknown): number => {
  const health = readGraphqlEndpointHealth(endpoint);
  const coolingDown = Number(health.cooldownUntilMs || 0) > Date.now();
  if (coolingDown) return Number.MAX_SAFE_INTEGER;
  return Math.max(0, Number(health.failures || 0));
};

const readGatewayHealth = (gateway: unknown): EndpointHealth => {
  const key = String(gateway || '').trim();
  if (!key) return emptyHealth();
  const raw = arweaveGatewayHealth.get(key);
  if (!raw || typeof raw !== 'object') {
    return emptyHealth();
  }
  return {
    failures: Math.max(0, Number(raw.failures || 0)),
    cooldownUntilMs: Math.max(0, Number(raw.cooldownUntilMs || 0)),
    lastStatus: Number.isFinite(Number(raw.lastStatus)) ? Number(raw.lastStatus) : null,
  };
};

export const markGatewaySuccess = (gateway: unknown): void => {
  const key = normalizeGatewayBase(gateway);
  if (!key) return;
  arweaveGatewayHealth.set(key, {
    failures: 0,
    cooldownUntilMs: 0,
    lastStatus: 200,
  });
};

const shouldGatewayCooldown = ({ status = null, kind = '' }: { kind?: unknown; status?: unknown } = {}): boolean => {
  const statusNum = Number(status);
  if (kind === 'network') return true;
  if (!Number.isFinite(statusNum)) return false;
  if (statusNum === 429 || statusNum === 425) return true;
  return statusNum >= 500;
};

export const markGatewayFailure = (
  gateway: unknown,
  { status = null, kind = '' }: { kind?: unknown; status?: unknown } = {},
): void => {
  const key = normalizeGatewayBase(gateway);
  if (!key) return;
  const statusNum = Number(status);
  const shouldCool = shouldGatewayCooldown({
    status: Number.isFinite(statusNum) ? statusNum : null,
    kind: String(kind || '')
      .trim()
      .toLowerCase(),
  });
  const prev = readGatewayHealth(key);
  if (!shouldCool) {
    arweaveGatewayHealth.set(key, {
      failures: Math.max(0, Number(prev.failures || 0)),
      cooldownUntilMs: Math.max(0, Number(prev.cooldownUntilMs || 0)),
      lastStatus: Number.isFinite(statusNum) ? statusNum : null,
    });
    return;
  }
  const failures = Math.max(1, Number(prev.failures || 0) + 1);
  const exponent = Math.max(0, Math.min(8, failures - 1));
  const cooldownMs = Math.min(
    ARWEAVE_GATEWAY_COOLDOWN_MAX_MS,
    Math.round(ARWEAVE_GATEWAY_COOLDOWN_BASE_MS * Math.pow(2, exponent)),
  );
  arweaveGatewayHealth.set(key, {
    failures,
    cooldownUntilMs: Date.now() + cooldownMs,
    lastStatus: Number.isFinite(statusNum) ? statusNum : null,
  });
};

const isGatewayCoolingDown = (gateway: unknown): boolean => {
  const key = normalizeGatewayBase(gateway);
  if (!key) return false;
  const health = readGatewayHealth(key);
  return Number(health.cooldownUntilMs || 0) > Date.now();
};

const getGatewaySortScore = (gateway: unknown): number => {
  const key = normalizeGatewayBase(gateway);
  if (!key) return Number.MAX_SAFE_INTEGER;
  const health = readGatewayHealth(key);
  const coolingDown = Number(health.cooldownUntilMs || 0) > Date.now();
  if (coolingDown) return Number.MAX_SAFE_INTEGER;
  return Math.max(0, Number(health.failures || 0));
};

const sortGatewaysByHealth = (gateways: unknown = []): unknown[] =>
  [...(Array.isArray(gateways) ? gateways : [])]
    .map((gateway, index) => ({
      gateway,
      index,
      score: getGatewaySortScore(gateway),
    }))
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return a.index - b.index;
    })
    .map((item) => item.gateway);

export const getAvailableGatewaysForAttempt = (gateways: unknown = []): unknown[] => {
  const ordered = sortGatewaysByHealth(gateways);
  const available = ordered.filter((gateway) => !isGatewayCoolingDown(gateway));
  return available.length ? available : ordered;
};
