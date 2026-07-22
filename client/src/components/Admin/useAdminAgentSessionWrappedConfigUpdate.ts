import { useCallback, type Dispatch, type SetStateAction } from 'react';
import {
  adminSessionRegistryPorts,
  type AdminSessionRegistryEntry,
} from '../../domains/sessions/registry/sessionRegistryAdminPorts.js';
import {
  getCachedSessionWorkerConfig,
  upsertCachedSessionWorkerConfig,
} from '../../utilities/session/sessionWorkerConfigCache.js';
import { normalizeWorkerUrl } from './adminPageHelpers';
import { ensureAdminAgentSessionWrappedWorkerAttached } from './adminAgentSessionWrapped';

type AdminRecord = Record<string, unknown>;

const asRecord = (value: unknown): AdminRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as AdminRecord) : {};

export const useAdminAgentSessionWrappedConfigUpdate = ({
  selectedConfig,
  selectedSlug,
  setSessions,
  providerLike,
}: {
  selectedConfig: unknown;
  selectedSlug: string;
  setSessions: Dispatch<SetStateAction<AdminSessionRegistryEntry[]>>;
  providerLike?: unknown;
}) => {
  const handleConfigUpdated = useCallback(
    ({ configPatch, workerUrl }: { configPatch: AdminRecord; workerUrl: string }) => {
      const normalizedWorkerUrl = normalizeWorkerUrl(workerUrl);
      const existingCachedConfig = getCachedSessionWorkerConfig({
        slug: selectedSlug,
        sessionConfig: selectedConfig,
      });
      upsertCachedSessionWorkerConfig({
        slug: selectedSlug,
        sessionConfig: selectedConfig,
        config: {
          ...asRecord(existingCachedConfig),
          ...configPatch,
          corsWorkerUrl: normalizedWorkerUrl,
        },
      });
      setSessions((current) =>
        current.map(([entrySlug, config]) =>
          entrySlug === selectedSlug
            ? ([
                entrySlug,
                { ...asRecord(config), ...configPatch, corsWorkerUrl: normalizedWorkerUrl },
              ] as AdminSessionRegistryEntry)
            : ([entrySlug, config] as AdminSessionRegistryEntry),
        ),
      );
    },
    [selectedConfig, selectedSlug, setSessions],
  );

  const ensureSessionWorkerAttached = useCallback(
    ({ sessionWorkerUrl }: { sessionWorkerUrl: string }) =>
      ensureAdminAgentSessionWrappedWorkerAttached({
        buildRegistrySessionFields: adminSessionRegistryPorts.writes.buildRegistrySessionFields,
        providerLike,
        sessionConfig: selectedConfig,
        sessionSlug: selectedSlug,
        sessionWorkerUrl,
        setSessionFieldsOnChain: adminSessionRegistryPorts.writes.setSessionFieldsOnChain,
      }),
    [providerLike, selectedConfig, selectedSlug],
  );

  return { ensureSessionWorkerAttached, handleConfigUpdated };
};
