import { toStr } from '../../../utilities/shared/primitives.js';

export type RegistryWriteRecord = Record<string, unknown>;

export const isObj = (value: unknown): value is RegistryWriteRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const trimString = (value: unknown): string => toStr(value).trim();

export const cloneValue = <T = unknown>(value: T): T => {
  if (Array.isArray(value)) return value.map((entry) => cloneValue(entry)) as T;
  if (isObj(value)) {
    return Object.keys(value).reduce<RegistryWriteRecord>((acc, key) => {
      acc[key] = cloneValue(value[key]);
      return acc;
    }, {}) as T;
  }
  return (typeof value === 'string' ? value.trim() : value) as T;
};

// Stage-A compatibility mirrors: worker URL and browser read RPC discovery have not fully
// migrated to Worker KV yet, so new sessions keep explicit registry mirrors while metadata
// stops claiming authority.
export const SESSION_WIZARD_ONCHAIN_COMPAT_FIELD_PATHS = Object.freeze({
  corsWorkerUrl: ['corsWorkerUrl'],
  rpcUrl: ['rpc', 'providers', 'path', 'rpcUrl'],
});

export const buildSessionWizardRegistrySessionFields = ({
  onChainFields = {},
  sponsoredFields = {},
  compatibilityFieldPaths = SESSION_WIZARD_ONCHAIN_COMPAT_FIELD_PATHS,
}: {
  onChainFields?: RegistryWriteRecord;
  sponsoredFields?: RegistryWriteRecord;
  compatibilityFieldPaths?: Record<string, string[]>;
} = {}): RegistryWriteRecord => {
  const next: RegistryWriteRecord = {};
  const compatPaths = isObj(compatibilityFieldPaths) ? compatibilityFieldPaths : {};
  const rawOnChainFields = isObj(onChainFields) ? onChainFields : {};

  Object.keys(compatPaths).forEach((fieldKey) => {
    if (!Object.prototype.hasOwnProperty.call(rawOnChainFields, fieldKey)) return;
    const rawValue = rawOnChainFields[fieldKey];
    if (typeof rawValue === 'string') {
      next[fieldKey] = trimString(rawValue);
      return;
    }
    if (rawValue != null) {
      next[fieldKey] = cloneValue(rawValue);
    }
  });

  Object.entries(isObj(sponsoredFields) ? sponsoredFields : {}).forEach(([key, value]) => {
    const trimmed = trimString(value);
    if (trimmed) next[key] = trimmed;
  });

  return next;
};
