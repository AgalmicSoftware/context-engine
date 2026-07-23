import {
  fetchWorkerCanonicalSessionBootstrap,
  WorkerSessionBootstrapRequestError,
  type WorkerCanonicalSessionBootstrap,
} from '../../utilities/session/sessionWorkerDiscovery';
import type { SessionSlugExistsArgs } from './sessionWizardTypes';

export type SessionWizardSlugAvailabilityCheck = (args: SessionSlugExistsArgs) => Promise<boolean>;

type WorkerBootstrapFetcher = (args: {
  sessionSlug: string;
  workerQueryValue: unknown;
}) => Promise<WorkerCanonicalSessionBootstrap>;

export const checkSessionWizardWorkerSlugExists = async ({
  workerUrl,
  slug,
  fetchBootstrap = fetchWorkerCanonicalSessionBootstrap,
}: {
  workerUrl: unknown;
  slug: string;
  fetchBootstrap?: WorkerBootstrapFetcher;
}): Promise<boolean> => {
  try {
    await fetchBootstrap({
      sessionSlug: slug,
      workerQueryValue: workerUrl,
    });
    return true;
  } catch (error) {
    if (
      error instanceof WorkerSessionBootstrapRequestError &&
      error.code === 'missing_config' &&
      error.status === 404
    ) {
      return false;
    }
    throw error;
  }
};

export const resolveSessionWizardSlugAvailabilityPort = ({
  isWorkerCanonical,
  registerSession,
  workerUrl,
  checkRegistrySlug,
  checkWorkerSlug,
}: {
  isWorkerCanonical: boolean;
  registerSession: boolean;
  workerUrl: unknown;
  checkRegistrySlug: SessionWizardSlugAvailabilityCheck;
  checkWorkerSlug: SessionWizardSlugAvailabilityCheck;
}): {
  enabled: boolean;
  source: 'none' | 'registry' | 'worker';
  sessionExists: SessionWizardSlugAvailabilityCheck;
} => {
  if (registerSession) {
    return {
      enabled: true,
      source: 'registry',
      sessionExists: checkRegistrySlug,
    };
  }
  if (isWorkerCanonical && String(workerUrl || '').trim()) {
    return {
      enabled: true,
      source: 'worker',
      sessionExists: checkWorkerSlug,
    };
  }
  return {
    enabled: false,
    source: 'none',
    sessionExists: checkWorkerSlug,
  };
};
