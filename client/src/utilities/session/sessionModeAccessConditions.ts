import type { SessionModeAccessConditionDocument } from './sessionModeProfileTypes';

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const trim = (value: unknown): string => String(value ?? '').trim();
const normalizeModeValue = (value: unknown): string => trim(value).toLowerCase();
const normalizeMatch = (value: unknown): 'any' | 'all' => (normalizeModeValue(value) === 'all' ? 'all' : 'any');
const normalizeRegistryChainId = (value: unknown): number | null => {
  const chainId = Number(value || 0);
  return Number.isFinite(chainId) && chainId > 0 ? chainId : null;
};

export const normalizeSessionModeAccessConditions = (value: unknown): SessionModeAccessConditionDocument | null => {
  const raw = isRecord(value) ? value : {};
  const conditions = Array.isArray(raw.conditions) ? raw.conditions : [];
  const normalized = conditions
    .filter(isRecord)
    .map((condition) => {
      const kind = normalizeModeValue(condition.kind);
      if (kind === 'worker_role') return { kind, role: trim(condition.role) };
      if (kind === 'sbt_onchain') {
        return {
          kind,
          chainId: normalizeRegistryChainId(condition.chainId || condition.networkChainId) || 0,
          contract: trim(condition.contract || condition.address),
          anyOrAll: normalizeMatch(condition.anyOrAll || condition.mode || condition.match),
        };
      }
      if (kind === 'agent_grant_scope') return { kind, scope: trim(condition.scope || condition.value) };
      return null;
    })
    .filter((condition): condition is SessionModeAccessConditionDocument['conditions'][number] => !!condition);
  return { match: normalizeMatch(raw.match), conditions: normalized };
};
